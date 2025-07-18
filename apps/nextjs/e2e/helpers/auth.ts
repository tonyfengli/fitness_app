import { Page } from '@playwright/test';

export async function loginAsTrainer(page: Page, email: string, password: string) {
  // Go to login page
  await page.goto('http://localhost:3000/login');
  
  // Wait for login page to load
  await page.waitForSelector('input[name="email"]', { state: 'visible' });
  
  // Fill in login form
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  
  // Take screenshot before submitting
  await page.screenshot({ path: 'test-results/before-login.png' });
  
  // Submit form - click the Sign In button
  await page.click('button:has-text("Sign In")');
  
  // Wait for navigation to start
  await page.waitForLoadState('domcontentloaded');
  
  // Wait for either redirect or error
  try {
    await page.waitForURL('**/trainer-dashboard**', { timeout: 15000 });
  } catch (e) {
    // Take screenshot if login failed
    await page.screenshot({ path: 'test-results/login-failed.png' });
    
    // Check for error message
    const errorElement = page.locator('.text-red-800');
    if (await errorElement.isVisible()) {
      const errorText = await errorElement.textContent();
      throw new Error(`Login failed: ${errorText}`);
    }
    throw e;
  }
  
  // Wait for page to be fully loaded
  await page.waitForLoadState('networkidle');
}

export async function loginAsClient(page: Page, email: string, password: string) {
  // Go to login page
  await page.goto('http://localhost:3000/login');
  
  // Fill in login form
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  
  // Submit form
  await page.click('button[type="submit"]');
  
  // Wait for redirect to dashboard
  await page.waitForURL('**/client-dashboard**', { timeout: 10000 });
  
  // Wait for page to be fully loaded
  await page.waitForLoadState('networkidle');
}