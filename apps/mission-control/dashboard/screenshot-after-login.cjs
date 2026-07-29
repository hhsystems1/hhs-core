const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1400, height: 900 });
  
  try {
    // Login first
    await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle', timeout: 15000 });
    await page.fill('input[type="email"]', 'stephen@helpinghandssystems.com');
    await page.fill('input[type="password"]', 'test123');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
    
    // Now capture dashboard
    await page.screenshot({ path: '/Users/turtleclaw/.openclaw/workspace/mission-control-after-login.png', fullPage: true });
    console.log('Screenshot saved');
  } catch(e) {
    console.error('Error:', e.message);
  }
  
  await browser.close();
})();