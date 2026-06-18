"""检查 3 个问题：M1/M2 位置、左侧 chips、时间轴对齐"""
from playwright.sync_api import sync_playwright
import time

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width": 1920, "height": 1080})
    page.goto("http://localhost:5174/", wait_until="networkidle", timeout=30000)
    time.sleep(1.5)

    # 全页截图
    page.screenshot(path="c:/git-project/TRAE/d4p3-fullpage.png", full_page=True)

    # ============ 1. M1/M2 节点位置 ============
    print("\n=== 1. M1/M2 节点位置 ===")
    milestones = page.locator("[title*='M1'], [title*='M2']").all()
    for m in milestones:
        title = m.get_attribute("title")
        box = m.bounding_box()
        print(f"  {title}  x={box['x']:.0f}  y={box['y']:.0f}")

    # ============ 2. 左侧 chips ============
    print("\n=== 2. 左侧 chips 位置 ===")
    chips = page.locator("[data-testid^='project-chip-']").all()
    for c in chips:
        tid = c.get_attribute("data-testid")
        box = c.bounding_box()
        print(f"  {tid}  x={box['x']:.0f}  y={box['y']:.0f}  w={box['width']:.0f}")

    gantt = page.locator("main").first.bounding_box()
    print(f"  GanttChart  x={gantt['x']:.0f}  w={gantt['width']:.0f}")

    # ============ 3. TimelineHeader vs GanttZone 对齐 ============
    print("\n=== 3. TimelineHeader 位置 ===")
    # 找到月份标签位置
    months = page.locator("text=/^\\d{4} (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)$/").all()
    for mo in months:
        text = mo.text_content()
        box = mo.bounding_box()
        print(f"  {text}  x={box['x']:.0f}  w={box['width']:.0f}")

    # ============ 4. 看 M-2026 第一个 task 的视觉位置 ============
    print("\n=== 4. M-2026 第一个 task 视觉位置 ===")
    # M-2026 是第三个项目行
    m2026_row = page.locator("text=某博物馆弱电集成").first
    if m2026_row.is_visible():
        row_box = m2026_row.bounding_box()
        print(f"  M-2026 row text x={row_box['x']:.0f}")

    # 看 gantt zone 中第一个 task bar (M-2026 需求确认 03-15)
    # 找 03-15 位置的 task bar
    print("\n=== 5. Top timeline 月份边界 vs GanttZone 月份边界 ===")

    browser.close()
    print("\nDone. Screenshot: c:/git-project/TRAE/d4p3-fullpage.png")
