import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/Layout/ErrorBoundary.tsx';
import './index.css';

// Global error handlers to prevent unhandled rejection crashes in browser
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    console.warn('Handled global unhandled promise rejection:', event.reason);
    // Prevent default browser crash dialog
    event.preventDefault();
  });

  window.addEventListener('error', (event) => {
    console.warn('Handled global window error:', event.message || event.error);
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

