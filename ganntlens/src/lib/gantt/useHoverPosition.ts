import { useEffect, useRef, useState } from 'react';

export interface UseHoverPositionOptions {
  /** 鼠标进入后多少 ms 才显示（默认 250） */
  delayIn?: number;
  /** 鼠标离开后多少 ms 渐隐（默认 100） */
  delayOut?: number;
  /** 卡片离鼠标的水平/垂直偏移（默认 16） */
  offsetX?: number;
  offsetY?: number;
  /** 边界翻转阈值：卡片宽 320 / 高 240 默认 */
  flipThreshold?: { x: number; y: number };
}

export interface HoverPosition {
  /** clientX（视口坐标） */
  x: number;
  y: number;
  visible: boolean;
  /** 抽屉打开时 = true，调用方应立即隐藏 */
  immediate: boolean;
}

const DEFAULTS = {
  delayIn: 250,
  delayOut: 100,
  offsetX: 16,
  offsetY: 16,
  flipThreshold: { x: 340, y: 240 }
};

/**
 * 跟踪 hover 元素位置 + 延迟显示 + 边界翻转
 * - 依赖 ref 指向 hover 触发元素（TaskBar 容器）
 * - 返回的 x/y 是 clientX/clientY（用于 position: fixed）
 * - 边界翻转：右距 < flipThreshold.x → 翻向左；下距 < flipThreshold.y → 翻向上
 */
export function useHoverPosition(
  ref: React.RefObject<HTMLElement>,
  immediate: boolean = false,
  options: UseHoverPositionOptions = {}
): HoverPosition {
  const opts = { ...DEFAULTS, ...options, flipThreshold: { ...DEFAULTS.flipThreshold, ...options.flipThreshold } };
  const [pos, setPos] = useState<HoverPosition>({ x: 0, y: 0, visible: false, immediate });

  const showTimer = useRef<number | null>(null);
  const hideTimer = useRef<number | null>(null);
  const mouseRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const clear = (t: React.MutableRefObject<number | null>) => {
    if (t.current !== null) {
      window.clearTimeout(t.current);
      t.current = null;
    }
  };

  const compute = (mx: number, my: number) => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let x = mx + opts.offsetX;
    let y = my + opts.offsetY;
    if (vw - x < opts.flipThreshold.x) x = mx - opts.flipThreshold.x + 32; // 翻向左
    if (vh - y < opts.flipThreshold.y) y = my - opts.flipThreshold.y + 16; // 翻向上
    return { x, y };
  };

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const onEnter = (e: MouseEvent) => {
      if (immediate) return;
      clear(hideTimer);
      mouseRef.current = { x: e.clientX, y: e.clientY };
      const { x, y } = compute(e.clientX, e.clientY);
      showTimer.current = window.setTimeout(() => {
        setPos({ x, y, visible: true, immediate: false });
      }, opts.delayIn);
    };

    const onMove = (e: MouseEvent) => {
      if (immediate) return;
      mouseRef.current = { x: e.clientX, y: e.clientY };
      // mousemove 时取消 show timer 重置（防止快速移动不显示）
      clear(showTimer);
      const { x, y } = compute(e.clientX, e.clientY);
      showTimer.current = window.setTimeout(() => {
        setPos({ x, y, visible: true, immediate: false });
      }, opts.delayIn);
    };

    const onLeave = () => {
      clear(showTimer);
      hideTimer.current = window.setTimeout(() => {
        setPos((p) => ({ ...p, visible: false }));
      }, opts.delayOut);
    };

    el.addEventListener('mouseenter', onEnter);
    el.addEventListener('mousemove', onMove);
    el.addEventListener('mouseleave', onLeave);
    return () => {
      el.removeEventListener('mouseenter', onEnter);
      el.removeEventListener('mousemove', onMove);
      el.removeEventListener('mouseleave', onLeave);
      clear(showTimer);
      clear(hideTimer);
    };
  }, [ref, immediate, opts.delayIn, opts.delayOut, opts.offsetX, opts.offsetY, opts.flipThreshold.x, opts.flipThreshold.y]);

  // 抽屉打开时立即隐藏
  useEffect(() => {
    if (immediate) {
      clear(showTimer);
      clear(hideTimer);
      setPos((p) => ({ ...p, visible: false, immediate: true }));
    }
  }, [immediate]);

  return pos;
}
