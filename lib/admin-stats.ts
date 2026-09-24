"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * 从 Supabase 聚合全平台统计。
 *
 * 注意：RLS 默认只允许用户读自己的行。要让 admin 看到全平台数据，
 * 需要在 Supabase 给每张表加一条 admin 读策略：
 *   USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin')
 * 未加策略前，admin 只能看到自己的数据。
 */

export interface AdminStats {
  /** 能聚合到的 userId 数量 */
  trackedUsers: number;
  totalAgents: number;
  totalSessions: number;
  totalRuns: number;
  successRuns: number;
  errorRuns: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  avgLatencyMs: number;
  modelDistribution: Record<string, number>;
  trend7d: { date: string; runs: number; errors: number }[];
  totalKnowledgeDocs: number;
  userStats: UserStat[];
  loading: boolean;
}

export interface UserStat {
  userId: string | null;
  /** user_profiles 表中的昵称（无则回退邮箱前缀） */
  displayName: string | null;
  /** user_profiles 表中的邮箱（anon key 读不了 auth.users，靠 profiles 冗余） */
  email: string | null;
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

interface LogRow {
  user_id: string | null;
  status: string;
  latency_ms: number;
  prompt_tokens: number;
  completion_tokens: number;
  model: string;
  created_at: string;
}

/** 核心聚合逻辑 —— 从 Supabase 查询后聚合 */
export async function aggregateAdminStats(): Promise<AdminStats> {
  const stats = emptyStats();
  const supabase = createClient();

  // 并行查 5 张表（只 select 聚合需要的字段）
  // user_profiles 表用于把 user_id 映射回邮箱/昵称（anon key 读不了 auth.users）
  const [agentsRes, logsRes, sessRes, docsRes, profilesRes] = await Promise.all([
    supabase.from("agents").select("id, user_id"),
    supabase
      .from("run_logs")
      .select(
        "user_id, status, latency_ms, prompt_tokens, completion_tokens, model, created_at"
      )
      .limit(2000),
    supabase.from("chat_sessions").select("id, user_id"),
    supabase.from("knowledge_documents").select("id, user_id"),
    supabase.from("user_profiles").select("user_id, email, name"),
  ]);

  // user_id → { email, name }（user_profiles 表未建或查询失败时为空，页面回退显示 user_id）
  const profileMap = new Map<string, { email: string | null; name: string | null }>();
  if (!profilesRes.error && profilesRes.data) {
    for (const p of profilesRes.data as {
      user_id: string;
      email: string | null;
      name: string | null;
    }[]) {
      profileMap.set(p.user_id, { email: p.email, name: p.name });
    }
  }

  const seenUsers = new Set<string | null>();
  const userMap = new Map<string | null, UserStat>();

  const ensureUser = (uid: string | null) => {
    seenUsers.add(uid);
    if (!userMap.has(uid)) {
      const profile = uid ? profileMap.get(uid) : undefined;
      userMap.set(uid, {
        userId: uid,
        displayName: profile?.name ?? profile?.email?.split("@")[0] ?? null,
        email: profile?.email ?? null,
        totalAgents: 0,
        totalRuns: 0,
        totalTokens: 0,
        lastActive: null,
      });
    }
    return userMap.get(uid)!;
  };

  // agents
  if (agentsRes.data) {
    stats.totalAgents = agentsRes.data.length;
    for (const row of agentsRes.data) {
      ensureUser(row.user_id as string | null).totalAgents++;
    }
  }

  // run_logs（核心指标）
  let latencySum = 0;
  let latencyCount = 0;
  if (logsRes.data) {
    const logs = logsRes.data as LogRow[];
    stats.totalRuns = logs.length;
    for (const log of logs) {
      const u = ensureUser(log.user_id as string | null);
      if (log.status === "success") stats.successRuns++;
      else if (log.status === "error") stats.errorRuns++;
      stats.totalPromptTokens += log.prompt_tokens ?? 0;
      stats.totalCompletionTokens += log.completion_tokens ?? 0;
      u.totalTokens +=
        (log.prompt_tokens ?? 0) + (log.completion_tokens ?? 0);
      if (log.latency_ms > 0) {
        latencySum += log.latency_ms;
        latencyCount++;
      }
      const m = log.model ?? "unknown";
      stats.modelDistribution[m] = (stats.modelDistribution[m] ?? 0) + 1;
      // 近 7 天趋势
      const d = new Date(log.created_at);
      const daysAgo = Math.floor(
        (Date.now() - d.getTime()) / (24 * 60 * 60 * 1000)
      );
      if (daysAgo >= 0 && daysAgo < 7) {
        const idx = 6 - daysAgo;
        stats.trend7d[idx].runs++;
        if (log.status !== "success") stats.trend7d[idx].errors++;
      }
      // 用户维度
      u.totalRuns++;
      if (!u.lastActive || new Date(log.created_at) > new Date(u.lastActive)) {
        u.lastActive = log.created_at;
      }
    }
  }

  // sessions
  if (sessRes.data) {
    stats.totalSessions = sessRes.data.length;
  }

  // knowledge
  if (docsRes.data) {
    stats.totalKnowledgeDocs = docsRes.data.length;
  }

  stats.trackedUsers = seenUsers.size;
  if (latencyCount > 0) stats.avgLatencyMs = Math.round(latencySum / latencyCount);
  stats.userStats = Array.from(userMap.values()).sort(
    (a, b) => b.totalRuns - a.totalRuns
  );

  return stats;
}

/** React hook —— 在 admin 页面里用，自动定时刷新 */
export function useAdminStats(): AdminStats & { refresh: () => void } {
  const [stats, setStats] = useState<AdminStats>(() => ({
    ...emptyStats(),
    loading: true,
  }));

  const refresh = useCallback(async () => {
    setStats((prev) => ({ ...prev, loading: true }));
    try {
      const next = await aggregateAdminStats();
      setStats(next);
    } catch (err) {
      console.error("加载 admin 统计失败:", err);
      setStats({ ...emptyStats(), loading: false });
    }
  }, []);

  useEffect(() => {
    refresh();
    // 定时刷新（15 秒），run_logs 会持续增加
    const id = window.setInterval(refresh, 15000);
    return () => window.clearInterval(id);
  }, [refresh]);

  return { ...stats, refresh };
}
