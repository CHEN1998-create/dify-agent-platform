"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Save, Play, Send, Trash2, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { ConsoleTopbar } from "@/components/console/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { useAgentStore } from "@/context/agent-store";
import { activeModels } from "@/lib/models";
import type { AgentStatus } from "@/lib/mock";

export default function AgentConfigPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { getAgent, updateAgent, deleteAgent } = useAgentStore();
  const { toast } = useToast();

  const agent = getAgent(params.id);

  // 表单状态（用 agent 当前值初始化）
  const [name, setName] = useState(agent?.name ?? "");
  const [description, setDescription] = useState(agent?.description ?? "");
  const [systemPrompt, setSystemPrompt] = useState(agent?.systemPrompt ?? "");
  const [model, setModel] = useState(agent?.model ?? "gpt-4o-mini");
  const [temperature, setTemperature] = useState(agent?.temperature ?? 0.7);
  const [maxTokens, setMaxTokens] = useState(agent?.maxTokens ?? 2048);
  const [status, setStatus] = useState<AgentStatus>(agent?.status ?? "draft");
  const [debugInput, setDebugInput] = useState("");

  const [openDelete, setOpenDelete] = useState(false);
  const initialRef = useRef({
    name, description, systemPrompt, model, temperature, maxTokens, status,
  });

  // 切换 agent 时重置表单
  useEffect(() => {
    if (!agent) return;
    setName(agent.name);
    setDescription(agent.description);
    setSystemPrompt(agent.systemPrompt);
    setModel(agent.model);
    setTemperature(agent.temperature);
    setMaxTokens(agent.maxTokens);
    setStatus(agent.status);
    initialRef.current = {
      name: agent.name,
      description: agent.description,
      systemPrompt: agent.systemPrompt,
      model: agent.model,
      temperature: agent.temperature,
      maxTokens: agent.maxTokens,
      status: agent.status,
    };
  }, [agent?.id]);

  const dirty =
    !!agent &&
    (name !== initialRef.current.name ||
      description !== initialRef.current.description ||
      systemPrompt !== initialRef.current.systemPrompt ||
      model !== initialRef.current.model ||
      temperature !== initialRef.current.temperature ||
      maxTokens !== initialRef.current.maxTokens ||
      status !== initialRef.current.status);

  const statusLabel = { draft: "草稿", published: "已发布", paused: "已停用" }[status];

  const handleSave = async () => {
    if (!agent) return;
    if (!name.trim()) {
      toast("请输入智能体名称", { variant: "error" });
      return;
    }
    try {
      await updateAgent(agent.id, {
        name: name.trim(),
        description: description.trim(),
        systemPrompt,
        model,
        temperature,
        maxTokens,
        status,
      });
      initialRef.current = { name, description, systemPrompt, model, temperature, maxTokens, status };
      toast("配置已保存", { description: agent.name, variant: "success" });
    } catch (err) {
      toast("保存失败", {
        description: err instanceof Error ? err.message : String(err),
        variant: "error",
      });
    }
  };

  const handleReset = () => {
    if (!agent) return;
    setName(initialRef.current.name);
    setDescription(initialRef.current.description);
    setSystemPrompt(initialRef.current.systemPrompt);
    setModel(initialRef.current.model);
    setTemperature(initialRef.current.temperature);
    setMaxTokens(initialRef.current.maxTokens);
    setStatus(initialRef.current.status);
    toast("已恢复到上次保存状态", { variant: "info" });
  };

  const handleDelete = async () => {
    if (!agent) return;
    const name = agent.name;
    try {
      await deleteAgent(agent.id);
      toast("已删除", { description: name, variant: "info" });
      router.replace("/agents");
    } catch (err) {
      toast("删除失败", {
        description: err instanceof Error ? err.message : String(err),
        variant: "error",
      });
    }
  };

  // agent 不存在（可能被删除或 id 错误）
  if (!agent) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-medium">未找到智能体</p>
          <p className="mt-1 text-sm text-muted-foreground">它可能已被删除。</p>
          <Link href="/agents" className="mt-4 inline-block">
            <Button variant="outline">返回列表</Button>
          </Link>
        </div>
      </main>
    );
  }

  return (
    <>
      <ConsoleTopbar title="智能体配置" />
      <main className="flex-1 overflow-y-auto p-6">
        {/* 未保存提示 */}
        {dirty && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            <AlertTriangle className="h-4 w-4" />
            <span>有未保存的更改</span>
          </div>
        )}

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
          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-2 text-red-600 hover:bg-red-50"
              onClick={() => setOpenDelete(true)}
            >
              <Trash2 className="h-4 w-4" /> 删除
            </Button>
          </div>
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
                    rows={8}
                    value={systemPrompt}
                    onChange={(e) => setSystemPrompt(e.target.value)}
                    className="font-mono text-sm"
                    placeholder="你是一个有用的 AI 助手..."
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
                      options={activeModels}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">状态</label>
                    <Select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as AgentStatus)}
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
                      min={1}
                      max={128000}
                      value={maxTokens}
                      onChange={(e) => setMaxTokens(Number(e.target.value))}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={handleReset} disabled={!dirty}>
                还原
              </Button>
              <Button className="gap-2" onClick={handleSave} disabled={!dirty}>
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
              </div>
              <div className="border-t p-3">
                <div className="flex items-end gap-2">
                  <Textarea
                    rows={1}
                    placeholder="请在对话页进行真实对话测试 ↘"
                    value={debugInput}
                    onChange={(e) => setDebugInput(e.target.value)}
                    className="min-h-[40px] flex-1"
                  />
                  <Button size="icon" className="h-10 w-10 shrink-0" disabled>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </main>

      {/* 删除确认 */}
      <Dialog
        open={openDelete}
        onOpenChange={setOpenDelete}
        title="删除智能体？"
        description={`删除后不可恢复，智能体「${agent.name}」的配置将被移除。`}
        footer={
          <>
            <Button variant="outline" onClick={() => setOpenDelete(false)}>
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
