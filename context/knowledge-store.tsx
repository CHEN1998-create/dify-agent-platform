"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  ReactNode,
} from "react";
import { useAuth } from "@/context/auth-context";
import { createClient } from "@/lib/supabase/client";

export interface KnowledgeDoc {
  id: string;
  name: string;
  /** 文件大小（字节） */
  size: number;
  /** 完整文本内容（MVP 关键词匹配用） */
  content: string;
  /** 分块后的片段（检索用） */
  chunks: string[];
  status: "processing" | "ready" | "failed";
  createdAt: string;
}

interface KnowledgeStoreValue {
  docs: KnowledgeDoc[];
  loading: boolean;
  uploadDoc: (file: File) => Promise<KnowledgeDoc>;
  deleteDoc: (id: string) => Promise<void>;
  getDoc: (id: string) => KnowledgeDoc | undefined;
  /** 给 chat-store 检索用：返回所有 ready 状态的 chunks */
  getAllChunks: () => string[];
}

const Ctx = createContext<KnowledgeStoreValue | undefined>(undefined);

function uid() {
  return "doc-" + Math.random().toString(36).slice(2, 10);
}

/** DB 行 → 前端 KnowledgeDoc */
function rowToDoc(row: Record<string, unknown>): KnowledgeDoc {
  return {
    id: row.id as string,
    name: row.name as string,
    size: Number(row.size_bytes ?? 0),
    content: (row.content as string) || "",
    chunks: (row.chunks as string[]) || [],
    // MVP 同步处理，入库即 ready
    status: "ready",
    createdAt:
      (row.created_at as string)?.slice(0, 10) ??
      new Date().toISOString().slice(0, 10),
  };
}

/** 把长文本按段落/长度分块（MVP 方案，不用 embedding） */
function chunkify(text: string, maxChunkLen = 500, overlap = 50): string[] {
  if (!text.trim()) return [];
  // 先按段落/空行粗分
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  for (const p of paragraphs) {
    if (p.length <= maxChunkLen) {
      chunks.push(p);
    } else {
      // 长段落按句子/长度切
      for (let i = 0; i < p.length; i += maxChunkLen - overlap) {
        chunks.push(p.slice(i, i + maxChunkLen));
      }
    }
  }
  return chunks;
}

/** 人类可读的文件大小 */
export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** 支持的文本文件扩展名 */
const SUPPORTED_EXT = [".txt", ".md", ".markdown", ".json", ".csv"];

function isSupported(filename: string): boolean {
  const lower = filename.toLowerCase();
  return SUPPORTED_EXT.some((ext) => lower.endsWith(ext));
}

export function KnowledgeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [docs, setDocs] = useState<KnowledgeDoc[]>([]);
  const [loading, setLoading] = useState(true);

  // userId 变化 → 从 Supabase 加载
  useEffect(() => {
    if (!userId) {
      setDocs([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from("knowledge_documents")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false });

        if (cancelled) return;
        if (error) {
          console.error("加载知识库文档失败:", error.message);
          setDocs([]);
        } else {
          setDocs((data ?? []).map(rowToDoc));
        }
      } catch (err) {
        console.error("加载知识库文档异常:", err);
        if (!cancelled) setDocs([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const uploadDoc = useCallback(
    async (file: File): Promise<KnowledgeDoc> => {
      if (!isSupported(file.name)) {
        throw new Error(
          `暂只支持 ${SUPPORTED_EXT.join(" / ")} 文件（PDF/Word 后续版本加入）`
        );
      }

      const text = await file.text();
      const chunks = chunkify(text);
      const now = new Date().toISOString();

      const supabase = createClient();
      const { data, error } = await supabase
        .from("knowledge_documents")
        .insert({
          id: uid(),
          user_id: userId,
          name: file.name,
          size_bytes: file.size,
          content: text,
          chunks,
          created_at: now,
        })
        .select("*")
        .single();

      if (error) throw new Error(`上传文档失败: ${error.message}`);

      const doc = rowToDoc(data!);
      setDocs((prev) => [doc, ...prev]);
      return doc;
    },
    [userId]
  );

  const deleteDoc = useCallback(
    async (id: string): Promise<void> => {
      const supabase = createClient();
      const { error } = await supabase
        .from("knowledge_documents")
        .delete()
        .eq("id", id)
        .eq("user_id", userId!);

      if (error) throw new Error(`删除文档失败: ${error.message}`);

      setDocs((prev) => prev.filter((d) => d.id !== id));
    },
    [userId]
  );

  const getDoc = useCallback(
    (id: string) => docs.find((d) => d.id === id),
    [docs]
  );

  const getAllChunks = useCallback((): string[] => {
    return docs.filter((d) => d.status === "ready").flatMap((d) => d.chunks);
  }, [docs]);

  const value = useMemo<KnowledgeStoreValue>(
    () => ({ docs, loading, uploadDoc, deleteDoc, getDoc, getAllChunks }),
    [docs, loading, uploadDoc, deleteDoc, getDoc, getAllChunks]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useKnowledgeStore() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useKnowledgeStore 必须在 KnowledgeProvider 内");
  return ctx;
}
