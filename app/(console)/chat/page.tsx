"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { ConsoleTopbar } from "@/components/console/topbar";
import { ChatSidebar } from "@/components/console/chat-sidebar";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { chatMessages } from "@/lib/mock";
import { cn } from "@/lib/utils";

export default function ChatPage() {
  const [input, setInput] = useState("");

  return (
    <>
      <ConsoleTopbar title="对话" />
      <div className="flex flex-1 overflow-hidden">
        <ChatSidebar />
        <div className="flex flex-1 flex-col">
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
                placeholder="输入消息，Enter 发送，Shift+Enter 换行..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="min-h-[44px] flex-1 resize-none"
              />
              <Button size="icon" className="h-11 w-11 shrink-0">
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <p className="mx-auto mt-2 max-w-3xl text-center text-xs text-muted-foreground">
              当前使用「内容创作助手」· 模型 gpt-4o-mini
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
