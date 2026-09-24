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
import { useKnowledgeStore } from "@/context/knowledge-store";

export interface ChatSession {
  id: string;
  agentId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

/** onRun 回调携带的真实 LLM 调用结果 */
export interface OnRunResult {
  status: "success" | "error" | "timeout";
  latencyMs: number;
  promptTokens: number;
  completionTokens: number;
  errorMessage?: string;
}

interface ChatStoreValue {
  sessions: ChatSession[];
  messages: ChatMessage[];
  createSession: (agentId: string, title?: string) => ChatSession;
  deleteSession: (sessionId: string) => void;
  renameSession: (sessionId: string, title: string) => void;
  getSession: (sessionId: string) => ChatSession | undefined;
  getSessionMessages: (sessionId: string) => ChatMessage[];
  sendMessage: (
    sessionId: string,
    content: string
  ) => Promise<{ userMsg: ChatMessage; reply: ChatMessage }>;
  deleteMessages: (sessionId: string) => void;
  /** 当前是否有 API 调用在进行中（发送中的会话 ID） */
  sendingSessionId: string | null;
}

const ChatStoreContext = createContext<ChatStoreValue | undefined>(undefined);

function sessionsKey(userId: string | null) {
  return `agent-studio:chat-sessions:${userId ?? "anon"}:v1`;
}
function messagesKey(userId: string | null) {
  return `agent-studio:chat-messages:${userId ?? "anon"}:v1`;
}

function uid(prefix = "id") {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function load<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function save(key: string, data: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(data));
  } catch {
    /* quota */
  }
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

/** 从用户消息提取关键词（去停用词 + 2~20 字符） */
function extractKeywords(text: string): string[] {
  // 按中英文标点 + 空白切
  const tokens = text
    .toLowerCase()
    .split(/[\s.,;:!?。，；：！？、…\-—_'"""''（）()【】\[\]《》<>/\\|=+*#@$%^&~`0-9]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && t.length <= 20 && !STOPWORDS.has(t));
  return Array.from(new Set(tokens)); // 去重
}

/** 在 chunks 里做关键词匹配，返回 top N 命中片段 */
function retrieveChunks(query: string, chunks: string[], topN = 3): string[] {
  const keywords = extractKeywords(query);
  if (keywords.length === 0 || chunks.length === 0) return [];

  // 每个 chunk 统计命中的关键词数量
  const scored = chunks
    .map((chunk) => {
      const hits = keywords.filter((kw) => chunk.toLowerCase().includes(kw)).length;
      return { chunk, hits };
    })
    .filter((c) => c.hits > 0)
    .sort((a, b) => b.hits - a.hits)
    .slice(0, topN);

  return scored.map((s) => s.chunk);
}

/** 把命中片段拼到 system prompt 后面 */
function injectToSystemPrompt(systemPrompt: string, snippets: string[]): string {
  if (snippets.length === 0) return systemPrompt;
  const body = snippets.map((s, i) => `[${i + 1}] ${s}`).join("\n\n");
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
  ) => void;
}

export function ChatProvider({ children, onRun }: ChatProviderProps) {
  // 从 agent-store 拿 agent 配置（systemPrompt/model/temperature/maxTokens）
  const { getAgent } = useAgentStore();
  const { toast } = useToast();
  const { user } = useAuth();
  const { getAllChunks } = useKnowledgeStore();
  const userId = user?.id ?? null;

  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sendingSessionId, setSendingSessionId] = useState<string | null>(null);

  // userId 变化 → 加载对应用户的数据
  useEffect(() => {
    setSessions(load<ChatSession[]>(sessionsKey(userId)) ?? []);
    setMessages(load<ChatMessage[]>(messagesKey(userId)) ?? []);
  }, [userId]);

  // 持久化（未登录时跳过）
  useEffect(() => {
    if (!userId) return;
    save(sessionsKey(userId), sessions);
  }, [sessions, userId]);
  useEffect(() => {
    if (!userId) return;
    save(messagesKey(userId), messages);
  }, [messages, userId]);

  const createSession = useCallback(
    (agentId: string, title?: string): ChatSession => {
      const now = new Date().toISOString();
      const agentName = getAgent(agentId)?.name ?? "智能体";
      const session: ChatSession = {
        id: uid("sess"),
        agentId,
        title: title ?? `新会话 · ${agentName}`,
        createdAt: now,
        updatedAt: now,
      };
      setSessions((prev) => [session, ...prev]);
      return session;
    },
    [getAgent]
  );

  const deleteSession = useCallback((id: string) => {
    setSessions((prev) => prev.filter((s) => s.id !== id));
    setMessages((prev) => prev.filter((m) => m.sessionId !== id));
  }, []);

  const renameSession = useCallback((id: string, title: string) => {
    setSessions((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, title, updatedAt: new Date().toISOString() } : s
      )
    );
  }, []);

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

  const deleteMessages = useCallback((sessionId: string) => {
    setMessages((prev) => prev.filter((m) => m.sessionId !== sessionId));
  }, []);

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

      // 1. 先插入用户消息
      const userMsg: ChatMessage = {
        id: uid("m"),
        sessionId,
        role: "user",
        content: trimmed,
        createdAt: now,
      };
      setMessages((prev) => [...prev, userMsg]);

      // 更新 session updatedAt + 自动标题（第一条消息）
      setSessions((prev) =>
        prev.map((s) => {
          if (s.id !== sessionId) return s;
          const isFirstMsg = !messages.some(
            (m) => m.sessionId === sessionId
          );
          return {
            ...s,
            updatedAt: now,
            title: isFirstMsg ? trimmed.slice(0, 30) : s.title,
          };
        })
      );

      // 2. 构造传给 LLM 的消息（system prompt + 历史 + 当前 user）
      const historyMsgs = messages
        .filter((m) => m.sessionId === sessionId)
        .sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        )
        .map((m) => ({ role: m.role, content: m.content }));

      const apiMessages: { role: string; content: string }[] = [];
      // 知识库检索：从用户消息提取关键词 → 匹配 chunks → 注入 system prompt
      const kbChunks = getAllChunks();
      const kbHits = retrieveChunks(trimmed, kbChunks, 3);
      const effectiveSystemPrompt = injectToSystemPrompt(
        agent?.systemPrompt ?? "你是一个有帮助的 AI 助手。",
        kbHits
      );
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
          // 鉴权失败 —— toast 提示，不插入 AI 回复，不写日志
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
        // 401 已经 toast 并 early return 过了，这里 skip
        if (err instanceof Error && err.message === "AUTH_REQUIRED") {
          throw err; // 重新抛出，让调用方知道发送失败
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
      };
      setMessages((prev) => [...prev, reply]);

      // 5. 回调：让上层写入 run_logs（真实数据）
      if (onRun && agent) {
        try {
          onRun(agent.id, sessionId, agent.model, agentName, llmResult);
        } catch {
          /* 日志写入失败不影响对话 */
        }
      }

      return { userMsg, reply };
    },
    [messages, sessions, getAgent, onRun, sendingSessionId]
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
      sendingSessionId,
      createSession,
      deleteSession,
      renameSession,
      getSession,
      getSessionMessages,
      sendMessage,
      deleteMessages,
    }),
    [
      sessions,
      messages,
      sendingSessionId,
      createSession,
      deleteSession,
      renameSession,
      getSession,
      getSessionMessages,
      sendMessage,
      deleteMessages,
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
