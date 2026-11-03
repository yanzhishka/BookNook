import React, { lazy, Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import { AppErrorBoundary } from './components/AppErrorBoundary';
import './src/index.css';
import { Capacitor } from '@capacitor/core';

const App = lazy(() => import('./App'));

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
    <AppErrorBoundary>
      <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-stone-500" role="status">Открываем…</div>}>
        <App />
      </Suspense>
    </AppErrorBoundary>
  </React.StrictMode>
);
