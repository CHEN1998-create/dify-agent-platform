"use client";

import {
  Users,
  Bot,
  Zap,
  Clock,
  AlertTriangle,
  FileCheck,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { platformStats } from "@/lib/mock";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

const stats = [
  { label: "总用户数", value: platformStats.totalUsers.toLocaleString(), icon: Users, color: "text-blue-600 bg-blue-100" },
  { label: "智能体总数", value: platformStats.totalAgents.toLocaleString(), icon: Bot, color: "text-violet-600 bg-violet-100" },
  { label: "总调用次数", value: platformStats.totalRuns.toLocaleString(), icon: Zap, color: "text-emerald-600 bg-emerald-100" },
  { label: "平均响应耗时", value: `${platformStats.avgLatencyMs} ms`, icon: Clock, color: "text-amber-600 bg-amber-100" },
];

export default function AdminHomePage() {
  return (
    <>
      <header className="flex h-16 items-center border-b bg-card px-6">
        <h1 className="text-lg font-semibold">平台总览</h1>
      </header>

      <main className="flex-1 overflow-y-auto p-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold">欢迎回来，管理员</h2>
          <p className="text-sm text-muted-foreground">
            实时监控平台运行状况与资源使用
          </p>
        </div>

        {/* Stat cards */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((s) => {
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
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={platformStats.chart.labels.map((label, i) => ({
                  label,
                  调用量: platformStats.chart.runs[i],
                  失败: platformStats.chart.errors[i],
                }))}>
                  <defs>
                    <linearGradient id="colorCalls" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="调用量"
                    stroke="#2563eb"
                    strokeWidth={2}
                    fill="url(#colorCalls)"
                  />
                  <Area
                    type="monotone"
                    dataKey="失败"
                    stroke="#ef4444"
                    strokeWidth={2}
                    fill="transparent"
                  />
                </AreaChart>
              </ResponsiveContainer>
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
                value={`${platformStats.errorRate}%`}
                tone="warn"
              />
              <MetricRow
                icon={FileCheck}
                label="文档处理成功率"
                value={`${platformStats.docsSuccessRate}%`}
                tone="good"
              />
              <MetricRow
                icon={Clock}
                label="P95 响应耗时"
                value="1,840 ms"
                tone="good"
              />
              <MetricRow
                icon={Zap}
                label="并发调用数"
                value="12"
                tone="good"
              />
            </CardContent>
          </Card>
        </div>

        {/* Resource overview */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">资源使用概览</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
              <ResourceBar label="CPU 使用率" value={42} color="bg-blue-500" />
              <ResourceBar label="内存使用率" value={67} color="bg-violet-500" />
              <ResourceBar label="存储使用率" value={31} color="bg-emerald-500" />
            </div>
          </CardContent>
        </Card>
      </main>
    </>
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

function ResourceBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className="mb-2 flex justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{value}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className={`h-full ${color}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}
