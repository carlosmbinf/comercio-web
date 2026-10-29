import React from 'react';
import { CssBaseline, GlobalStyles, ThemeProvider } from '@mui/material';
import { buildTheme } from '../theme';
import { appearanceTokens, DEFAULT_APPEARANCE } from '../domain/appearance';

const BrandingContext = React.createContext({ appearance: DEFAULT_APPEARANCE });
export const useStoreBranding = () => React.useContext(BrandingContext);

export default function StoreBranding({ children, mode, branding }) {
  const theme = React.useMemo(() => buildTheme(mode, branding.appearance), [mode, branding.appearance]);
  const tokens = React.useMemo(() => appearanceTokens(branding.appearance, mode), [mode, branding.appearance]);
  return (
    <BrandingContext.Provider value={branding}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <GlobalStyles styles={{
          ':root': tokens.variables,
          'body .app-root.mode-light, body .app-root.mode-dark, body .catalog-overlay.mode-light, body .catalog-overlay.mode-dark, body .checkout-dialog-paper, body .checkout-dialog-paper.checkout-dark': tokens.variables,
        }} />
        {children}
      </ThemeProvider>
    </BrandingContext.Provider>
  );
}
