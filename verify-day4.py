"""D4 验证脚本：总览清理 + v9 hover + v9 抽屉动画"""
import time
from playwright.sync_api import sync_playwright

URL = "http://localhost:5173"

def main():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        ctx = browser.new_context(viewport={"width": 1440, "height": 900})
        page = ctx.new_page()
        errors = []
        page.on("console", lambda msg: errors.append(f"[{msg.type}] {msg.text}") if msg.type == "error" else None)
        page.on("pageerror", lambda err: errors.append(f"[pageerror] {err}"))

        # ---- 0. 总览页 ----
        page.goto(URL)
        page.wait_for_load_state("networkidle")
        time.sleep(0.5)

        # 0.1 左侧 240px projects aside 应该不存在
        aside_count = page.locator("aside").count()
        assert aside_count == 1, f"expected 1 aside (right panel only), got {aside_count}"

        # 0.2 顶部 3 个项目 chip
        chips = page.locator("[data-testid^='project-chip-']")
        assert chips.count() == 3, f"expected 3 project chips, got {chips.count()}"

        # 0.3 TodayLine 数量 = 1
        red_lines = page.locator("div[style*='background: var(--today)']").count()
        assert red_lines >= 1, f"expected >=1 red today line, got {red_lines}"

        page.screenshot(path="d4-overview.png", full_page=False)
        print("✓ 0. OverviewPage 验证通过")

        # ---- 1. v9 hover 卡片（大甘特图）----
        # 找第一个任务条（跳过前 3 个 PhaseRibbon 阶段条）
        first_task = page.locator("[title*='→']").nth(3)
        first_task.hover(force=True)
        time.sleep(0.4)  # 250ms 延迟 + buffer

        # hover 卡应可见
        hover_card_visible = page.evaluate("""() => {
            const cards = document.querySelectorAll('[style*="width: 320px"]');
            for (const c of cards) {
                const op = parseFloat(getComputedStyle(c).opacity);
                if (op > 0) return true;
            }
            return false;
        }""")
        assert hover_card_visible, "hover card not visible on big gantt"
        print("✓ 1. v9 hover card on big gantt works")
        page.screenshot(path="d4-big-gantt-hover.png", full_page=False)

        # 鼠标移走
        page.mouse.move(10, 10)
        time.sleep(0.3)

        # ---- 2. 详情页 hover + 抽屉 ----
        page.goto(f"{URL}/projects/m-2026")
        page.wait_for_load_state("networkidle")
        time.sleep(0.5)

        # 2.1 hover 任务（跳过前 3 个 PhaseRibbon 阶段条）
        task_in_detail = page.locator("[title*='→']").nth(3)
        task_in_detail.hover(force=True)
        time.sleep(0.4)
        page.screenshot(path="d4-detail-hover.png", full_page=False)

        # 2.2 离开 hover 后点击（防误触 150ms 后才能 click）
        time.sleep(0.2)
        task_in_detail.click(force=True)
        time.sleep(0.3)

        # 2.3 抽屉打开
        drawer = page.locator("[data-testid='task-drawer']")
        assert drawer.is_visible(), "drawer not visible after click"
        # 抽屉应有 open class
        has_open = page.evaluate("""() => {
            const d = document.querySelector('[data-testid="task-drawer"]');
            return d && d.className.includes('open');
        }""")
        assert has_open, "drawer missing 'open' class"
        print("✓ 2. drawer opened with open class")
        page.screenshot(path="d4-drawer-open.png", full_page=False)

        # 2.4 遮罩
        backdrop = page.locator("[data-testid='drawer-backdrop']")
        assert backdrop.is_visible(), "backdrop not visible"
        print("✓ 3. backdrop visible")

        # 2.5 ESC 关闭
        page.keyboard.press("Escape")
        time.sleep(0.2)
        # 抽屉应被卸载（drawerOpen=false → selectedTask=null → 不再渲染 TaskDrawer）
        drawer_state = page.evaluate("""() => {
            const d = document.querySelector('[data-testid="task-drawer"]');
            return d ? d.className : 'unmounted';
        }""")
        assert drawer_state == 'unmounted', f"ESC did not close drawer, class={drawer_state}"
        print("✓ 4. ESC closes drawer")
        time.sleep(0.3)  # 等动画结束
        page.screenshot(path="d4-drawer-closed.png", full_page=False)

        # 2.6 点击遮罩关闭（重新打开后测试）
        task_in_detail.click(force=True)
        time.sleep(0.3)
        # backdrop 中心 (720, 450) 在 drawer 范围 (700-1120) 内，点 backdrop 左侧
        backdrop.click(force=True, position={"x": 100, "y": 100})
        time.sleep(0.3)
        drawer_state2 = page.evaluate("""() => {
            const d = document.querySelector('[data-testid="task-drawer"]');
            return d ? d.className : 'unmounted';
        }""")
        assert drawer_state2 == 'unmounted', f"backdrop click did not close drawer, class={drawer_state2}"
        print("✓ 5. backdrop click closes drawer")

        # ---- 错误检查 ----
        assert len(errors) == 0, f"console errors: {errors}"
        print(f"✓ no console errors")

        browser.close()
        print("\n🎉 D4 全部验证通过")

if __name__ == "__main__":
    main()
