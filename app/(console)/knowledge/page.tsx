"use client";

import { useState, useCallback } from "react";
import {
  Upload,
  FileText,
  CheckCircle2,
  Trash2,
  Loader2,
  AlertCircle,
  FileX,
} from "lucide-react";
import { ConsoleTopbar } from "@/components/console/topbar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useKnowledgeStore, formatSize } from "@/context/knowledge-store";
import { useToast } from "@/components/ui/toast";

const statusConfig: Record<
  string,
  { label: string; icon: typeof CheckCircle2; variant: "success" | "warning" | "destructive" }
> = {
  ready: { label: "可检索", icon: CheckCircle2, variant: "success" },
  processing: { label: "处理中", icon: Loader2, variant: "warning" },
  failed: { label: "失败", icon: AlertCircle, variant: "destructive" },
};

const SUPPORTED_HINT = "支持 .txt / .md / .markdown / .json / .csv（PDF / Word 后续版本加入）";

export default function KnowledgePage() {
  const { docs, uploadDoc, deleteDoc } = useKnowledgeStore();
  const { toast } = useToast();

  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      if (files.length === 0) return;
      setIsUploading(true);
      try {
        for (const file of Array.from(files)) {
          try {
            await uploadDoc(file);
            toast(`已上传 ${file.name}`, { variant: "success" });
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            toast(`${file.name}: ${msg}`, { variant: "error" });
          }
        }
      } finally {
        setIsUploading(false);
      }
    },
    [uploadDoc, toast]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback(() => setIsDragging(false), []);

  const onFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) handleFiles(e.target.files);
      e.target.value = "";
    },
    [handleFiles]
  );

  const onDelete = useCallback(
    async (id: string, name: string) => {
      try {
        await deleteDoc(id);
        toast(`已删除 ${name}`);
      } catch (e) {
        toast(e instanceof Error ? e.message : "删除失败", { variant: "error" });
      }
    },
    [deleteDoc, toast]
  );

  const uploadedAt = (iso: string) => iso.slice(0, 10);

  return (
    <>
      <ConsoleTopbar title="知识库" />
      <main className="flex-1 overflow-y-auto p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">知识库</h2>
            <p className="text-sm text-muted-foreground">
              上传文档，对话时将自动检索相关片段注入 AI 上下文
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              id="knowledge-file-input"
              type="file"
              multiple
              className="hidden"
              accept=".txt,.md,.markdown,.json,.csv"
              onChange={onFileInput}
            />
            <Button
              className="gap-2"
              disabled={isUploading}
              onClick={() =>
                (document.getElementById("knowledge-file-input") as HTMLInputElement)?.click()
              }
            >
              <Upload className={cn("h-4 w-4", isUploading && "animate-bounce")} />
              {isUploading ? "上传中..." : "上传文档"}
            </Button>
          </div>
        </div>

        {/* Upload zone */}
        <Card className={cn("mb-6 border-dashed transition-colors", isDragging && "border-primary bg-primary/5")}>
          <CardContent
            className="flex cursor-pointer flex-col items-center justify-center gap-3 py-10"
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onClick={() =>
              (document.getElementById("knowledge-file-input") as HTMLInputElement)?.click()
            }
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Upload className={cn("h-7 w-7", isDragging && "animate-bounce")} />
            </div>
            <div className="text-center">
              <p className="font-medium">
                {isDragging ? "松手上传" : "拖拽文件到此处，或点击上传"}
              </p>
              <p className="text-sm text-muted-foreground">{SUPPORTED_HINT}</p>
            </div>
          </CardContent>
        </Card>

        {/* Document table */}
        {docs.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
              <FileX className="h-10 w-10" />
              <p className="text-sm">还没有上传任何文档</p>
              <p className="text-xs">上传后，对话会自动基于你的文档内容回答</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <div className="divide-y">
              {docs.map((doc) => {
                const cfg = statusConfig[doc.status] ?? statusConfig.ready;
                const Icon = cfg.icon;
                return (
                  <div
                    key={doc.id}
                    className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-muted/30"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{doc.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatSize(doc.size)} · 上传于 {uploadedAt(doc.createdAt)}
                        {doc.chunks.length > 0 && ` · ${doc.chunks.length} 个分块`}
                      </p>
                    </div>
                    <Badge variant={cfg.variant} className="gap-1">
                      <Icon className={cn("h-3 w-3", doc.status === "processing" && "animate-spin")} />
                      {cfg.label}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1 text-destructive hover:text-destructive"
                      onClick={() => onDelete(doc.id, doc.name)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      删除
                    </Button>
                  </div>
                );
              })}
            </div>
          </Card>
        )}
      </main>
    </>
  );
}
