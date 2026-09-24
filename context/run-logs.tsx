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
import { useAuth } from "@/context/auth-context";
import { createClient } from "@/lib/supabase/client";

export interface RunLog {
  id: string;
  agentId: string;
  agentName: string;
  sessionId: string;
  model: string;
  status: "success" | "error" | "timeout";
  latencyMs: number;
  promptTokens: number;
  completionTokens: number;
  createdAt: string;
  errorMessage?: string;
  /** 知识库命中片段数（未开启知识库时为 null） */
  kbHitCount?: number | null;
  /** 命中的文档名（顿号分隔） */
  kbDocNames?: string | null;
}

interface RunLogsStoreValue {
  logs: RunLog[];
  loading: boolean;
  createLog: (
    agentId: string,
    sessionId: string,
    model: string,
    agentName: string,
    opts?: {
      status?: RunLog["status"];
      latencyMs?: number;
      errorMessage?: string;
      promptTokens?: number;
      completionTokens?: number;
      kbHitCount?: number;
      kbDocNames?: string;
    }
  ) => Promise<RunLog>;
  getLog: (id: string) => RunLog | undefined;
  getSessionLogs: (sessionId: string) => RunLog[];
  clearLogs: () => Promise<void>;
}

const Ctx = createContext<RunLogsStoreValue | undefined>(undefined);

function uid(p = "log") {
  return `${p}-${Math.random().toString(36).slice(2, 10)}`;
}

/** DB 行 → 前端 RunLog */
function rowToLog(row: Record<string, unknown>): RunLog {
  return {
    id: row.id as string,
    agentId: (row.agent_id as string) || "",
    agentName: (row.agent_name as string) || "",
    sessionId: (row.session_id as string) || "",
    model: (row.model as string) || "",
    status: (row.status as RunLog["status"]) || "success",
    latencyMs: Number(row.latency_ms ?? 0),
    promptTokens: Number(row.prompt_tokens ?? 0),
    completionTokens: Number(row.completion_tokens ?? 0),
    createdAt: (row.created_at as string) ?? new Date().toISOString(),
    errorMessage: (row.error_message as string) || undefined,
    kbHitCount: (row.kb_hit_count as number | null) ?? null,
    kbDocNames: (row.kb_doc_names as string | null) ?? null,
  };
}

export function RunLogsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [logs, setLogs] = useState<RunLog[]>([]);
  const [loading, setLoading] = useState(true);

  // userId 变化 → 从 Supabase 加载
  useEffect(() => {
    if (!userId) {
      setLogs([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from("run_logs")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(500);

        if (cancelled) return;
        if (error) {
          console.error("加载运行日志失败:", error.message);
          setLogs([]);
        } else {
          setLogs((data ?? []).map(rowToLog));
        }
      } catch (err) {
        console.error("加载运行日志异常:", err);
        if (!cancelled) setLogs([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const createLog = useCallback<RunLogsStoreValue["createLog"]>(
    async (agentId, sessionId, model, agentName, opts = {}) => {
      const now = new Date().toISOString();
      const insertData = {
        id: uid(),
        user_id: userId,
        agent_id: agentId,
        agent_name: agentName,
        session_id: sessionId,
        model,
        status: opts.status ?? "success",
        latency_ms: opts.latencyMs ?? 0,
        prompt_tokens: opts.promptTokens ?? 0,
        completion_tokens: opts.completionTokens ?? 0,
        error_message: opts.errorMessage ?? null,
        kb_hit_count: opts.kbHitCount ?? null,
        kb_doc_names: opts.kbDocNames ?? null,
        created_at: now,
      };

      const supabase = createClient();
      const { data, error } = await supabase
        .from("run_logs")
        .insert(insertData)
        .select("*")
        .single();

      if (error) throw new Error(`写入运行日志失败: ${error.message}`);

      const log = rowToLog(data!);
      setLogs((prev) => [log, ...prev]);
      return log;
    },
    [userId]
  );

  const getLog = useCallback(
    (id: string) => logs.find((l) => l.id === id),
    [logs]
  );

  const getSessionLogs = useCallback(
    (sessionId: string) => logs.filter((l) => l.sessionId === sessionId),
    [logs]
  );

  const clearLogs = useCallback(async () => {
    const supabase = createClient();
    const { error } = await supabase
      .from("run_logs")
      .delete()
      .eq("user_id", userId!);

    if (error) throw new Error(`清空日志失败: ${error.message}`);

    setLogs([]);
  }, [userId]);

  const value = useMemo<RunLogsStoreValue>(
    () => ({
      logs: logs.slice().sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
      loading,
      createLog,
      getLog,
      getSessionLogs,
      clearLogs,
    }),
    [logs, loading, createLog, getLog, getSessionLogs, clearLogs]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useRunLogs() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useRunLogs 必须在 RunLogsProvider 内");
  return ctx;
}
