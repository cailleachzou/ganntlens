"""验证 GitHub Pages 实际链接跳转"""
from playwright.sync_api import sync_playwright
import time

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width": 1440, "height": 900})
    page.goto("https://cailleachzou.github.io/ganntlens/", wait_until="networkidle", timeout=30000)
    time.sleep(2)

    page.screenshot(path="c:/git-project/TRAE/pages-overview.png", full_page=True)

    links = page.evaluate("""() => {
        const navLinks = document.querySelectorAll('header nav a');
        return Array.from(navLinks).map(a => ({
            text: a.textContent.trim(),
            href: a.getAttribute('href')
        }));
    }""")

    print("=== 头部 nav 链接 ===")
    for l in links:
        print(f"  {l['text']}  href={l['href']}")

    print(f"\n当前 URL: {page.url}")

    # 点 M-2026
    m_link = page.locator("header nav a:has-text('M-2026')")
    if m_link.count() > 0:
        m_link.first.click()
        time.sleep(1.5)
        print(f"\n=== 点击 M-2026 后 ===")
        print(f"  URL = {page.url}")
        page.screenshot(path="c:/git-project/TRAE/pages-m2026.png", full_page=True)

    # 测直链
    page.goto("https://cailleachzou.github.io/ganntlens/projects/ofc-2026", wait_until="networkidle", timeout=30000)
    time.sleep(1.5)
    print(f"\n=== 直链 /projects/ofc-2026 ===")
    print(f"  URL = {page.url}")

    # 测 OVERVIEW 直链
    page.goto("https://cailleachzou.github.io/ganntlens/", wait_until="networkidle", timeout=30000)
    time.sleep(1.5)
    print(f"\n=== 直链 / (overview) ===")
    print(f"  URL = {page.url}")

    browser.close()
    print("\nDone.")
