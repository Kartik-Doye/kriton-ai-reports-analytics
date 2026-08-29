import puppeteer from 'puppeteer';
try {
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.setContent('<h1>Test</h1>');
  await page.pdf({ path: 'test.pdf' });
  await browser.close();
  console.log("Puppeteer works");
} catch (e) {
  console.error("Puppeteer failed", e);
}
