"use client";

import { Upload, FileText, CheckCircle2, Loader2, AlertCircle, Link2 } from "lucide-react";
import { ConsoleTopbar } from "@/components/console/topbar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { knowledgeDocs, type KnowledgeDoc } from "@/lib/mock";
import { cn } from "@/lib/utils";

const statusConfig: Record<
  KnowledgeDoc["status"],
  { label: string; icon: typeof CheckCircle2; variant: "success" | "warning" | "destructive" }
> = {
  ready: { label: "可检索", icon: CheckCircle2, variant: "success" },
  processing: { label: "处理中", icon: Loader2, variant: "warning" },
  failed: { label: "失败", icon: AlertCircle, variant: "destructive" },
};

export default function KnowledgePage() {
  return (
    <>
      <ConsoleTopbar title="知识库" />
      <main className="flex-1 overflow-y-auto p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">知识库</h2>
            <p className="text-sm text-muted-foreground">
              上传文档，智能体将基于知识库内容进行回答
            </p>
          </div>
          <Button className="gap-2">
            <Upload className="h-4 w-4" /> 上传文档
          </Button>
        </div>

        {/* Upload zone */}
        <Card className="mb-6 border-dashed">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-10">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Upload className="h-7 w-7" />
            </div>
            <div className="text-center">
              <p className="font-medium">拖拽文件到此处，或点击上传</p>
              <p className="text-sm text-muted-foreground">
                支持 PDF、Word、Markdown、TXT、CSV，单个文件最大 50MB
              </p>
            </div>
            <Button variant="outline" className="mt-1">选择文件</Button>
          </CardContent>
        </Card>

        {/* Document table */}
        <Card>
          <div className="divide-y">
            {knowledgeDocs.map((doc) => {
              const cfg = statusConfig[doc.status];
              const Icon = cfg.icon;
              return (
                <div
                  key={doc.id}
                  className="flex items-center gap-4 px-5 py-4"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{doc.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {doc.size} · 上传于 {doc.uploadedAt}
                      {doc.chunkCount > 0 && ` · ${doc.chunkCount} 个分块`}
                    </p>
                  </div>
                  <Badge variant={cfg.variant} className="gap-1">
                    <Icon className={cn("h-3 w-3", doc.status === "processing" && "animate-spin")} />
                    {cfg.label}
                  </Badge>
                  <div className="hidden items-center gap-1 text-xs text-muted-foreground sm:flex">
                    <Link2 className="h-3 w-3" />
                    关联：{doc.agentName}
                  </div>
                  <Button variant="ghost" size="sm">
                    管理
                  </Button>
                </div>
              );
            })}
          </div>
        </Card>
      </main>
    </>
  );
}
