import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AuthProvider } from './context/AuthContext';
import './lib/chartSetup';
import './styles/global.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* Последний рубеж: ошибка рендера показывает экран с кнопкой, а не белый лист */}
    <ErrorBoundary variant="page">
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
);
