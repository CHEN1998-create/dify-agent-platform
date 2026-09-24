"use client";

import {
  Users,
  Bot,
  MessageSquare,
  Zap,
  Clock,
  AlertTriangle,
  FileCheck,
  Database,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAdminStats } from "@/lib/admin-stats";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  BarChart,
  Bar,
  Cell,
} from "recharts";

export default function AdminHomePage() {
  const stats = useAdminStats();

  const errorRate =
    stats.totalRuns > 0
      ? ((stats.errorRuns / stats.totalRuns) * 100).toFixed(1)
      : "0.0";

  const statCards = [
    {
      label: "当前登录用户数",
      value: stats.trackedUsers.toString(),
      icon: Users,
      color: "text-blue-600 bg-blue-100",
    },
    {
      label: "智能体总数",
      value: stats.totalAgents.toLocaleString(),
      icon: Bot,
      color: "text-violet-600 bg-violet-100",
    },
    {
      label: "总调用次数",
      value: stats.totalRuns.toLocaleString(),
      icon: Zap,
      color: "text-emerald-600 bg-emerald-100",
    },
    {
      label: "平均响应耗时",
      value: `${stats.avgLatencyMs} ms`,
      icon: Clock,
      color: "text-amber-600 bg-amber-100",
    },
  ];

  return (
    <>
      <header className="flex h-16 items-center border-b bg-card px-6">
        <h1 className="text-lg font-semibold">平台总览</h1>
      </header>

      <main className="flex-1 overflow-y-auto p-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold">欢迎回来，管理员</h2>
          <p className="text-sm text-muted-foreground">
            基于 Supabase 数据库的全平台聚合统计（每 15 秒自动刷新）
          </p>
        </div>

        {/* Stat cards */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {statCards.map((s) => {
            const Icon = s.icon;
            return (
              <Card key={s.label}>
                <CardContent className="flex items-center gap-4 p-5">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${s.color}`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{s.label}</p>
                    <p className="text-2xl font-bold">{s.value}</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Charts row */}
        <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">近 7 天调用趋势</CardTitle>
            </CardHeader>
            <CardContent className="h-72">
              {stats.totalRuns === 0 ? (
                <EmptyHint text="暂无调用数据，去对话页发几条消息试试" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={stats.trend7d}>
                    <defs>
                      <linearGradient id="colorCalls" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="runs"
                      name="调用量"
                      stroke="#2563eb"
                      strokeWidth={2}
                      fill="url(#colorCalls)"
                    />
                    <Area
                      type="monotone"
                      dataKey="errors"
                      name="失败"
                      stroke="#ef4444"
                      strokeWidth={2}
                      fill="transparent"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Health metrics */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">健康指标</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <MetricRow
                icon={AlertTriangle}
                label="模型调用失败率"
                value={`${errorRate}%`}
                tone={Number(errorRate) > 10 ? "warn" : "good"}
              />
              <MetricRow
                icon={FileCheck}
                label="文档处理成功率"
                value="100%"
                tone="good"
              />
              <MetricRow
                icon={MessageSquare}
                label="会话总数"
                value={stats.totalSessions.toLocaleString()}
                tone="good"
              />
              <MetricRow
                icon={Database}
                label="知识库文档"
                value={stats.totalKnowledgeDocs.toLocaleString()}
                tone="good"
              />
            </CardContent>
          </Card>
        </div>

        {/* Model distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">模型调用分布</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            {Object.keys(stats.modelDistribution).length === 0 ? (
              <EmptyHint text="暂无模型调用数据" />
            ) : (
              <ModelBarChart distribution={stats.modelDistribution} />
            )}
          </CardContent>
        </Card>
      </main>
    </>
  );
}

function EmptyHint({ text }: { text: string }) {
  return (
    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}

function MetricRow({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Zap;
  label: string;
  value: string;
  tone: "good" | "warn";
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 ${tone === "good" ? "text-emerald-500" : "text-amber-500"}`} />
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      <span className={`font-semibold ${tone === "good" ? "text-emerald-600" : "text-amber-600"}`}>
        {value}
      </span>
    </div>
  );
}

function ModelBarChart({
  distribution,
}: {
  distribution: Record<string, number>;
}) {
  const entries = Object.entries(distribution)
    .map(([name, runs]) => ({ name, runs }))
    .sort((a, b) => b.runs - a.runs);

  const colors = [
    "#2563eb", "#3b82f6", "#60a5fa", "#93c5fd", "#bfdbfe",
    "#7c3aed", "#a78bfa", "#c4b5fd",
    "#10b981", "#34d399",
  ];

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={entries} layout="vertical">
        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 12 }} />
        <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={140} />
        <Tooltip formatter={(v) => `${v} 次`} />
        <Bar dataKey="runs" name="调用次数" radius={[0, 4, 4, 0]}>
          {entries.map((_, i) => (
            <Cell key={i} fill={colors[i % colors.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
