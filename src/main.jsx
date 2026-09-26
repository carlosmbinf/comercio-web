import React from 'react';
import { createRoot } from 'react-dom/client';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { BrowserRouter } from 'react-router-dom';

import App from './App';
import { buildTheme } from './theme';
import './styles.css';
import 'leaflet/dist/leaflet.css';

function readSavedMode() {
  try {
    const saved = localStorage.getItem('vidkar.comercio.theme');
    return saved === 'dark' ? 'dark' : 'light';
  } catch (_error) {
    return 'light';
  }
}

function Root() {
  const [mode, setMode] = React.useState(readSavedMode);
  const theme = React.useMemo(() => buildTheme(mode), [mode]);
  const toggleMode = React.useCallback(() => {
    setMode((current) => {
      const next = current === 'dark' ? 'light' : 'dark';
      try {
        localStorage.setItem('vidkar.comercio.theme', next);
      } catch (_error) {
        // El tema sigue funcionando durante esta sesión si el almacenamiento está desactivado.
      }
      return next;
    });
  }, []);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <App mode={mode} onToggleMode={toggleMode} />
      </BrowserRouter>
    </ThemeProvider>
  );
}

// MeteorRN 2.9.1 does not restore its useTracker mount flag after StrictMode's
// development-only effect replay; without StrictMode DDP subscriptions remain reactive.
createRoot(document.getElementById('root')).render(<Root />);
