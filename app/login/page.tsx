"use client";

import { useState } from "react";
import Link from "next/link";
import { Bot, Github, Chrome } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

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
        <p className="text-sm text-primary-foreground/60">
          © 2025 Agent Studio. 灵感来自 Dify。
        </p>
      </div>

      {/* Right form panel */}
      <div className="flex w-full flex-col justify-center px-6 lg:w-1/2 lg:px-16">
        <div className="mx-auto w-full max-w-sm space-y-6">
          <div className="space-y-2 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground lg:hidden">
              <Bot className="h-6 w-6" />
            </div>
            <h1 className="text-2xl font-bold">欢迎回来</h1>
            <p className="text-sm text-muted-foreground">登录以继续使用 Agent Studio</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" className="gap-2">
              <Github className="h-4 w-4" /> GitHub
            </Button>
            <Button variant="outline" className="gap-2">
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

          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              window.location.href = "/agents";
            }}
          >
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
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">密码</label>
                <Link href="#" className="text-xs text-primary hover:underline">
                  忘记密码？
                </Link>
              </div>
              <Input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full">
              登录
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            还没有账号？{" "}
            <Link href="#" className="font-medium text-primary hover:underline">
              注册
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
