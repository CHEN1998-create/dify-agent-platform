"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ConsoleTopbar } from "@/components/console/topbar";
import { ChatSidebar } from "@/components/console/chat-sidebar";
import { Button } from "@/components/ui/button";
import { Bot, ArrowRight } from "lucide-react";
import { useAgentStore } from "@/context/agent-store";
import { useChatStore } from "@/context/chat-store";
import { useToast } from "@/components/ui/toast";

export default function ChatHomePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialAgentId = searchParams.get("agentId") ?? undefined;

  const { agents } = useAgentStore();
  const { createSession } = useChatStore();
  const { toast } = useToast();

  const defaultAgent =
    (initialAgentId && agents.find((a) => a.id === initialAgentId)) ||
    agents.find((a) => a.status === "published") ||
    agents[0];

  const handleStart = (agentId: string) => {
    const session = createSession(agentId);
    router.push(`/chat/${session.id}`);
  };

  if (agents.length === 0) {
    return (
      <>
        <ConsoleTopbar title="对话" />
        <div className="flex flex-1 overflow-hidden">
          <ChatSidebar />
          <div className="flex flex-1 flex-col items-center justify-center p-12">
            <p className="text-lg font-medium">还没有智能体</p>
            <p className="mt-1 text-sm text-muted-foreground">
              先去创建一个智能体，然后开始对话吧。
            </p>
            <Button className="mt-4" onClick={() => router.replace("/agents")}>
              去创建智能体
            </Button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <ConsoleTopbar title="对话" />
      <div className="flex flex-1 overflow-hidden">
        <ChatSidebar selectedAgentId={defaultAgent?.id} />
        <div className="flex flex-1 flex-col">
          <div className="flex flex-1 flex-col items-center justify-center p-12">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Bot className="h-8 w-8" />
            </div>
            <h2 className="text-xl font-semibold">选择智能体开始对话</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              从左侧选择智能体，或直接点下方开始
            </p>

            {defaultAgent && (
              <div className="mt-6 flex min-w-[320px] max-w-lg items-center justify-between rounded-xl border bg-card p-4 shadow-sm">
                <div>
                  <p className="font-medium">{defaultAgent.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {defaultAgent.model} · {defaultAgent.status === "published" ? "已发布" : "草稿"}
                  </p>
                </div>
                <Button
                  onClick={() => handleStart(defaultAgent.id)}
                  disabled={defaultAgent.status === "paused"}
                  className="gap-2"
                >
                  开始对话
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            )}

            {agents.length > 1 && (
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                {agents
                  .filter((a) => a.id !== defaultAgent?.id)
                  .map((a) => (
                    <Button
                      key={a.id}
                      variant="outline"
                      size="sm"
                      onClick={() => handleStart(a.id)}
                      disabled={a.status === "paused"}
                    >
                      {a.name}
                    </Button>
                  ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
