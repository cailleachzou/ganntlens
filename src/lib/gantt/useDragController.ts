import { useEffect, useRef } from 'react';
import { pixelDeltaToDays } from './dateUtils';

export interface UseDragControllerOptions {
  /** ref 指向甘特区容器（用于计算像素→百分比） */
  containerRef: React.RefObject<HTMLElement>;
  /** ref 指向触发元素（TaskBar / MilestoneMarker） */
  handleRef: React.RefObject<HTMLElement>;
  /** range 区间 */
  rangeStart: string;
  rangeEnd: string;
  /** 边界检测 + 计算 preview 的回调（接收 daysDelta，返回 { previewStart, previewEnd, outOfBounds }） */
  computePreview: (daysDelta: number) => { previewStart: string; previewEnd: string; outOfBounds: boolean };
  /** 拖动期间实时回调（更新 uiStore.dragState） */
  onDrag: (preview: { previewStart: string; previewEnd: string; daysDelta: number; outOfBounds: boolean; clientX: number; clientY: number }) => void;
  /** 拖动结束（commit store action）。如果 outOfBounds 也会调，由调用方决定是否真 commit。 */
  onCommit: (final: { previewStart: string; previewEnd: string; daysDelta: number; outOfBounds: boolean }) => void;
  /** 拖动是否启用 */
  enabled?: boolean;
}

/**
 * 拖拽控制器 - 纯 DOM 事件
 * - mousedown 在 handleRef 上 → 进入 drag
 * - mousemove 在 window 上 → 计算 delta → computePreview → onDrag
 * - mouseup 在 window/document 上 → onCommit
 * - 越界：computePreview 返回 outOfBounds=true，cursor 由调用方决定
 * - drawerOpen/AI 命令触发 cancelDrag：调用方负责
 *
 * 性能：computePreview/onDrag/onCommit 通过 ref 缓存，useEffect deps 只看稳定引用
 * （handleRef / containerRef / rangeStart / rangeEnd / enabled），避免父组件 re-render 触发 listener 抖动
 */
export function useDragController(opts: UseDragControllerOptions) {
  // callback refs - 缓存函数引用，避免 useEffect 频繁重绑
  const computePreviewRef = useRef(opts.computePreview);
  const onDragRef = useRef(opts.onDrag);
  const onCommitRef = useRef(opts.onCommit);
  computePreviewRef.current = opts.computePreview;
  onDragRef.current = opts.onDrag;
  onCommitRef.current = opts.onCommit;

  const stateRef = useRef({
    isDragging: false,
    startX: 0,
    currentDelta: 0
  });

  useEffect(() => {
    if (!opts.enabled) return;
    const handleEl = opts.handleRef.current;
    const containerEl = opts.containerRef.current;
    if (!handleEl || !containerEl) return;

    const onMouseDown = (e: MouseEvent) => {
      // 左键才触发
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      stateRef.current.isDragging = true;
      stateRef.current.startX = e.clientX;
      stateRef.current.currentDelta = 0;
      document.body.style.cursor = 'grabbing';
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!stateRef.current.isDragging) return;
      const deltaPx = e.clientX - stateRef.current.startX;
      stateRef.current.currentDelta = deltaPx;
      const containerWidth = containerEl.getBoundingClientRect().width;
      const daysDelta = pixelDeltaToDays(deltaPx, opts.rangeStart, opts.rangeEnd, containerWidth);
      const { previewStart, previewEnd, outOfBounds } = computePreviewRef.current(daysDelta);
      onDragRef.current({
        previewStart,
        previewEnd,
        daysDelta,
        outOfBounds,
        clientX: e.clientX,
        clientY: e.clientY
      });
    };

    const onMouseUp = () => {
      if (!stateRef.current.isDragging) return;
      stateRef.current.isDragging = false;
      document.body.style.cursor = '';
      const containerWidth = containerEl.getBoundingClientRect().width;
      const daysDelta = pixelDeltaToDays(stateRef.current.currentDelta, opts.rangeStart, opts.rangeEnd, containerWidth);
      const { previewStart, previewEnd, outOfBounds } = computePreviewRef.current(daysDelta);
      onCommitRef.current({ previewStart, previewEnd, daysDelta, outOfBounds });
    };

    handleEl.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    // window + document 共享同一个 onMouseUp 引用（onMouseUp 幂等）
    window.addEventListener('mouseup', onMouseUp);
    document.addEventListener('mouseup', onMouseUp);

    return () => {
      handleEl.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
    };
  }, [opts.enabled, opts.handleRef, opts.containerRef, opts.rangeStart, opts.rangeEnd]);
}
