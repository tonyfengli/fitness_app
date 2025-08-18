import { Page } from "@playwright/test";

/**
 * Selects a client from the sidebar by name
 * @param page - Playwright page object
 * @param clientName - Display name of the client (e.g., "Tony Lee")
 */
export async function selectClient(page: Page, clientName: string) {
  // Wait for sidebar to be loaded
  await page.waitForSelector('nav[aria-label="Client navigation"]', {
    state: "visible",
  });

  // Wait for clients to load (check that "Loading clients..." is gone)
  await page.waitForFunction(
    () => {
      const mainContent = document.querySelector("main");
      return (
        mainContent && !mainContent.textContent?.includes("Loading clients...")
      );
    },
    { timeout: 10000 },
  );

  // Click on the client in the sidebar
  // The button contains the client name in a paragraph element
  const clientButton = page.locator(`button:has(p:text-is("${clientName}"))`);

  // Wait for the client button to be visible
  await clientButton.waitFor({ state: "visible", timeout: 10000 });

  if (await clientButton.isVisible()) {
    await clientButton.click();

    // Wait for the page to load the client's workouts
    await page.waitForLoadState("networkidle");

    // Verify we're on the right client's page
    await page.waitForSelector(`h1:has-text("${clientName}")`, {
      state: "visible",
    });
  } else {
    throw new Error(`Client "${clientName}" not found in sidebar`);
  }
}

/**
 * Navigates to trainer dashboard and selects a specific client
 * Useful for workout management tests
 */
export async function navigateToClientWorkouts(page: Page, clientName: string) {
  // Navigate to trainer dashboard
  await page.goto("/trainer-dashboard");

  // Wait for page to load
  await page.waitForLoadState("networkidle");

  // Select the client
  await selectClient(page, clientName);
}
