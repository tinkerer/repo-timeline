import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Capture console logs
  page.on('console', msg => {
    const type = msg.type();
    const text = msg.text();
    console.log(`[BROWSER ${type}]:`, text);
  });

  // Capture errors
  page.on('pageerror', err => {
    console.error('[BROWSER ERROR]:', err.message);
  });

  console.log('Navigating to http://localhost:5173/repo-timeline/facebook/react');
  await page.goto('http://localhost:5173/repo-timeline/facebook/react', { waitUntil: 'networkidle' });

  console.log('Waiting 5 seconds for console logs...');
  await page.waitForTimeout(5000);

  console.log('Done - closing browser');
  await browser.close();
})();
