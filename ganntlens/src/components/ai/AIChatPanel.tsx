import { useState } from 'react';
import { Send } from 'lucide-react';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  ts: string;
}

const SEED_MESSAGES: ChatMessage[] = [
  {
    id: 'm1',
    role: 'user',
    content: '把 M1 开工延后 3 天',
    ts: '2026-06-16 10:24'
  },
  {
    id: 'm2',
    role: 'assistant',
    content:
      '已识别意图：M1 (开工) +3 天。\n\n影响范围：M1 之后所有任务/里程碑顺延 3 天。\n\n✅ 已应用。是否通知 张工 / 李工？',
    ts: '2026-06-16 10:24'
  }
];

const SHORTCUTS = ['/延后', '/完成度', '/冲突', '/周报', '/拆解'];

interface Props {
  provider?: string;
  onCommand?: (cmd: string) => void;
}

/** AI 聊天面板 - 消息列表 + 输入框 + 快捷指令 */
export function AIChatPanel({ provider = 'MOCK', onCommand }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>(SEED_MESSAGES);
  const [input, setInput] = useState('');

  const send = () => {
    if (!input.trim()) return;
    const userMsg: ChatMessage = {
      id: 'u' + Date.now(),
      role: 'user',
      content: input.trim(),
      ts: new Date().toISOString().slice(11, 16)
    };
    setMessages((m) => [...m, userMsg]);
    onCommand?.(input.trim());
    setInput('');
    // 模拟回复（Day 5 接入真实 LLM）
    setTimeout(() => {
      setMessages((m) => [
        ...m,
        {
          id: 'a' + Date.now(),
          role: 'assistant',
          content: '已收到。Day 5 将接入真实 LLM 引擎。',
          ts: new Date().toISOString().slice(11, 16)
        }
      ]);
    }, 600);
  };

  return (
    <aside
      style={{
        width: 320,
        background: 'var(--paper)',
        borderLeft: '1px solid var(--line)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0
      }}
    >
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--line)',
          display: 'flex',
          alignItems: 'center',
          gap: 8
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            background: '#10b981',
            borderRadius: '50%'
          }}
        />
        <span
          style={{
            fontFamily: 'Inter Tight, sans-serif',
            fontWeight: 600,
            fontSize: 13
          }}
        >
          AI ASSISTANT
        </span>
        <span
          style={{
            marginLeft: 'auto',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 10,
            color: 'var(--mute)',
            padding: '2px 6px',
            border: '1px solid var(--line)'
          }}
        >
          {provider}
        </span>
      </div>

      <div
        style={{
          flex: 1,
          padding: '14px 16px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 10
        }}
      >
        {messages.map((m) => (
          <div
            key={m.id}
            style={{
              fontSize: 12,
              lineHeight: 1.6,
              padding: '8px 10px',
              maxWidth: '90%',
              alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
              background: m.role === 'user' ? 'var(--bg-2)' : 'var(--ink)',
              color: m.role === 'user' ? 'var(--ink)' : '#e2e8f0',
              whiteSpace: 'pre-wrap'
            }}
          >
            {m.role === 'assistant' && (
              <div
                style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 9,
                  color: 'var(--accent)',
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  fontWeight: 700,
                  marginBottom: 4
                }}
              >
                MOCK · LLM
              </div>
            )}
            {m.content}
            <div
              style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 9,
                color: m.role === 'user' ? 'var(--mute-2)' : '#64748b',
                marginTop: 4
              }}
            >
              {m.ts}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 4, padding: '0 12px 8px', flexWrap: 'wrap' }}>
        {SHORTCUTS.map((s) => (
          <button
            key={s}
            onClick={() => setInput(s)}
            style={{
              fontSize: 10,
              padding: '3px 8px',
              border: '1px solid var(--line)',
              color: 'var(--mute)',
              fontFamily: 'JetBrains Mono, monospace',
              cursor: 'pointer',
              background: 'transparent'
            }}
          >
            {s}
          </button>
        ))}
      </div>

      <div
        style={{
          padding: '10px 12px',
          borderTop: '1px solid var(--line)',
          display: 'flex',
          gap: 6
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder="问点什么… (⏎)"
          style={{
            flex: 1,
            padding: '6px 10px',
            border: '1px solid var(--line-2)',
            fontFamily: 'Inter, sans-serif',
            fontSize: 12,
            background: 'var(--bg)'
          }}
        />
        <button
          onClick={send}
          style={{
            padding: '6px 10px',
            background: 'var(--ink)',
            color: '#fff',
            border: 0,
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.1em',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 4
          }}
        >
          <Send size={11} />
          SEND
        </button>
      </div>
    </aside>
  );
}
