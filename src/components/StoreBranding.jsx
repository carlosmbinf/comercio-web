import React from 'react';
import { CssBaseline, GlobalStyles, ThemeProvider } from '@mui/material';
import { buildTheme } from '../theme';
import { appearanceTokens, DEFAULT_APPEARANCE } from '../domain/appearance';

const BrandingContext = React.createContext({ appearance: DEFAULT_APPEARANCE });
export const useStoreBranding = () => React.useContext(BrandingContext);

export default function StoreBranding({ children, mode, branding }) {
  const theme = React.useMemo(() => buildTheme(mode, branding.appearance), [mode, branding.appearance]);
  const tokens = React.useMemo(() => appearanceTokens(branding.appearance, mode), [mode, branding.appearance]);
  React.useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]');
    const previous = meta?.content;
    if (meta) meta.content = tokens.background;
    const icon = branding.appearance.logo ? document.createElement('link') : null;
    if (icon) { icon.rel = 'icon'; icon.href = branding.appearance.logo; document.head.append(icon); }
    return () => { if (meta) meta.content = previous; icon?.remove(); };
  }, [tokens.background, branding.appearance.logo]);
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
