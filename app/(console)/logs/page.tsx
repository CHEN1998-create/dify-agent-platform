"use client";

import { useState } from "react";
import { Clock, AlertTriangle, CheckCircle2, XCircle, Search } from "lucide-react";
import { ConsoleTopbar } from "@/components/console/topbar";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { runLogs, type RunLog } from "@/lib/mock";
import { cn } from "@/lib/utils";

const statusConfig: Record<
  RunLog["status"],
  { label: string; icon: typeof CheckCircle2; variant: "success" | "destructive" | "warning" }
> = {
  success: { label: "成功", icon: CheckCircle2, variant: "success" },
  error: { label: "错误", icon: XCircle, variant: "destructive" },
  timeout: { label: "超时", icon: Clock, variant: "warning" },
};

export default function LogsPage() {
  const [statusFilter, setStatusFilter] = useState<"all" | RunLog["status"]>("all");
  const [modelFilter, setModelFilter] = useState("all");

  const filtered = runLogs.filter((l) => {
    if (statusFilter !== "all" && l.status !== statusFilter) return false;
    if (modelFilter !== "all" && l.model !== modelFilter) return false;
    return true;
  });

  return (
    <>
      <ConsoleTopbar title="调用日志" />
      <main className="flex-1 overflow-y-auto p-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold">调用日志</h2>
          <p className="text-sm text-muted-foreground">
            查看所有模型调用记录、耗时与 token 消耗
          </p>
        </div>

        {/* Filters */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="搜索智能体或日志 ID..." className="pl-9" />
          </div>
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            options={[
              { value: "all", label: "全部状态" },
              { value: "success", label: "成功" },
              { value: "error", label: "错误" },
              { value: "timeout", label: "超时" },
            ]}
            className="w-36"
          />
          <Select
            value={modelFilter}
            onChange={(e) => setModelFilter(e.target.value)}
            options={[
              { value: "all", label: "全部模型" },
              { value: "gpt-4o", label: "gpt-4o" },
              { value: "gpt-4o-mini", label: "gpt-4o-mini" },
              { value: "gpt-3.5-turbo", label: "gpt-3.5-turbo" },
            ]}
            className="w-40"
          />
        </div>

        {/* Stats summary */}
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">总调用</p>
              <p className="text-xl font-bold">{runLogs.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">成功</p>
              <p className="text-xl font-bold text-emerald-600">
                {runLogs.filter((l) => l.status === "success").length}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">失败/超时</p>
              <p className="text-xl font-bold text-destructive">
                {runLogs.filter((l) => l.status !== "success").length}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">平均耗时</p>
              <p className="text-xl font-bold">
                {Math.round(
                  runLogs.reduce((s, l) => s + l.latencyMs, 0) / runLogs.length
                )}
                ms
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Log table */}
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                  <th className="px-4 py-3 font-medium">状态</th>
                  <th className="px-4 py-3 font-medium">智能体</th>
                  <th className="px-4 py-3 font-medium">模型</th>
                  <th className="px-4 py-3 font-medium">耗时</th>
                  <th className="px-4 py-3 font-medium">Tokens</th>
                  <th className="px-4 py-3 font-medium">时间</th>
                  <th className="px-4 py-3 font-medium">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((log) => {
                  const cfg = statusConfig[log.status];
                  const Icon = cfg.icon;
                  return (
                    <tr key={log.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <Badge variant={cfg.variant} className="gap-1">
                          <Icon className={cn("h-3 w-3", log.status === "timeout" && "animate-pulse")} />
                          {cfg.label}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 font-medium">{log.agentName}</td>
                      <td className="px-4 py-3 text-muted-foreground">{log.model}</td>
                      <td className="px-4 py-3 tabular-nums">{log.latencyMs} ms</td>
                      <td className="px-4 py-3 tabular-nums text-muted-foreground">
                        {log.promptTokens} / {log.completionTokens}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{log.createdAt}</td>
                      <td className="px-4 py-3">
                        <button className="text-primary hover:underline">详情</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Error detail for the first error log */}
        {runLogs.find((l) => l.errorMessage) && (
          <Card className="mt-4 border-destructive/30">
            <CardContent className="flex items-start gap-3 p-4">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-destructive" />
              <div>
                <p className="font-medium text-destructive">最近一次错误</p>
                <p className="text-sm text-muted-foreground">
                  {runLogs.find((l) => l.errorMessage)?.errorMessage}
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </>
  );
}
