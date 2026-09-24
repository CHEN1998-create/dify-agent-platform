"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Bot, Github, Chrome, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/auth-context";
import { DEMO_ADMIN, UserRole } from "@/lib/auth";

type Mode = "login" | "register";

export default function LoginPage() {
  const router = useRouter();
  const { login, register, user, loading } = useAuth();

  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<UserRole>("user");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // 已登录则跳转
  useEffect(() => {
    if (!loading && user) {
      router.replace("/agents");
    }
  }, [user, loading, router]);

  const validate = (): string => {
    if (!email.trim()) return "请输入邮箱";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "邮箱格式不正确";
    if (password.length < 6) return "密码至少 6 位";
    if (mode === "register" && !name.trim()) return "请输入昵称";
    return "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const msg = validate();
    if (msg) {
      setError(msg);
      return;
    }

    setSubmitting(true);
    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        await register(email, password, name, role);
      }
      router.replace("/agents");
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作失败，请重试");
    } finally {
      setSubmitting(false);
    }
  };

  const switchMode = (m: Mode) => {
    setMode(m);
    setError("");
  };

  return (
    <div className="flex min-h-screen">
      {/* Left brand panel */}
      <div className="hidden w-1/2 flex-col justify-between bg-gradient-to-br from-primary/90 to-primary p-12 text-primary-foreground lg:flex">
        <div className="flex items-center gap-2 text-xl font-semibold">
          <Bot className="h-7 w-7" />
          Agent Studio
        </div>
        <div className="space-y-4">
          <h2 className="text-4xl font-bold leading-tight">
            5 分钟搭建你的
            <br />
            专属 AI 智能体
          </h2>
          <p className="max-w-md text-primary-foreground/80">
            配置 Prompt、选择模型、上传知识库，一键发布并追踪每一次调用。
            让 AI 真正为你工作。
          </p>
        </div>
        <div className="space-y-2 text-sm text-primary-foreground/70">
          <p className="font-medium text-primary-foreground">演示账号</p>
          <p>管理员：{DEMO_ADMIN.email} / {DEMO_ADMIN.password}</p>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex w-full flex-col justify-center px-6 lg:w-1/2 lg:px-16">
        <div className="mx-auto w-full max-w-sm space-y-6">
          <div className="space-y-2 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground lg:hidden">
              <Bot className="h-6 w-6" />
            </div>
            <h1 className="text-2xl font-bold">
              {mode === "login" ? "欢迎回来" : "创建账号"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {mode === "login"
                ? "登录以继续使用 Agent Studio"
                : "注册后即可创建你的第一个智能体"}
            </p>
          </div>

          {/* Mode tabs */}
          <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
            <button
              type="button"
              onClick={() => switchMode("login")}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                mode === "login"
                  ? "bg-background shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              登录
            </button>
            <button
              type="button"
              onClick={() => switchMode("register")}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                mode === "register"
                  ? "bg-background shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              注册
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" className="gap-2" type="button">
              <Github className="h-4 w-4" /> GitHub
            </Button>
            <Button variant="outline" className="gap-2" type="button">
              <Chrome className="h-4 w-4" /> Google
            </Button>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">或使用邮箱</span>
            </div>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            {mode === "register" && (
              <div className="space-y-2">
                <label className="text-sm font-medium">昵称</label>
                <Input
                  placeholder="你的昵称"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">邮箱</label>
              <Input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">密码</label>
              <Input
                type="password"
                placeholder="至少 6 位"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {mode === "register" && (
              <div className="space-y-2">
                <label className="text-sm font-medium">账号角色</label>
                <div className="grid grid-cols-2 gap-2">
                  {(["user", "admin"] as UserRole[]).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRole(r)}
                      className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
                        role === r
                          ? "border-primary bg-primary/5 text-primary"
                          : "border-border hover:bg-accent"
                      }`}
                    >
                      {r === "user" ? "普通用户" : "管理员"}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  管理员可访问后台管理台，普通用户仅使用控制台。
                </p>
              </div>
            )}

            {error && (
              <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === "login" ? "登录" : "注册并登录"}
            </Button>
          </form>

          {mode === "login" && (
            <p className="text-center text-sm text-muted-foreground lg:hidden">
              演示管理员：{DEMO_ADMIN.email} / {DEMO_ADMIN.password}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
