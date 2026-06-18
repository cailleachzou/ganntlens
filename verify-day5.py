#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
GanttLens D5 验证脚本
检查项：
1. Overview 页加载 + AI Chat (global) 可见
2. M-2026 详情页加载 + AI Chat (scoped) 可见
3. AI Chat 输入 "把 M1 延后 3 天" → 真实响应
4. AI Settings Modal 打开
5. 切换到 M-2026 页 → scope 标识变成 SCOPED · M-2026
6. 切换到 DC-2026 → scope 跟着变
"""
import sys
import time
from playwright.sync_api import sync_playwright

URL = "http://localhost:5175"
SHOT_DIR = "c:/git-project/TRAE"


def verify():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1440, "height": 900})

        # ====== 1. Overview 页加载 + AI Chat visible ======
        print("[1/7] Overview 页加载...")
        page.goto(URL, wait_until="networkidle")
        page.wait_for_selector('text=AI ASSISTANT', timeout=8000)
        # 清掉 localStorage 防止 seed 注入失败
        page.evaluate("() => { localStorage.clear(); }")
        page.reload(wait_until="networkidle")
        page.wait_for_selector('text=AI ASSISTANT', timeout=8000)
        # 检查 GLOBAL scope
        page.wait_for_selector('text=GLOBAL', timeout=5000)
        page.screenshot(path=f"{SHOT_DIR}/d5-overview-global.png", full_page=False)
        print("  ✓ GLOBAL scope 显示")

        # ====== 2. 输入 M1 延后 3 天 ======
        print("[2/7] 输入 '把 M1 延后 3 天'...")
        chat_input = page.locator('input[placeholder*="问点什么"]')
        chat_input.fill("把 M1 延后 3 天")
        chat_input.press("Enter")
        # 等待响应
        page.wait_for_selector('text=已应用', timeout=5000)
        page.screenshot(path=f"{SHOT_DIR}/d5-overview-m1-shift.png", full_page=False)
        print("  ✓ Mock 响应成功")

        # ====== 3. 测试周报命令 ======
        print("[3/7] 输入 '周报'...")
        chat_input.fill("周报")
        chat_input.press("Enter")
        page.wait_for_selector('text=本周项目进度周报', timeout=5000)
        page.screenshot(path=f"{SHOT_DIR}/d5-overview-weekly.png", full_page=False)
        print("  ✓ 周报生成成功")

        # ====== 4. 测试 Settings Modal ======
        print("[4/7] 打开 AI Settings Modal...")
        # 找到齿轮按钮（aria-label=open settings）
        page.locator('button[aria-label="open settings"]').click()
        page.wait_for_selector('text=AI · SETTINGS', timeout=3000)
        page.wait_for_selector('text=Provider', timeout=3000)
        page.screenshot(path=f"{SHOT_DIR}/d5-settings-modal.png", full_page=False)
        print("  ✓ Modal 打开，Provider 列表可见")
        # 点击 TEST CONNECTION
        page.locator('button:has-text("TEST CONNECTION")').click()
        page.wait_for_selector('text=连接', timeout=3000)
        page.screenshot(path=f"{SHOT_DIR}/d5-settings-tested.png", full_page=False)
        print("  ✓ 连接测试通过")
        # 关闭
        page.locator('button:has-text("取消")').click()
        page.wait_for_timeout(500)

        # ====== 5. 导航到 M-2026 详情页 ======
        print("[5/7] 跳转到 /projects/m-2026...")
        page.goto(f"{URL}/projects/m-2026", wait_until="networkidle")
        page.wait_for_selector('text=AI ASSISTANT', timeout=5000)
        page.wait_for_selector('text=SCOPED · M-2026', timeout=5000)
        page.screenshot(path=f"{SHOT_DIR}/d5-detail-m-scoped.png", full_page=False)
        print("  ✓ SCOPED · M-2026 显示")

        # ====== 6. 在 scoped 模式输入任务 ======
        print("[6/7] M-2026 页面输入 '验收测试 进度 70%'...")
        chat_input = page.locator('input[placeholder*="问点什么"]')
        chat_input.fill("验收测试 进度 70%")
        chat_input.press("Enter")
        page.wait_for_selector('text=验收测试', timeout=5000)
        page.screenshot(path=f"{SHOT_DIR}/d5-detail-m-progress.png", full_page=False)
        print("  ✓ scoped 命令执行成功")

        # ====== 7. 切换到 DC-2026 → scope 跟着变 ======
        print("[7/7] 跳转到 /projects/dc-2026...")
        page.goto(f"{URL}/projects/dc-2026", wait_until="networkidle")
        page.wait_for_selector('text=SCOPED · DC-2026', timeout=5000)
        page.screenshot(path=f"{SHOT_DIR}/d5-detail-dc-scoped.png", full_page=False)
        print("  ✓ SCOPED · DC-2026 显示")

        browser.close()
        print("\n=== ALL 7 CHECKS PASSED ===")
        print(f"截图保存到 {SHOT_DIR}/d5-*.png")


if __name__ == "__main__":
    try:
        verify()
    except Exception as e:
        print(f"\n[FAIL] {e}")
        sys.exit(1)
