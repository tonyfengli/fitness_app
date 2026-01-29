import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const CONFIG = {
  // Set to true to preview in browser before generating PDF
  PREVIEW_MODE: true,

  // Print-shop quality: 4 = ~384 DPI
  DEVICE_SCALE_FACTOR: 4,

  // Landscape Letter: 11 x 8.5 inches
  PAGE_WIDTH: 11,
  PAGE_HEIGHT: 8.5,

  // Server URL
  BASE_URL: 'http://localhost:3001',

  // Pages to generate
  PAGES: [
    { path: '/pricing', filename: 'g1-fitness-pricing.pdf', name: 'Group Classes' },
    { path: '/pricing/strength', filename: 'g1-strength-pricing.pdf', name: 'Strength Training' },
  ],
};

const PRINT_STYLES = `
  /* Print-shop quality optimizations */
  * {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    -webkit-font-smoothing: antialiased !important;
    -moz-osx-font-smoothing: grayscale !important;
  }

  /* Force landscape layout */
  @page {
    size: 11in 8.5in landscape;
    margin: 0;
  }

  /* Force white background everywhere */
  html, body {
    margin: 0 !important;
    padding: 0 !important;
    width: 11in !important;
    min-height: 8.5in !important;
    background: white !important;
  }

  /* Adjust main container for landscape */
  .min-h-screen {
    min-height: 8.5in !important;
    width: 11in !important;
    padding: 0.3in 0.5in 2.4in 0.5in !important; /* top right bottom left - more bottom padding pushes content up */
    box-sizing: border-box !important;
    background: white !important;
    display: flex !important;
    flex-direction: column !important;
    align-items: center !important;
    justify-content: center !important;
  }

  /* Remove all shadows for clean PDF */
  .shadow, .shadow-sm, .shadow-md, .shadow-lg {
    box-shadow: none !important;
  }

  /* Ensure borders are crisp */
  .border, .border-2 {
    border-style: solid !important;
  }

  /* Remove hover/transition states */
  * {
    transition: none !important;
  }
`;

async function generatePDF(pageConfig, browser, isLastPage) {
  const page = await browser.newPage();

  // Set viewport to landscape Letter dimensions
  const viewportWidth = Math.round(CONFIG.PAGE_WIDTH * 96);
  const viewportHeight = Math.round(CONFIG.PAGE_HEIGHT * 96);

  await page.setViewport({
    width: viewportWidth,
    height: viewportHeight,
    deviceScaleFactor: CONFIG.DEVICE_SCALE_FACTOR,
  });

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Generating: ${pageConfig.name}`);
  console.log(`${'='.repeat(60)}`);
  console.log(`URL: ${CONFIG.BASE_URL}${pageConfig.path}`);
  console.log(`Output: ${pageConfig.filename}`);

  // Navigate to the page
  await page.goto(`${CONFIG.BASE_URL}${pageConfig.path}`, {
    waitUntil: 'networkidle0',
  });

  // Inject print-optimized styles
  await page.addStyleTag({ content: PRINT_STYLES });

  // Remove focus states
  await page.evaluate(() => {
    document.activeElement?.blur();
  });

  // Wait for styles to apply
  await new Promise(resolve => setTimeout(resolve, 500));

  if (CONFIG.PREVIEW_MODE) {
    console.log('\nPreview ready. Inspect the page in the browser.');
    console.log('Press ENTER to generate PDF, or Ctrl+C to cancel...');

    await new Promise((resolve) => {
      process.stdin.resume();
      process.stdin.once('data', resolve);
    });
  }

  // Generate PDF
  console.log('Generating PDF...');
  const pdfPath = path.join(__dirname, `../../../${pageConfig.filename}`);

  await page.pdf({
    path: pdfPath,
    width: `${CONFIG.PAGE_WIDTH}in`,
    height: `${CONFIG.PAGE_HEIGHT}in`,
    printBackground: true,
    scale: 1.0,
    preferCSSPageSize: true,
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
    displayHeaderFooter: false,
  });

  console.log(`✅ PDF saved: ${pdfPath}`);

  await page.close();
}

async function main() {
  console.log('Starting PDF generation (print-shop quality)...');
  console.log(`Preview mode: ${CONFIG.PREVIEW_MODE ? 'ON' : 'OFF'}`);
  console.log(`Quality: ${CONFIG.DEVICE_SCALE_FACTOR * 96} DPI`);
  console.log(`Pages to generate: ${CONFIG.PAGES.length}`);

  const browser = await puppeteer.launch({
    headless: CONFIG.PREVIEW_MODE ? false : 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      `--window-size=${Math.round(CONFIG.PAGE_WIDTH * 96)},${Math.round(CONFIG.PAGE_HEIGHT * 96)}`
    ],
    defaultViewport: null,
  });

  try {
    for (let i = 0; i < CONFIG.PAGES.length; i++) {
      const pageConfig = CONFIG.PAGES[i];
      const isLastPage = i === CONFIG.PAGES.length - 1;
      await generatePDF(pageConfig, browser, isLastPage);
    }

    console.log('\n' + '='.repeat(60));
    console.log('ALL DONE!');
    console.log('='.repeat(60));
    console.log('Generated PDFs:');
    CONFIG.PAGES.forEach(p => {
      console.log(`  - ${p.filename} (${p.name})`);
    });

  } catch (error) {
    console.error('\n❌ Error generating PDF:', error);
    console.log('\nMake sure:');
    console.log(`1. Your Next.js app is running at ${CONFIG.BASE_URL}`);
    console.log('2. All pricing pages are accessible');
  } finally {
    await browser.close();
    process.exit(0);
  }
}

// Run
main();
