"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Send, MoreVertical, Pencil, Trash2, Loader2, ArrowRight } from "lucide-react";
import Link from "next/link";
import { ConsoleTopbar } from "@/components/console/topbar";
import { ChatSidebar } from "@/components/console/chat-sidebar";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useChatStore } from "@/context/chat-store";
import { useAgentStore } from "@/context/agent-store";
import { useToast } from "@/components/ui/toast";

export default function ChatSessionPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { getSession, getSessionMessages, sendMessage, deleteSession, renameSession } =
    useChatStore();
  const { agents } = useAgentStore();
  const { toast } = useToast();

  const session = getSession(params.id);
  const messages = getSessionMessages(params.id);
  const agent = session ? agents.find((a) => a.id === session.agentId) : undefined;

  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(session?.title ?? "");

  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (session) setTitleDraft(session.title);
  }, [session?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, sending]);

  if (!session) {
    return (
      <>
        <ConsoleTopbar title="会话不存在" />
        <div className="flex flex-1 flex-col items-center justify-center p-12">
          <p className="text-lg font-medium">会话不存在或已被删除</p>
          <Link href="/chat" className="mt-4">
            <Button variant="outline">返回对话列表</Button>
          </Link>
        </div>
      </>
    );
  }

  const handleSend = async () => {
    if (!input.trim() || sending) return;
    if (!agent) {
      toast("关联的智能体不存在", { variant: "error" });
      return;
    }
    setSending(true);
    const text = input;
    setInput("");
    try {
      await sendMessage(session.id, text);
    } catch (e) {
      toast(e instanceof Error ? e.message : "发送失败", { variant: "error" });
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteSession(session.id);
      toast("已删除会话", { variant: "info" });
      router.replace("/chat");
    } catch (e) {
      toast(e instanceof Error ? e.message : "删除失败", { variant: "error" });
    }
  };

  const handleSaveTitle = async () => {
    if (titleDraft.trim() && titleDraft.trim() !== session.title) {
      try {
        await renameSession(session.id, titleDraft.trim());
        toast("已重命名", { variant: "success" });
      } catch (e) {
        toast(e instanceof Error ? e.message : "重命名失败", { variant: "error" });
      }
    }
    setEditingTitle(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      <ConsoleTopbar title={session.title} />
      <div className="flex flex-1 overflow-hidden">
        <ChatSidebar selectedAgentId={agent?.id} />
        <div className="flex flex-1 flex-col">
          {/* Session header */}
          <div className="flex items-center justify-between border-b bg-card px-6 py-3">
            <div className="flex items-center gap-3">
              {editingTitle ? (
                <input
                  autoFocus
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  onBlur={handleSaveTitle}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveTitle();
                    if (e.key === "Escape") {
                      setTitleDraft(session.title);
                      setEditingTitle(false);
                    }
                  }}
                  className="rounded border px-2 py-0.5 text-base font-medium"
                />
              ) : (
                <>
                  <div>
                    <h3 className="font-medium">{session.title}</h3>
                    <p className="text-xs text-muted-foreground">
                      {agent?.name ?? "已删除"} · {messages.length} 条消息
                    </p>
                  </div>
                </>
              )}
            </div>
            <div className="relative">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMenuOpen((v) => !v)}
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 z-20 mt-1 w-36 rounded-md border bg-popover p-1 shadow-md">
                    <button
                      className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                      onClick={() => {
                        setEditingTitle(true);
                        setMenuOpen(false);
                      }}
                    >
                      <Pencil className="h-4 w-4" /> 重命名
                    </button>
                    <button
                      className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-red-600 hover:bg-red-50"
                      onClick={() => {
                        setMenuOpen(false);
                        handleDelete();
                      }}
                    >
                      <Trash2 className="h-4 w-4" /> 删除
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Empty state */}
          {messages.length === 0 && (
            <div className="flex flex-1 flex-col items-center justify-center p-8">
              <div className="max-w-md text-center">
                <p className="text-base font-medium">开始新对话</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  当前智能体：{agent?.name} · {agent?.model}
                </p>
                {agent && agent.status !== "published" && (
                  <p className="mt-2 text-xs text-amber-600">
                    ⚠️ 该智能体尚未发布，回复可能不准确。建议先去配置页发布。
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-6">
            <div className="mx-auto max-w-3xl space-y-4">
              {messages.map((m) => (
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

              {/* 正在回复 */}
              {sending && (
                <div className="flex justify-start">
                  <div className="rounded-2xl rounded-tl-sm bg-muted px-4 py-2.5 text-sm">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          </div>

          {/* Input */}
          <div className="border-t bg-card p-4">
            <div className="mx-auto flex max-w-3xl items-end gap-2">
              <Textarea
                rows={1}
                placeholder={
                  sending
                    ? "正在回复，请稍候..."
                    : `向 ${agent?.name ?? "智能体"} 发送消息，Enter 发送，Shift+Enter 换行...`
                }
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                className="min-h-[44px] flex-1 resize-none"
                disabled={sending || !agent}
              />
              <Button
                size="icon"
                className="h-11 w-11 shrink-0"
                disabled={sending || !input.trim() || !agent}
                onClick={handleSend}
              >
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="mx-auto mt-2 flex max-w-3xl items-center justify-center gap-1 text-center text-xs text-muted-foreground">
              {agent?.name} · {agent?.model}
              <ArrowRight className="h-3 w-3" />
              Mock 模式 · 接入真实 LLM 后提供精准回复
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
