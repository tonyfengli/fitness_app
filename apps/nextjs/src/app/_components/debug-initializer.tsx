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
      
      console.log("🛠️ Debug tools initialized. Available commands:");
      console.log("  • debugAuth() - Full auth debugging report");
      console.log("  • enableAutoCapture() - Auto-capture navigation events");
      console.log("  • FrontendDebugClient - Access to debug client");
    }
  }, []);

  return null;
}