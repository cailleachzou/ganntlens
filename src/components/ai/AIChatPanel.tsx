import { useState, useRef, useEffect } from 'react';
import { Send, Settings, Trash2, Sparkles, Globe, Lock, FolderOpen, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';
import { useAIStore } from '../../store/aiStore';
import { useProjectStore } from '../../store/projectStore';
import { runPlan, scopeLabel, type AIScope } from '../../lib/ai/planGenerator';
import { AISettingsModal } from './AISettingsModal';
import { api } from '../../lib/data/apiClient';
import type { ScanConfig, ScanStatus } from '../../types/data';

interface Props {
  /**
   * AI 操作范围
   * - 'global'：可在所有项目中操作（用于 Overview 页）
   * - { projectId }：只能操作指定项目（用于项目详情页）
   * 默认 'global'
   */
  scope?: AIScope;
}

const SHORTCUTS = ['/延后', '/完成度', '/冲突', '/周报', '/拆解'];

const SEED_MESSAGES = [
  {
    id: 'seed-global-1',
    role: 'assistant' as const,
    content:
      '👋 你好，我是 GanttLens AI。\n\n试试这些命令：\n• 把 M1 延后 3 天\n• 验收测试 进度 70%\n• 冲突 / 周报 / 完成度\n• 拆解 弱电管线\n• 打开 DC-2026',
    ts: '2026-06-16 09:00'
  }
];

const SCOPED_SEED_MESSAGES = [
  {
    id: 'seed-scoped-1',
    role: 'assistant' as const,
    content:
      '🔒 当前为 项目 scope，AI 只能在本项目内生成方案。\n\n试试：\n• 把 M1 延后 3 天\n• 验收测试 进度 70%\n• 拆解 弱电管线\n• 完成度 / 冲突 / 周报',
    ts: '2026-06-16 09:00'
  }
];

export function AIChatPanel({ scope = 'global' }: Props) {
  const messages = useAIStore((s) => s.messages);
  const loading = useAIStore((s) => s.loading);
  const addMessage = useAIStore((s) => s.addMessage);
  const clearMessages = useAIStore((s) => s.clearMessages);
  const setLoading = useAIStore((s) => s.setLoading);
  const config = useAIStore((s) => s.config);
  const projects = useProjectStore((s) => s.projects);
  const setSelectedProject = useProjectStore((s) => s.setSelectedProject);

  const [input, setInput] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [scanConfig, setScanConfig] = useState<ScanConfig | null>(null);
  const [scanStatus, setScanStatus] = useState<ScanStatus | null>(null);
  const [scanPathInput, setScanPathInput] = useState('');
  const [scanPanelOpen, setScanPanelOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  // ref 标记是否已 seed（防 StrictMode remount 重复注入 seed）
  const seededRef = useRef(false);

  const isGlobal = scope === 'global';

  // 首次加载：注入 seed（不持久化 seed，只在 messages 为空时）
  useEffect(() => {
    if (messages.length === 0 && !seededRef.current) {
      seededRef.current = true;
      const seeds = isGlobal ? SEED_MESSAGES : SCOPED_SEED_MESSAGES;
      seeds.forEach((m) => addMessage(m));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 消息变更滚到底
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  // D8: 加载扫描配置
  useEffect(() => {
    api.getScanConfig().then((cfg) => {
      setScanConfig(cfg);
      setScanPathInput(cfg.scanRoot);
    }).catch(() => {});
    api.getScanStatus().then(setScanStatus).catch(() => {});
  }, []);

  const handleSaveScanConfig = async () => {
    const cfg = await api.updateScanConfig({
      scanRoot: scanPathInput,
      enabled: true
    });
    setScanConfig(cfg);
  };

  const handleToggleScan = async () => {
    if (!scanConfig) return;
    const cfg = await api.updateScanConfig({ enabled: !scanConfig.enabled });
    setScanConfig(cfg);
  };

  const handleTriggerScan = async () => {
    await api.triggerScan();
  };

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;

    addMessage({ id: 'u-' + Date.now(), role: 'user', content: text });
    setInput('');
    setLoading(true);

    try {
      const result = await runPlan(text, scope);
      const finalContent = result.outOfScope
        ? `🚫 ${result.content}\n\n当前 scope = ${scopeLabel(scope, projects)}，请到对应页面操作。`
        : result.content;
      addMessage({
        id: 'a-' + Date.now(),
        role: 'assistant',
        content: finalContent,
        plan: result.plan,
        navigateTo: result.navigateTo
      });
      if (result.navigateTo) {
        setSelectedProject(result.navigateTo);
      }
    } catch (e) {
      addMessage({
        id: 'e-' + Date.now(),
        role: 'assistant',
        content: `❌ 出错了：${e instanceof Error ? e.message : String(e)}`
      });
    } finally {
      setLoading(false);
    }
  };

  const providerLabel = config.provider.toUpperCase();
  const scopeText = scopeLabel(scope, projects);

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
      {/* Header */}
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
            background: loading ? 'var(--accent)' : '#10b981',
            borderRadius: '50%',
            animation: loading ? 'pulse 1.2s ease-in-out infinite' : 'none'
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
          title={isGlobal ? '全局 scope：可操作所有项目' : `项目 scope：仅可操作 ${scopeText}`}
          style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 9,
            color: isGlobal ? '#10b981' : 'var(--accent)',
            padding: '2px 6px',
            border: `1px solid ${isGlobal ? '#10b981' : 'var(--accent)'}`,
            display: 'flex',
            alignItems: 'center',
            gap: 3,
            background: isGlobal ? 'rgba(16,185,129,0.08)' : 'rgba(245,158,11,0.08)',
            fontWeight: 700,
            letterSpacing: '0.06em'
          }}
        >
          {isGlobal ? <Globe size={9} /> : <Lock size={9} />}
          {scopeText}
        </span>
        <span
          style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 10,
            color: 'var(--mute)',
            padding: '2px 6px',
            border: '1px solid var(--line)'
          }}
        >
          {providerLabel}
        </span>
        <button
          onClick={() => clearMessages()}
          title="清空对话"
          aria-label="clear chat"
          style={{
            background: 'transparent',
            border: 0,
            cursor: 'pointer',
            padding: 2,
            color: 'var(--mute)',
            display: 'flex'
          }}
        >
          <Trash2 size={12} />
        </button>
        <button
          onClick={() => setSettingsOpen(true)}
          title="AI 设置"
          aria-label="open settings"
          style={{
            background: 'transparent',
            border: 0,
            cursor: 'pointer',
            padding: 2,
            color: 'var(--mute)',
            display: 'flex'
          }}
        >
          <Settings size={13} />
        </button>
        <button
          onClick={() => setScanPanelOpen(!scanPanelOpen)}
          title="文件夹扫描配置"
          aria-label="scan config"
          style={{
            background: 'transparent',
            border: 0,
            cursor: 'pointer',
            padding: 2,
            color: scanPanelOpen ? 'var(--accent)' : 'var(--mute)',
            display: 'flex'
          }}
        >
          <FolderOpen size={13} />
        </button>
      </div>

      {/* D8 扫描配置面板 */}
      {scanPanelOpen && (
        <div style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--line)',
          background: 'var(--bg-2)',
          fontSize: 11
        }}>
          <div style={{ fontWeight: 600, marginBottom: 8, fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.08em' }}>
            文件夹扫描
          </div>

          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            <input
              value={scanPathInput}
              onChange={(e) => setScanPathInput(e.target.value)}
              placeholder="D:\项目根目录"
              style={{
                flex: 1,
                padding: '4px 8px',
                border: '1px solid var(--line-2)',
                background: 'var(--paper)',
                color: 'var(--ink)',
                fontSize: 11,
                fontFamily: 'JetBrains Mono, monospace'
              }}
            />
            <button
              onClick={handleSaveScanConfig}
              style={{
                padding: '4px 10px',
                border: '1px solid var(--line-2)',
                background: 'var(--paper)',
                color: 'var(--ink)',
                fontSize: 11,
                cursor: 'pointer'
              }}
            >
              保存
            </button>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              onClick={handleToggleScan}
              style={{
                padding: '4px 10px',
                border: '1px solid var(--line-2)',
                background: scanConfig?.enabled ? 'var(--accent-2)' : 'var(--paper)',
                color: scanConfig?.enabled ? '#fff' : 'var(--mute)',
                fontSize: 11,
                cursor: 'pointer'
              }}
            >
              {scanConfig?.enabled ? '已启用' : '已禁用'}
            </button>
            <button
              onClick={handleTriggerScan}
              disabled={!scanConfig?.enabled || scanStatus?.scanning}
              style={{
                padding: '4px 10px',
                border: '1px solid var(--line-2)',
                background: 'var(--paper)',
                color: 'var(--ink)',
                fontSize: 11,
                cursor: 'pointer',
                opacity: !scanConfig?.enabled || scanStatus?.scanning ? 0.5 : 1,
                display: 'flex',
                alignItems: 'center',
                gap: 4
              }}
            >
              <RefreshCw size={11} className={scanStatus?.scanning ? 'spin' : ''} />
              {scanStatus?.scanning ? '扫描中...' : '立即扫描'}
            </button>
          </div>

          {scanStatus && (
            <div style={{
              marginTop: 8,
              fontSize: 10,
              color: 'var(--mute)',
              display: 'flex',
              alignItems: 'center',
              gap: 4
            }}>
              {scanStatus.scanning ? (
                <><RefreshCw size={10} className="spin" /> 扫描中...</>
              ) : scanStatus.error ? (
                <><AlertCircle size={10} color="#ef4444" /> {scanStatus.error}</>
              ) : scanStatus.projectCount > 0 ? (
                <><CheckCircle size={10} color="#22c55e" /> 上次扫描: {scanStatus.projectCount} 个项目</>
              ) : (
                '尚未扫描'
              )}
            </div>
          )}
        </div>
      )}

      {/* Messages */}
      <div
        ref={scrollRef}
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
              whiteSpace: 'pre-wrap',
              borderRadius: 0
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
                  marginBottom: 4,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4
                }}
              >
                <Sparkles size={9} /> {providerLabel}
              </div>
            )}
            {m.content}
            {m.plan && (
              <details
                data-testid="plan-summary"
                style={{ marginTop: 8, fontSize: 12 }}
              >
                <summary
                  style={{
                    cursor: 'pointer',
                    color: 'var(--accent)',
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: 11,
                    letterSpacing: '0.04em'
                  }}
                >
                  📋 方案（不自动应用 — 待 IDE 落地）
                </summary>
                <pre
                  style={{
                    background: 'var(--paper-2, #1e293b)',
                    color: '#e2e8f0',
                    padding: 8,
                    marginTop: 6,
                    fontSize: 11,
                    overflow: 'auto',
                    fontFamily: 'JetBrains Mono, monospace',
                    border: '1px solid var(--line)'
                  }}
                >
                  {JSON.stringify(m.plan, null, 2)}
                </pre>
                <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                  <button
                    onClick={() =>
                      navigator.clipboard
                        .writeText(JSON.stringify(m.plan, null, 2))
                        .catch(() => {})
                    }
                    data-testid="copy-plan"
                    style={{
                      fontSize: 10,
                      padding: '3px 8px',
                      border: '1px solid var(--accent)',
                      background: 'transparent',
                      color: 'var(--accent)',
                      fontFamily: 'JetBrains Mono, monospace',
                      cursor: 'pointer',
                      letterSpacing: '0.06em'
                    }}
                  >
                    复制 plan
                  </button>
                  <button
                    onClick={() => {
                      const blob = new Blob([JSON.stringify(m.plan, null, 2)], {
                        type: 'application/json'
                      });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = 'patch.json';
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                    data-testid="download-patch"
                    style={{
                      fontSize: 10,
                      padding: '3px 8px',
                      border: '1px solid var(--accent)',
                      background: 'transparent',
                      color: 'var(--accent)',
                      fontFamily: 'JetBrains Mono, monospace',
                      cursor: 'pointer',
                      letterSpacing: '0.06em'
                    }}
                  >
                    下载 patch.json
                  </button>
                </div>
              </details>
            )}
            <div
              style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 9,
                color: m.role === 'user' ? 'var(--mute-2)' : '#64748b',
                marginTop: 4
              }}
            >
              {m.ts ? m.ts.slice(11, 16) : ''}
            </div>
          </div>
        ))}
        {loading && (
          <div
            style={{
              alignSelf: 'flex-start',
              padding: '8px 12px',
              background: 'var(--ink)',
              color: 'var(--mute-2)',
              fontSize: 11,
              fontFamily: 'JetBrains Mono, monospace',
              letterSpacing: '0.1em'
            }}
          >
            ▍▍▍ 思考中…
          </div>
        )}
      </div>

      {/* Shortcuts */}
      <div style={{ display: 'flex', gap: 4, padding: '0 12px 8px', flexWrap: 'wrap' }}>
        {SHORTCUTS.map((s) => (
          <button
            key={s}
            onClick={() => setInput(s.replace('/', ''))}
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

      {/* Input */}
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
          disabled={loading}
          data-testid="ai-input"
          style={{
            flex: 1,
            padding: '6px 10px',
            border: '1px solid var(--line-2)',
            fontFamily: 'Inter, sans-serif',
            fontSize: 12,
            background: 'var(--bg)',
            color: 'var(--ink)',
            outline: 'none'
          }}
        />
        <button
          onClick={send}
          disabled={loading || !input.trim()}
          aria-label="send"
          style={{
            padding: '6px 10px',
            background: loading || !input.trim() ? 'var(--mute-2)' : 'var(--ink)',
            color: '#fff',
            border: 0,
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.1em',
            cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 4
          }}
        >
          <Send size={11} />
          SEND
        </button>
      </div>

      {/* Settings Modal */}
      <AISettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </aside>
  );
}
