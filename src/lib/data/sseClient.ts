// D7 SSE 客户端
// EventSource hook，订阅项目变更事件

import { useEffect } from 'react';
import type { ProjectEvent, ScanEvent } from '../../types/data';

export function useProjectEvents(
  handler: (evt: ProjectEvent) => void,
  scanHandler?: (evt: ScanEvent) => void
) {
  useEffect(() => {
    const es = new EventSource('/api/events');
    const kinds: ProjectEvent['kind'][] = [
      'project-updated',
      'files-updated',
      'activities-updated',
      'ai-notes-updated'
    ];
    kinds.forEach((kind) => {
      es.addEventListener(kind, (e: MessageEvent) => {
        try {
          handler(JSON.parse(e.data));
        } catch (err) {
          console.error('[sseClient] parse error', err);
        }
      });
    });
    // D8 扫描事件
    const scanKinds: ScanEvent['kind'][] = ['scan-start', 'scan-complete'];
    scanKinds.forEach((kind) => {
      es.addEventListener(kind, (e: MessageEvent) => {
        try {
          scanHandler?.(JSON.parse(e.data));
        } catch (err) {
          console.error('[sseClient] scan parse error', err);
        }
      });
    });
    es.onerror = () => {
      // EventSource 自动重连，这里只 log
      console.warn('[sseClient] connection lost, reconnecting...');
    };
    return () => es.close();
  }, [handler, scanHandler]);
}
