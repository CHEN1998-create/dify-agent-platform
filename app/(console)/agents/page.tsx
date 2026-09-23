"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, MoreHorizontal, Play, Bot } from "lucide-react";
import { ConsoleTopbar } from "@/components/console/topbar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { agents, type AgentStatus } from "@/lib/mock";
import { cn } from "@/lib/utils";

const statusMap: Record<AgentStatus, { label: string; variant: "success" | "muted" | "warning" }> = {
  published: { label: "已发布", variant: "success" },
  draft: { label: "草稿", variant: "muted" },
  paused: { label: "已停用", variant: "warning" },
};

export default function AgentsPage() {
  const [filter, setFilter] = useState<"all" | AgentStatus>("all");
  const filtered = filter === "all" ? agents : agents.filter((a) => a.status === filter);

  return (
    <>
      <ConsoleTopbar title="智能体" />
      <main className="flex-1 overflow-y-auto p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">我的智能体</h2>
            <p className="text-sm text-muted-foreground">
              共 {agents.length} 个智能体 · {agents.filter((a) => a.status === "published").length} 个已发布
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Select
              value={filter}
              onChange={(e) => setFilter(e.target.value as typeof filter)}
              options={[
                { value: "all", label: "全部状态" },
                { value: "published", label: "已发布" },
                { value: "draft", label: "草稿" },
                { value: "paused", label: "已停用" },
              ]}
              className="w-36"
            />
            <Button className="gap-2">
              <Plus className="h-4 w-4" /> 新建智能体
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {/* Create card */}
          <button className="flex min-h-[180px] flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-muted-foreground/20 text-muted-foreground transition-colors hover:border-primary hover:text-primary">
            <Plus className="h-8 w-8" />
            <span className="text-sm font-medium">创建新智能体</span>
          </button>

          {filtered.map((agent) => {
            const st = statusMap[agent.status];
            return (
              <Card key={agent.id} className="group relative overflow-hidden transition-shadow hover:shadow-md">
                <CardContent className="p-5">
                  <div className="mb-3 flex items-start justify-between">
                    <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Bot className="h-6 w-6" />
                    </div>
                    <div className="flex items-center gap-1">
                      <Badge variant={st.variant}>{st.label}</Badge>
                      <Button variant="ghost" size="icon" className="h-7 w-7">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <Link href={`/agents/${agent.id}`}>
                    <h3 className="font-semibold group-hover:text-primary">{agent.name}</h3>
                  </Link>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                    {agent.description}
                  </p>
                  <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                    <span>{agent.model}</span>
                    <span>{agent.runs.toLocaleString()} 次调用</span>
                  </div>
                  <div className="mt-4 flex items-center gap-2">
                    <Link href="/chat" className="flex-1">
                      <Button variant="outline" size="sm" className="w-full gap-1">
                        <Play className="h-3 w-3" /> 运行
                      </Button>
                    </Link>
                    <Link href={`/agents/${agent.id}`} className="flex-1">
                      <Button size="sm" className="w-full">
                        配置
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </main>
    </>
  );
}
