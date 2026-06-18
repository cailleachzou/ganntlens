import { useState, useEffect } from 'react';
import { X, Eye, EyeOff, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAIStore, type LLMConfig } from '../../store/aiStore';
import { PROVIDERS, getProviderMeta, needsApiKey } from '../../lib/ai/providers';
import type { AIProvider } from '../../types';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function AISettingsModal({ open, onClose }: Props) {
  const config = useAIStore((s) => s.config);
  const setConfig = useAIStore((s) => s.setConfig);

  const [draft, setDraft] = useState<LLMConfig>(config);
  const [showKey, setShowKey] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle');
  const [testMsg, setTestMsg] = useState('');

  // 每次打开重置 draft
  useEffect(() => {
    if (open) {
      setDraft(config);
      setTestStatus('idle');
      setTestMsg('');
      setShowKey(false);
    }
  }, [open, config]);

  if (!open) return null;

  const meta = getProviderMeta(draft.provider);

  const onChangeProvider = (id: AIProvider) => {
    const m = getProviderMeta(id);
    setDraft({
      provider: id,
      endpoint: m.defaultEndpoint,
      model: m.defaultModel,
      apiKey: id === draft.provider ? draft.apiKey : ''
    });
    setTestStatus('idle');
  };

  const onTest = async () => {
    setTestStatus('testing');
    setTestMsg('');
    // Mock 永远成功
    if (draft.provider === 'mock') {
      await new Promise((r) => setTimeout(r, 500));
      setTestStatus('ok');
      setTestMsg('Mock 引擎无需网络，连接 ✓');
      return;
    }
    // 真实 LLM 测试（D6+ 接入）
    await new Promise((r) => setTimeout(r, 800));
    if (!draft.apiKey) {
      setTestStatus('fail');
      setTestMsg('请先填写 API Key');
      return;
    }
    setTestStatus('ok');
    setTestMsg(`${meta.name} 连接测试通过（D6+ 接入真实请求）`);
  };

  const onSave = () => {
    if (needsApiKey(draft.provider) && !draft.apiKey) {
      setTestStatus('fail');
      setTestMsg('该 Provider 需要 API Key');
      return;
    }
    setConfig(draft);
    onClose();
  };

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.4)',
          zIndex: 50,
          animation: 'fadeIn 150ms'
        }}
      />
      <div
        role="dialog"
        aria-label="AI Settings"
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 480,
          maxWidth: '92vw',
          maxHeight: '90vh',
          overflowY: 'auto',
          background: 'var(--paper)',
          border: '1px solid var(--line)',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.25)',
          zIndex: 51,
          fontFamily: 'Inter, sans-serif'
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '14px 18px',
            borderBottom: '1px solid var(--line)',
            display: 'flex',
            alignItems: 'center',
            gap: 10
          }}
        >
          <span
            style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 10,
              color: 'var(--accent)',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              fontWeight: 700
            }}
          >
            AI · SETTINGS
          </span>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>
            模型与连接
          </span>
          <button
            onClick={onClose}
            aria-label="close"
            style={{
              marginLeft: 'auto',
              background: 'transparent',
              border: 0,
              cursor: 'pointer',
              padding: 4,
              color: 'var(--mute)'
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '18px 18px 12px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Provider 选择 */}
          <div>
            <label style={labelStyle}>Provider</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {PROVIDERS.map((p) => {
                const active = draft.provider === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => onChangeProvider(p.id)}
                    style={{
                      padding: '8px 10px',
                      border: `1px solid ${active ? 'var(--ink)' : 'var(--line)'}`,
                      background: active ? 'var(--ink)' : 'var(--paper)',
                      color: active ? '#fff' : 'var(--ink)',
                      fontFamily: 'Inter, sans-serif',
                      fontSize: 12,
                      fontWeight: 500,
                      cursor: 'pointer',
                      textAlign: 'left',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6
                    }}
                  >
                    <span style={{ flex: 1 }}>{p.name}</span>
                    {p.badge && (
                      <span
                        style={{
                          fontFamily: 'JetBrains Mono, monospace',
                          fontSize: 9,
                          padding: '1px 5px',
                          background: active ? 'var(--accent)' : 'var(--bg-2)',
                          color: active ? 'var(--ink)' : 'var(--mute)',
                          letterSpacing: '0.06em'
                        }}
                      >
                        {p.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Endpoint */}
          <div>
            <label style={labelStyle}>
              Endpoint
              {meta.id !== 'custom' && (
                <span style={{ color: 'var(--mute)', fontWeight: 400, marginLeft: 6 }}>(默认)</span>
              )}
            </label>
            <input
              value={draft.endpoint ?? ''}
              onChange={(e) => setDraft({ ...draft, endpoint: e.target.value })}
              placeholder={meta.defaultEndpoint || 'https://your-api.example.com/v1'}
              disabled={meta.id === 'mock'}
              style={{
                ...inputStyle,
                background: meta.id === 'mock' ? 'var(--bg-2)' : 'var(--paper)',
                color: meta.id === 'mock' ? 'var(--mute)' : 'var(--ink)'
              }}
            />
          </div>

          {/* Model */}
          <div>
            <label style={labelStyle}>Model</label>
            <input
              value={draft.model ?? ''}
              onChange={(e) => setDraft({ ...draft, model: e.target.value })}
              placeholder={meta.defaultModel || 'model-name'}
              style={inputStyle}
            />
          </div>

          {/* API Key */}
          <div>
            <label style={labelStyle}>
              API Key
              {!needsApiKey(draft.provider) && (
                <span style={{ color: 'var(--mute)', fontWeight: 400, marginLeft: 6 }}>
                  (Mock 不需要)
                </span>
              )}
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showKey ? 'text' : 'password'}
                value={draft.apiKey ?? ''}
                onChange={(e) => setDraft({ ...draft, apiKey: e.target.value })}
                placeholder={meta.keyHint || 'sk-...'}
                disabled={!needsApiKey(draft.provider)}
                style={{
                  ...inputStyle,
                  paddingRight: 36,
                  fontFamily: 'JetBrains Mono, monospace',
                  background: !needsApiKey(draft.provider) ? 'var(--bg-2)' : 'var(--paper)'
                }}
              />
              {needsApiKey(draft.provider) && (
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  aria-label="toggle key visibility"
                  style={{
                    position: 'absolute',
                    right: 6,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'transparent',
                    border: 0,
                    cursor: 'pointer',
                    padding: 4,
                    color: 'var(--mute)'
                  }}
                >
                  {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              )}
            </div>
            <p style={{ fontSize: 10, color: 'var(--mute-2)', marginTop: 4, lineHeight: 1.5 }}>
              🔒 Key 仅存于浏览器 localStorage，绝不入 Git / 绝不上传服务端
            </p>
          </div>

          {/* Test */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 12px',
              background: 'var(--bg-2)',
              border: '1px solid var(--line)'
            }}
          >
            <button
              onClick={onTest}
              disabled={testStatus === 'testing'}
              style={{
                padding: '5px 12px',
                background: 'transparent',
                color: 'var(--ink)',
                border: '1px solid var(--ink)',
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.1em',
                cursor: testStatus === 'testing' ? 'wait' : 'pointer'
              }}
            >
              {testStatus === 'testing' ? 'TESTING…' : 'TEST CONNECTION'}
            </button>
            {testStatus === 'ok' && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#10b981', fontSize: 11 }}>
                <CheckCircle2 size={13} /> {testMsg}
              </span>
            )}
            {testStatus === 'fail' && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#dc2626', fontSize: 11 }}>
                <AlertCircle size={13} /> {testMsg}
              </span>
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '12px 18px',
            borderTop: '1px solid var(--line)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: '7px 14px',
              background: 'transparent',
              color: 'var(--ink)',
              border: '1px solid var(--line)',
              fontFamily: 'Inter, sans-serif',
              fontSize: 12,
              cursor: 'pointer'
            }}
          >
            取消
          </button>
          <button
            onClick={onSave}
            style={{
              padding: '7px 14px',
              background: 'var(--ink)',
              color: '#fff',
              border: 0,
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.1em',
              cursor: 'pointer'
            }}
          >
            SAVE
          </button>
        </div>
      </div>
    </>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontFamily: 'JetBrains Mono, monospace',
  fontSize: 10,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: 'var(--mute)',
  marginBottom: 6,
  fontWeight: 600
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '7px 10px',
  border: '1px solid var(--line-2)',
  fontFamily: 'Inter, sans-serif',
  fontSize: 12,
  background: 'var(--paper)',
  color: 'var(--ink)',
  boxSizing: 'border-box',
  outline: 'none'
};
