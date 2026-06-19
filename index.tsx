import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './src/index.css';
import { Capacitor } from '@capacitor/core';

// На нативной платформе помечаем <html>, чтобы отключить кастомный курсор (cursor: none).
if (Capacitor.isNativePlatform()) {
  document.documentElement.classList.add('capacitor');
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);