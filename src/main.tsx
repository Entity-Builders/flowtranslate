import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { initAnalytics, analytics } from './services/analytics';
import type { IElectronAPI } from './type';

const createBrowserIpcFallback = (): IElectronAPI => ({
  invoke: async <T = unknown>(
    channel: string,
    ...args: unknown[]
  ): Promise<T> => {
    if (channel === 'app:get-version') {
      return 'dev' as T;
    }
    if (channel === 'clipboard:write') {
      const text = typeof args[0] === 'string' ? args[0] : '';
      await navigator.clipboard?.writeText(text);
      return { success: true } as T;
    }
    if (channel === 'app:check-for-updates') {
      return { success: true } as T;
    }
    return undefined as T;
  },
  on: <TArgs extends unknown[] = unknown[]>(
    _channel: string,
    _listener: (event: unknown, ...args: TArgs) => void,
  ) => {
    void _channel;
    void _listener;
  },
  off: <TArgs extends unknown[] = unknown[]>(
    _channel: string,
    _listener: (event: unknown, ...args: TArgs) => void,
  ) => {
    void _channel;
    void _listener;
  },
  send: (_channel: string, ..._args: unknown[]) => {
    void _channel;
    void _args;
  },
});

if (!window.ipcRenderer) {
  window.ipcRenderer = createBrowserIpcFallback();
}

// Initialize analytics
initAnalytics();

// Track app launch — version will be set from App.tsx once available
analytics.track('app_launched');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// Use contextBridge
window.ipcRenderer.on('main-process-message', (_event, message) => {
  console.log(message);
});
