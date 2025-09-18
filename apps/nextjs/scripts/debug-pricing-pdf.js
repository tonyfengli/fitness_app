import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function debugPDF() {
  console.log('Starting debug PDF generation...');
  
  const browser = await puppeteer.launch({
    headless: false, // Show the browser so we can see what's happening
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    devtools: true // Open devtools
  });
  
  try {
    const page = await browser.newPage();
    
    // Set viewport
    await page.setViewport({
      width: 1440,
      height: 1100,
      deviceScaleFactor: 2,
    });
    
    console.log('Navigating to pricing page...');
    await page.goto('http://localhost:3001/pricing', {
      waitUntil: 'networkidle0',
    });
    
    // Wait for user to inspect
    console.log('\n📋 DEBUGGING STEPS:');
    console.log('1. The browser is now open with DevTools');
    console.log('2. Inspect the "Best Value" badge and other elements with artifacts');
    console.log('3. Look for:');
    console.log('   - Extra DOM elements behind the badges');
    console.log('   - CSS transforms or positioning issues');
    console.log('   - Z-index stacking problems');
    console.log('   - Background elements that might be showing through');
    console.log('\n4. Press Enter in this terminal when done inspecting...');
    
    // Wait for user input
    await new Promise((resolve) => {
      process.stdin.once('data', resolve);
    });
    
    // Take a screenshot for comparison
    await page.screenshot({
      path: path.join(__dirname, '../../../pricing-debug-screenshot.png'),
      fullPage: true
    });
    
    console.log('Screenshot saved for reference.');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
}

// Enable stdin
process.stdin.resume();
debugPDF();