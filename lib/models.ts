/**
 * LLM 模型配置 —— 按 provider 分组
 *
 * 切换 provider 时改 2 处：
 *   1. .env.local 的 LLM_BASE_URL + LLM_API_KEY
 *   2. 下面的 ACTIVE_PROVIDER（决定 agent 配置页下拉显示哪组模型）
 *
 * 每个 provider 内：
 *   - baseUrl: 对应 LLM_BASE_URL 的值（注释用）
 *   - models: agent 配置页下拉选项，value 直接传给 API
 */

export interface ModelOption {
  value: string;
  label: string;
}

export interface ProviderGroup {
  id: string;
  name: string;
  baseUrl: string;
  models: ModelOption[];
}

export const providers: ProviderGroup[] = [
  {
    id: "deepseek",
    name: "Deepseek 官方",
    baseUrl: "https://api.deepseek.com/v1",
    models: [
      { value: "deepseek-flash", label: "deepseek-flash（推荐·便宜快）" },
      { value: "deepseek-v4-pro", label: "deepseek-v4-pro（旗舰·更强）" },
    ],
  },
  {
    id: "siliconflow",
    name: "硅基流动 SiliconFlow",
    baseUrl: "https://api.siliconflow.cn/v1",
    models: [
      { value: "deepseek-ai/DeepSeek-V4-Flash", label: "DeepSeek-V4-Flash" },
      { value: "deepseek-ai/DeepSeek-V3", label: "DeepSeek-V3" },
      { value: "Qwen/Qwen2.5-32B-Instruct", label: "Qwen2.5-32B" },
      { value: "Qwen/Qwen2.5-7B-Instruct", label: "Qwen2.5-7B" },
      { value: "THUDM/GLM-4-32B-0414", label: "GLM-4-32B" },
    ],
  },
  {
    id: "dashscope",
    name: "阿里 DashScope",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    models: [
      { value: "qwen-plus", label: "qwen-plus（旗舰）" },
      { value: "qwen-turbo", label: "qwen-turbo（快）" },
      { value: "deepseek-v3", label: "deepseek-v3" },
    ],
  },
];

/** 当前使用的 provider —— 改成 providers 里的某个 id 即可切换下拉选项 */
export const ACTIVE_PROVIDER = "deepseek";

/** agent 配置页直接 import 这个，不用每次手动写模型列表 */
export const activeModels: ModelOption[] =
  providers.find((p) => p.id === ACTIVE_PROVIDER)?.models ?? providers[0].models;

/** 当前 provider 的默认模型（新建 agent 时用） */
export const DEFAULT_MODEL: string = activeModels[0].value;
