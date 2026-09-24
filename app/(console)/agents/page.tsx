"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, MoreHorizontal, Play, Bot, Trash2 } from "lucide-react";
import { ConsoleTopbar } from "@/components/console/topbar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { useAgentStore } from "@/context/agent-store";
import type { AgentStatus } from "@/lib/mock";
import { cn } from "@/lib/utils";

const statusMap: Record<AgentStatus, { label: string; variant: "success" | "muted" | "warning" }> = {
  published: { label: "已发布", variant: "success" },
  draft: { label: "草稿", variant: "muted" },
  paused: { label: "已停用", variant: "warning" },
};

export default function AgentsPage() {
  const { agents, createAgent, deleteAgent } = useAgentStore();
  const { toast } = useToast();

  const [filter, setFilter] = useState<"all" | AgentStatus>("all");
  const [openCreate, setOpenCreate] = useState(false);
  const [openDelete, setOpenDelete] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  const filtered = filter === "all" ? agents : agents.filter((a) => a.status === filter);
  const publishedCount = agents.filter((a) => a.status === "published").length;

  const resetForm = () => {
    setName("");
    setDesc("");
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      toast("请输入智能体名称", { variant: "error" });
      return;
    }
    try {
      const agent = await createAgent({ name, description: desc });
      toast("智能体已创建", { description: agent.name, variant: "success" });
      setOpenCreate(false);
      resetForm();
      // 跳转到配置页
      window.location.href = `/agents/${agent.id}`;
    } catch (err) {
      toast("创建失败", {
        description: err instanceof Error ? err.message : String(err),
        variant: "error",
      });
    }
  };

  const handleDelete = async () => {
    if (!openDelete) return;
    const target = agents.find((a) => a.id === openDelete);
    try {
      await deleteAgent(openDelete);
      toast("已删除", { description: target?.name, variant: "info" });
    } catch (err) {
      toast("删除失败", {
        description: err instanceof Error ? err.message : String(err),
        variant: "error",
      });
    }
    setOpenDelete(null);
    setMenuOpen(null);
  };

  return (
    <>
      <ConsoleTopbar title="智能体" />
      <main className="flex-1 overflow-y-auto p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">我的智能体</h2>
            <p className="text-sm text-muted-foreground">
              共 {agents.length} 个智能体 · {publishedCount} 个已发布
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
            <Button className="gap-2" onClick={() => setOpenCreate(true)}>
              <Plus className="h-4 w-4" /> 新建智能体
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {/* Create card */}
          <button
            onClick={() => setOpenCreate(true)}
            className="flex min-h-[180px] flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-muted-foreground/20 text-muted-foreground transition-colors hover:border-primary hover:text-primary"
          >
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
                      <div className="relative">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => setMenuOpen(menuOpen === agent.id ? null : agent.id)}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                        {menuOpen === agent.id && (
                          <>
                            <div
                              className="fixed inset-0 z-10"
                              onClick={() => setMenuOpen(null)}
                            />
                            <div className="absolute right-0 z-20 mt-1 w-36 rounded-md border bg-popover p-1 shadow-md">
                              <button
                                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                                onClick={() => {
                                  setMenuOpen(null);
                                  setOpenDelete(agent.id);
                                }}
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                                <span className="text-red-600">删除</span>
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <Link href={`/agents/${agent.id}`} onClick={() => setMenuOpen(null)}>
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

      {/* 创建弹窗 */}
      <Dialog
        open={openCreate}
        onOpenChange={setOpenCreate}
        title="创建新智能体"
        description="先起一个名字，稍后可以在配置页完善 Prompt 和模型参数。"
        footer={
          <>
            <Button variant="outline" onClick={() => setOpenCreate(false)}>
              取消
            </Button>
            <Button onClick={handleCreate}>创建并进入配置</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">智能体名称 *</label>
            <Input
              placeholder="例如：产品介绍助手"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">描述</label>
            <Input
              placeholder="一句话说明它能做什么"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
            />
          </div>
        </div>
      </Dialog>

      {/* 删除确认 */}
      <Dialog
        open={!!openDelete}
        onOpenChange={(o) => !o && setOpenDelete(null)}
        title="删除智能体？"
        description={
          openDelete
            ? `删除后不可恢复，智能体「${agents.find((a) => a.id === openDelete)?.name ?? ""}」的配置和调用记录将被移除。`
            : undefined
        }
        footer={
          <>
            <Button variant="outline" onClick={() => setOpenDelete(null)}>
              取消
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              确认删除
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          此操作不会创建新会话，也不会影响其他智能体。
        </p>
      </Dialog>
    </>
  );
}
