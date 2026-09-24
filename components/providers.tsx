"use client";

import { useCallback } from "react";
import { AuthProvider } from "@/context/auth-context";
import { AgentProvider } from "@/context/agent-store";
import { ChatProvider } from "@/context/chat-store";
import { RunLogsProvider, useRunLogs } from "@/context/run-logs";
import { ToastProvider } from "@/components/ui/toast";

/**
 * 串 ChatProvider 和 RunLogsProvider：
 * ChatProvider.sendMessage 调用 mock AI 后触发 onRun
 * → onRun 调 useRunLogs().createLog 写日志
 */
function ChatWithLogsBridge({ children }: { children: React.ReactNode }) {
  const { createLog } = useRunLogs();

  const onRun = useCallback(
    (
      agentId: string,
      sessionId: string,
      model: string,
      agentName: string,
      _content: string
    ) => {
      createLog(agentId, sessionId, model, agentName, { status: "success" });
    },
    [createLog]
  );

  return <ChatProvider onRun={onRun}>{children}</ChatProvider>;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <AgentProvider>
        <RunLogsProvider>
          <ChatWithLogsBridge>
            <ToastProvider>{children}</ToastProvider>
          </ChatWithLogsBridge>
        </RunLogsProvider>
      </AgentProvider>
    </AuthProvider>
  );
}
