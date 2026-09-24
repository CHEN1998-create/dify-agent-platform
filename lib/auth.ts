// 鉴权层 —— 基于 Supabase Auth
// 注册/登录/登出走 Supabase，角色信息存储在 user_metadata.role

import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

export type UserRole = "user" | "admin";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: string;
}

function mapUser(user: User): AuthUser {
  const metadata = user.user_metadata || {};
  return {
    id: user.id,
    email: user.email ?? "",
    name: metadata.name || user.email?.split("@")[0] || "用户",
    role: (metadata.role as UserRole) || "user",
    createdAt: user.created_at || new Date().toISOString(),
  };
}

export async function registerUser(
  email: string,
  password: string,
  name: string,
  role: UserRole = "user"
): Promise<AuthUser> {
  const supabase = createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { name, role },
    },
  });

  if (error) {
    // Supabase 返回的错误信息中文化
    const msg = error.message.toLowerCase();
    if (msg.includes("already registered") || msg.includes("already been registered")) {
      throw new Error("该邮箱已被注册");
    }
    if (msg.includes("password")) {
      throw new Error("密码不符合要求（至少 6 位）");
    }
    throw new Error(error.message);
  }

  if (!data.user) {
    throw new Error("注册失败，请重试");
  }

  // 如果开启了邮箱确认，user 可能存在但 session 为 null
  if (!data.session) {
    throw new Error("注册成功，请查收邮箱完成验证后登录");
  }

  return mapUser(data.user);
}

export async function loginUser(email: string, password: string): Promise<AuthUser> {
  const supabase = createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("invalid") || msg.includes("credentials")) {
      throw new Error("邮箱或密码错误");
    }
    throw new Error(error.message);
  }

  return mapUser(data.user);
}

export async function logout(): Promise<void> {
  const supabase = createClient();
  await supabase.auth.signOut();
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? mapUser(user) : null;
}
