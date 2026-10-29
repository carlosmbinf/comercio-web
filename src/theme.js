import React from 'react';
import Slide from '@mui/material/Slide';
import { createTheme } from '@mui/material/styles';
import { appearanceTokens } from './domain/appearance';

const DialogSlideUpTransition = React.forwardRef(function DialogSlideUpTransition(props, ref) {
  const prefersReducedMotion = typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const transitionProps = prefersReducedMotion ? { ...props, timeout: 0 } : props;

  return React.createElement(Slide, { ...transitionProps, direction: 'up', ref });
});

export const buildTheme = (mode, appearance) => {
  const tokens = appearanceTokens(appearance, mode);
  return createTheme({
    palette: {
      mode,
      primary: { main: tokens.primary, contrastText: tokens.onPrimary },
      secondary: { main: tokens.secondary, contrastText: tokens.onSecondary },
      success: { main: '#15803d' },
      background: {
        default: tokens.background,
        paper: tokens.paper,
      },
      text: {
        primary: tokens.text,
        secondary: tokens.muted,
      },
      divider: mode === 'dark' ? 'rgba(255,255,255,.09)' : 'rgba(35,25,50,.09)',
    },
    shape: { borderRadius: 18 },
    typography: {
      fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      h1: { fontSize: 'clamp(2rem, 3.2vw, 2.75rem)', fontWeight: 800, letterSpacing: '-0.045em', lineHeight: 1.12 },
      h2: { fontSize: 'clamp(1.75rem, 2.6vw, 2.375rem)', fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1.15 },
      h3: { fontSize: 'clamp(1.5rem, 2.1vw, 1.875rem)', fontWeight: 800, letterSpacing: '-0.035em', lineHeight: 1.2 },
      h4: { fontSize: 'clamp(1.375rem, 1.7vw, 1.625rem)', fontWeight: 750, letterSpacing: '-0.025em', lineHeight: 1.25 },
      h5: { fontSize: 'clamp(1.1875rem, 1.45vw, 1.3125rem)', fontWeight: 750, letterSpacing: '-0.02em', lineHeight: 1.3 },
      h6: { fontSize: '1.125rem', fontWeight: 700, letterSpacing: '-0.01em', lineHeight: 1.35 },
      subtitle1: { fontSize: '1rem', fontWeight: 500, lineHeight: 1.5 },
      subtitle2: { fontSize: '0.875rem', fontWeight: 600, lineHeight: 1.45 },
      body1: { fontSize: '1rem', lineHeight: 1.6 },
      body2: { fontSize: '0.875rem', lineHeight: 1.5 },
      caption: { fontSize: '0.75rem', lineHeight: 1.45 },
      button: { fontWeight: 700, textTransform: 'none' },
    },
    components: {
      MuiButton: {
        styleOverrides: {
          root: { borderRadius: 999, minHeight: 44, paddingInline: 18 },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: { backgroundImage: 'none' },
        },
      },
      MuiDialog: {
        defaultProps: {
          TransitionComponent: DialogSlideUpTransition,
          transitionDuration: { appear: 280, enter: 280, exit: 200 },
        },
        styleOverrides: {
          paper: { borderRadius: 24 },
        },
      },
    },
  });
};
