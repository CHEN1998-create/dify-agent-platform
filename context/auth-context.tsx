"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import {
  AuthUser,
  getCurrentUser,
  loginUser as loginUserFn,
  registerUser as registerUserFn,
  logout as logoutFn,
  seedAdminIfNeeded,
  UserRole,
} from "@/lib/auth";

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
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // 初始化：从 localStorage 恢复登录态，并预置管理员
  useEffect(() => {
    seedAdminIfNeeded();
    setUser(getCurrentUser());
    setLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    const u = await loginUserFn(email, password);
    setUser(u);
    return u;
  };

  const register = async (
    email: string,
    password: string,
    name: string,
    role: UserRole = "user"
  ) => {
    const u = await registerUserFn(email, password, name, role);
    setUser(u);
    return u;
  };

  const logout = () => {
    logoutFn();
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
