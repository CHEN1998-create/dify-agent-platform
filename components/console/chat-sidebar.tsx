"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Plus, MessageSquare, Bot, ChevronDown, Trash2, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useChatStore, timeAgo } from "@/context/chat-store";
import { useAgentStore } from "@/context/agent-store";
import { useToast } from "@/components/ui/toast";

interface Props {
  selectedAgentId?: string;
}

export function ChatSidebar({ selectedAgentId }: Props = {}) {
  const pathname = usePathname();
  const router = useRouter();
  const { sessions, createSession, deleteSession, renameSession } = useChatStore();
  const { agents } = useAgentStore();
  const { toast } = useToast();

  const [showAgentMenu, setShowAgentMenu] = useState(false);
  const [editingSession, setEditingSession] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");

  // 决定当前选中的 agent
  const currentAgent =
    agents.find((a) => a.id === selectedAgentId) ??
    agents.find((a) => a.status === "published") ??
    agents[0];

  const handleNewChat = () => {
    if (!currentAgent) {
      toast("没有可用的智能体", { variant: "error" });
      return;
    }
    const session = createSession(currentAgent.id);
    router.push(`/chat/${session.id}`);
  };

  const handleDeleteSession = (id: string, title: string) => {
    deleteSession(id);
    toast("已删除会话", { description: title, variant: "info" });
    if (pathname === `/chat/${id}`) {
      router.replace("/chat");
    }
  };

  const startRename = (id: string, title: string) => {
    setEditingSession(id);
    setEditTitle(title);
  };

  const confirmRename = () => {
    if (editingSession && editTitle.trim()) {
      renameSession(editingSession, editTitle.trim());
      toast("已重命名", { variant: "success" });
    }
    setEditingSession(null);
    setEditTitle("");
  };

  return (
    <aside className="flex w-72 flex-col border-r bg-card">
      {/* Agent selector */}
      <div className="border-b p-3 relative">
        <button
          className="flex w-full items-center justify-between rounded-lg bg-muted p-3 text-left"
          onClick={() => setShowAgentMenu((v) => !v)}
        >
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">当前智能体</p>
              <p className="text-sm font-medium">{currentAgent?.name ?? "无"}</p>
            </div>
          </div>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </button>

        {showAgentMenu && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setShowAgentMenu(false)}
            />
            <div className="absolute left-3 right-3 top-full z-20 mt-1 max-h-60 overflow-y-auto rounded-lg border bg-popover p-1 shadow-lg">
              {agents.length === 0 && (
                <p className="p-3 text-center text-sm text-muted-foreground">
                  还没有智能体，去 <Link href="/agents" className="text-primary underline">创建</Link>
                </p>
              )}
              {agents.map((a) => (
                <Link
                  key={a.id}
                  href={`/chat?agentId=${a.id}`}
                  className={cn(
                    "flex items-center justify-between rounded-md px-2 py-2 text-sm hover:bg-accent",
                    currentAgent?.id === a.id && "bg-accent"
                  )}
                  onClick={() => setShowAgentMenu(false)}
                >
                  <span className="truncate">{a.name}</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {a.model}
                  </span>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>

      {/* New chat */}
      <div className="p-3">
        <Button className="w-full gap-2" onClick={handleNewChat} disabled={!currentAgent}>
          <Plus className="h-4 w-4" /> 新建会话
        </Button>
      </div>

      {/* Session list */}
      <div className="flex-1 overflow-y-auto px-2 pb-3">
        <p className="px-2 py-2 text-xs font-medium uppercase text-muted-foreground">
          最近会话
        </p>
        {sessions.length === 0 && (
          <p className="px-2 py-4 text-center text-xs text-muted-foreground">
            还没有会话，点上方按钮新建
          </p>
        )}
        <div className="space-y-1">
          {sessions.map((s) => {
            const active = pathname === `/chat/${s.id}`;
            const msgCount = (() => {
              // 粗略：根据 messages store 计算
              return 0; // 实际数量在详情页显示，这里不依赖消息 store
            })();

            return (
              <div key={s.id} className="group relative">
                {editingSession === s.id ? (
                  <div className="flex gap-1 rounded-lg bg-accent p-2">
                    <input
                      autoFocus
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") confirmRename();
                        if (e.key === "Escape") setEditingSession(null);
                      }}
                      className="flex-1 rounded border px-1 py-0.5 text-sm"
                    />
                    <Button size="sm" onClick={confirmRename}>确定</Button>
                  </div>
                ) : (
                  <Link
                    href={`/chat/${s.id}`}
                    className={cn(
                      "flex items-start gap-2 rounded-lg px-2 py-2.5 text-sm transition-colors",
                      active ? "bg-accent" : "hover:bg-accent/60"
                    )}
                  >
                    <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{s.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {timeAgo(s.updatedAt)}
                      </p>
                    </div>
                  </Link>
                )}

                {/* Hover actions */}
                {editingSession !== s.id && (
                  <div className="absolute right-1 top-1 hidden gap-0.5 group-hover:flex">
                    <button
                      onClick={() => startRename(s.id, s.title)}
                      className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                      title="重命名"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => handleDeleteSession(s.id, s.title)}
                      className="rounded p-1 text-muted-foreground hover:bg-red-100 hover:text-red-600"
                      title="删除"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
