"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, Save, Play, Send } from "lucide-react";
import Link from "next/link";
import { ConsoleTopbar } from "@/components/console/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { agents } from "@/lib/mock";

export default function AgentConfigPage() {
  const params = useParams<{ id: string }>();
  const agent = agents.find((a) => a.id === params.id) ?? agents[0];

  const [name, setName] = useState(agent.name);
  const [description, setDescription] = useState(agent.description);
  const [systemPrompt, setSystemPrompt] = useState(agent.systemPrompt);
  const [model, setModel] = useState(agent.model);
  const [temperature, setTemperature] = useState(agent.temperature);
  const [maxTokens, setMaxTokens] = useState(agent.maxTokens);
  const [status, setStatus] = useState(agent.status);
  const [debugInput, setDebugInput] = useState("");

  const statusLabel = { draft: "草稿", published: "已发布", paused: "已停用" }[status];

  return (
    <>
      <ConsoleTopbar title="智能体配置" />
      <main className="flex-1 overflow-y-auto p-6">
        <div className="mb-5 flex items-center gap-3">
          <Link href="/agents">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h2 className="text-2xl font-bold">{agent.name}</h2>
          <Badge variant={status === "published" ? "success" : status === "draft" ? "muted" : "warning"}>
            {statusLabel}
          </Badge>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          {/* Config form */}
          <div className="space-y-5 lg:col-span-3">
            <Card>
              <CardHeader>
                <CardTitle>基本信息</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">智能体名称</label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">描述</label>
                  <Textarea
                    rows={2}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Prompt 与模型</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">System Prompt</label>
                  <Textarea
                    rows={6}
                    value={systemPrompt}
                    onChange={(e) => setSystemPrompt(e.target.value)}
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    定义智能体的角色、背景和行为准则。
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">模型</label>
                    <Select
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      options={[
                        { value: "gpt-4o", label: "gpt-4o" },
                        { value: "gpt-4o-mini", label: "gpt-4o-mini" },
                        { value: "gpt-3.5-turbo", label: "gpt-3.5-turbo" },
                        { value: "claude-3-5-sonnet", label: "claude-3-5-sonnet" },
                      ]}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">状态</label>
                    <Select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as typeof status)}
                      options={[
                        { value: "draft", label: "草稿" },
                        { value: "published", label: "发布" },
                        { value: "paused", label: "停用" },
                      ]}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="flex items-center justify-between text-sm font-medium">
                      温度 <span className="text-muted-foreground">{temperature}</span>
                    </label>
                    <input
                      type="range"
                      min={0}
                      max={2}
                      step={0.1}
                      value={temperature}
                      onChange={(e) => setTemperature(Number(e.target.value))}
                      className="w-full accent-primary"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">最大 Token</label>
                    <Input
                      type="number"
                      value={maxTokens}
                      onChange={(e) => setMaxTokens(Number(e.target.value))}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end gap-3">
              <Button variant="outline">取消</Button>
              <Button className="gap-2">
                <Save className="h-4 w-4" /> 保存配置
              </Button>
            </div>
          </div>

          {/* Debug / preview panel */}
          <div className="lg:col-span-2">
            <Card className="sticky top-6 flex h-[calc(100vh-8rem)] flex-col">
              <CardHeader className="border-b">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Play className="h-4 w-4 text-primary" /> 调试与预览
                </CardTitle>
              </CardHeader>
              <div className="flex-1 space-y-4 overflow-y-auto p-4">
                <div className="ml-auto max-w-[80%] rounded-2xl rounded-tr-sm bg-primary px-3 py-2 text-sm text-primary-foreground">
                  你好，帮我写一段产品介绍。
                </div>
                <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-muted px-3 py-2 text-sm">
                  好的，这是一段产品介绍草稿：我们的产品致力于……
                </div>
                <div className="ml-auto max-w-[80%] rounded-2xl rounded-tr-sm bg-primary px-3 py-2 text-sm text-primary-foreground">
                  再简洁一点。
                </div>
                <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-muted px-3 py-2 text-sm">
                  好的，精简版来了。
                </div>
              </div>
              <div className="border-t p-3">
                <div className="flex items-end gap-2">
                  <Textarea
                    rows={1}
                    placeholder="输入消息进行调试..."
                    value={debugInput}
                    onChange={(e) => setDebugInput(e.target.value)}
                    className="min-h-[40px] flex-1"
                  />
                  <Button size="icon" className="h-10 w-10 shrink-0">
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </main>
    </>
  );
}
