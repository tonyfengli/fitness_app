import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function generatePDF() {
  console.log('Starting PDF generation (v2)...');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    
    // Set viewport to Letter paper width
    await page.setViewport({
      width: 816, // 8.5 inches at 96 DPI
      height: 2000, // Tall enough to capture all content
      deviceScaleFactor: 2,
    });
    
    // Navigate to the pricing page
    console.log('Navigating to pricing page...');
    await page.goto('http://localhost:3001/pricing', {
      waitUntil: 'networkidle0',
    });
    
    // Remove focus states and add padding
    await page.evaluate(() => {
      document.activeElement?.blur();
    });
    
    // Fix positioning artifacts and add padding
    await page.addStyleTag({
      content: `
        /* Fix the Best Value badge */
        .absolute.-top-3 {
          top: 0 !important;
          transform: translate(-50%, -50%) !important;
        }
        
        /* Remove shadows */
        .shadow, .shadow-sm, .shadow-md, .shadow-lg {
          box-shadow: none !important;
        }
        
        /* Fix ring artifacts */
        .ring-1 {
          box-shadow: none !important;
          border-width: 1px !important;
        }
        
        /* Ensure full background but with padding */
        body {
          margin: 0 !important;
          padding: 0 !important;
          background: white !important;
        }
        
        .min-h-screen {
          min-height: auto !important;
          padding: 48px !important;
          margin: 0 !important;
        }
      `
    });
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Take a screenshot of just the content area
    const content = await page.$('.min-h-screen');
    const boundingBox = await content.boundingBox();
    
    console.log('Taking screenshot of content area...');
    const screenshotBuffer = await page.screenshot({
      clip: {
        x: 0,
        y: 0,
        width: boundingBox.width,
        height: boundingBox.height
      }
    });
    
    // Create a new page with just the screenshot
    const pdfPage = await browser.newPage();
    await pdfPage.setViewport({
      width: Math.ceil(boundingBox.width),
      height: Math.ceil(boundingBox.height),
      deviceScaleFactor: 1,
    });
    
    // Create an HTML page with the screenshot
    await pdfPage.setContent(`
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { margin: 0; padding: 0; }
          img { display: block; width: 100%; height: 100%; }
        </style>
      </head>
      <body>
        <img src="data:image/png;base64,${screenshotBuffer.toString('base64')}" />
      </body>
      </html>
    `);
    
    // Generate PDF from the screenshot
    console.log('Generating PDF...');
    const pdfPath = path.join(__dirname, '../../../heart-for-the-house-pricing.pdf');
    await pdfPage.pdf({
      path: pdfPath,
      width: '8.5in',
      height: `${(boundingBox.height / 96)}in`, // Convert pixels to inches
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });
    
    console.log(`✅ PDF generated successfully at: ${pdfPath}`);
    
  } catch (error) {
    console.error('❌ Error generating PDF:', error);
    console.log('\nMake sure your Next.js app is running on localhost:3001');
  } finally {
    await browser.close();
  }
}

generatePDF();