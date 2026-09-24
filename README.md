# Agent Studio — 类 Dify 智能体平台

一个模仿 Dify 核心体验的精简版智能体编排平台（MVP）：创建智能体、配置 Prompt 与模型参数、发起对话、可选知识库增强、查看调用日志、管理员后台统计。

**线上演示**：<https://dify-agent-platform.vercel.app>

> 测试账号：`e2eab3cd9@test.com` / `E2eTest!1234`（普通用户）。注册时选择「管理员」角色可体验后台。

## 项目简介

- **智能体管理**：创建 / 编辑 / 删除智能体，配置 System Prompt、模型、温度、最大 Token，支持草稿 / 已发布 / 已停用状态流转
- **AI 对话**：按智能体配置调用真实 LLM（OpenAI Chat Completions 兼容格式），会话与消息持久化
- **知识库**：上传 .txt / .md / .markdown / .json / .csv 文档，自动分块（500 字/块，重叠 50 字）；每个智能体可开启「知识库增强」——对话前先检索知识片段注入 System Prompt。检索结果可见（回复下方面板展示命中片段来源与调用链路）、调用链路可解释（日志记录命中数与文档来源）
- **调用日志**：每次 LLM 调用记录状态、耗时、Token 消耗、知识库命中情况，可查看详情
- **管理后台**：平台总览（调用量趋势、健康指标、模型分布）、用户与调用统计（按用户聚合 Token 消耗、显示昵称/邮箱）
- **权限体系**：Supabase Auth 邮箱注册登录，普通用户 / 管理员（`user_metadata.role = 'admin'`）双层路由保护，所有数据按 `user_id` RLS 隔离

## 架构说明

```
浏览器（用户控制台 / 管理后台）
  │  supabase-js 直连（anon key + RLS 鉴权）
  ├──────────────► Supabase Auth（邮箱注册登录，JWT 会话）
  ├──────────────► Supabase Postgres（agents / chat_sessions / chat_messages /
  │                 run_logs / knowledge_documents / user_profiles，全表 RLS）
  │  fetch（携带 cookie，服务端本地解析 JWT 校验）
  └──────────────► /api/chat（Next.js Route Handler）
                      │  校验登录 → 透传 OpenAI 兼容请求
                      └────► LLM Provider（Deepseek / 硅基流动 / OpenAI 等）
```

- **数据层**：浏览器端 `supabase-js` 直连 Supabase，不自建 CRUD 接口；数据隔离完全依赖 PostgreSQL RLS 策略（普通用户仅能读写自己 `user_id` 的数据，管理员有全表只读权限）
- **LLM 代理**：唯一服务端接口 `/api/chat`，API Key 仅存服务端环境变量；鉴权采用本地解析 cookie 中 JWT（校验 `sub` + `exp`），不依赖服务端访问 Supabase 网络
- **知识检索链路**：用户消息 → 中文滑窗切 2-gram + 去停用词提取关键词 → IDF 加权匹配所有知识片段（通用词权重趋零）→ 按加权得分取 top 3 → 拼接 System Prompt → 调用模型；命中片段、来源文档与关键词全程记录，前端可展开查看

## 技术栈

| 层 | 技术 |
|---|---|
| 框架 | Next.js 14（App Router）+ React 18 + TypeScript |
| 样式 / 组件 | Tailwind CSS + 自建 UI 组件（Card / Dialog / Toast 等）+ lucide-react 图标 |
| 图表 | recharts |
| 鉴权 / 数据库 | Supabase（Auth + Postgres + RLS 行级安全） |
| LLM | OpenAI Chat Completions 兼容 API（默认 Deepseek，可切换硅基流动等） |
| 部署 | Vercel（GitHub main 分支自动部署） |

## 本地启动步骤

```bash
# 1. 克隆仓库
git clone https://github.com/CHEN1998-create/dify-agent-platform.git
cd dify-agent-platform

# 2. 安装依赖
npm install

# 3. 配置环境变量（在项目根目录创建 .env.local，内容见下节）

# 4. 启动开发服务器
npm run dev
# 访问 http://localhost:3000
```

首次使用需在 Supabase Dashboard 完成初始化：注册账号（注册页选择角色）、开启 Auth 的「Enable signup」、关闭「Confirm email」，并执行数据库迁移（建表 + RLS 策略 + 管理员读策略 + `user_profiles` 注册触发器）。

## 环境变量清单

| 变量 | 必填 | 说明 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | 是 | Supabase 项目 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 是 | Supabase anon public key（公开密钥，安全由 RLS 保证） |
| `LLM_API_KEY` | 是 | LLM 服务商 API Key（仅服务端使用，不会打入前端 bundle） |
| `LLM_BASE_URL` | 否 | LLM 基础地址，默认 `https://api.deepseek.com/v1`；硅基流动为 `https://api.siliconflow.cn/v1` |

## 接口说明

### `POST /api/chat`（服务端 LLM 代理）

- **鉴权**：请求需携带登录后的 Supabase auth cookie，服务端本地解析 JWT 校验，未登录 / 过期返回 `401`
- **请求体**：

```json
{
  "messages": [
    { "role": "system", "content": "System Prompt（可能已注入知识片段）" },
    { "role": "user", "content": "用户消息" }
  ],
  "model": "deepseek-flash",
  "temperature": 0.7,
  "maxTokens": 2048
}
```

- **响应体**（业务错误也返回 200，靠 `status` 字段区分）：

```json
{
  "content": "AI 回复内容",
  "latencyMs": 396,
  "promptTokens": 61,
  "completionTokens": 7,
  "status": "success",   // success | error | timeout
  "errorMessage": "失败时的错误说明（可选）"
}
```

### 数据访问

无自建 CRUD 接口，浏览器端通过 `supabase-js` 访问以下表（全部启用 RLS）：

| 表 | 用途 | 写入方 |
|---|---|---|
| `agents` | 智能体配置（含 `knowledge_enabled` 开关） | 智能体页 |
| `chat_sessions` / `chat_messages` | 会话与消息（`kb_meta` jsonb 持久化检索结果） | 对话页 |
| `run_logs` | LLM 调用日志（`kb_hit_count` / `kb_doc_names` 记录知识库命中） | 对话成功后自动写入 |
| `knowledge_documents` | 知识库文档与分块内容 | 知识库页 |
| `user_profiles` | 用户昵称 / 邮箱映射（注册触发器自动建档） | 注册触发器 |

## 相关文档

- [PRD 产品需求文档](./docs/PRD.md)
