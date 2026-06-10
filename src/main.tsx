import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import {
  initAnalytics,
  analytics,
  getLaunchAnalyticsProperties,
} from './services/analytics';

initAnalytics();

analytics.track('app_launched', getLaunchAnalyticsProperties());

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
