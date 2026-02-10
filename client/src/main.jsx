import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { SocketProvider } from './context/SocketContext';
import { SessionProvider } from './context/SessionContext';
import { ThemeProvider } from './context/ThemeContext';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import './styles/globals.css';

// PWA Service Worker is registered automatically by vite-plugin-pwa

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <SocketProvider>
            <SessionProvider>
              <App />
            </SessionProvider>
          </SocketProvider>
        </BrowserRouter>
      </ThemeProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
