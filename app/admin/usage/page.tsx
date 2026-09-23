"use client";

import { Search, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { adminUsers } from "@/lib/mock";
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

const topUsersByToken = [...adminUsers]
  .sort((a, b) => b.tokenUsage - a.tokenUsage)
  .slice(0, 5)
  .map((u) => ({
    name: u.email.split("@")[0],
    tokens: Math.round(u.tokenUsage / 1000),
  }));

export default function AdminUsagePage() {
  return (
    <>
      <header className="flex h-16 items-center border-b bg-card px-6">
        <h1 className="text-lg font-semibold">用户与调用概览</h1>
      </header>

      <main className="flex-1 overflow-y-auto p-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold">用户与使用情况</h2>
          <p className="text-sm text-muted-foreground">
            查看全平台用户、调用消耗与异常情况
          </p>
        </div>

        {/* Summary cards */}
        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Card>
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">用户总数</p>
              <p className="text-2xl font-bold">1,284</p>
              <p className="mt-1 flex items-center gap-1 text-xs text-emerald-600">
                <TrendingUp className="h-3 w-3" /> +12.4% 本周
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">活跃用户</p>
              <p className="text-2xl font-bold">342</p>
              <p className="mt-1 flex items-center gap-1 text-xs text-emerald-600">
                <TrendingUp className="h-3 w-3" /> +5.1% 本周
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">总 Token 消耗</p>
              <p className="text-2xl font-bold">1.57M</p>
              <p className="mt-1 text-xs text-muted-foreground">本月</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">异常调用</p>
              <p className="text-2xl font-bold text-amber-600">38</p>
              <p className="mt-1 text-xs text-muted-foreground">近 24 小时</p>
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
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topUsersByToken} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 12 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={60} />
                  <Tooltip formatter={(v) => `${v}K tokens`} />
                  <Bar dataKey="tokens" radius={[0, 4, 4, 0]}>
                    {topUsersByToken.map((_, i) => (
                      <Cell key={i} fill={["#2563eb", "#3b82f6", "#60a5fa", "#93c5fd", "#bfdbfe"][i]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Model distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">模型调用分布</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-2">
              {[
                { name: "gpt-4o-mini", pct: 52, color: "bg-blue-500" },
                { name: "gpt-4o", pct: 28, color: "bg-violet-500" },
                { name: "gpt-3.5-turbo", pct: 15, color: "bg-emerald-500" },
                { name: "claude-3-5-sonnet", pct: 5, color: "bg-amber-500" },
              ].map((m) => (
                <div key={m.name}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="font-medium">{m.name}</span>
                    <span className="text-muted-foreground">{m.pct}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div className={`h-full ${m.color}`} style={{ width: `${m.pct}%` }} />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* User table */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">用户列表</CardTitle>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="搜索用户..." className="w-56 pl-9" />
            </div>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-y bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                  <th className="px-4 py-3 font-medium">用户</th>
                  <th className="px-4 py-3 font-medium">角色</th>
                  <th className="px-4 py-3 font-medium">智能体数</th>
                  <th className="px-4 py-3 font-medium">调用次数</th>
                  <th className="px-4 py-3 font-medium">Token 消耗</th>
                  <th className="px-4 py-3 font-medium">最近活跃</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {adminUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                          {u.email[0].toUpperCase()}
                        </div>
                        <span className="font-medium">{u.email}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={u.role === "admin" ? "default" : "secondary"}>
                        {u.role === "admin" ? "管理员" : "用户"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 tabular-nums">{u.agentCount}</td>
                    <td className="px-4 py-3 tabular-nums">{u.runCount.toLocaleString()}</td>
                    <td className="px-4 py-3 tabular-nums">
                      {(u.tokenUsage / 1000).toFixed(1)}K
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{u.lastActive}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </main>
    </>
  );
}
