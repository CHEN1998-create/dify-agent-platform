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
  uploadDoc: (file: File) => Promise<KnowledgeDoc>;
  deleteDoc: (id: string) => void;
  getDoc: (id: string) => KnowledgeDoc | undefined;
  /** 给 chat-store 检索用：返回所有 ready 状态的 chunks */
  getAllChunks: () => string[];
}

const Ctx = createContext<KnowledgeStoreValue | undefined>(undefined);

function storageKey(userId: string | null) {
  return `agent-studio:knowledge:${userId ?? "anon"}:v1`;
}

function uid() {
  return "doc-" + Math.random().toString(36).slice(2, 10);
}

function load(key: string): KnowledgeDoc[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (raw) return JSON.parse(raw);
  } catch { /* noop */ }
  return [];
}

function save(key: string, data: KnowledgeDoc[]) {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(key, JSON.stringify(data)); } catch { /* quota */ }
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

  // userId 变化 → 加载对应用户的文档
  useEffect(() => {
    setDocs(load(storageKey(userId)));
  }, [userId]);

  // 持久化
  useEffect(() => {
    if (!userId) return;
    save(storageKey(userId), docs);
  }, [docs, userId]);

  const uploadDoc = useCallback<KnowledgeStoreValue["uploadDoc"]>(
    async (file: File): Promise<KnowledgeDoc> => {
      if (!isSupported(file.name)) {
        throw new Error(
          `暂只支持 ${SUPPORTED_EXT.join(" / ")} 文件（PDF/Word 后续版本加入）`
        );
      }

      const text = await file.text();
      const chunks = chunkify(text);

      const doc: KnowledgeDoc = {
        id: uid(),
        name: file.name,
        size: file.size,
        content: text,
        chunks,
        status: "ready",
        createdAt: new Date().toISOString(),
      };

      setDocs((prev) => [doc, ...prev]);
      return doc;
    },
    []
  );

  const deleteDoc = useCallback((id: string) => {
    setDocs((prev) => prev.filter((d) => d.id !== id));
  }, []);

  const getDoc = useCallback(
    (id: string) => docs.find((d) => d.id === id),
    [docs]
  );

  const getAllChunks = useCallback((): string[] => {
    return docs.filter((d) => d.status === "ready").flatMap((d) => d.chunks);
  }, [docs]);

  const value = useMemo<KnowledgeStoreValue>(
    () => ({ docs, uploadDoc, deleteDoc, getDoc, getAllChunks }),
    [docs, uploadDoc, deleteDoc, getDoc, getAllChunks]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useKnowledgeStore() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useKnowledgeStore 必须在 KnowledgeProvider 内");
  return ctx;
}
