import React from 'react';
import { Alert, Box, Button, CircularProgress, Paper, Typography } from '@mui/material';
import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import StorefrontRoundedIcon from '@mui/icons-material/StorefrontRounded';

import { isMeteorConfigured } from './config';
import AppShell from './components/AppShell';
import { useCommerceCart } from './hooks/useCommerceCart';
import { useStorefront } from './hooks/useStorefront';
import { connectToMeteor, Meteor } from './meteor/client';
import { LoginPage } from './pages/LoginPage';
import { OrdersPage } from './pages/OrdersPage';
import { ProfilePage } from './pages/ProfilePage';
import { StorePage } from './pages/StorePage';

function ConnectionScreen({ mode, onRetry, error }) {
  return (
    <Box className="connection-screen">
      <Paper className="connection-card" elevation={0}>
        <Box className="brand-mark"><StorefrontRoundedIcon /></Box>
        <Typography color="text.secondary" sx={{ letterSpacing: '.16em', fontWeight: 800 }} variant="overline">
          VIDKAR · COMERCIO
        </Typography>
        <Typography sx={{ mt: 1 }} variant="h4">{error ? 'No se pudo conectar' : 'Conectando con tu tienda'}</Typography>
        <Typography color="text.secondary" sx={{ mt: 1.5, maxWidth: 460 }}>
          {error || 'Estamos estableciendo una conexión segura con el servidor para sincronizar el catálogo y tus compras.'}
        </Typography>
        {error ? (
          <Button onClick={onRetry} sx={{ mt: 3 }} variant="contained">Reintentar conexión</Button>
        ) : (
          <CircularProgress sx={{ mt: 3 }} />
        )}
      </Paper>
    </Box>
  );
}

function StoreLayout({ mode, onToggleMode }) {
  const storefront = useStorefront();
  const cart = useCommerceCart(storefront.storeIds);
  const [toastMessage, setToastMessage] = React.useState('');
  const notify = React.useCallback((message) => setToastMessage(String(message || '')), []);
  const dismissToast = React.useCallback(() => setToastMessage(''), []);
  const auth = Meteor.useTracker(() => ({
    loggingIn: Meteor.loggingIn?.() || false,
    userId: Meteor.userId(),
  }), []);
  const userState = Meteor.useTracker(() => {
    if (!auth.userId) return { ready: true, user: null };
    const selector = { _id: auth.userId };
    const fields = {
      _id: 1,
      username: 1,
      'emails.address': 1,
      'profile.name': 1,
      'profile.firstName': 1,
      'profile.lastName': 1,
      picture: 1,
      movil: 1,
      mobile: 1,
      phone: 1,
      telefono: 1,
      permitirPagoEfectivoCUP: 1,
    };
    const handle = Meteor.subscribe('user', selector, { fields });
    return {
      ready: handle.ready(),
      user: Meteor.users.findOne(selector, { fields }) || null,
    };
  }, [auth.userId]);

  const outletContext = React.useMemo(() => ({
    auth,
    cart,
    notify,
    storefront,
    user: userState.user,
    userReady: userState.ready,
  }), [auth, cart, notify, storefront, userState.ready, userState.user]);

  return (
    <AppShell
      cart={cart}
      mode={mode}
      onDismissToast={dismissToast}
      onToggleMode={onToggleMode}
      storefront={storefront}
      toastMessage={toastMessage}
      user={userState.user}
    >
      <Outlet context={outletContext} />
    </AppShell>
  );
}

export default function App({ mode, onToggleMode }) {
  const [connectionError, setConnectionError] = React.useState('');
  const status = Meteor.useTracker(() => Meteor.status?.() || { connected: false, status: 'offline' }, []);

  const connect = React.useCallback(async () => {
    setConnectionError('');
    try {
      await connectToMeteor();
    } catch (error) {
      setConnectionError(error?.reason || error?.message || 'Revisa la URL DDP configurada.');
    }
  }, []);

  React.useEffect(() => {
    if (!isMeteorConfigured) {
      setConnectionError('Configura una URL ws:// o wss:// válida en VITE_METEOR_DDP_URL.');
      return undefined;
    }
    connect();
    return undefined;
  }, [connect]);

  if (!isMeteorConfigured || connectionError) {
    return <ConnectionScreen error={connectionError || 'URL DDP no configurada.'} onRetry={connect} mode={mode} />;
  }

  if (!status.connected) {
    return <ConnectionScreen onRetry={connect} mode={mode} />;
  }

  return (
    <Routes>
      <Route element={<StoreLayout mode={mode} onToggleMode={onToggleMode} />}>
        <Route index element={<StorePage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="pedidos" element={<OrdersPage />} />
        <Route path="perfil" element={<ProfilePage />} />
        <Route path="*" element={<Navigate replace to="/" />} />
      </Route>
    </Routes>
  );
}
