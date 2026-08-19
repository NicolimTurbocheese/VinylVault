import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { CurrencyProvider } from './context/CurrencyContext';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CurrencyProvider>
      <App />
    </CurrencyProvider>
  </StrictMode>,
);

// Offline support. Registered after load so it never competes with first paint, and only
// in production — a service worker in front of the dev server intercepts HMR and makes
// edits appear not to take.
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    // BASE_URL carries the GitHub Pages subpath, which also scopes the worker correctly.
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL })
      .catch((err) => console.warn("Service worker registration failed:", err));
  });
}
