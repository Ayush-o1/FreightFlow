/**
 * main.jsx
 * Application entry point.
 * Renders <App /> inside <AuthProvider> so auth context is available globally.
 * <NotificationProvider> sits inside AuthProvider so it can access auth state
 * if needed, and wraps the entire app so toasts + bell work on all pages.
 * Imports the global stylesheet (Tailwind + design tokens).
 */

import { StrictMode } from 'react';
import { createRoot }  from 'react-dom/client';
import { AuthProvider }         from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import App from './App';
import './styles/index.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <NotificationProvider>
        <App />
      </NotificationProvider>
    </AuthProvider>
  </StrictMode>
);

