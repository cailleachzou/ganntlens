"""详细检查 TimelineHeader 对齐问题"""
from playwright.sync_api import sync_playwright
import time

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width": 1920, "height": 1080})
    page.goto("http://localhost:5174/", wait_until="networkidle", timeout=30000)
    time.sleep(1.5)

    # 找 TimelineHeader 的边界
    print("=== TimelineHeader DOM 结构 ===")
    result = page.evaluate("""() => {
        // 找月份行容器（高度28）
        const monthRow = document.querySelector('div[style*="height: 28px"]');
        if (!monthRow) return 'NO month row';

        const rect = monthRow.getBoundingClientRect();
        const monthRowParent = monthRow.parentElement;
        const parentRect = monthRowParent.getBoundingClientRect();

        // 找 GanttChart outer container
        const main = document.querySelector('main');
        const mainRect = main.getBoundingClientRect();

        // 找 GanttChart 内部外层
        const ganttOuter = monthRowParent.parentElement;
        const ganttOuterRect = ganttOuter.getBoundingClientRect();

        // 找 OFC 第一个 task bar (需求调研 05-15) 的 left
        // 范围 03-15 ~ 10-05 = 204 days
        // 05-15 = 61 days / 204 = 29.9%
        // OFC 第一个 task 实际位置
        const allDivs = document.querySelectorAll('div');
        let taskBars = [];
        allDivs.forEach(d => {
            const style = d.getAttribute('style') || '';
            if (style.includes('background: rgb(59, 130, 246)') || style.includes('#dbeafe')) {
                const r = d.getBoundingClientRect();
                taskBars.push({left: r.left, width: r.width, top: r.top, bg: style.substring(0, 60)});
            }
        });

        return {
            mainRect: {x: mainRect.x, width: mainRect.width},
            ganttOuterRect: {x: ganttOuterRect.x, width: ganttOuterRect.width},
            monthRowParentRect: {x: parentRect.x, width: parentRect.width},
            monthRowRect: {x: rect.x, width: rect.width},
            taskBars: taskBars.slice(0, 5)
        };
    }""")
    print(f"main (含 GanttChart): {result['mainRect']}")
    print(f"GanttChart outer: {result['ganttOuterRect']}")
    print(f"TimelineHeader outer (monthRow parent): {result['monthRowParentRect']}")
    print(f"Month row: {result['monthRowRect']}")
    print(f"Task bars: {result['taskBars']}")

    # 关键测试：GanttChart 和 TimelineHeader 是不是同宽
    print("\n=== GanttChart 和 TimelineHeader 同宽? ===")
    if abs(result['ganttOuterRect']['width'] - result['monthRowParentRect']['width']) > 5:
        print(f"!! 不一致: GanttChart={result['ganttOuterRect']['width']} vs TimelineHeader={result['monthRowParentRect']['width']}")
    else:
        print(f"OK 一致: width={result['ganttOuterRect']['width']}")

    # 关键测试：TimelineHeader 是不是 GanttChart 的直接子元素
    print("\n=== TimelineHeader 起始位置 ===")
    if result['ganttOuterRect']['x'] != result['monthRowParentRect']['x']:
        print(f"!! TimelineHeader 偏移: offset = {result['monthRowParentRect']['x'] - result['ganttOuterRect']['x']}px")
    else:
        print("OK TimelineHeader 起始 = GanttChart 起始")

    browser.close()
