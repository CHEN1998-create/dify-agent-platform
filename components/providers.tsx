"use client";

import { useCallback } from "react";
import { AuthProvider } from "@/context/auth-context";
import { AgentProvider } from "@/context/agent-store";
import { ChatProvider, type OnRunResult } from "@/context/chat-store";
import { RunLogsProvider, useRunLogs } from "@/context/run-logs";
import { KnowledgeProvider } from "@/context/knowledge-store";
import { ToastProvider } from "@/components/ui/toast";

/**
 * 串 ChatProvider 和 RunLogsProvider：
 * ChatProvider.sendMessage 调 LLM API 拿到真实结果后触发 onRun
 * → onRun 把 latencyMs / tokens / status 等真实数据透传给 createLog
 */
function ChatWithLogsBridge({ children }: { children: React.ReactNode }) {
  const { createLog } = useRunLogs();

  const onRun = useCallback(
    async (
      agentId: string,
      sessionId: string,
      model: string,
      agentName: string,
      result: OnRunResult
    ) => {
      await createLog(agentId, sessionId, model, agentName, {
        status: result.status,
        latencyMs: result.latencyMs,
        promptTokens: result.promptTokens,
        completionTokens: result.completionTokens,
        errorMessage: result.errorMessage,
      });
    },
    [createLog]
  );

  return <ChatProvider onRun={onRun}>{children}</ChatProvider>;
}

export function Providers({ children }: { children: React.ReactNode }) {
  // ToastProvider 放最顶层，这样内部所有 store / 组件都能 useToast()
  return (
    <ToastProvider>
      <AuthProvider>
        <AgentProvider>
          <KnowledgeProvider>
            <RunLogsProvider>
              <ChatWithLogsBridge>{children}</ChatWithLogsBridge>
            </RunLogsProvider>
          </KnowledgeProvider>
        </AgentProvider>
      </AuthProvider>
    </ToastProvider>
  );
}
