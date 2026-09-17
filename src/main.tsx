import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';
import { initTableScrollLocker } from './utils/tableScrollLocker';

// Enforce single-axis vertical/horizontal scrolling (no diagonal) and contain overscroll on all tables
initTableScrollLocker();

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
