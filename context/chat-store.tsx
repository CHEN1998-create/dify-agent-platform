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
import { agents as seedAgents } from "@/lib/mock";

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

// Mock AI 回复生成器 —— 模拟智能体回应
function mockReply(agentName: string, userMessage: string): string {
  const greetings = ["你好", "hi", "hello", "在吗"];
  const clean = userMessage.trim().toLowerCase();

  if (greetings.some((g) => clean.includes(g))) {
    return `你好！我是 ${agentName}，很高兴为你服务。有什么我可以帮你的？`;
  }

  if (clean.includes("写") || clean.includes("帮我")) {
    return `好的，我来帮你处理这个需求。\n\n关于「${userMessage.slice(0, 50)}${userMessage.length > 50 ? "..." : ""}」，我的建议是：\n\n1. 先明确目标和受众\n2. 列出关键点\n3. 组织成清晰的结构\n\n你希望我先从哪方面开始？`;
  }

  if (clean.includes("总结") || clean.includes("概括")) {
    return `好的，以下是核心要点：\n\n• 明确问题的本质\n• 列出关键约束条件\n• 设计可验证的方案\n• 执行后收集反馈迭代`;
  }

  return `收到！关于「${userMessage.slice(0, 30)}${userMessage.length > 30 ? "..." : ""}」，我的理解是你想得到一些帮助。\n\n当前是 mock 模式，接入真实 LLM 后我会给出更精准的回复。你可以继续追问，或者切换其他智能体试试。`;
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const [sessions, setSessions] = useState<ChatSession[]>(() =>
    load<ChatSession[]>(SESSIONS_KEY) ?? []
  );
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    load<ChatMessage[]>(MESSAGES_KEY) ?? []
  );

  useEffect(() => save(SESSIONS_KEY, sessions), [sessions]);
  useEffect(() => save(MESSAGES_KEY, messages), [messages]);

  const createSession = useCallback(
    (agentId: string, title?: string): ChatSession => {
      const now = new Date().toISOString();
      const agentName =
        seedAgents.find((a) => a.id === agentId)?.name ?? "智能体";
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
    []
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

      const now = new Date().toISOString();
      const userMsg: ChatMessage = {
        id: uid("m"),
        sessionId,
        role: "user",
        content: trimmed,
        createdAt: now,
      };
      setMessages((prev) => [...prev, userMsg]);

      // 更新 session updatedAt + 生成标题（第一条消息）
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

      // mock AI 回复（模拟 600ms 延迟）
      await new Promise((r) => setTimeout(r, 600));

      const session = sessions.find((s) => s.id === sessionId);
      const agentName =
        seedAgents.find((a) => a.id === session?.agentId)?.name ?? "智能体";
      const reply: ChatMessage = {
        id: uid("m"),
        sessionId,
        role: "assistant",
        content: mockReply(agentName, trimmed),
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, reply]);

      return { userMsg, reply };
    },
    [messages, sessions]
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
