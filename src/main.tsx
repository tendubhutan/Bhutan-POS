import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';

// Instant Service Worker auto-update & reload logic
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    window.location.reload();
  });
  // Check for updates when page becomes visible or focused
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      navigator.serviceWorker.getRegistration().then(reg => {
        reg?.update();
      });
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

