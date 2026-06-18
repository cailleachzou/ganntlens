// =====================================================================
// AI Provider 元数据 - D5
//
// 7 家通用 LLM 协议（OpenAI 兼容）+ Mock
// 真实 API 接入放在 D6+，本文件先准备配置
// =====================================================================

import type { AIProvider } from '../../types';

export interface ProviderMeta {
  id: AIProvider;
  name: string;
  defaultEndpoint: string;
  defaultModel: string;
  keyHint: string;
  badge?: string; // 角标：推荐 / 免费 / 中文
}

export const PROVIDERS: ProviderMeta[] = [
  {
    id: 'mock',
    name: 'Mock (内置演示)',
    defaultEndpoint: '',
    defaultModel: 'mock-engine-v1',
    keyHint: '无需 API Key，零成本演示',
    badge: '推荐'
  },
  {
    id: 'openai',
    name: 'OpenAI',
    defaultEndpoint: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    keyHint: 'sk-...'
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    defaultEndpoint: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat',
    keyHint: 'sk-...',
    badge: '中文'
  },
  {
    id: 'moonshot',
    name: 'Moonshot (Kimi)',
    defaultEndpoint: 'https://api.moonshot.cn/v1',
    defaultModel: 'moonshot-v1-8k',
    keyHint: 'sk-...',
    badge: '中文'
  },
  {
    id: 'zhipu',
    name: '智谱 GLM',
    defaultEndpoint: 'https://open.bigmodel.cn/api/paas/v4',
    defaultModel: 'glm-4-flash',
    keyHint: '',
    badge: '中文'
  },
  {
    id: 'MiniMax',
    name: 'MiniMax M2',
    defaultEndpoint: 'https://api.MiniMax.chat/v1',
    defaultModel: 'MiniMax-Text-01',
    keyHint: ''
  },
  {
    id: 'mimo',
    name: 'MiMo (小米)',
    defaultEndpoint: 'https://api.mimo.example.com/v1',
    defaultModel: 'mimo-7b',
    keyHint: ''
  },
  {
    id: 'custom',
    name: 'Custom (自定义)',
    defaultEndpoint: '',
    defaultModel: '',
    keyHint: 'OpenAI 兼容协议'
  }
];

export function getProviderMeta(id: AIProvider): ProviderMeta {
  return PROVIDERS.find((p) => p.id === id) || PROVIDERS[0];
}

export function needsApiKey(id: AIProvider): boolean {
  return id !== 'mock';
}
