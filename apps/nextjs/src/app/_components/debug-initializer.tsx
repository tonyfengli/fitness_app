"use client";

import { useEffect } from "react";
import { debugAuth, enableAutoCapture } from "~/utils/debugCommands";

export function DebugInitializer() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      // Make debug commands available globally
      (window as any).debugAuth = debugAuth;
      (window as any).enableAutoCapture = enableAutoCapture;
      (window as any).FrontendDebugClient = 
        import("~/utils/frontendDebugClient").then(m => m.FrontendDebugClient);
      
      console.log("🛠️ Debug tools initialized (disabled by default for performance)");
      console.log("Commands:");
      console.log("  • window.frontendDebug.setEnabled(true) - Enable debug logging");
      console.log("  • debugAuth() - Full auth debugging report");
      console.log("  • enableAutoCapture() - Auto-capture navigation events");
    }
  }, []);

  return null;
}