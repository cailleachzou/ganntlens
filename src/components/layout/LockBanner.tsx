import { useUIStore } from '../../store/uiStore';

export function LockBanner() {
  const lockState = useUIStore((s) => s.lockState);
  if (!lockState.projectId) return null;
  return (
    <div
      data-testid="lock-banner"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        background: 'var(--accent)',
        color: '#fff',
        padding: '6px 16px',
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 12,
        zIndex: 100,
        textAlign: 'center',
        letterSpacing: '0.05em'
      }}
    >
      🔒 {lockState.projectId} 正被 {lockState.owner} 编辑 ({lockState.reason ?? 'in progress'}) — 2 分钟自动失效
    </div>
  );
}
