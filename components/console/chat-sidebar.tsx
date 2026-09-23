"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus, MessageSquare, Bot, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { chatSessions, agents } from "@/lib/mock";
import { Button } from "@/components/ui/button";

export function ChatSidebar() {
  const pathname = usePathname();
  const agent = agents[0];

  return (
    <aside className="flex w-72 flex-col border-r bg-card">
      {/* Agent selector */}
      <div className="border-b p-3">
        <button className="flex w-full items-center justify-between rounded-lg bg-muted p-3 text-left">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">当前智能体</p>
              <p className="text-sm font-medium">{agent.name}</p>
            </div>
          </div>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      {/* New chat */}
      <div className="p-3">
        <Button className="w-full gap-2">
          <Plus className="h-4 w-4" /> 新建会话
        </Button>
      </div>

      {/* Session list */}
      <div className="flex-1 overflow-y-auto px-2 pb-3">
        <p className="px-2 py-2 text-xs font-medium uppercase text-muted-foreground">
          最近会话
        </p>
        <div className="space-y-1">
          {chatSessions.map((s) => {
            const active = pathname === `/chat/${s.id}`;
            return (
              <Link
                key={s.id}
                href={`/chat/${s.id}`}
                className={cn(
                  "flex items-start gap-2 rounded-lg px-2 py-2.5 text-sm transition-colors",
                  active
                    ? "bg-accent"
                    : "hover:bg-accent/60"
                )}
              >
                <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{s.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {s.messageCount} 条消息 · {s.updatedAt}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
