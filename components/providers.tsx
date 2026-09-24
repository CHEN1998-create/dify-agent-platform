"use client";

import { AuthProvider } from "@/context/auth-context";
import { AgentProvider } from "@/context/agent-store";
import { ToastProvider } from "@/components/ui/toast";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <AgentProvider>
        <ToastProvider>{children}</ToastProvider>
      </AgentProvider>
    </AuthProvider>
  );
}
