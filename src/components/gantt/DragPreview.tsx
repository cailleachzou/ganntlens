import { useUIStore } from '../../store/uiStore';

const STYLE_BASE: Omit<React.CSSProperties, 'left' | 'top'> = {
  position: 'fixed',
  zIndex: 100,
  fontFamily: 'JetBrains Mono, monospace',
  fontSize: 11,
  fontWeight: 700,
  padding: '4px 8px',
  border: '1.5px solid var(--ink)',
  background: 'var(--paper)',
  color: 'var(--ink)',
  pointerEvents: 'none',
  whiteSpace: 'nowrap',
  boxShadow: '2px 2px 0 var(--ink)'
};

/**
 * 拖动期间右上角浮层
 * - 显示 daysDelta / previewEnd / milestone name
 * - 越界时红底白字 + not-allowed 标记
 */
export function DragPreview() {
  const dragState = useUIStore((s) => s.dragState);
  if (!dragState) return null;

  const { type, previewStart, previewEnd, daysDelta, outOfBounds, clientX, clientY } = dragState;

  let label = '';
  if (type === 'task-move') {
    label = `${daysDelta >= 0 ? '+' : ''}${daysDelta}d → ${previewEnd}`;
  } else if (type === 'task-resize-end' || type === 'task-resize-start') {
    label = `${daysDelta >= 0 ? '+' : ''}${daysDelta}d (${type === 'task-resize-end' ? 'end' : 'start'})`;
  } else if (type === 'milestone') {
    label = `→ ${previewStart}`;
  }

  if (outOfBounds) label = `✕ ${label} · out of bounds`;

  const style: React.CSSProperties = {
    ...STYLE_BASE,
    left: clientX + 16,
    top: clientY - 32,
    ...(outOfBounds ? { background: 'var(--today)', color: '#fff' } : {})
  };

  return <div style={style}>{label}</div>;
}
