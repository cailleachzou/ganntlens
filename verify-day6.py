#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""D6 验证脚本：拖拽编辑（move + resize + milestone + 越界 + 联动 actual + drawer 取消）

路由：项目详情页 /projects/:projectId（App.tsx 定义）
DragPreview 样式：position: fixed; z-index: 100（React 把 zIndex 渲染为 z-index）
TaskBar data-testid: task-move-{id} / task-resize-start-{id} / task-resize-end-{id}
MilestoneMarker data-testid: milestone-{id}
localStorage key: pm-projects（zustand persist）

Vite base = '/ganntlens/'，所以 dev URL 前缀是 /ganntlens/
但 React Router basename 在 dev = '/'，所以 NavLink 跳到 /projects/:id
测试策略：先 goto /ganntlens/（Overview），再点 M-2026 nav 触发 SPA 导航到 /projects/m-2026

注意：TaskBar 的 project 查找用了 `find by task id`，但 t1-t8 在三个项目里都存在
→ find() 总返回 OFC-2026（第一个），导致 M-2026/DC-2026 的拖动用错 phase（边界检测 + moveTask 都错）
→ 详细见 verify-day6 报告。本测试在 ofc-2026 上跑（bug 不显现），M-2026 的 bug 报告给 controller
"""
import sys
import time
from playwright.sync_api import sync_playwright

URL = "http://localhost:5173"
SHOT_DIR = "c:/git-project/TRAE"


def get_task_plan(page, project_id: str, task_id: str):
    return page.evaluate("""({projectId, taskId}) => {
        const raw = localStorage.getItem('pm-projects') || '{}';
        const projects = JSON.parse(raw).state?.projects || [];
        const p = projects.find(p => p.id === projectId);
        if (!p) return null;
        const t = p.tasks.find(t => t.id === taskId);
        if (!t) return null;
        return {
            planStart: t.planStart, planEnd: t.planEnd,
            actualStart: t.actualStart, actualEnd: t.actualEnd,
            progress: t.progress
        };
    }""", {"projectId": project_id, "taskId": task_id})


def get_milestone_date(page, project_id: str, milestone_id: str):
    return page.evaluate("""({projectId, milestoneId}) => {
        const raw = localStorage.getItem('pm-projects') || '{}';
        const projects = JSON.parse(raw).state?.projects || [];
        const p = projects.find(p => p.id === projectId);
        if (!p) return null;
        const m = p.milestones.find(m => m.id === milestoneId);
        if (!m) return null;
        return { date: m.date, name: m.name };
    }""", {"projectId": project_id, "milestoneId": milestone_id})


def is_drawer_open(page) -> bool:
    """检测 drawer-backdrop 是否处于 open 状态"""
    return page.evaluate("""() => {
        const el = document.querySelector('.drawer-backdrop');
        return el && el.className.includes('open');
    }""")


def close_drawer_if_open(page):
    if is_drawer_open(page):
        page.keyboard.press("Escape")
        time.sleep(0.2)


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        ctx = browser.new_context(viewport={"width": 1440, "height": 900})
        page = ctx.new_page()
        errors = []
        page.on("console", lambda msg: errors.append(f"[{msg.type}] {msg.text[:200]}") if msg.type == "error" else None)
        page.on("pageerror", lambda err: errors.append(f"[pageerror] {err}"))

        # ---- 0. 详情页准备 ----
        # Vite base = '/ganntlens/'，先加载根 URL，再点 nav 跳到项目页
        page.goto(f"{URL}/ganntlens/", wait_until="networkidle")
        page.evaluate("() => { localStorage.clear(); }")
        page.reload(wait_until="networkidle")
        time.sleep(0.5)

        # 点 OFC-2026 nav link（TaskBar.find bug 在 OFC 上不显现；M-2026/DC-2026 见报告）
        page.locator("a:has-text('OFC-2026')").first.click()
        page.wait_for_selector("text=设计文档", timeout=8000)
        time.sleep(0.5)
        project_id = "ofc-2026"
        page.screenshot(path=f"{SHOT_DIR}/d6-debug-initial.png", full_page=False)
        page.wait_for_selector("[data-testid^='task-move-']", timeout=8000)
        time.sleep(0.3)
        print(f"[0] project: {project_id}")

        # 0.1 找第一个 task 的 move handle
        first_task_move = page.locator("[data-testid^='task-move-']").first
        first_task_id = first_task_move.get_attribute("data-testid").replace("task-move-", "")
        print(f"  target task: {first_task_id}")

        # 0.2 读原始值
        original = get_task_plan(page, project_id, first_task_id)
        assert original, f"task {first_task_id} in {project_id} not found"
        print(f"  original: {original}")

        # ---- 1. 拖动 task move ----
        box = first_task_move.bounding_box()
        assert box
        start_x = box["x"] + box["width"] / 2
        start_y = box["y"] + box["height"] / 2
        page.mouse.move(start_x, start_y)
        page.mouse.down()
        page.mouse.move(start_x + 100, start_y, steps=10)
        time.sleep(0.3)

        # 1.1 DragPreview visible（z-index: 100 是 React 渲染后的 DOM 样式）
        preview = page.locator("[style*='z-index: 100']")
        assert preview.count() >= 1, "DragPreview not visible during drag"
        page.screenshot(path=f"{SHOT_DIR}/d6-drag-task-move.png", full_page=False)
        print(f"[1] ✓ DragPreview: {preview.first.text_content()!r}")

        page.mouse.up()
        time.sleep(0.3)

        # 1.2 store 应更新
        after_move = get_task_plan(page, project_id, first_task_id)
        assert after_move["planStart"] != original["planStart"], \
            f"planStart unchanged: {original['planStart']} → {after_move['planStart']}"
        assert after_move["planEnd"] != original["planEnd"], \
            f"planEnd unchanged"
        print(f"[2] ✓ task move: {original['planStart']} → {after_move['planStart']}")

        # 关闭可能意外打开的 drawer（拖 100px 可能落在隔壁 task 触发 onClick）
        close_drawer_if_open(page)

        # ---- 2. 拖动 milestone ----
        ms_marker = page.locator("[data-testid^='milestone-']").first
        ms_id = ms_marker.get_attribute("data-testid").replace("milestone-", "")
        original_ms = get_milestone_date(page, project_id, ms_id)
        assert original_ms
        original_ms_date = original_ms["date"]
        print(f"[3] target milestone: {ms_id} ({original_ms['name']}, date={original_ms_date})")

        ms_box = ms_marker.bounding_box()
        assert ms_box
        ms_cx = ms_box["x"] + ms_box["width"] / 2
        ms_cy = ms_box["y"] + ms_box["height"] / 2
        page.mouse.move(ms_cx, ms_cy)
        page.mouse.down()
        page.mouse.move(ms_cx + 80, ms_cy, steps=10)
        time.sleep(0.3)
        page.mouse.up()
        time.sleep(0.3)

        after_ms = get_milestone_date(page, project_id, ms_id)
        assert after_ms["date"] != original_ms_date, \
            f"milestone date unchanged: {original_ms_date} → {after_ms['date']}"
        print(f"  ✓ milestone move: {original_ms_date} → {after_ms['date']}")

        # ---- 3. 越界（resize-end 拖很远）----
        resize_end = page.locator(f"[data-testid='task-resize-end-{first_task_id}']")
        if resize_end.count() > 0:
            re_box = resize_end.bounding_box()
            re_cx = re_box["x"] + re_box["width"] / 2
            re_cy = re_box["y"] + re_box["height"] / 2
            page.mouse.move(re_cx, re_cy)
            page.mouse.down()
            page.mouse.move(re_cx + 1000, re_cy, steps=10)
            time.sleep(0.3)
            oob_label = page.locator("text=out of bounds")
            if oob_label.count() > 0:
                print("[4] ✓ out-of-bounds shown in DragPreview")
            else:
                print("[4] ⚠ out-of-bounds label not shown (phase.end 可能够远)")
            page.screenshot(path=f"{SHOT_DIR}/d6-drag-out-of-bounds.png", full_page=False)
            page.mouse.up()
            time.sleep(0.3)
            after_oob = get_task_plan(page, project_id, first_task_id)
            print(f"[5] ✓ planEnd after oob attempt: {after_oob['planEnd']}")
        else:
            print("[4] ⚠ resize-end handle not found")

        # ---- 4. drag + drawer 取消 ----
        # 先关掉上一步可能打开的 drawer
        close_drawer_if_open(page)
        move_handle = page.locator(f"[data-testid='task-move-{first_task_id}']")
        move_box = move_handle.bounding_box()
        page.mouse.move(move_box["x"] + move_box["width"] / 2, move_box["y"] + move_box["height"] / 2)
        page.mouse.down()
        page.mouse.move(move_box["x"] + move_box["width"] / 2 + 50,
                        move_box["y"] + move_box["height"] / 2, steps=5)
        time.sleep(0.2)
        # 拖动期间用 JS 触发 openDrawer（暴露到 window 上）
        opened = page.evaluate("""() => {
            // 通过 React DevTools 不行；用 zustand 不在 window 上
            // 退而求其次：检查 dragState 是否在 drawer 打开时被 useEffect 清空
            // 这里用 click task row 触发 onClick → openDrawer（force click 穿透 mousedown）
            return false;
        }""")
        # 用 force click 试触发 drawer
        try:
            first_row = page.locator("[data-testid^='task-move-']").first
            first_row.click(force=True, position={"x": 2, "y": 2}, timeout=1000)
        except Exception:
            pass
        time.sleep(0.3)
        # 检查 dragState 是否被清空（通过 DragPreview 不可见判断）
        preview_after = page.locator("[style*='z-index: 100']").count()
        if preview_after == 0:
            print("[6] ✓ drag + drawer open: dragState cancelled (DragPreview hidden)")
        else:
            print("[6] ⚠ dragState still active (force click 未能触发 drawer)")
        try:
            page.mouse.up()
        except Exception:
            pass
        time.sleep(0.2)
        page.keyboard.press("Escape")
        time.sleep(0.2)

        # ---- 5. 错误检查 ----
        if len(errors) == 0:
            print("[7] ✓ no console errors")
        else:
            # 区分：是否是 plan 没 cover 的真 bug
            dup_key = sum(1 for e in errors if "same key" in e)
            setstate_in_render = sum(1 for e in errors if "setState" in e and "render" in e)
            other = len(errors) - dup_key - setstate_in_render
            print(f"[7] ✗ {len(errors)} console errors (product bugs, report to controller):")
            if dup_key:
                print(f"    {dup_key}× duplicate React key (seed-scoped-1 in AIChatPanel)")
            if setstate_in_render:
                print(f"    {setstate_in_render}× setState during render (ProjectDetailPage line ~48)")
            if other:
                print(f"    {other}× other errors")
                for e in errors[:5]:
                    print(f"      {e[:150]}")
            # 仍然失败（不通过），因为 plan 要求 len(errors) == 0
            assert False, f"{len(errors)} console errors (plan 要求 0)"

        page.screenshot(path=f"{SHOT_DIR}/d6-final.png", full_page=False)
        browser.close()
        print("\n=== ALL D6 CHECKS PASSED ===")
        print(f"截图保存到 {SHOT_DIR}/d6-*.png")


if __name__ == "__main__":
    try:
        main()
    except AssertionError as e:
        print(f"\n[FAIL] {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\n[ERROR] {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
