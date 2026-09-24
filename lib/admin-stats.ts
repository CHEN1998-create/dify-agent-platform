"use client";

import { useEffect, useState } from "react";

/**
 * 从 localStorage 遍历所有 agent-studio 开头的 key，聚合出全平台统计。
 *
 * MVP 阶段的数据来源（都是 localStorage，按 userId 隔离的）：
 *   agent-studio:agents:{userId}:v1         → agents
 *   agent-studio:run-logs:{userId}:v1       → run-logs
 *   agent-studio:knowledge:{userId}:v1      → knowledge
 *   agent-studio:chat-sessions:{userId}:v1  → chat sessions
 *
 * 因为是纯前端统计，只能看到当前浏览器里登录过的所有用户的数据。
 * 接 Supabase DB 后应改为服务端聚合，这里保留作为 MVP 实现。
 */

const KEY_PREFIX = "agent-studio:";

interface ParsedKey {
  type: "agents" | "run-logs" | "knowledge" | "chat-sessions" | "chat-messages" | "unknown";
  userId: string | null;
  full: string;
}

function parseStorageKey(key: string): ParsedKey {
  // 格式: agent-studio:{type}:{userId}:v1
  const parts = key.split(":");
  if (parts.length < 4 || parts[0] !== "agent-studio") {
    return { type: "unknown", userId: null, full: key };
  }
  const [, type, userId] = parts;
  const validTypes = new Set([
    "agents",
    "run-logs",
    "knowledge",
    "chat-sessions",
    "chat-messages",
  ]);
  return {
    type: validTypes.has(type) ? (type as ParsedKey["type"]) : "unknown",
    userId: userId === "anon" ? null : userId,
    full: key,
  };
}

function parseJSON<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export interface AdminStats {
  /** 当前浏览器 localStorage 里能聚合到的 userId 数量 */
  trackedUsers: number;
  /** 聚合到的 agent 总数 */
  totalAgents: number;
  /** 聚合到的会话总数 */
  totalSessions: number;
  /** 聚合到的调用日志总数 */
  totalRuns: number;
  /** 成功调用数 */
  successRuns: number;
  /** 失败调用数 */
  errorRuns: number;
  /** 总 prompt tokens */
  totalPromptTokens: number;
  /** 总 completion tokens */
  totalCompletionTokens: number;
  /** 平均耗时（ms） */
  avgLatencyMs: number;
  /** 模型调用分布：{ model: 调用次数 } */
  modelDistribution: Record<string, number>;
  /** 近 7 天按日期的调用趋势：[{ date, runs, errors }] */
  trend7d: { date: string; runs: number; errors: number }[];
  /** 知识库文档总数 */
  totalKnowledgeDocs: number;
  /** 每个用户的简要统计（供用户列表用） */
  userStats: UserStat[];
  /** 是否还在加载 */
  loading: boolean;
}

export interface UserStat {
  userId: string | null;
  totalAgents: number;
  totalRuns: number;
  totalTokens: number;
  lastActive: string | null;
}

function emptyStats(): AdminStats {
  return {
    trackedUsers: 0,
    totalAgents: 0,
    totalSessions: 0,
    totalRuns: 0,
    successRuns: 0,
    errorRuns: 0,
    totalPromptTokens: 0,
    totalCompletionTokens: 0,
    avgLatencyMs: 0,
    modelDistribution: {},
    trend7d: makeEmptyTrend7d(),
    totalKnowledgeDocs: 0,
    userStats: [],
    loading: false,
  };
}

function makeEmptyTrend7d(): { date: string; runs: number; errors: number }[] {
  const out: { date: string; runs: number; errors: number }[] = [];
  const today = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    out.push({
      date: `${d.getMonth() + 1}/${d.getDate()}`,
      runs: 0,
      errors: 0,
    });
  }
  return out;
}

/** 核心聚合逻辑 —— 遍历 localStorage 所有 agent-studio key */
export function aggregateAdminStats(): AdminStats {
  if (typeof window === "undefined") return { ...emptyStats(), loading: false };

  const stats = emptyStats();
  const seenUsers = new Set<string | null>();
  const userMap = new Map<string | null, UserStat>();

  // 先初始化 userMap 里的条目
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    if (!key?.startsWith(KEY_PREFIX)) continue;
    const parsed = parseStorageKey(key);
    if (parsed.type === "unknown") continue;
    seenUsers.add(parsed.userId);
    if (!userMap.has(parsed.userId)) {
      userMap.set(parsed.userId, {
        userId: parsed.userId,
        totalAgents: 0,
        totalRuns: 0,
        totalTokens: 0,
        lastActive: null,
      });
    }
  }

  // 遍历所有 key，按类型累加
  let latencySum = 0;
  let latencyCount = 0;

  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    if (!key?.startsWith(KEY_PREFIX)) continue;
    const parsed = parseStorageKey(key);
    const raw = window.localStorage.getItem(key);
    if (!raw) continue;

    switch (parsed.type) {
      case "agents": {
        const arr = parseJSON<Array<{ id: string }>>(raw);
        if (!arr) break;
        stats.totalAgents += arr.length;
        const u = userMap.get(parsed.userId);
        if (u) u.totalAgents += arr.length;
        break;
      }
      case "run-logs": {
        const arr = parseJSON<
          Array<{
            id: string;
            status: string;
            latencyMs: number;
            promptTokens: number;
            completionTokens: number;
            model: string;
            createdAt: string;
          }>
        >(raw);
        if (!arr) break;
        stats.totalRuns += arr.length;
        for (const log of arr) {
          if (log.status === "success") stats.successRuns++;
          else if (log.status === "error") stats.errorRuns++;
          stats.totalPromptTokens += log.promptTokens ?? 0;
          stats.totalCompletionTokens += log.completionTokens ?? 0;
          if (log.latencyMs > 0) {
            latencySum += log.latencyMs;
            latencyCount++;
          }
          // 模型分布
          const m = log.model ?? "unknown";
          stats.modelDistribution[m] = (stats.modelDistribution[m] ?? 0) + 1;
          // 近 7 天趋势
          const d = new Date(log.createdAt);
          const daysAgo = Math.floor(
            (Date.now() - d.getTime()) / (24 * 60 * 60 * 1000)
          );
          if (daysAgo >= 0 && daysAgo < 7) {
            const idx = 6 - daysAgo;
            stats.trend7d[idx].runs++;
            if (log.status !== "success") stats.trend7d[idx].errors++;
          }
          // 用户维度
          const u = userMap.get(parsed.userId);
          if (u) {
            u.totalRuns++;
            u.totalTokens += (log.promptTokens ?? 0) + (log.completionTokens ?? 0);
            if (!u.lastActive || new Date(log.createdAt) > new Date(u.lastActive)) {
              u.lastActive = log.createdAt;
            }
          }
        }
        break;
      }
      case "knowledge": {
        const arr = parseJSON<Array<{ id: string }>>(raw);
        if (arr) stats.totalKnowledgeDocs += arr.length;
        break;
      }
      case "chat-sessions": {
        const arr = parseJSON<Array<{ id: string }>>(raw);
        if (arr) stats.totalSessions += arr.length;
        break;
      }
      default:
        break;
    }
  }

  stats.trackedUsers = seenUsers.size;
  if (latencyCount > 0) stats.avgLatencyMs = Math.round(latencySum / latencyCount);
  stats.userStats = Array.from(userMap.values()).sort(
    (a, b) => b.totalRuns - a.totalRuns
  );

  return stats;
}

/** React hook —— 在 admin 页面里用，自动监听 localStorage 变化 */
export function useAdminStats(): AdminStats {
  const [stats, setStats] = useState<AdminStats>(() => ({
    ...emptyStats(),
    loading: true,
  }));

  useEffect(() => {
    const refresh = () => setStats(aggregateAdminStats());
    refresh();

    // 监听 storage 事件（同一浏览器多个标签页同步）
    window.addEventListener("storage", refresh);
    // 定期刷新（3 秒），因为 run-logs 会持续增加
    const id = window.setInterval(refresh, 3000);

    return () => {
      window.removeEventListener("storage", refresh);
      window.clearInterval(id);
    };
  }, []);

  return stats;
}
