"""详细验证 timeline 对齐 + M1/M2 位置"""
from playwright.sync_api import sync_playwright
import time

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width": 1920, "height": 1080})
    page.goto("http://localhost:5174/", wait_until="networkidle", timeout=30000)
    time.sleep(1.5)

    # 截图
    page.screenshot(path="c:/git-project/TRAE/d4p3-fixed.png", full_page=True)

    # 关键验证：TimelineHeader 月份边界 vs M-2026 第一个 task 位置 vs M1 位置
    result = page.evaluate("""() => {
        // 1. TimelineHeader 的月份边界（3月 起点 + 4月 起点）
        const monthDivs = document.querySelectorAll('div[style*="position: absolute"][style*="JetBrains Mono"]');
        const months = [];
        monthDivs.forEach(d => {
            const text = d.textContent;
            if (text && /\\d{4}\\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/.test(text)) {
                const r = d.getBoundingClientRect();
                months.push({label: text.trim(), x: r.x, right: r.x + r.width});
            }
        });

        // 2. M-2026 的第一个 task bar (t1: 03-15 ~ 03-25)
        // 通过找 M-2026 行的最左边的 task bar
        // M-2026 是第 3 个项目行
        // 找所有 task bar (有 left% style)
        const taskBars = [];
        document.querySelectorAll('div[style*="position: absolute"]').forEach(d => {
            const style = d.getAttribute('style') || '';
            if (style.includes('border-radius') && style.includes('height:')) {
                const r = d.getBoundingClientRect();
                if (r.width > 5 && r.width < 200 && r.height > 8 && r.height < 30) {
                    taskBars.push({x: r.x, w: r.width, y: r.y, h: r.height, style: style.substring(0, 100)});
                }
            }
        });

        // 3. M-2026 的 M1 位置
        const milestones = [];
        document.querySelectorAll('div[title]').forEach(d => {
            const t = d.getAttribute('title');
            if (t && (t.includes('M1') || t.includes('M2'))) {
                const r = d.getBoundingClientRect();
                milestones.push({title: t, x: r.x, y: r.y});
            }
        });

        return {months, taskBars: taskBars.slice(0, 20), milestones};
    }""")

    print("=== TimelineHeader 月份边界（关键） ===")
    for m in result['months']:
        print(f"  {m['label']}  left={m['x']:.0f}  right={m['right']:.0f}")

    # 找 3月 起点 = rangeStart
    mar = next((m for m in result['months'] if 'Mar' in m['label']), None)
    apr = next((m for m in result['months'] if 'Apr' in m['label']), None)
    may = next((m for m in result['months'] if 'May' in m['label']), None)
    if mar and apr:
        print(f"\n  3月→4月 间隔 = {apr['x'] - mar['x']:.0f}px (代表 3月整天数)")
    if apr and may:
        print(f"  4月→5月 间隔 = {may['x'] - apr['x']:.0f}px (代表 4月整天数)")

    print("\n=== M1/M2 节点位置 ===")
    for m in result['milestones']:
        print(f"  {m['title']}  x={m['x']:.0f}  y={m['y']:.0f}")

    # 关键测试：M-2026 M1 (04-15) 视觉位置 vs TimelineHeader 4月15日位置
    print("\n=== 关键对齐验证 ===")
    print(f"  TimelineHeader 4月起点 x = {apr['x'] if apr else 'N/A'}")
    # 4月15日 = 4月起点 + (14/30) * 4月宽度
    if apr and mar:
        apr_width = next((m for m in result['months'] if 'Apr' in m['label']), None)
        if apr_width:
            apr_15 = apr['x'] + 14/30 * (apr_width['right'] - apr['x'])
            print(f"  TimelineHeader 4月15日预期 x = {apr_15:.0f}")
    m1_2026 = next((m for m in result['milestones'] if 'M1' in m['title'] and '04-15' in m['title']), None)
    if m1_2026:
        print(f"  M-2026 M1 (04-15) 实际 x = {m1_2026['x']:.0f}")
        if apr:
            expected = apr['x'] + 14/30 * (apr['right'] - apr['x'])
            diff = abs(m1_2026['x'] - expected)
            print(f"  偏差 = {diff:.1f}px (≤10 为正常舍入)")

    browser.close()
    print("\n截图: c:/git-project/TRAE/d4p3-fixed.png")
