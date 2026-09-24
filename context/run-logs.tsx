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
}

interface RunLogsStoreValue {
  logs: RunLog[];
  createLog: (agentId: string, sessionId: string, model: string, agentName: string, opts?: { status?: RunLog["status"]; latencyMs?: number; errorMessage?: string; promptTokens?: number; completionTokens?: number }) => RunLog;
  getLog: (id: string) => RunLog | undefined;
  getSessionLogs: (sessionId: string) => RunLog[];
  clearLogs: () => void;
}

const Ctx = createContext<RunLogsStoreValue | undefined>(undefined);

function storageKey(userId: string | null) {
  return `agent-studio:run-logs:${userId ?? "anon"}:v1`;
}

function uid(p = "log") {
  return `${p}-${Math.random().toString(36).slice(2, 10)}`;
}

function load(key: string): RunLog[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (raw) return JSON.parse(raw);
  } catch { /* noop */ }
  return [];
}

function save(key: string, data: RunLog[]) {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(key, JSON.stringify(data)); } catch { /* quota */ }
}

export function RunLogsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [logs, setLogs] = useState<RunLog[]>([]);

  // userId 变化 → 加载对应用户的日志
  useEffect(() => {
    setLogs(load(storageKey(userId)));
  }, [userId]);

  // 持久化（未登录时跳过）
  useEffect(() => {
    if (!userId) return;
    save(storageKey(userId), logs);
  }, [logs, userId]);

  const createLog = useCallback<RunLogsStoreValue["createLog"]>(
    (agentId, sessionId, model, agentName, opts = {}) => {
      const latencyMs = opts.latencyMs ?? Math.floor(300 + Math.random() * 1800);
      const promptTokens = opts.promptTokens ?? Math.floor(40 + Math.random() * 200);
      const completionTokens = opts.completionTokens ?? Math.floor(60 + Math.random() * 400);
      const log: RunLog = {
        id: uid(),
        agentId,
        agentName,
        sessionId,
        model,
        status: opts.status ?? "success",
        latencyMs,
        promptTokens,
        completionTokens,
        createdAt: new Date().toISOString(),
        errorMessage: opts.errorMessage,
      };
      setLogs((prev) => [log, ...prev]);
      return log;
    },
    []
  );

  const getLog = useCallback(
    (id: string) => logs.find((l) => l.id === id),
    [logs]
  );

  const getSessionLogs = useCallback(
    (sessionId: string) =>
      logs.filter((l) => l.sessionId === sessionId),
    [logs]
  );

  const clearLogs = useCallback(() => setLogs([]), []);

  const value = useMemo<RunLogsStoreValue>(
    () => ({
      logs: logs.slice().sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
      createLog,
      getLog,
      getSessionLogs,
      clearLogs,
    }),
    [logs, createLog, getLog, getSessionLogs, clearLogs]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useRunLogs() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useRunLogs 必须在 RunLogsProvider 内");
  return ctx;
}
