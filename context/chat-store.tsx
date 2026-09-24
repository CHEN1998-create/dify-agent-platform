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

const SESSIONS_KEY = "agent-studio:chat-sessions:v1";
const MESSAGES_KEY = "agent-studio:chat-messages:v1";
const ChatStoreContext = createContext<ChatStoreValue | undefined>(undefined);

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

  const [sessions, setSessions] = useState<ChatSession[]>(() =>
    load<ChatSession[]>(SESSIONS_KEY) ?? []
  );
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    load<ChatMessage[]>(MESSAGES_KEY) ?? []
  );
  const [sendingSessionId, setSendingSessionId] = useState<string | null>(null);

  useEffect(() => save(SESSIONS_KEY, sessions), [sessions]);
  useEffect(() => save(MESSAGES_KEY, messages), [messages]);

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
      if (agent?.systemPrompt) {
        apiMessages.push({ role: "system", content: agent.systemPrompt });
      }
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
            model: agent?.model ?? "deepseek-chat",
            temperature: agent?.temperature ?? 0.7,
            maxTokens: agent?.maxTokens ?? 2048,
          }),
        });

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
