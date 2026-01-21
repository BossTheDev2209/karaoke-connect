/**
 * Sync Timer Web Worker
 * 
 * This worker runs in a separate thread and is NOT throttled when the browser tab
 * is in the background. It sends periodic "tick" messages to the main thread for
 * sync correction.
 */

let intervalId: number | null = null;

self.onmessage = (event: MessageEvent) => {
  const { type, intervalMs } = event.data;

  switch (type) {
    case 'start':
      // Clear any existing interval
      if (intervalId !== null) {
        clearInterval(intervalId);
      }
      
      // Start ticking at the specified interval (default 500ms)
      const interval = intervalMs || 500;
      intervalId = self.setInterval(() => {
        self.postMessage({
          type: 'tick',
          timestamp: Date.now(),
        });
      }, interval);
      
      console.log(`[SyncWorker] Started with ${interval}ms interval`);
      break;

    case 'stop':
      if (intervalId !== null) {
        clearInterval(intervalId);
        intervalId = null;
        console.log('[SyncWorker] Stopped');
      }
      break;

    case 'ping':
      // Respond to ping for testing
      self.postMessage({
        type: 'pong',
        timestamp: Date.now(),
      });
      break;

    default:
      console.warn(`[SyncWorker] Unknown message type: ${type}`);
  }
};

// Notify main thread that worker is ready
self.postMessage({ type: 'ready' });
