"""截 GitHub Actions 公开页面"""
from playwright.sync_api import sync_playwright
import time

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width": 1440, "height": 900})
    page.goto("https://github.com/cailleachzou/ganntlens/actions", wait_until="networkidle", timeout=30000)
    time.sleep(2)
    page.screenshot(path="c:/git-project/TRAE/ganntlens/docs/screenshots/06-actions-success.png", full_page=False)
    print("Saved: 06-actions-success.png")
    browser.close()
