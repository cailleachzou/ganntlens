"""临时检查：M1/M2 位置 + Timeline 对齐"""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_context(viewport={"width": 1600, "height": 900}).new_page()
    page.goto("http://localhost:5173")
    page.wait_for_load_state("networkidle")
    import time; time.sleep(0.5)

    # 取所有 milestone marker 的位置
    info = page.evaluate("""() => {
        const markers = document.querySelectorAll('div[title*="M"]');
        const out = [];
        for (const m of markers) {
            const rect = m.getBoundingClientRect();
            out.push({
                title: m.title,
                x: Math.round(rect.left + rect.width/2),
                y: Math.round(rect.top + rect.height/2)
            });
        }
        // 也取 TimelineHeader 第一个月份标签
        const months = document.querySelectorAll('div');
        let firstMonth = null;
        for (const d of months) {
            if (d.textContent && /\\d{4}\\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/.test(d.textContent.trim())) {
                const r = d.getBoundingClientRect();
                firstMonth = {text: d.textContent.trim(), x: Math.round(r.left), w: Math.round(r.width)};
                break;
            }
        }
        // 也取大甘特图容器的位置
        const ganttContainer = document.querySelector('div[style*="background: var(--paper)"]');
        let ganttLeft = null;
        if (ganttContainer) {
            const r = ganttContainer.getBoundingClientRect();
            ganttLeft = Math.round(r.left);
        }
        return { markers: out, firstMonth, ganttLeft };
    }""")

    print("=== Milestone 位置 ===")
    for m in info["markers"]:
        print(f"  {m['title']:30s}  x={m['x']:4d}  y={m['y']:4d}")
    print(f"\n=== Timeline 第一个月份 ===\n  {info['firstMonth']}")
    print(f"\n=== 大甘特图容器左边 x = {info['ganttLeft']} ===")

    page.screenshot(path="d4p2-milestones.png", full_page=False)
    print("\n📸 d4p2-milestones.png 已保存")
    browser.close()
