// 模拟数据 —— 仅用于前端骨架展示，不接真实接口

export type AgentStatus = "draft" | "published" | "paused";

export interface Agent {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  model: string;
  temperature: number;
  maxTokens: number;
  status: AgentStatus;
  createdAt: string;
  lastActive: string;
  runs: number;
}

export const agents: Agent[] = [
  {
    id: "agent-001",
    name: "内容创作助手",
    description: "帮助撰写营销文案、博客和社交媒体内容。",
    systemPrompt: "你是一个专业的内容创作助手，擅长撰写吸引人的营销文案和博客文章。",
    model: "deepseek-chat",
    temperature: 0.7,
    maxTokens: 2048,
    status: "published",
    createdAt: "2025-09-10",
    lastActive: "2 小时前",
    runs: 1284,
  },
  {
    id: "agent-002",
    name: "代码审查专家",
    description: "对代码进行审查并提供改进建议。",
    systemPrompt: "你是一位资深软件工程师，负责审查代码质量、安全性和性能。",
    model: "deepseek-chat",
    temperature: 0.2,
    maxTokens: 4096,
    status: "published",
    createdAt: "2025-09-12",
    lastActive: "5 分钟前",
    runs: 532,
  },
  {
    id: "agent-003",
    name: "数据分析助手",
    description: "解析数据并生成洞察报告。",
    systemPrompt: "你是一个数据分析助手，能够解释数据趋势并给出建议。",
    model: "deepseek-chat",
    temperature: 0.5,
    maxTokens: 2048,
    status: "draft",
    createdAt: "2025-09-18",
    lastActive: "昨天",
    runs: 42,
  },
  {
    id: "agent-004",
    name: "客服机器人",
    description: "7x24 小时回答常见问题。",
    systemPrompt: "你是一个友好的客服机器人，回答用户关于产品的常见问题。",
    model: "deepseek-chat",
    temperature: 0.3,
    maxTokens: 1024,
    status: "paused",
    createdAt: "2025-08-30",
    lastActive: "3 天前",
    runs: 8921,
  },
];

export interface ChatSession {
  id: string;
  agentId: string;
  title: string;
  updatedAt: string;
  messageCount: number;
}

export const chatSessions: ChatSession[] = [
  { id: "sess-1", agentId: "agent-001", title: "帮我写一篇产品发布文案", updatedAt: "刚刚", messageCount: 6 },
  { id: "sess-2", agentId: "agent-002", title: "审查 auth 模块代码", updatedAt: "10 分钟前", messageCount: 12 },
  { id: "sess-3", agentId: "agent-001", title: "社交媒体内容规划", updatedAt: "1 小时前", messageCount: 4 },
  { id: "sess-4", agentId: "agent-003", title: "Q3 销售数据分析", updatedAt: "昨天", messageCount: 8 },
];

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export const chatMessages: ChatMessage[] = [
  {
    id: "m1",
    role: "user",
    content: "帮我写一篇关于新品发布的文案，面向年轻用户。",
    createdAt: "14:20",
  },
  {
    id: "m2",
    role: "assistant",
    content:
      "好的！这里有一版年轻向的新品发布文案草稿：\n\n🔥 准备好了吗？\n我们的全新产品终于来了！\n\n✨ 更轻、更快、更懂你\n💡 从今天开始，让生活简单一点\n\n👉 立即体验，首发限定福利等你拿！",
    createdAt: "14:20",
  },
  {
    id: "m3",
    role: "user",
    content: "再活泼一点，加一些 emoji。",
    createdAt: "14:22",
  },
  {
    id: "m4",
    role: "assistant",
    content:
      "安排！🎉 来一版更有元气的：\n\n🚀 叮咚！你的新宠已上线！\n\n颜值在线 ✨ 实力拉满 💪\n用一次就爱上，根本停不下来～\n\n🎁 首发福利手慢无，快冲！",
    createdAt: "14:22",
  },
];

export interface RunLog {
  id: string;
  agentName: string;
  model: string;
  status: "success" | "error" | "timeout";
  latencyMs: number;
  promptTokens: number;
  completionTokens: number;
  createdAt: string;
  errorMessage?: string;
}

export const runLogs: RunLog[] = [
  {
    id: "log-1",
    agentName: "内容创作助手",
    model: "deepseek-chat",
    status: "success",
    latencyMs: 842,
    promptTokens: 120,
    completionTokens: 256,
    createdAt: "2025-09-23 14:22",
  },
  {
    id: "log-2",
    agentName: "代码审查专家",
    model: "deepseek-chat",
    status: "success",
    latencyMs: 2103,
    promptTokens: 1540,
    completionTokens: 890,
    createdAt: "2025-09-23 14:18",
  },
  {
    id: "log-3",
    agentName: "客服机器人",
    model: "deepseek-chat",
    status: "error",
    latencyMs: 0,
    promptTokens: 80,
    completionTokens: 0,
    createdAt: "2025-09-23 14:05",
    errorMessage: "模型供应商返回 429 Too Many Requests",
  },
  {
    id: "log-4",
    agentName: "数据分析助手",
    model: "deepseek-chat",
    status: "timeout",
    latencyMs: 30000,
    promptTokens: 320,
    completionTokens: 0,
    createdAt: "2025-09-23 13:50",
    errorMessage: "请求超时（30s）",
  },
  {
    id: "log-5",
    agentName: "内容创作助手",
    model: "deepseek-chat",
    status: "success",
    latencyMs: 610,
    promptTokens: 95,
    completionTokens: 180,
    createdAt: "2025-09-23 13:30",
  },
];

export interface KnowledgeDoc {
  id: string;
  name: string;
  size: string;
  status: "processing" | "ready" | "failed";
  chunkCount: number;
  uploadedAt: string;
  agentName: string;
}

export const knowledgeDocs: KnowledgeDoc[] = [
  {
    id: "doc-1",
    name: "产品手册 v2.3.pdf",
    size: "2.4 MB",
    status: "ready",
    chunkCount: 142,
    uploadedAt: "2025-09-20",
    agentName: "客服机器人",
  },
  {
    id: "doc-2",
    name: "常见问题 FAQ.docx",
    size: "128 KB",
    status: "ready",
    chunkCount: 24,
    uploadedAt: "2025-09-19",
    agentName: "客服机器人",
  },
  {
    id: "doc-3",
    name: "代码规范.md",
    size: "56 KB",
    status: "processing",
    chunkCount: 0,
    uploadedAt: "2025-09-23",
    agentName: "代码审查专家",
  },
  {
    id: "doc-4",
    name: "历史销售数据.csv",
    size: "8.1 MB",
    status: "failed",
    chunkCount: 0,
    uploadedAt: "2025-09-22",
    agentName: "数据分析助手",
  },
];

export interface AdminUser {
  id: string;
  email: string;
  role: "user" | "admin";
  agentCount: number;
  runCount: number;
  tokenUsage: number;
  lastActive: string;
}

export const adminUsers: AdminUser[] = [
  { id: "u1", email: "alice@example.com", role: "user", agentCount: 4, runCount: 10779, tokenUsage: 1_240_000, lastActive: "2 分钟前" },
  { id: "u2", email: "bob@example.com", role: "user", agentCount: 2, runCount: 1204, tokenUsage: 320_000, lastActive: "1 小时前" },
  { id: "u3", email: "carol@example.com", role: "user", agentCount: 1, runCount: 88, tokenUsage: 12_400, lastActive: "昨天" },
  { id: "u4", email: "admin@example.com", role: "admin", agentCount: 0, runCount: 0, tokenUsage: 0, lastActive: "刚刚" },
];

export const platformStats = {
  totalUsers: 1284,
  totalAgents: 3920,
  totalRuns: 1_284_930,
  avgLatencyMs: 932,
  errorRate: 2.4,
  docsSuccessRate: 94.1,
  chart: {
    labels: ["周一", "周二", "周三", "周四", "周五", "周六", "周日"],
    runs: [12000, 15800, 18200, 16500, 21000, 9800, 8400],
    errors: [240, 310, 280, 420, 380, 120, 90],
  },
};
