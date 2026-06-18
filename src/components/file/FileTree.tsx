import { useState } from 'react';
import type { FileNode } from '../../types';
import { FileText, Folder, FolderOpen, ChevronRight, ChevronDown } from 'lucide-react';

interface Props {
  files: FileNode[];
  onSelect?: (file: FileNode) => void;
}

/** 文件树 - 折叠展开 + 选中态 */
export function FileTree({ files, onSelect }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(files.filter((f) => f.type === 'folder').map((f) => f.id))
  );
  const [selected, setSelected] = useState<string | null>(null);

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelect = (node: FileNode) => {
    if (node.type === 'file') {
      setSelected(node.id);
      onSelect?.(node);
    } else {
      toggle(node.id);
    }
  };

  // 顶层 + 嵌套
  const renderNode = (node: FileNode, depth: number) => {
    if (node.type === 'folder') {
      const isOpen = expanded.has(node.id);
      const children = files.filter((f) => f.parentId === node.id);
      return (
        <div key={node.id}>
          <div
            onClick={() => handleSelect(node)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '4px 16px 4px ' + (8 + depth * 14) + 'px',
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--ink)',
              cursor: 'pointer'
            }}
          >
            {isOpen ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
            {isOpen ? <FolderOpen size={12} color="var(--mute-2)" /> : <Folder size={12} color="var(--mute-2)" />}
            <span>{node.name}</span>
            <span style={{ marginLeft: 'auto', fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: 'var(--mute-2)' }}>
              {children.length}
            </span>
          </div>
          {isOpen && children.map((c) => renderNode(c, depth + 1))}
        </div>
      );
    }
    return (
      <div
        key={node.id}
        onClick={() => handleSelect(node)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '4px 16px 4px ' + (24 + depth * 14) + 'px',
          fontSize: 11,
          color: 'var(--mute)',
          cursor: 'pointer',
          background: selected === node.id ? 'var(--accent-bg)' : 'transparent'
        }}
      >
        <span style={{ width: 10 }} />
        <FileText size={11} color="var(--mute-2)" />
        <span style={{ flex: 1 }}>{node.name}</span>
        {node.ext && (
          <span
            style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 9,
              color: 'var(--mute-2)',
              textTransform: 'uppercase'
            }}
          >
            {node.ext}
          </span>
        )}
      </div>
    );
  };

  const topLevel = files.filter((f) => !f.parentId);

  return (
    <aside
      style={{
        width: 240,
        background: 'var(--paper)',
        borderRight: '1px solid var(--line)',
        flexShrink: 0,
        overflowY: 'auto'
      }}
    >
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--line)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <span
          style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 10,
            color: 'var(--mute)',
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            fontWeight: 700
          }}
        >
          FILES
        </span>
        <span
          style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 10,
            color: 'var(--ink-3)',
            fontWeight: 700
          }}
        >
          {String(files.filter((f) => f.type === 'file').length).padStart(2, '0')}
        </span>
      </div>
      <div style={{ padding: '8px 0' }}>{topLevel.map((n) => renderNode(n, 0))}</div>
    </aside>
  );
}
