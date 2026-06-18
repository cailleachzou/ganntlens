#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""D7 验证脚本：数据外置 + dev-server + chokidar + SSE + AI plan 模式 + 软锁

5 大检查:
  1. 3 chip 加载
  2. 拖拽 commit 写盘 + project.json mtime 更新
  3. AGENT 直写 → chokidar 推 SSE → page re-render
  4. AI plan 模式: 出方案 + 不写数据
  5. 锁文件清理

URL 关键: Vite base = '/ganntlens/'，dev URL 必须是 http://localhost:5173/ganntlens/
"""
import json
import sys
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

URL = "http://localhost:5173/ganntlens/"
DATA = Path("data")
PROJECT = "m-2026"
PROJ_FILE = DATA / "projects" / PROJECT / "project.json"
SHOT_DIR = Path("d7-shots")
SHOT_DIR.mkdir(exist_ok=True)


def reset_baseline() -> dict:
    """重置 m-2026/project.json 到 seed 时的已知状态，便于 test idempotent"""
    proj = json.loads(PROJ_FILE.read_text(encoding="utf-8"))
    proj["lastModifiedBy"] = "seed"
    proj["lastModifiedAt"] = "2026-06-18T12:39:47.364Z"
    # m1 = 开工, m2 = 验收交付
    proj["milestones"][0]["date"] = "2026-05-10"
    proj["milestones"][0]["status"] = "reached"
    proj["milestones"][1]["date"] = "2026-06-17"
    proj["milestones"][1]["status"] = "pending"
    PROJ_FILE.write_text(json.dumps(proj, indent=2, ensure_ascii=False), encoding="utf-8")
    return proj


def read_proj() -> dict:
    return json.loads(PROJ_FILE.read_text(encoding="utf-8"))


def main() -> int:
    baseline = reset_baseline()
    print(f"[init] reset {PROJ_FILE} → m1.date={baseline['milestones'][0]['date']}, "
          f"m2.date={baseline['milestones'][1]['date']}, lastModifiedBy=seed")

    with sync_playwright() as p:
        browser = p.chromium.launch()
        ctx = browser.new_context(viewport={"width": 1440, "height": 900})
        page = ctx.new_page()
        errors: list[str] = []
        page.on("console", lambda msg: errors.append(f"[{msg.type}] {msg.text[:200]}")
                if msg.type == "error" else None)
        page.on("pageerror", lambda err: errors.append(f"[pageerror] {str(err)[:200]}"))

        # 监听 SSE 网络请求（间接验证连接建立）
        sse_requested = {"ok": False}
        page.on("request", lambda req: sse_requested.update(
            ok=True) if "/api/events" in req.url else None)

        # ---- 0. 加载 ----
        # 不能用 wait_until=networkidle —— SSE 是长连接，永远不 idle
        # Vite dev server 会把 / 改写到 /ganntlens/（base 配置），React Router basename 已对齐
        page.goto(URL, wait_until="domcontentloaded")
        # 等 chips 出现（说明 initFromApi + OverviewPage 渲染完成）
        page.wait_for_selector("[data-testid^='project-chip-']", timeout=10000)
        time.sleep(0.6)

        # 0.1 3 chip
        chips = page.locator("[data-testid^='project-chip-']")
        assert chips.count() == 3, f"expected 3 chips, got {chips.count()}"
        chip_texts = [chips.nth(i).text_content() for i in range(3)]
        print(f"✓ 0.1 3 项目 chip 加载: {chip_texts}")

        # 0.2 甘特图渲染
        bars = page.locator("[data-testid^='task-move-']")
        assert bars.count() >= 1, f"no task bars: {bars.count()}"
        print(f"✓ 0.2 甘特图渲染 ({bars.count()} task bars)")

        # 0.3 SSE 连接已建立
        time.sleep(0.4)
        assert sse_requested["ok"], "SSE /api/events not requested by page"
        print("✓ 0.3 SSE /api/events 连接建立")

        # ---- 1. 拖拽 commit 写盘 ----
        first_bar = bars.first
        first_task_id = first_bar.get_attribute("data-testid").replace("task-move-", "")
        bbox = first_bar.bounding_box()
        assert bbox, "task bar no bbox"
        sx = bbox["x"] + bbox["width"] / 2
        sy = bbox["y"] + bbox["height"] / 2
        page.mouse.move(sx, sy)
        page.mouse.down()
        page.mouse.move(sx + 60, sy, steps=10)
        time.sleep(0.2)
        page.mouse.up()
        time.sleep(0.7)  # wait for moveTask async write

        meta = read_proj()
        last_by = meta.get("lastModifiedBy")
        assert last_by == "ui-dude", \
            f"drag write failed: expected lastModifiedBy=ui-dude, got {last_by}"
        print(f"✓ 1 拖拽 commit 写盘 (lastModifiedBy=ui-dude, task={first_task_id})")
        page.screenshot(path=str(SHOT_DIR / "d7-drag-write.png"))

        # ---- 2. AGENT 直写 → chokidar → SSE → page re-render ----
        # 用一个明显在 DEMO_TODAY(2026-06-16) + 0~60d 范围内的日期，会出现在 upcoming 面板
        new_date = "2026-07-20"
        proj = read_proj()
        old_m1_date = proj["milestones"][0]["date"]
        proj["milestones"][0]["date"] = new_date
        proj["lastModifiedBy"] = "agent-verify"
        proj["lastModifiedAt"] = "2026-06-18T21:00:00Z"
        PROJ_FILE.write_text(json.dumps(proj, indent=2, ensure_ascii=False), encoding="utf-8")
        print(f"[2] AGENT direct write: m1.date {old_m1_date} → {new_date}")
        time.sleep(1.2)  # chokidar 50ms + SSE + applyRemoteUpdate + re-render

        # 验证：1) JSON 改了；2) page DOM 反映了新日期
        after_agent = read_proj()
        assert after_agent["milestones"][0]["date"] == new_date, "JSON not updated"
        content = page.content()
        assert new_date in content, \
            f"new date '{new_date}' not visible in page after AGENT write (SSE → reload 链路可能断)"
        print(f"✓ 2 AGENT 直写 → SSE → page re-render ({new_date} 出现在 upcoming 面板)")
        page.screenshot(path=str(SHOT_DIR / "d7-agent-edit.png"))

        # ---- 3. AI plan 模式 ----
        before_ai = read_proj()
        before_meta = before_ai.get("lastModifiedBy")
        ai_input = page.locator("[data-testid='ai-input']").first
        ai_input.fill("把 M1 延后 3 天")
        ai_input.press("Enter")
        time.sleep(2.0)  # mockLLM 800-1200ms + render

        plan = page.locator("[data-testid='plan-summary']")
        assert plan.count() >= 1, "no plan summary found (AI plan mode UI broken)"
        # 验证有 copy-plan / download-patch 按钮
        copy_btn = page.locator("[data-testid='copy-plan']")
        dl_btn = page.locator("[data-testid='download-patch']")
        assert copy_btn.count() >= 1, "no copy-plan button"
        assert dl_btn.count() >= 1, "no download-patch button"
        print("✓ 3.1 AI plan 模式渲染 (plan-summary + copy + download-patch)")

        after_ai = read_proj()
        after_meta = after_ai.get("lastModifiedBy")
        assert before_meta == after_meta, \
            f"AI plan shouldn't write data: {before_meta} → {after_meta}"
        # 也验证 m1.date 没变（mock engine 应当返回 plan 但不应用）
        assert after_ai["milestones"][0]["date"] == new_date, \
            f"AI shouldn't have changed m1.date (expected {new_date}, got {after_ai['milestones'][0]['date']})"
        print(f"✓ 3.2 AI plan 不写数据 (lastModifiedBy={after_meta} 不变, m1.date={new_date} 不变)")
        page.screenshot(path=str(SHOT_DIR / "d7-ai-plan.png"))

        # ---- 4. 锁文件清理 ----
        time.sleep(0.5)
        lock_files = sorted((DATA / "locks").glob("*.lock"))
        # 写盘瞬间会有锁，写完 releaseLock → 文件被 unlink。这里放宽：≤1 个
        # 如果有剩余锁，应该有「失效中」状态（> LOCK_TTL_MS=2min 不可能）
        assert len(lock_files) <= 1, f"too many stale lock files: {lock_files}"
        print(f"✓ 4 锁文件清理 (剩余 {len(lock_files)} 个)")

        # ---- 5. console error 检查（过滤 SSE 自身 warning） ----
        real_errors = [
            e for e in errors
            if "EventSource" not in e
            and "reconnecting" not in e
            and "Failed to load resource" not in e
        ]
        if real_errors:
            print(f"⚠ {len(real_errors)} console errors:")
            for e in real_errors[:5]:
                print(f"  {e}")
        assert len(real_errors) == 0, f"{len(real_errors)} console errors"
        print("✓ 5 no console errors")

        browser.close()

    print("\n🎉 D7 全部验证通过")
    print(f"截图保存到 {SHOT_DIR}/")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except AssertionError as e:
        print(f"\n[FAIL] {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\n[ERROR] {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
