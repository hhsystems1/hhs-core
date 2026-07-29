const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 800 });
  
  try {
    await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: '/Users/turtleclaw/.openclaw/workspace/mission-control-login.png', fullPage: false });
    console.log('Screenshot saved');
  } catch(e) {
    console.error('Error:', e.message);
  }
  
  await browser.close();
})();