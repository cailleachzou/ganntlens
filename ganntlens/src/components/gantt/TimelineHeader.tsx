import { rangeToPercent } from '../../lib/gantt/dateUtils';

interface Props {
  rangeStart: string;
  rangeEnd: string;
  view: 'week' | 'month';
}

/** 时间轴头部 - 共享顶部时间标尺 */
export function TimelineHeader({ rangeStart, rangeEnd, view }: Props) {
  // 月份（粗）
  const startDate = new Date(rangeStart);
  const endDate = new Date(rangeEnd);
  const months: { label: string; left: number; width: number }[] = [];
  const cur = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  while (cur <= endDate) {
    const y = cur.getFullYear();
    const m = cur.getMonth();
    const monthStart = new Date(y, m, 1);
    const monthEnd = new Date(y, m + 1, 0); // 0 = last day of prev month
    const segStart = monthStart < startDate ? startDate : monthStart;
    const segEnd = monthEnd > endDate ? endDate : monthEnd;
    const fmt = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const { left, width } = rangeToPercent(fmt(segStart), fmt(segEnd), rangeStart, rangeEnd);
    const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    months.push({ label: `${y} ${MONTH_LABELS[m]}`, left, width });
    cur.setMonth(cur.getMonth() + 1);
  }

  // 周（细）
  const weeks: { label: string; left: number; width: number; isToday?: boolean }[] = [];
  if (view === 'week') {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const wstart = new Date(startDate);
    const dow = wstart.getDay();
    const offset = dow === 0 ? -6 : 1 - dow;
    wstart.setDate(wstart.getDate() + offset);
    while (wstart <= endDate) {
      const wend = new Date(wstart);
      wend.setDate(wend.getDate() + 6);
      const segStart = wstart < startDate ? startDate : wstart;
      const segEnd = wend > endDate ? endDate : wend;
      const fmt = (d: Date) =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const { left, width } = rangeToPercent(fmt(segStart), fmt(segEnd), rangeStart, rangeEnd);
      weeks.push({ label: String(wstart.getDate()), left, width });
      wstart.setDate(wstart.getDate() + 7);
    }
    // 标记今天
    const todayIdx = weeks.findIndex(
      (w) => parseInt(w.label) >= 1 && parseInt(w.label) <= 7
    );
    if (todayIdx >= 0) {
      weeks[todayIdx].isToday = false; // 简化：不标今天到周
    }
  }

  return (
    <div style={{ borderBottom: '1px solid var(--line)' }}>
      {/* 月份行 */}
      <div
        style={{
          position: 'relative',
          height: 28,
          background: 'var(--bg-2)',
          borderBottom: '1px solid var(--line)'
        }}
      >
        {months.map((m, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: `${m.left}%`,
              width: `${m.width}%`,
              borderLeft: i === 0 ? 'none' : '1px solid var(--line)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 11,
              color: 'var(--mute)',
              fontWeight: 600
            }}
          >
            {m.label}
          </div>
        ))}
      </div>
      {/* 周/日 行 */}
      {view === 'week' && (
        <div style={{ position: 'relative', height: 22 }}>
          {weeks.map((w, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: `${w.left}%`,
                width: `${w.width}%`,
                borderLeft: i === 0 ? 'none' : '1px dashed var(--line)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 9,
                color: 'var(--mute-2)'
              }}
            >
              {w.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
