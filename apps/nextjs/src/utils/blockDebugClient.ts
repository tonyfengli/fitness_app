/**
 * Client-side utilities for block system debugging
 */

export class BlockDebugClient {
  private static baseUrl = '/api/debug/blocks';

  /**
   * Get current debug logs
   */
  static async getLogs(): Promise<any> {
    const response = await fetch(this.baseUrl);
    return response.json();
  }

  /**
   * Get formatted debug report
   */
  static async getReport(): Promise<any> {
    const response = await fetch(`${this.baseUrl}?format=report`);
    return response.json();
  }

  /**
   * Clear debug logs
   */
  static async clearLogs(): Promise<any> {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'clear' })
    });
    return response.json();
  }

  /**
   * Enable debugging
   */
  static async enable(): Promise<any> {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'enable' })
    });
    return response.json();
  }

  /**
   * Disable debugging
   */
  static async disable(): Promise<any> {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'disable' })
    });
    return response.json();
  }

  /**
   * Download debug report as file
   */
  static async downloadReport(): Promise<void> {
    const data = await this.getReport();
    const blob = new Blob([data.report || JSON.stringify(data, null, 2)], { 
      type: 'text/plain' 
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `block-debug-${new Date().toISOString()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Console helper for debugging
   */
  static async logToConsole(): Promise<void> {
    const data = await this.getLogs();
    console.group('🔍 Block System Debug Logs');
    data.logs.forEach((log: any, index: number) => {
      console.group(`[${index}] ${log.stage} - ${log.timestamp}`);
      console.log(log.data || log);
      console.groupEnd();
    });
    console.groupEnd();
  }
}

// Make available globally in development
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as any).blockDebug = BlockDebugClient;
  console.log('🔧 Block debug available (disabled by default). Enable with: blockDebug.enable()');
}