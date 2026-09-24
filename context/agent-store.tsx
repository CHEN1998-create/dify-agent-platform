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
import {
  agents as seedAgents,
  type Agent,
  type AgentStatus,
} from "@/lib/mock";

export interface AgentCreateInput {
  name: string;
  description: string;
}

export interface AgentUpdateInput {
  name?: string;
  description?: string;
  systemPrompt?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  status?: AgentStatus;
}

interface AgentStoreValue {
  agents: Agent[];
  getAgent: (id: string) => Agent | undefined;
  createAgent: (input: AgentCreateInput) => Agent;
  updateAgent: (id: string, input: AgentUpdateInput) => Agent | undefined;
  deleteAgent: (id: string) => void;
  publishAgent: (id: string) => Agent | undefined;
}

const STORAGE_KEY = "agent-studio:agents:v1";
const AgentStoreContext = createContext<AgentStoreValue | undefined>(undefined);

function loadFromStorage(): Agent[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as Agent[];
    return null;
  } catch {
    return null;
  }
}

function saveToStorage(agents: Agent[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(agents));
  } catch {
    /* ignore quota errors */
  }
}

function uid() {
  return "agent-" + Math.random().toString(36).slice(2, 10);
}

export function AgentProvider({ children }: { children: ReactNode }) {
  const [agents, setAgents] = useState<Agent[]>(() => {
    return loadFromStorage() ?? seedAgents;
  });

  // 持久化到 localStorage
  useEffect(() => {
    saveToStorage(agents);
  }, [agents]);

  const getAgent = useCallback(
    (id: string) => agents.find((a) => a.id === id),
    [agents]
  );

  const createAgent = useCallback((input: AgentCreateInput): Agent => {
    const now = new Date();
    const agent: Agent = {
      id: uid(),
      name: input.name.trim(),
      description: input.description.trim() || "还没有描述",
      systemPrompt: "你是一个有帮助的 AI 助手。",
      model: "gpt-4o-mini",
      temperature: 0.7,
      maxTokens: 2048,
      status: "draft",
      createdAt: now.toISOString().slice(0, 10),
      lastActive: "刚刚",
      runs: 0,
    };
    setAgents((prev) => [agent, ...prev]);
    return agent;
  }, []);

  const updateAgent = useCallback(
    (id: string, input: AgentUpdateInput): Agent | undefined => {
      let updated: Agent | undefined;
      setAgents((prev) =>
        prev.map((a) => {
          if (a.id !== id) return a;
          updated = { ...a, ...input };
          return updated;
        })
      );
      // setAgents 是异步的，但 React 会立即同步执行 setState 内的 map
      return updated;
    },
    []
  );

  const deleteAgent = useCallback((id: string) => {
    setAgents((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const publishAgent = useCallback(
    (id: string): Agent | undefined => {
      return updateAgent(id, { status: "published" });
    },
    [updateAgent]
  );

  const value = useMemo<AgentStoreValue>(
    () => ({ agents, getAgent, createAgent, updateAgent, deleteAgent, publishAgent }),
    [agents, getAgent, createAgent, updateAgent, deleteAgent, publishAgent]
  );

  return (
    <AgentStoreContext.Provider value={value}>
      {children}
    </AgentStoreContext.Provider>
  );
}

export function useAgentStore() {
  const ctx = useContext(AgentStoreContext);
  if (!ctx) {
    throw new Error("useAgentStore 必须在 AgentProvider 内部使用");
  }
  return ctx;
}
