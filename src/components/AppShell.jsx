import React from 'react';
import { Avatar, Badge, Box, Button, Container, IconButton, Tooltip, Typography } from '@mui/material';
import { NavLink, Link as RouterLink, useLocation, useNavigate } from 'react-router-dom';
import DarkModeRoundedIcon from '@mui/icons-material/DarkModeRounded';
import LightModeRoundedIcon from '@mui/icons-material/LightModeRounded';
import ShoppingBagRoundedIcon from '@mui/icons-material/ShoppingBagRounded';
import ShoppingCartRoundedIcon from '@mui/icons-material/ShoppingCartRounded';
import PersonOutlineRoundedIcon from '@mui/icons-material/PersonOutlineRounded';
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded';
import StorefrontRoundedIcon from '@mui/icons-material/StorefrontRounded';
import CheckoutWizard from './CheckoutWizard';

import { COMERCIO_NOMBRE } from '../config';

const NAV_ITEMS = [
  { label: 'Tienda', to: '/', icon: <StorefrontRoundedIcon fontSize="small" /> },
  { label: 'Mis pedidos', to: '/pedidos', icon: <ReceiptLongRoundedIcon fontSize="small" /> },
];

const displayName = (user) =>
  [user?.profile?.firstName, user?.profile?.lastName].filter(Boolean).join(' ').trim() ||
  user?.profile?.name || user?.username || '';

export default function AppShell({ children, cart, mode, onDismissToast, onToggleMode, storefront, toastMessage, user }) {
  const [cartOpen, setCartOpen] = React.useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const configuredStoreName = COMERCIO_NOMBRE || storefront.stores?.[0]?.title || storefront.stores?.[0]?.name || '';
  const storeLabel = configuredStoreName || 'VIDKAR · COMERCIO';
  const userLabel = displayName(user);
  const cartCount = cart?.items?.length || 0;

  React.useEffect(() => {
    if (typeof document !== 'undefined') {
      document.title = configuredStoreName
        ? `Comercio · ${configuredStoreName}`
        : 'Comercio · VIDKAR';
    }
  }, [configuredStoreName]);

  return (
    <Box className={`app-root ${mode === 'dark' ? 'mode-dark' : 'mode-light'}`}>
      <Box component="header" className="site-header">
        <Container maxWidth="xl" className="header-inner">
          <RouterLink aria-label="Ir al inicio" className="brand-link" to="/">
            <Box className="brand-icon"><ShoppingBagRoundedIcon /></Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography className="brand-title" noWrap>{storeLabel}</Typography>
              <Typography className="brand-caption" noWrap>COMPRA LOCAL · VIDKAR</Typography>
            </Box>
          </RouterLink>

          <Box className="desktop-nav" component="nav" aria-label="Navegación principal">
            {NAV_ITEMS.map((item) => (
              <Button
                className="nav-link"
                component={NavLink}
                end={item.to === '/'}
                key={item.to}
                startIcon={item.icon}
                to={item.to}
              >
                {item.label}
              </Button>
            ))}
          </Box>

          <Box className="header-actions">
            <Tooltip title={mode === 'dark' ? 'Activar modo claro' : 'Activar modo oscuro'}>
              <IconButton aria-label={mode === 'dark' ? 'Activar modo claro' : 'Activar modo oscuro'} onClick={onToggleMode}>
                {mode === 'dark' ? <LightModeRoundedIcon /> : <DarkModeRoundedIcon />}
              </IconButton>
            </Tooltip>
            <Tooltip title="Abrir carrito">
              <IconButton aria-label={`Abrir carrito, ${cartCount} artículos`} className="cart-icon-button" onClick={() => setCartOpen(true)}>
                <Badge badgeContent={cartCount} color="secondary" max={99}>
                  <ShoppingCartRoundedIcon />
                </Badge>
              </IconButton>
            </Tooltip>
            <Button
              className="profile-action"
              component={RouterLink}
              startIcon={user ? (
                <Avatar alt={userLabel || user.username} className="header-avatar">
                  {(userLabel || user.username || 'U').slice(0, 1).toUpperCase()}
                </Avatar>
              ) : <PersonOutlineRoundedIcon />}
              to={user ? '/perfil' : '/login'}
            >
              <span className="profile-label">{user ? (userLabel || 'Mi perfil') : 'Iniciar sesión'}</span>
            </Button>
          </Box>
        </Container>
      </Box>

      <Container component="main" className="page-frame" maxWidth="xl" key={location.pathname}>
        <div className="page-enter">{children}</div>
      </Container>

      <Box component="footer" className="site-footer">
        <Container maxWidth="xl" className="footer-inner">
          <Box className="footer-brand"><StorefrontRoundedIcon fontSize="small" /> VIDKAR <span>·</span> COMERCIO</Box>
          <Typography color="text.secondary" variant="caption">Compra segura, seguimiento claro y atención en un solo lugar.</Typography>
        </Container>
      </Box>

      <div aria-live="polite" className={toastMessage ? 'product-toast visible' : 'product-toast'} role="status">
        {toastMessage}
        <button aria-label="Cerrar aviso" onClick={onDismissToast} type="button">×</button>
      </div>

      <Box className="mobile-nav" component="nav" aria-label="Navegación móvil">
        {[...NAV_ITEMS, { label: 'Perfil', to: user ? '/perfil' : '/login', icon: <PersonOutlineRoundedIcon fontSize="small" /> }].map((item) => (
          <Button
            aria-current={location.pathname === item.to ? 'page' : undefined}
            className={location.pathname === item.to ? 'mobile-nav-item active' : 'mobile-nav-item'}
            component={NavLink}
            end={item.to === '/'}
            key={item.to}
            to={item.to}
          >
            {item.icon}<span>{item.label}</span>
          </Button>
        ))}
      </Box>

      <CheckoutWizard
        cart={cart}
        onClose={() => setCartOpen(false)}
        onCompleted={() => {
          setCartOpen(false);
          navigate('/pedidos');
        }}
        onLogin={() => {
          setCartOpen(false);
          navigate('/login', { state: { from: '/' } });
        }}
        open={cartOpen}
        storefront={storefront}
        user={user}
      />
    </Box>
  );
}
