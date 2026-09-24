/**
 * /api/chat — 服务端 LLM 代理路由
 *
 * 为什么放服务端？
 *   - API Key 不能暴露给前端（带 NEXT_PUBLIC 会被打进 bundle）
 *   - 国内 Node.js dev server 直连国内 LLM（Deepseek/硅基流动/DashScope 等）不需要走 GFW
 *   - 部署 Vercel 后服务器能直连全球 provider
 *
 * 设计为 OpenAI Chat Completions 兼容格式，这样几乎所有 provider 都能用：
 *   - OpenAI:        https://api.openai.com/v1/chat/completions
 *   - Deepseek:      https://api.deepseek.com/v1/chat/completions
 *   - 硅基流动:      https://api.siliconflow.cn/v1/chat/completions
 *   - 阿里 DashScope: https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions
 *   - 百度千帆:       https://qianfan.baidubce.com/v2/chat/completions
 */

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs"; // Route Handler 默认就是 nodejs，显式声明

const API_KEY = process.env.LLM_API_KEY;
// 默认走硅基流动（国内直连，注册送 ¥14 免费额度）
// 切换 provider 时改 LLM_BASE_URL 即可，模型名也要对应改
//   硅基流动: https://api.siliconflow.cn/v1
//   Deepseek: https://api.deepseek.com/v1
//   DashScope: https://dashscope.aliyuncs.com/compatible-mode/v1
const BASE_URL = process.env.LLM_BASE_URL ?? "https://api.siliconflow.cn/v1";

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

interface RequestBody {
  messages: ChatMessage[]; // 已经包含 system prompt 的完整历史
  model: string;
  temperature?: number;
  maxTokens?: number;
}

export async function POST(req: NextRequest) {
  // 1. 环境变量检查
  if (!API_KEY) {
    return NextResponse.json(
      { error: "服务端未配置 LLM_API_KEY，请在 .env.local 中设置" },
      { status: 500 }
    );
  }

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求体不是有效的 JSON" }, { status: 400 });
  }

  const { messages, model, temperature = 0.7, maxTokens = 2048 } = body;

  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "messages 不能为空" }, { status: 400 });
  }
  if (!model) {
    return NextResponse.json({ error: "model 不能为空" }, { status: 400 });
  }

  // 2. 调 LLM API
  const url = `${BASE_URL.replace(/\/$/, "")}/chat/completions`;
  const start = Date.now();

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
        // 不启用 stream，MVP 阶段要完整响应
      }),
      // Next.js route handler 中的 fetch 默认无缓存，且 30s 超时
      // 这里显式设一个超时兜底（60s）
      signal: AbortSignal.timeout(60_000),
    });

    const latencyMs = Date.now() - start;

    if (!resp.ok) {
      let errText = resp.statusText;
      try {
        const errJson = await resp.json();
        errText = errJson?.error?.message ?? errJson?.message ?? errText;
      } catch {
        errText = await resp.text().catch(() => errText);
      }
      return NextResponse.json(
        {
          content: "",
          latencyMs,
          promptTokens: 0,
          completionTokens: 0,
          status: "error" as const,
          errorMessage: `LLM API 错误 (${resp.status}): ${errText}`,
        },
        { status: 200 } // 业务层错误走 200，前端根据 status 字段判断
      );
    }

    const data = await resp.json();
    const content: string =
      data?.choices?.[0]?.message?.content ??
      data?.choices?.[0]?.message?.reasoning_content ?? // deepseek-reasoner 的思维链字段
      "";
    const promptTokens = data?.usage?.prompt_tokens ?? 0;
    const completionTokens = data?.usage?.completion_tokens ?? 0;

    return NextResponse.json({
      content,
      latencyMs,
      promptTokens,
      completionTokens,
      status: "success" as const,
    });
  } catch (err: unknown) {
    const latencyMs = Date.now() - start;
    const msg =
      err instanceof Error ? err.message : String(err);

    // 区分超时 vs 网络错误
    const isTimeout = msg.includes("aborted") || msg.includes("timeout");
    const status: "timeout" | "error" = isTimeout ? "timeout" : "error";

    return NextResponse.json(
      {
        content: "",
        latencyMs,
        promptTokens: 0,
        completionTokens: 0,
        status,
        errorMessage: isTimeout
          ? `LLM 请求超时 (60s)，请检查网络或降低 maxTokens`
          : `LLM 请求失败: ${msg}`,
      },
      { status: 200 }
    );
  }
}
