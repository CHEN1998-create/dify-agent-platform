"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAdminStats } from "@/lib/admin-stats";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

const COLORS = [
  "#2563eb", "#3b82f6", "#60a5fa", "#93c5fd", "#bfdbfe",
  "#7c3aed", "#a78bfa", "#c4b5fd",
  "#10b981", "#34d399",
];

export default function AdminUsagePage() {
  const stats = useAdminStats();
  const [search, setSearch] = useState("");

  const topUsers = useMemo(
    () =>
      stats.userStats
        .filter((u) => u.userId !== null)
        .slice(0, 5)
        .map((u) => ({
          name: u.userId!.slice(0, 10),
          tokens: Math.round(u.totalTokens / 1000),
        })),
    [stats.userStats]
  );

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return stats.userStats.filter((u) =>
      q ? (u.userId ?? "匿名").toLowerCase().includes(q) : true
    );
  }, [stats.userStats, search]);

  const topModels = Object.entries(stats.modelDistribution)
    .map(([name, runs]) => ({ name, runs }))
    .sort((a, b) => b.runs - a.runs);

  const modelTotal = topModels.reduce((s, m) => s + m.runs, 0);

  return (
    <>
      <header className="flex h-16 items-center border-b bg-card px-6">
        <h1 className="text-lg font-semibold">用户与调用概览</h1>
      </header>

      <main className="flex-1 overflow-y-auto p-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold">用户与使用情况</h2>
          <p className="text-sm text-muted-foreground">
            查看本浏览器已登录账号的聚合数据（接数据库后升级为全平台统计）
          </p>
        </div>

        {/* Summary cards */}
        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Card>
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">当前可见用户</p>
              <p className="text-2xl font-bold">{stats.trackedUsers}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                本浏览器 localStorage 内登录过的账号
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">总调用次数</p>
              <p className="text-2xl font-bold">{stats.totalRuns.toLocaleString()}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                成功 {stats.successRuns} · 失败 {stats.errorRuns}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">总 Token 消耗</p>
              <p className="text-2xl font-bold tabular-nums">
                {(
                  (stats.totalPromptTokens + stats.totalCompletionTokens) / 1000
                ).toFixed(1)}
                K
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                prompt {stats.totalPromptTokens.toLocaleString()} + completion{" "}
                {stats.totalCompletionTokens.toLocaleString()}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">知识库文档</p>
              <p className="text-2xl font-bold">{stats.totalKnowledgeDocs}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                分属 {stats.userStats.filter((u) => u.userId !== null).length} 位用户
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Top users by token */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Token 消耗 Top 5 用户</CardTitle>
            </CardHeader>
            <CardContent className="h-72">
              {topUsers.length === 0 ? (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  暂无用户数据
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topUsers} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 12 }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={100} />
                    <Tooltip formatter={(v) => `${v}K tokens`} />
                    <Bar dataKey="tokens" name="tokens" radius={[0, 4, 4, 0]}>
                      {topUsers.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Model distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">模型调用分布</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-2">
              {topModels.length === 0 ? (
                <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
                  暂无模型调用数据
                </div>
              ) : (
                topModels.map((m, i) => (
                  <div key={m.name}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="font-medium">{m.name}</span>
                      <span className="text-muted-foreground">
                        {modelTotal > 0
                          ? ((m.runs / modelTotal) * 100).toFixed(1)
                          : 0}
                        %
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${modelTotal > 0 ? (m.runs / modelTotal) * 100 : 0}%`,
                          backgroundColor: COLORS[i % COLORS.length],
                        }}
                      />
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* User table */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">用户列表</CardTitle>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="搜索用户 ID..."
                className="w-56 pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-y bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                  <th className="px-4 py-3 font-medium">用户</th>
                  <th className="px-4 py-3 font-medium">智能体数</th>
                  <th className="px-4 py-3 font-medium">调用次数</th>
                  <th className="px-4 py-3 font-medium">Token 消耗</th>
                  <th className="px-4 py-3 font-medium">最近活跃</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-sm text-muted-foreground">
                      暂无用户数据
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => (
                    <tr key={u.userId} className="hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                            {(u.userId ?? "A")[0].toUpperCase()}
                          </div>
                          <span className="font-medium max-w-[200px] truncate">
                            {u.userId ?? "匿名（未登录状态）"}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 tabular-nums">{u.totalAgents}</td>
                      <td className="px-4 py-3 tabular-nums">{u.totalRuns.toLocaleString()}</td>
                      <td className="px-4 py-3 tabular-nums">
                        {(u.totalTokens / 1000).toFixed(1)}K
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {u.lastActive
                          ? new Date(u.lastActive).toLocaleString("zh-CN", {
                              month: "2-digit",
                              day: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </main>
    </>
  );
}
