import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    // Disable cache to ensure we get the latest version
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();

  // Disable cache
  await context.route('**/*', route => {
    route.continue({
      headers: {
        ...route.request().headers(),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  });

  console.log('Navigating to: https://rjwalters.github.io/repo-timeline/rjwalters/nistmemsql');

  // Listen to all navigation events
  page.on('framenavigated', frame => {
    if (frame === page.mainFrame()) {
      console.log('NAVIGATED TO:', frame.url());
    }
  });

  // Listen to console messages
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));

  // Listen to page errors
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));

  // Navigate and wait for network to be idle
  const response = await page.goto('https://rjwalters.github.io/repo-timeline/rjwalters/nistmemsql', {
    waitUntil: 'networkidle'
  });

  console.log('Response status:', response.status());
  console.log('Final URL:', page.url());

  // Wait a bit for any redirects
  await page.waitForTimeout(3000);

  console.log('URL after wait:', page.url());

  // Get the page title
  const title = await page.title();
  console.log('Page title:', title);

  // Check if we see error or loading state
  const bodyText = await page.evaluate(() => document.body.innerText);
  console.log('Page content preview:', bodyText.substring(0, 500));

  // Take a screenshot
  await page.screenshot({ path: 'test-screenshot.png', fullPage: true });
  console.log('Screenshot saved to test-screenshot.png');

  await browser.close();
})();
