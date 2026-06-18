"""检查 M-2026 第一个 task 在 gantt zone 里的位置 vs TimelineHeader 位置"""
from playwright.sync_api import sync_playwright
import time

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width": 1920, "height": 1080})
    page.goto("http://localhost:5174/", wait_until="networkidle", timeout=30000)
    time.sleep(1.5)

    result = page.evaluate("""() => {
        // 找 M-2026 第一行（最下）
        const rows = document.querySelectorAll('main > div > div > div');
        // 简化：找所有 phase ribbon (设计/施工/验收背景色)
        const phaseRibbons = [];
        document.querySelectorAll('div').forEach(d => {
            const bg = d.style.background || '';
            const bgColor = d.style.backgroundColor || '';
            if (bgColor.includes('dbeafe') || bgColor.includes('fef3c7') || bgColor.includes('d1fae5')) {
                const r = d.getBoundingClientRect();
                if (r.height >= 8 && r.height <= 30) {
                    phaseRibbons.push({bg: bgColor, x: r.x, w: r.width, y: r.y});
                }
            }
        });

        // 找所有 milestone 位置
        const milestones = [];
        document.querySelectorAll('div[title]').forEach(d => {
            const t = d.getAttribute('title');
            if (t && (t.includes('M1') || t.includes('M2'))) {
                const r = d.getBoundingClientRect();
                milestones.push({title: t, x: r.x, y: r.y});
            }
        });

        // 找 TimelineHeader 的边界
        const monthRow = document.querySelector('div[style*="height: 28px"]');
        const monthRowRect = monthRow ? monthRow.getBoundingClientRect() : null;

        // 找 GanttChart outer
        const ganttOuter = monthRow ? monthRow.parentElement.parentElement : null;
        const ganttRect = ganttOuter ? ganttOuter.getBoundingClientRect() : null;

        return {
            monthRowRect,
            ganttRect,
            phaseRibbons: phaseRibbons.slice(0, 15),
            milestones
        };
    }""")

    print("=== GanttChart outer ===")
    print(f"  x={result['ganttRect']['x']:.1f}  w={result['ganttRect']['width']:.1f}")
    print("=== TimelineHeader month row ===")
    print(f"  x={result['monthRowRect']['x']:.1f}  w={result['monthRowRect']['width']:.1f}")

    print("\n=== Phase Ribbons (前 15) ===")
    for r in result['phaseRibbons']:
        print(f"  {r['bg']}  x={r['x']:.0f}  w={r['w']:.0f}  y={r['y']:.0f}")

    print("\n=== Milestones ===")
    for m in result['milestones']:
        print(f"  {m['title']}  x={m['x']:.0f}  y={m['y']:.0f}")

    # 关键计算: 如果 GanttChart 在 x=289, w=1303
    # rangeStart=03-15, rangeEnd=10-05, totalDays=204
    # 03-15 = 0%, 03-24 = 9/204 = 4.4%, 05-15 = 61/204 = 29.9%, 05-22 = 68/204 = 33.3%
    gx = result['ganttRect']['x']
    gw = result['ganttRect']['width']
    print(f"\n=== 关键日期位置 (在 gantt zone 内) ===")
    print(f"  03-15 (项目起): x={gx + 0/204*gw:.0f}")
    print(f"  03-24: x={gx + 9/204*gw:.0f}")
    print(f"  05-15: x={gx + 61/204*gw:.0f}")
    print(f"  05-22: x={gx + 68/204*gw:.0f}")

    browser.close()
