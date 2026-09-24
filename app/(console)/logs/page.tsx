"use client";

import { useMemo, useState } from "react";
import {
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Search,
  FileText,
} from "lucide-react";
import Link from "next/link";
import { ConsoleTopbar } from "@/components/console/topbar";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useRunLogs, type RunLog } from "@/context/run-logs";
import { cn } from "@/lib/utils";

const statusConfig: Record<
  RunLog["status"],
  { label: string; icon: typeof CheckCircle2; variant: "success" | "destructive" | "warning" }
> = {
  success: { label: "成功", icon: CheckCircle2, variant: "success" },
  error: { label: "错误", icon: XCircle, variant: "destructive" },
  timeout: { label: "超时", icon: Clock, variant: "warning" },
};

function fmtDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function LogsPage() {
  const { logs } = useRunLogs();
  const [statusFilter, setStatusFilter] = useState<"all" | RunLog["status"]>("all");
  const [modelFilter, setModelFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [detailLog, setDetailLog] = useState<RunLog | null>(null);

  const models = useMemo(() => {
    const s = new Set(logs.map((l) => l.model));
    return Array.from(s).sort();
  }, [logs]);

  const filtered = useMemo(() => {
    return logs.filter((l) => {
      if (statusFilter !== "all" && l.status !== statusFilter) return false;
      if (modelFilter !== "all" && l.model !== modelFilter) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        if (
          !l.agentName.toLowerCase().includes(q) &&
          !l.id.toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [logs, statusFilter, modelFilter, search]);

  const successCount = logs.filter((l) => l.status === "success").length;
  const errorCount = logs.filter((l) => l.status !== "success").length;
  const avgLatency =
    logs.length > 0
      ? Math.round(logs.reduce((s, l) => s + l.latencyMs, 0) / logs.length)
      : 0;
  const totalTokens = logs.reduce(
    (s, l) => s + l.promptTokens + l.completionTokens,
    0
  );

  const errors = logs.filter((l) => l.status !== "success");

  return (
    <>
      <ConsoleTopbar title="调用日志" />
      <main className="flex-1 overflow-y-auto p-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold">调用日志</h2>
          <p className="text-sm text-muted-foreground">
            查看所有模型调用记录、耗时与 token 消耗 · 对话结束后自动写入
          </p>
        </div>

        {/* Filters */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="搜索智能体或日志 ID..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
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
              ...models.map((m) => ({ value: m, label: m })),
            ]}
            className="w-40"
          />
        </div>

        {/* Stats */}
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">总调用</p>
              <p className="text-xl font-bold">{logs.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">成功</p>
              <p className="text-xl font-bold text-emerald-600">{successCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">失败/超时</p>
              <p className="text-xl font-bold text-destructive">{errorCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">平均耗时 / 总 tokens</p>
              <p className="text-xl font-bold">
                {avgLatency} <span className="text-sm text-muted-foreground">ms</span>
              </p>
              <p className="text-xs text-muted-foreground">{totalTokens.toLocaleString()} tokens</p>
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
                  <th className="px-4 py-3 font-medium">知识库</th>
                  <th className="px-4 py-3 font-medium">耗时</th>
                  <th className="px-4 py-3 font-medium">Tokens</th>
                  <th className="px-4 py-3 font-medium">时间</th>
                  <th className="px-4 py-3 font-medium">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-sm text-muted-foreground">
                      暂无日志。去 <Link href="/chat" className="text-primary underline">对话页</Link> 发一条消息，日志会自动出现在这里。
                    </td>
                  </tr>
                )}
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
                      <td className="px-4 py-3 text-muted-foreground">
                        {log.kbHitCount != null ? (
                          <span
                            className="text-xs text-emerald-600"
                            title={log.kbDocNames ?? undefined}
                          >
                            📚 命中 {log.kbHitCount} 片段
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-3 tabular-nums">{log.latencyMs} ms</td>
                      <td className="px-4 py-3 tabular-nums text-muted-foreground">
                        {log.promptTokens} / {log.completionTokens}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {fmtDateTime(log.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-auto p-0 text-primary hover:bg-transparent hover:underline"
                          onClick={() => setDetailLog(log)}
                        >
                          详情
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Latest error */}
        {errors.length > 0 && (
          <Card className="mt-4 border-destructive/30">
            <CardContent className="flex items-start gap-3 p-4">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-destructive" />
              <div>
                <p className="font-medium text-destructive">
                  最近 {errors.length} 次失败
                </p>
                <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
                  {errors.slice(0, 3).map((e) => (
                    <li key={e.id}>
                      [{fmtDateTime(e.createdAt)}] {e.agentName} · {e.model}
                      {e.errorMessage && ` — ${e.errorMessage}`}
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Detail dialog */}
        <Dialog
          open={!!detailLog}
          onOpenChange={(o) => !o && setDetailLog(null)}
          title="调用详情"
          footer={
            <Button variant="outline" onClick={() => setDetailLog(null)}>关闭</Button>
          }
        >
          {detailLog && (
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">状态</span>
                <Badge variant={statusConfig[detailLog.status].variant}>
                  {statusConfig[detailLog.status].label}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">智能体</span>
                <span className="font-medium">{detailLog.agentName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">模型</span>
                <span>{detailLog.model}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">知识库</span>
                <span>
                  {detailLog.kbHitCount != null
                    ? `命中 ${detailLog.kbHitCount} 个片段${detailLog.kbDocNames ? `（${detailLog.kbDocNames}）` : ""}`
                    : "未启用"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">耗时</span>
                <span className="tabular-nums">{detailLog.latencyMs} ms</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Prompt Tokens</span>
                <span className="tabular-nums">{detailLog.promptTokens}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Completion Tokens</span>
                <span className="tabular-nums">{detailLog.completionTokens}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">时间</span>
                <span>{fmtDateTime(detailLog.createdAt)}</span>
              </div>
              {detailLog.errorMessage && (
                <div className="rounded-md bg-destructive/10 p-3 text-destructive">
                  <p className="font-medium">错误信息</p>
                  <p className="mt-1 text-sm">{detailLog.errorMessage}</p>
                </div>
              )}
              <div className="rounded-md bg-muted p-3">
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  <FileText className="h-3 w-3" />
                  日志 ID: {detailLog.id}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  会话 ID: {detailLog.sessionId}
                </p>
              </div>
            </div>
          )}
        </Dialog>
      </main>
    </>
  );
}
