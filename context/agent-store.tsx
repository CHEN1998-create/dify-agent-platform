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
import { type Agent, type AgentStatus } from "@/lib/mock";
import { DEFAULT_MODEL } from "@/lib/models";
import { useAuth } from "@/context/auth-context";
import { createClient } from "@/lib/supabase/client";

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
  knowledgeEnabled?: boolean;
}

interface AgentStoreValue {
  agents: Agent[];
  loading: boolean;
  getAgent: (id: string) => Agent | undefined;
  createAgent: (input: AgentCreateInput) => Promise<Agent>;
  updateAgent: (id: string, input: AgentUpdateInput) => Promise<void>;
  deleteAgent: (id: string) => Promise<void>;
  publishAgent: (id: string) => Promise<void>;
}

const AgentStoreContext = createContext<AgentStoreValue | undefined>(undefined);

/** DB 行 → 前端 Agent 对象 */
function rowToAgent(row: Record<string, unknown>): Agent {
  return {
    id: row.id as string,
    name: row.name as string,
    description: (row.description as string) || "还没有描述",
    systemPrompt: (row.system_prompt as string) || "你是一个有帮助的 AI 助手。",
    model: (row.model as string) || DEFAULT_MODEL,
    temperature: Number(row.temperature ?? 0.7),
    maxTokens: Number(row.max_tokens ?? 2048),
    status: (row.status as AgentStatus) || "draft",
    knowledgeEnabled: Boolean(row.knowledge_enabled),
    createdAt: (row.created_at as string)?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
    lastActive: "刚刚",
    runs: Number(row.runs ?? 0),
  };
}

export function AgentProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);

  // userId 变化 → 从 Supabase 加载
  useEffect(() => {
    if (!userId) {
      setAgents([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from("agents")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false });

        if (cancelled) return;
        if (error) {
          console.error("加载 agents 失败:", error.message);
          setAgents([]);
        } else {
          setAgents((data ?? []).map(rowToAgent));
        }
      } catch (err) {
        console.error("加载 agents 异常:", err);
        if (!cancelled) setAgents([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const getAgent = useCallback(
    (id: string) => agents.find((a) => a.id === id),
    [agents]
  );

  const createAgent = useCallback(
    async (input: AgentCreateInput): Promise<Agent> => {
      const supabase = createClient();
      const insertData = {
        user_id: userId,
        name: input.name.trim(),
        description: input.description.trim() || "还没有描述",
        system_prompt: "你是一个有帮助的 AI 助手。",
        model: DEFAULT_MODEL,
        temperature: 0.7,
        max_tokens: 2048,
        status: "draft",
        runs: 0,
      };

      const { data, error } = await supabase
        .from("agents")
        .insert(insertData)
        .select("*")
        .single();

      if (error) throw new Error(`创建智能体失败: ${error.message}`);

      const agent = rowToAgent(data!);
      setAgents((prev) => [agent, ...prev]);
      return agent;
    },
    [userId]
  );

  const updateAgent = useCallback(
    async (id: string, input: AgentUpdateInput): Promise<void> => {
      const supabase = createClient();
      const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (input.name !== undefined) updateData.name = input.name;
      if (input.description !== undefined) updateData.description = input.description;
      if (input.systemPrompt !== undefined) updateData.system_prompt = input.systemPrompt;
      if (input.model !== undefined) updateData.model = input.model;
      if (input.temperature !== undefined) updateData.temperature = input.temperature;
      if (input.maxTokens !== undefined) updateData.max_tokens = input.maxTokens;
      if (input.status !== undefined) updateData.status = input.status;
      if (input.knowledgeEnabled !== undefined) updateData.knowledge_enabled = input.knowledgeEnabled;

      const { error } = await supabase
        .from("agents")
        .update(updateData)
        .eq("id", id)
        .eq("user_id", userId!);

      if (error) throw new Error(`更新智能体失败: ${error.message}`);

      // 本地同步
      setAgents((prev) =>
        prev.map((a) => {
          if (a.id !== id) return a;
          const updated = { ...a };
          if (input.name !== undefined) updated.name = input.name;
          if (input.description !== undefined) updated.description = input.description;
          if (input.systemPrompt !== undefined) updated.systemPrompt = input.systemPrompt;
          if (input.model !== undefined) updated.model = input.model;
          if (input.temperature !== undefined) updated.temperature = input.temperature;
          if (input.maxTokens !== undefined) updated.maxTokens = input.maxTokens;
          if (input.status !== undefined) updated.status = input.status;
          if (input.knowledgeEnabled !== undefined) updated.knowledgeEnabled = input.knowledgeEnabled;
          return updated;
        })
      );
    },
    [userId]
  );

  const deleteAgent = useCallback(
    async (id: string): Promise<void> => {
      const supabase = createClient();
      const { error } = await supabase
        .from("agents")
        .delete()
        .eq("id", id)
        .eq("user_id", userId!);

      if (error) throw new Error(`删除智能体失败: ${error.message}`);

      setAgents((prev) => prev.filter((a) => a.id !== id));
    },
    [userId]
  );

  const publishAgent = useCallback(
    async (id: string): Promise<void> => {
      await updateAgent(id, { status: "published" });
    },
    [updateAgent]
  );

  const value = useMemo<AgentStoreValue>(
    () => ({ agents, loading, getAgent, createAgent, updateAgent, deleteAgent, publishAgent }),
    [agents, loading, getAgent, createAgent, updateAgent, deleteAgent, publishAgent]
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
