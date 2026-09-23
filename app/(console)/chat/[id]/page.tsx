"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Send, MoreVertical } from "lucide-react";
import { ConsoleTopbar } from "@/components/console/topbar";
import { ChatSidebar } from "@/components/console/chat-sidebar";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { chatMessages, chatSessions } from "@/lib/mock";
import { cn } from "@/lib/utils";

export default function ChatSessionPage() {
  const params = useParams<{ id: string }>();
  const session = chatSessions.find((s) => s.id === params.id);
  const [input, setInput] = useState("");

  return (
    <>
      <ConsoleTopbar title={session?.title ?? "会话"} />
      <div className="flex flex-1 overflow-hidden">
        <ChatSidebar />
        <div className="flex flex-1 flex-col">
          {/* Session header */}
          <div className="flex items-center justify-between border-b bg-card px-6 py-3">
            <div>
              <h3 className="font-medium">{session?.title}</h3>
              <p className="text-xs text-muted-foreground">
                {session?.messageCount} 条消息 · 更新于 {session?.updatedAt}
              </p>
            </div>
            <Button variant="ghost" size="icon">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </div>

          {/* Messages */}
          <div className="flex-1 space-y-4 overflow-y-auto p-6">
            <div className="mx-auto max-w-3xl space-y-4">
              {chatMessages.map((m) => (
                <div
                  key={m.id}
                  className={cn(
                    "flex",
                    m.role === "user" ? "justify-end" : "justify-start"
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap",
                      m.role === "user"
                        ? "rounded-tr-sm bg-primary text-primary-foreground"
                        : "rounded-tl-sm bg-muted"
                    )}
                  >
                    {m.content}
                    <p className="mt-1 text-[10px] opacity-60">{m.createdAt}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Input */}
          <div className="border-t bg-card p-4">
            <div className="mx-auto flex max-w-3xl items-end gap-2">
              <Textarea
                rows={1}
                placeholder="继续提问..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="min-h-[44px] flex-1 resize-none"
              />
              <Button size="icon" className="h-11 w-11 shrink-0">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
