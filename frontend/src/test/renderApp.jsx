// Rendu de l'application complète avec ses providers (thème, toasts)
import { render } from '@testing-library/react';
import { ThemeProvider } from '../context/ThemeContext';
import { ToastProvider } from '../components/Toast';
import App from '../App';

export function renderApp() {
  return render(
    <ThemeProvider>
      <ToastProvider>
        <App />
      </ToastProvider>
    </ThemeProvider>
  );
}
