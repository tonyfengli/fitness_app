/**
 * Debug commands for faster troubleshooting
 */

import { FrontendDebugClient } from './frontendDebugClient';
import { isDebugEnabled } from './debugConfig';

export const debugAuth = async () => {
  console.group('🔍 Auth Debug Report');
  
  // 1. Current state
  const logs = FrontendDebugClient.getLogs();
  const authLogs = logs.filter(log => 
    log.component === 'useAuth' || 
    log.component === 'Navigation' || 
    log.component === 'Auth'
  );
  
  console.log('📊 Current State:');
  const lastNavLog = logs.filter(log => log.event === 'Render').pop();
  console.table(lastNavLog?.data || {});
  
  // 2. Session responses
  console.log('\n🔐 Session Responses:');
  const sessionLogs = logs.filter(log => log.event === 'Session raw response');
  sessionLogs.forEach((log, i) => {
    console.log(`Response ${i + 1}:`, {
      hasUser: log.data.hasUser,
      userData: log.data.userData,
      structure: log.data.dataKeys
    });
  });
  
  // 3. Test endpoints
  console.log('\n🌐 Testing Endpoints:');
  try {
    // Test client endpoint
    const clientRes = await fetch('/api/auth/get-session', { credentials: 'include' });
    const clientData = await clientRes.json();
    console.log('Client endpoint:', clientData);
    
    // Test server debug endpoint
    const serverRes = await fetch('/api/debug/session');
    const serverData = await serverRes.json();
    console.log('Server endpoint:', serverData);
    
    // Compare structures
    console.log('\n🔄 Structure Comparison:');
    console.log('Client keys:', Object.keys(clientData || {}));
    console.log('Server keys:', Object.keys(serverData?.session || {}));
  } catch (error) {
    console.error('Endpoint test failed:', error);
  }
  
  console.groupEnd();
  
  return {
    logs: authLogs,
    recommendation: generateRecommendation(authLogs)
  };
};

function generateRecommendation(logs: any[]) {
  const lastSession = logs.filter(log => log.event === 'Session raw response').pop();
  
  if (!lastSession) {
    return "No session data found. Check if cookies are being sent.";
  }
  
  if (!lastSession.data.hasUser) {
    return "Session exists but user data is missing. Check response structure.";
  }
  
  if (!lastSession.data.userData?.role) {
    return "User data incomplete. Missing role or other required fields.";
  }
  
  return "Session and user data look correct. Check component logic.";
}

// Auto-capture on navigation
export const enableAutoCapture = () => {
  let lastUrl = window.location.href;
  
  setInterval(() => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      FrontendDebugClient.logNavigation(lastUrl, window.location.href, 'auto-capture');
      
      // Capture auth state after navigation
      setTimeout(() => {
        const logs = FrontendDebugClient.getLogs();
        const recentAuth = logs.filter(log => 
          log.timestamp > new Date(Date.now() - 1000).toISOString()
        );
        console.log(`📍 Navigation to ${window.location.pathname}:`, {
          authLogs: recentAuth.length,
          lastState: recentAuth.pop()?.data
        });
      }, 500);
    }
  }, 100);
};

// Debug command to capture client dropdown data
export const debugClients = async () => {
  console.group('👥 Client Dropdown Debug');
  
  try {
    // Find the dropdown element
    const dropdown = document.querySelector('#client-select') as HTMLSelectElement;
    if (!dropdown) {
      console.log('❌ Client dropdown not found on page');
      return null;
    }
    
    // Get all options
    const options = Array.from(dropdown.options);
    const clients = options.slice(1).map(option => ({
      id: option.value,
      displayText: option.text,
      selected: option.selected
    }));
    
    console.log('📊 Client Dropdown Data:');
    console.table(clients);
    
    // Save to a file for Claude Code to read
    const debugData = {
      timestamp: new Date().toISOString(),
      currentPage: window.location.pathname,
      clientsInDropdown: clients,
      totalClients: clients.length,
      selectedClient: clients.find(c => c.selected) || null
    };
    
    // Save to localStorage for persistence
    localStorage.setItem('debug-clients-data', JSON.stringify(debugData, null, 2));
    
    console.log('💾 Client data saved to localStorage as "debug-clients-data"');
    console.log('To retrieve: JSON.parse(localStorage.getItem("debug-clients-data"))');
    
    return debugData;
  } catch (error) {
    console.error('Error capturing client data:', error);
    return null;
  }
  
  console.groupEnd();
};

// Make commands available globally
if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
  (window as any).debugAuth = debugAuth;
  (window as any).enableAutoCapture = enableAutoCapture;
  (window as any).debugClients = debugClients;
  
  // Only show console messages if explicitly enabled
  if (isDebugEnabled()) {
    console.log('🔧 Debug commands available:');
    console.log('- debugAuth() - Full auth debugging report');
    console.log('- enableAutoCapture() - Auto-capture navigation events');
    console.log('- debugClients() - Capture client dropdown data');
  }
}