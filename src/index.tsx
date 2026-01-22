import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { ConfigProvider, theme } from 'antd';
import './styles/global.css';

// Unregister old service worker if exists
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => {
      // Unregister old service-worker.js
      if (registration.active?.scriptURL.includes('service-worker.js')) {
        registration.unregister();
        // console.log('Old service worker unregistered');
      }
    });
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConfigProvider
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorPrimary: '#4096ff',
          colorBgContainer: '#2d2d30',
          colorBgElevated: '#3c3c3f',
          colorBorder: '#3f3f46',
          colorText: '#ffffff',
          colorTextSecondary: '#cccccc',
          borderRadius: 6
        }
      }}
    >
      <App />
    </ConfigProvider>
  </React.StrictMode>
);
