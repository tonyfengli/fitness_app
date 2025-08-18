/**
 * Client-side utilities for managing session test data collection
 */

class SessionTestDataClient {
  private apiUrl = "/api/debug/session-test-data";

  /**
   * Enable session test data logging
   */
  async enable(): Promise<void> {
    try {
      const response = await fetch(`${this.apiUrl}/enable`, {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error(`Failed to enable: ${response.statusText}`);
      }

      console.log("✅ Session test data logging enabled");
      console.log(
        "📝 All preference flows will now be logged to session-test-data/",
      );
    } catch (error) {
      console.error("❌ Failed to enable session test data logging:", error);
    }
  }

  /**
   * Disable session test data logging
   */
  async disable(): Promise<void> {
    try {
      const response = await fetch(`${this.apiUrl}/disable`, {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error(`Failed to disable: ${response.statusText}`);
      }

      console.log("🚫 Session test data logging disabled");
    } catch (error) {
      console.error("❌ Failed to disable session test data logging:", error);
    }
  }

  /**
   * Check if logging is enabled
   */
  async isEnabled(): Promise<boolean> {
    try {
      const response = await fetch(`${this.apiUrl}/status`);

      if (!response.ok) {
        throw new Error(`Failed to check status: ${response.statusText}`);
      }

      const data = await response.json();
      return data.enabled;
    } catch (error) {
      console.error("❌ Failed to check session test data status:", error);
      return false;
    }
  }

  /**
   * List available session test data files
   */
  async listSessions(): Promise<string[]> {
    try {
      const response = await fetch(`${this.apiUrl}/list`);

      if (!response.ok) {
        throw new Error(`Failed to list sessions: ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`📁 Found ${data.sessions.length} session(s):`);
      data.sessions.forEach((session: string, index: number) => {
        console.log(`  ${index + 1}. ${session}`);
      });

      return data.sessions;
    } catch (error) {
      console.error("❌ Failed to list sessions:", error);
      return [];
    }
  }

  /**
   * View the latest session data
   */
  async viewLatest(): Promise<void> {
    try {
      const response = await fetch(`${this.apiUrl}/latest`);

      if (!response.ok) {
        throw new Error(`Failed to get latest session: ${response.statusText}`);
      }

      const data = await response.json();
      console.log("📊 Latest Session Data:");
      console.log("========================");
      console.log(JSON.stringify(data, null, 2));
    } catch (error) {
      console.error("❌ Failed to view latest session:", error);
    }
  }
}

// Create global instance and attach to window
const sessionTestData = new SessionTestDataClient();

// Make it available globally in development
if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
  (window as any).sessionTestData = sessionTestData;
}

// Export for use in components
export { sessionTestData };

// Console usage instructions
if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
  console.log(`
🔍 Session Test Data Debug Tools Available:
  
  sessionTestData.enable()     - Start logging preference flows
  sessionTestData.disable()    - Stop logging preference flows
  sessionTestData.isEnabled()  - Check if logging is active
  sessionTestData.listSessions() - List all saved sessions
  sessionTestData.viewLatest() - View the most recent session data
  `);
}
