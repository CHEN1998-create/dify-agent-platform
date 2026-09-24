"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  ReactNode,
} from "react";
import { useAgentStore } from "@/context/agent-store";
import { useToast } from "@/components/ui/toast";
import { DEFAULT_MODEL } from "@/lib/models";
import { useAuth } from "@/context/auth-context";
import { useKnowledgeStore, type KbChunk } from "@/context/knowledge-store";
import { createClient } from "@/lib/supabase/client";

export interface ChatSession {
  id: string;
  agentId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

/** 单条知识库命中（可解释：来自哪个文档的第几个片段） */
export interface KbHit {
  docName: string;
  chunkIndex: number;
  snippet: string;
}

/** 一次对话的知识库检索信息（挂在 assistant 消息上，用于 UI 展示） */
export interface KbInfo {
  enabled: boolean;
  /** 从用户消息提取的检索关键词 */
  keywords: string[];
  /** 命中片段数（可为 0，表示检索了但没命中） */
  hitCount: number;
  /** 本次参与检索的片段总数（0 = 知识库为空，用于诊断） */
  totalChunks: number;
  hits: KbHit[];
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  /** 知识库检索信息（仅 assistant 消息、且智能体开启知识库时存在） */
  kbInfo?: KbInfo;
}

/** onRun 回调携带的真实 LLM 调用结果 */
export interface OnRunResult {
  status: "success" | "error" | "timeout";
  latencyMs: number;
  promptTokens: number;
  completionTokens: number;
  errorMessage?: string;
  /** 知识库命中片段数（未开启/未命中为 undefined 或 0） */
  kbHitCount?: number;
  /** 命中的文档名（顿号分隔，用于日志页展示） */
  kbDocNames?: string;
}

interface ChatStoreValue {
  sessions: ChatSession[];
  messages: ChatMessage[];
  loading: boolean;
  createSession: (agentId: string, title?: string) => Promise<ChatSession>;
  deleteSession: (sessionId: string) => Promise<void>;
  renameSession: (sessionId: string, title: string) => Promise<void>;
  getSession: (sessionId: string) => ChatSession | undefined;
  getSessionMessages: (sessionId: string) => ChatMessage[];
  sendMessage: (
    sessionId: string,
    content: string
  ) => Promise<{ userMsg: ChatMessage; reply: ChatMessage }>;
  deleteMessages: (sessionId: string) => Promise<void>;
  /** 当前是否有 API 调用在进行中（发送中的会话 ID） */
  sendingSessionId: string | null;
}

const ChatStoreContext = createContext<ChatStoreValue | undefined>(undefined);

function uid(prefix = "id") {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function fmtTime() {
  const d = new Date();
  return d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "刚刚";
  if (m < 60) return `${m} 分钟前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} 小时前`;
  return Math.floor(h / 24) + " 天前";
}

/** DB 行 → 前端 ChatSession */
function rowToSession(row: Record<string, unknown>): ChatSession {
  return {
    id: row.id as string,
    agentId: (row.agent_id as string) || "",
    title: (row.title as string) || "新会话",
    createdAt: (row.created_at as string) ?? new Date().toISOString(),
    updatedAt: (row.updated_at as string) ?? new Date().toISOString(),
  };
}

/** DB 行 → 前端 ChatMessage */
function rowToMessage(row: Record<string, unknown>): ChatMessage {
  // kb_meta 为 jsonb 列（未跑迁移 SQL 时为 undefined）
  const kbMeta = row.kb_meta as
    | { keywords?: string[]; hitCount?: number; totalChunks?: number; hits?: KbHit[] }
    | null
    | undefined;
  return {
    id: row.id as string,
    sessionId: (row.session_id as string) || "",
    role: (row.role as "user" | "assistant") || "user",
    content: (row.content as string) || "",
    createdAt: (row.created_at as string) ?? new Date().toISOString(),
    kbInfo: kbMeta
      ? {
          enabled: true,
          keywords: kbMeta.keywords ?? [],
          hitCount: kbMeta.hitCount ?? 0,
          totalChunks: kbMeta.totalChunks ?? 0,
          hits: kbMeta.hits ?? [],
        }
      : undefined,
  };
}

// ============ 知识库关键词检索（MVP，不用 embedding） ============

/** 中英文常见停用词 —— 简单过滤不参与匹配 */
const STOPWORDS = new Set([
  "的", "了", "是", "在", "和", "与", "或", "不", "也", "都", "就", "要", "会",
  "我", "你", "他", "她", "它", "我们", "你们", "他们",
  "什么", "怎么", "为什么", "如何", "哪", "哪些", "请", "帮我", "一下",
  "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
  "do", "does", "did", "have", "has", "had", "will", "would", "can", "could",
  "should", "may", "might", "must", "shall",
  "i", "you", "he", "she", "it", "we", "they", "me", "him", "her", "us", "them",
  "what", "how", "why", "where", "when", "who", "please", "help",
]);

/** 单字停用词（用于过滤中文 2-gram 中的虚词组合） */
const SINGLE_CHAR_STOPWORDS = new Set(
  Array.from(STOPWORDS).filter((w) => w.length === 1)
);

function hasCJK(s: string): boolean {
  return /[\u4e00-\u9fff]/.test(s);
}

/**
 * 从用户消息提取关键词。
 * 英文按空格/标点切分；中文没有词边界，整句直接匹配永远命中不了，
 * 所以对中文串滑窗切 2-gram（过滤含单字停用词/疑问词的组合）——MVP 无词典分词方案。
 */
function extractKeywords(text: string): string[] {
  const tokens = text
    .toLowerCase()
    .split(/[\s.,;:!?。，；：！？、…\-—_'"""''（）()【】\[\]《》<>/\\|=+*#@$%^&~`0-9]+/)
    .map((t) => t.trim())
    .filter(Boolean);

  const keywords: string[] = [];
  for (const token of tokens) {
    if (!hasCJK(token)) {
      // 英文 token：保持原有长度过滤 + 停用词过滤
      if (token.length >= 2 && token.length <= 20 && !STOPWORDS.has(token)) {
        keywords.push(token);
      }
      continue;
    }
    if (token.length === 2) {
      // 恰好两字的中文词直接作为关键词
      if (
        !STOPWORDS.has(token) &&
        !SINGLE_CHAR_STOPWORDS.has(token[0]) &&
        !SINGLE_CHAR_STOPWORDS.has(token[1])
      ) {
        keywords.push(token);
      }
      continue;
    }
    // 更长的中文串：滑窗切 2-gram
    for (let i = 0; i < token.length - 1; i++) {
      const gram = token.slice(i, i + 2);
      if (STOPWORDS.has(gram)) continue;
      if (
        SINGLE_CHAR_STOPWORDS.has(gram[0]) ||
        SINGLE_CHAR_STOPWORDS.has(gram[1])
      ) {
        continue;
      }
      keywords.push(gram);
    }
  }
  // 去重 + 限制数量（防止超长提问产生过多 gram）
  return Array.from(new Set(keywords)).slice(0, 24);
}

/** 一次检索的完整结果（关键词 + 命中片段，用于链路展示） */
interface KbRetrievalResult {
  keywords: string[];
  hits: KbHit[];
  totalChunks: number;
}

/** 在 chunks 里做关键词匹配，返回 top N 命中片段（带来源） */
function retrieveKnowledge(query: string, chunks: KbChunk[], topN = 3): KbRetrievalResult {
  const keywords = extractKeywords(query);
  if (keywords.length === 0 || chunks.length === 0) {
    return { keywords, hits: [], totalChunks: chunks.length };
  }

  const scored = chunks
    .map((c) => {
      const hits = keywords.filter((kw) => c.chunk.toLowerCase().includes(kw)).length;
      return { docName: c.docName, chunkIndex: c.chunkIndex, snippet: c.chunk, hits };
    })
    .filter((c) => c.hits > 0)
    .sort((a, b) => b.hits - a.hits)
    .slice(0, topN);

  return {
    keywords,
    hits: scored.map(({ docName, chunkIndex, snippet }) => ({ docName, chunkIndex, snippet })),
    totalChunks: chunks.length,
  };
}

/** 把命中片段拼到 system prompt 后面 */
function injectToSystemPrompt(systemPrompt: string, hits: KbHit[]): string {
  if (hits.length === 0) return systemPrompt;
  const body = hits
    .map((h, i) => `[${i + 1}]（来源：${h.docName} 片段#${h.chunkIndex + 1}）${h.snippet}`)
    .join("\n\n");
  return `${systemPrompt}\n\n---\n参考资料（请优先使用以下内容回答）：\n${body}`;
}

interface ChatProviderProps {
  children: ReactNode;
  /** 每次 LLM 调用完成后回调（用于写入 run_logs） */
  onRun?: (
    agentId: string,
    sessionId: string,
    model: string,
    agentName: string,
    result: OnRunResult
  ) => Promise<void> | void;
}

export function ChatProvider({ children, onRun }: ChatProviderProps) {
  const { getAgent } = useAgentStore();
  const { toast } = useToast();
  const { user } = useAuth();
  const { getAllChunks } = useKnowledgeStore();
  const userId = user?.id ?? null;

  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sendingSessionId, setSendingSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // userId 变化 → 从 Supabase 加载 sessions + messages
  useEffect(() => {
    if (!userId) {
      setSessions([]);
      setMessages([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const supabase = createClient();
        const [sessRes, msgRes] = await Promise.all([
          supabase
            .from("chat_sessions")
            .select("*")
            .eq("user_id", userId)
            .order("updated_at", { ascending: false }),
          supabase
            .from("chat_messages")
            .select("*")
            .eq("user_id", userId)
            .order("created_at", { ascending: true }),
        ]);

        if (cancelled) return;
        if (sessRes.error) {
          console.error("加载会话失败:", sessRes.error.message);
          setSessions([]);
        } else {
          setSessions((sessRes.data ?? []).map(rowToSession));
        }
        if (msgRes.error) {
          console.error("加载消息失败:", msgRes.error.message);
          setMessages([]);
        } else {
          setMessages((msgRes.data ?? []).map(rowToMessage));
        }
      } catch (err) {
        console.error("加载对话数据异常:", err);
        if (!cancelled) {
          setSessions([]);
          setMessages([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const createSession = useCallback(
    async (agentId: string, title?: string): Promise<ChatSession> => {
      const now = new Date().toISOString();
      const agentName = getAgent(agentId)?.name ?? "智能体";
      const id = uid("sess");

      const supabase = createClient();
      const { data, error } = await supabase
        .from("chat_sessions")
        .insert({
          id,
          user_id: userId,
          agent_id: agentId,
          title: title ?? `新会话 · ${agentName}`,
          created_at: now,
          updated_at: now,
        })
        .select("*")
        .single();

      if (error) throw new Error(`创建会话失败: ${error.message}`);

      const session = rowToSession(data!);
      setSessions((prev) => [session, ...prev]);
      return session;
    },
    [getAgent, userId]
  );

  const deleteSession = useCallback(
    async (id: string): Promise<void> => {
      const supabase = createClient();
      // 先删消息，再删会话
      const [, sessErr] = await Promise.all([
        supabase.from("chat_messages").delete().eq("session_id", id),
        supabase
          .from("chat_sessions")
          .delete()
          .eq("id", id)
          .eq("user_id", userId!),
      ]);

      const err = sessErr as { message?: string } | null;
      if (err?.message) throw new Error(`删除会话失败: ${err.message}`);

      setSessions((prev) => prev.filter((s) => s.id !== id));
      setMessages((prev) => prev.filter((m) => m.sessionId !== id));
    },
    [userId]
  );

  const renameSession = useCallback(
    async (id: string, title: string): Promise<void> => {
      const now = new Date().toISOString();
      const supabase = createClient();
      const { error } = await supabase
        .from("chat_sessions")
        .update({ title, updated_at: now })
        .eq("id", id)
        .eq("user_id", userId!);

      if (error) throw new Error(`重命名会话失败: ${error.message}`);

      setSessions((prev) =>
        prev.map((s) => (s.id === id ? { ...s, title, updatedAt: now } : s))
      );
    },
    [userId]
  );

  const getSession = useCallback(
    (id: string) => sessions.find((s) => s.id === id),
    [sessions]
  );

  const getSessionMessages = useCallback(
    (id: string) =>
      messages
        .filter((m) => m.sessionId === id)
        .sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        ),
    [messages]
  );

  const deleteMessages = useCallback(
    async (sessionId: string): Promise<void> => {
      const supabase = createClient();
      const { error } = await supabase
        .from("chat_messages")
        .delete()
        .eq("session_id", sessionId)
        .eq("user_id", userId!);

      if (error) throw new Error(`清空消息失败: ${error.message}`);

      setMessages((prev) => prev.filter((m) => m.sessionId !== sessionId));
    },
    [userId]
  );

  const sendMessage = useCallback(
    async (
      sessionId: string,
      content: string
    ): Promise<{ userMsg: ChatMessage; reply: ChatMessage }> => {
      const trimmed = content.trim();
      if (!trimmed) throw new Error("消息不能为空");

      // 防止重复发送
      if (sendingSessionId === sessionId) {
        throw new Error("正在等待上一条回复，请稍候");
      }

      const now = new Date().toISOString();
      const session = sessions.find((s) => s.id === sessionId);
      if (!session) throw new Error("会话不存在");

      const agent = getAgent(session.agentId);
      const agentName = agent?.name ?? "智能体";

      // 1. 乐观插入用户消息（本地立即显示），同时持久化到 Supabase
      const userMsg: ChatMessage = {
        id: uid("m"),
        sessionId,
        role: "user",
        content: trimmed,
        createdAt: now,
      };
      setMessages((prev) => [...prev, userMsg]);

      // 持久化用户消息（确保持久化成功后再调 LLM）
      const supabase = createClient();
      const { error: userMsgErr } = await supabase.from("chat_messages").insert({
        id: userMsg.id,
        session_id: sessionId,
        user_id: userId,
        role: "user",
        content: trimmed,
        created_at: now,
      });
      if (userMsgErr) {
        toast("消息保存失败", {
          description: userMsgErr.message,
          variant: "error",
        });
        throw new Error(`保存用户消息失败: ${userMsgErr.message}`);
      }

      // 更新 session updatedAt + 自动标题（第一条消息）
      const isFirstMsg = !messages.some((m) => m.sessionId === sessionId);
      const newTitle = isFirstMsg ? trimmed.slice(0, 30) : session.title;
      setSessions((prev) =>
        prev.map((s) =>
          s.id === sessionId
            ? { ...s, updatedAt: now, title: newTitle }
            : s
        )
      );
      // session 更新 fire-and-forget（标题/时间丢失可接受）
      supabase
        .from("chat_sessions")
        .update({ updated_at: now, title: newTitle })
        .eq("id", sessionId)
        .eq("user_id", userId!)
        .then(({ error: e }) => {
          if (e) console.error("更新会话失败:", e.message);
        });

      // 2. 构造传给 LLM 的消息（system prompt + 历史 + 当前 user）
      const historyMsgs = messages
        .filter((m) => m.sessionId === sessionId)
        .sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        )
        .map((m) => ({ role: m.role, content: m.content }));

      const apiMessages: { role: string; content: string }[] = [];
      // 知识库检索：仅当智能体开启知识库开关时，先检索再注入 system prompt；
      // 关闭时按普通对话模式响应（不检索、不注入）
      const kbEnabled = agent?.knowledgeEnabled === true;
      let kbRetrieval: KbRetrievalResult = { keywords: [], hits: [], totalChunks: 0 };
      if (kbEnabled) {
        kbRetrieval = retrieveKnowledge(trimmed, getAllChunks(), 3);
      }
      const effectiveSystemPrompt = injectToSystemPrompt(
        agent?.systemPrompt ?? "你是一个有帮助的 AI 助手。",
        kbRetrieval.hits
      );
      // 挂到 assistant 消息上，供对话 UI 展示检索链路（含未命中情况）
      const kbInfo: KbInfo | undefined = kbEnabled
        ? {
            enabled: true,
            keywords: kbRetrieval.keywords,
            hitCount: kbRetrieval.hits.length,
            totalChunks: kbRetrieval.totalChunks,
            hits: kbRetrieval.hits,
          }
        : undefined;
      apiMessages.push({ role: "system", content: effectiveSystemPrompt });
      apiMessages.push(...historyMsgs);
      apiMessages.push({ role: "user", content: trimmed });

      setSendingSessionId(sessionId);

      let replyContent = "";
      let llmResult: OnRunResult = {
        status: "error",
        latencyMs: 0,
        promptTokens: 0,
        completionTokens: 0,
        errorMessage: "",
      };

      try {
        // 3. 调 API route → 服务端代理 → 真实 LLM
        const resp = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: apiMessages,
            model: agent?.model ?? DEFAULT_MODEL,
            temperature: agent?.temperature ?? 0.7,
            maxTokens: agent?.maxTokens ?? 2048,
          }),
        });

        if (resp.status === 401) {
          toast("请先登录", { description: "登录后才能使用 AI 对话", variant: "error" });
          setSendingSessionId(null);
          throw new Error("AUTH_REQUIRED");
        }

        if (!resp.ok) {
          throw new Error(`HTTP ${resp.status} ${resp.statusText}`);
        }

        const data = await resp.json();
        replyContent = data.content ?? "";
        llmResult = {
          status: data.status ?? "error",
          latencyMs: data.latencyMs ?? 0,
          promptTokens: data.promptTokens ?? 0,
          completionTokens: data.completionTokens ?? 0,
          errorMessage: data.errorMessage,
        };
      } catch (err: unknown) {
        if (err instanceof Error && err.message === "AUTH_REQUIRED") {
          throw err;
        }
        const msg = err instanceof Error ? err.message : String(err);
        llmResult = {
          status: "error",
          latencyMs: 0,
          promptTokens: 0,
          completionTokens: 0,
          errorMessage: msg,
        };
        replyContent = `⚠️ 无法连接到 AI 服务：${msg}`;
      } finally {
        setSendingSessionId(null);
      }

      // 4. 插入 AI 回复
      if (!replyContent) {
        replyContent =
          llmResult.status === "timeout"
            ? "⏱️ AI 回复超时，请稍后重试"
            : llmResult.status === "error"
            ? `❌ AI 服务出错：${llmResult.errorMessage ?? "未知错误"}`
            : "（AI 返回了空内容）";
      }

      const reply: ChatMessage = {
        id: uid("m"),
        sessionId,
        role: "assistant",
        content: replyContent,
        createdAt: new Date().toISOString(),
        kbInfo,
      };
      setMessages((prev) => [...prev, reply]);

      // 知识库命中信息附加到 llmResult，供上层写入 run_logs（链路可解释）
      if (kbInfo) {
        llmResult.kbHitCount = kbInfo.hitCount;
        const docNames = Array.from(new Set(kbInfo.hits.map((h) => h.docName)));
        if (docNames.length > 0) llmResult.kbDocNames = docNames.join("、");
      }

      // 持久化 AI 回复（开启知识库时附带 kb_meta，刷新后检索链路仍可见）
      const baseRow = {
        id: reply.id,
        session_id: sessionId,
        user_id: userId,
        role: "assistant" as const,
        content: replyContent,
        created_at: reply.createdAt,
      };
      const { error: replyErr } = await supabase.from("chat_messages").insert({
        ...baseRow,
        // kb_meta 为 jsonb 列；未开启知识库时存 null
        kb_meta: kbInfo
          ? {
              keywords: kbInfo.keywords,
              hitCount: kbInfo.hitCount,
              totalChunks: kbInfo.totalChunks,
              hits: kbInfo.hits,
            }
          : null,
      });
      if (replyErr) {
        // 未跑迁移 SQL（kb_meta 列不存在）时降级：不带 kb_meta 重试，保证消息不丢
        if (kbInfo && /kb_meta|schema cache|column/i.test(replyErr.message)) {
          const { error: retryErr } = await supabase
            .from("chat_messages")
            .insert(baseRow);
          if (retryErr) {
            toast("AI 回复保存失败", {
              description: retryErr.message,
              variant: "error",
            });
          }
        } else {
          toast("AI 回复保存失败", {
            description: replyErr.message,
            variant: "error",
          });
        }
      }

      // 5. 回调：让上层写入 run_logs（真实数据）
      if (onRun && agent) {
        try {
          await onRun(agent.id, sessionId, agent.model, agentName, llmResult);
        } catch {
          /* 日志写入失败不影响对话 */
        }
      }

      return { userMsg, reply };
    },
    [messages, sessions, getAgent, onRun, sendingSessionId, getAllChunks, toast, userId]
  );

  const value = useMemo<ChatStoreValue>(
    () => ({
      sessions: sessions
        .slice()
        .sort(
          (a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        ),
      messages,
      loading,
      createSession,
      deleteSession,
      renameSession,
      getSession,
      getSessionMessages,
      sendMessage,
      deleteMessages,
      sendingSessionId,
    }),
    [
      sessions,
      messages,
      loading,
      createSession,
      deleteSession,
      renameSession,
      getSession,
      getSessionMessages,
      sendMessage,
      deleteMessages,
      sendingSessionId,
    ]
  );

  return (
    <ChatStoreContext.Provider value={value}>{children}</ChatStoreContext.Provider>
  );
}

export function useChatStore() {
  const ctx = useContext(ChatStoreContext);
  if (!ctx) throw new Error("useChatStore 必须在 ChatProvider 内");
  return ctx;
}

export { timeAgo, fmtTime };
