import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function generatePDF() {
  console.log('Starting PDF generation...');
  
  // Launch browser
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    
    // Set viewport to match Letter paper aspect ratio (8.5 x 11 inches)
    // Using a wider viewport to ensure the 3-column grid renders properly
    await page.setViewport({
      width: 1440,
      height: 1100,
      deviceScaleFactor: 2, // Higher quality
    });
    
    // Navigate to the pricing page with PDF media emulation
    console.log('Navigating to pricing page...');
    
    // Emulate print media to trigger print styles
    await page.emulateMediaType('print');
    
    await page.goto('http://localhost:3001/pricing', {
      waitUntil: 'networkidle0', // Wait for all resources to load
    });
    
    // Remove any focus states and wait for animations
    await page.evaluate(() => {
      // Remove focus from any focused element
      document.activeElement?.blur();
      
      // Remove any hover/focus styles by adding a print class
      document.body.classList.add('print-mode');
    });
    
    // Fix PDF rendering artifacts from absolute positioning and transforms
    await page.addStyleTag({
      content: `
        /* Fix the Best Value badge positioning for PDF */
        .absolute.-top-3 {
          top: 0 !important;
          transform: translate(-50%, -50%) !important;
        }
        
        /* Ensure clean rendering by removing problematic styles */
        * {
          /* Disable subpixel antialiasing that causes artifacts */
          -webkit-font-smoothing: antialiased !important;
          -moz-osx-font-smoothing: grayscale !important;
        }
        
        /* Remove shadows that might render poorly */
        .shadow,
        .shadow-sm,
        .shadow-md,
        .shadow-lg {
          box-shadow: none !important;
        }
        
        /* Ensure solid backgrounds for absolute elements */
        .absolute {
          background-clip: padding-box !important;
        }
        
        /* Fix potential ring artifacts from Tailwind */
        .ring-1 {
          box-shadow: none !important;
          border-width: 1px !important;
        }
        
        /* Ensure background gradient extends to edges */
        body, html {
          margin: 0 !important;
          padding: 0 !important;
        }
        
        /* Make sure the gradient container fills the viewport */
        body {
          margin: 0 !important;
          padding: 0 !important;
        }
        
        /* Ensure gradient fills the entire page */
        body {
          background: linear-gradient(to bottom, #ffffff, #f8fafc) !important;
          min-height: 100vh !important;
        }
        
        /* Add padding to the main container */
        .min-h-screen.w-full.bg-gradient-to-b {
          min-height: 100% !important;
          padding: 48px !important;
          box-sizing: border-box !important;
          background: transparent !important; /* Let body gradient show through */
        }
        
        @media print {
          .min-h-screen.w-full.bg-gradient-to-b {
            padding: 48px !important;
          }
        }
      `
    });
    
    // Wait a bit for any animations/transitions to complete
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Generate PDF
    console.log('Generating PDF...');
    const pdfPath = path.join(__dirname, '../../../heart-for-the-house-pricing.pdf');
    await page.pdf({
      path: pdfPath,
      format: 'Letter',
      printBackground: true, // Include backgrounds
      margin: {
        top: 0,
        right: 0,
        bottom: 0,
        left: 0
      },
      displayHeaderFooter: false,
      scale: 0.85, // Adjusted scale for better fit
    });
    
    console.log(`✅ PDF generated successfully at: ${pdfPath}`);
    console.log('\nMake sure your Next.js app is running on localhost:3001 first!');
    
  } catch (error) {
    console.error('❌ Error generating PDF:', error);
    console.log('\nMake sure:');
    console.log('1. Your Next.js app is running (pnpm dev --filter @acme/nextjs)');
    console.log('2. The pricing page is accessible at http://localhost:3001/pricing');
  } finally {
    await browser.close();
  }
}

// Run the function
generatePDF();