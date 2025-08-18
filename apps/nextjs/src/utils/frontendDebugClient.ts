/**
 * Frontend debugging system for capturing UI state and auth flow
 * Zero-overhead in production through compile-time optimization
 */

import { isDebugEnabled } from "./debugConfig";

interface DebugLog {
  timestamp: string;
  component: string;
  event: string;
  data: any;
  stack?: string[];
}

interface AuthState {
  user: any;
  isAuthenticated: boolean;
  isLoading: boolean;
  session: any;
}

// No-op implementation for production (gets tree-shaken)
class NoOpDebugClient {
  static log() {}
  static logAuthState() {}
  static logNavigation() {}
  static getLogs() {
    return [];
  }
  static getAuthHistory() {
    return [];
  }
  static getReport() {
    return {};
  }
  static clear() {}
  static setEnabled() {}
  static downloadReport() {}
  static printLogs() {}
  static getLogsForComponent() {
    return [];
  }
  static async sendToServer() {}
}

// Real implementation for development
class RealDebugClient {
  private static logs: DebugLog[] = [];
  private static maxLogs = 100;
  private static enabled = false; // Disabled by default for performance
  private static authStateHistory: AuthState[] = [];

  static log(component: string, event: string, data: any) {
    if (!this.enabled) return;

    const log: DebugLog = {
      timestamp: new Date().toISOString(),
      component,
      event,
      data,
      stack: this.getComponentStack(),
    };

    this.logs.push(log);

    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    console.log(`[${component}] ${event}:`, data);
  }

  static logAuthState(state: AuthState) {
    this.log("Auth", "State Change", state);
    this.authStateHistory.push({
      ...state,
      timestamp: new Date().toISOString(),
    } as any);

    if (this.authStateHistory.length > 20) {
      this.authStateHistory = this.authStateHistory.slice(-20);
    }
  }

  static logNavigation(from: string, to: string, trigger: string) {
    this.log("Navigation", "Route Change", { from, to, trigger });
  }

  private static getComponentStack(): string[] {
    const stack = new Error().stack?.split("\n") || [];
    return stack.slice(3, 8).map((line) => line.trim());
  }

  static getLogs(): DebugLog[] {
    return this.logs;
  }

  static getAuthHistory(): AuthState[] {
    return this.authStateHistory;
  }

  static getReport() {
    return {
      timestamp: new Date().toISOString(),
      enabled: this.enabled,
      totalLogs: this.logs.length,
      logs: this.logs,
      authHistory: this.authStateHistory,
      currentUrl: typeof window !== "undefined" ? window.location.href : "N/A",
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "N/A",
    };
  }

  static clear() {
    this.logs = [];
    this.authStateHistory = [];
    console.log("🧹 Frontend debug logs cleared");
  }

  static setEnabled(enabled: boolean) {
    this.enabled = enabled;
    console.log(`🔍 Frontend debugging ${enabled ? "enabled" : "disabled"}`);
  }

  static downloadReport() {
    const report = this.getReport();
    const blob = new Blob([JSON.stringify(report, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `frontend-debug-${new Date().toISOString()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  static printLogs() {
    console.group("🔍 Frontend Debug Report");

    console.group("📊 Summary");
    console.log(`Total logs: ${this.logs.length}`);
    console.log(`Auth states recorded: ${this.authStateHistory.length}`);
    console.log(`Current URL: ${window.location.href}`);
    console.groupEnd();

    console.group("🔐 Auth History");
    this.authStateHistory.forEach((state, i) => {
      console.log(`[${i}] ${(state as any).timestamp}:`, {
        isAuthenticated: state.isAuthenticated,
        user: state.user?.name,
        role: state.user?.role,
      });
    });
    console.groupEnd();

    console.group("📝 Recent Events");
    this.logs.slice(-10).forEach((log, i) => {
      console.group(`[${i}] ${log.component} - ${log.event}`);
      console.log("Time:", log.timestamp);
      console.log("Data:", log.data);
      console.groupEnd();
    });
    console.groupEnd();

    console.groupEnd();
  }

  static getLogsForComponent(component: string): DebugLog[] {
    return this.logs.filter((log) => log.component === component);
  }

  static async sendToServer() {
    try {
      const response = await fetch("/api/debug/frontend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(this.getReport()),
      });
      return response.json();
    } catch (error) {
      console.error("Failed to send debug logs:", error);
    }
  }
}

// Export the appropriate implementation based on environment
export const FrontendDebugClient =
  process.env.NODE_ENV === "production" ? NoOpDebugClient : RealDebugClient;

// Only expose to window in development
if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
  (window as any).frontendDebug = FrontendDebugClient;
  // Only show console messages if explicitly enabled
  if (isDebugEnabled()) {
    console.log("🔍 Frontend Debug Client available as window.frontendDebug");
    console.log(
      "Commands: printLogs(), getReport(), downloadReport(), clear()",
    );
  }
}
