"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import {
  AuthUser,
  getCurrentUser,
  loginUser,
  registerUser,
  logout as logoutFn,
  UserRole,
} from "@/lib/auth";
import { createClient } from "@/lib/supabase/client";

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  register: (
    email: string,
    password: string,
    name: string,
    role?: UserRole
  ) => Promise<AuthUser>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 初始化：从 Supabase 会话恢复
    getCurrentUser().then((u) => {
      setUser(u);
      setLoading(false);
    });

    // 监听登录态变化
    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        const metadata = session.user.user_metadata || {};
        setUser({
          id: session.user.id,
          email: session.user.email ?? "",
          name: metadata.name || session.user.email?.split("@")[0] || "用户",
          role: (metadata.role as UserRole) || "user",
          createdAt: session.user.created_at || new Date().toISOString(),
        });
      } else {
        setUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email: string, password: string) => {
    const u = await loginUser(email, password);
    setUser(u);
    return u;
  };

  const register = async (
    email: string,
    password: string,
    name: string,
    role: UserRole = "user"
  ) => {
    const u = await registerUser(email, password, name, role);
    setUser(u);
    return u;
  };

  const logout = async () => {
    await logoutFn();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth 必须在 AuthProvider 内部使用");
  }
  return ctx;
}
