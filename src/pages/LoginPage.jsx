import React from 'react';
import { Alert, Box, Button, Card, CardContent, CircularProgress, Divider, InputAdornment, Stack, TextField, Typography } from '@mui/material';
import AlternateEmailRoundedIcon from '@mui/icons-material/AlternateEmailRounded';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import LoginRoundedIcon from '@mui/icons-material/LoginRounded';
import VerifiedUserRoundedIcon from '@mui/icons-material/VerifiedUserRounded';
import { Link as RouterLink, useLocation, useNavigate, useOutletContext } from 'react-router-dom';
import { GoogleLogin, GoogleOAuthProvider } from '@react-oauth/google';

import { getGoogleClientConfig, loginWithGoogleIdToken, loginWithPassword } from '../meteor/client';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { auth } = useOutletContext();
  const [identifier, setIdentifier] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [loadingGoogle, setLoadingGoogle] = React.useState(false);
  const [googleConfig, setGoogleConfig] = React.useState(null);
  const [googleButtonWidth] = React.useState(() => (
    typeof window === 'undefined' ? 384 : Math.max(200, Math.min(384, window.innerWidth - 96))
  ));
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    let mounted = true;

    getGoogleClientConfig()
      .then((config) => {
        if (mounted && config?.enabled && config?.clientId && config?.nonce) {
          setGoogleConfig(config);
        }
      })
      .catch(() => {
        if (mounted) setGoogleConfig(null);
      });

    return () => {
      mounted = false;
    };
  }, []);

  React.useEffect(() => {
    if (auth?.userId) navigate(location.state?.from || '/', { replace: true });
  }, [auth?.userId, location.state, navigate]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    if (!identifier.trim() || !password) {
      setError('Introduce tu usuario o correo y tu contraseña.');
      return;
    }
    setLoading(true);
    try {
      await loginWithPassword(identifier.trim(), password);
      navigate(location.state?.from || '/', { replace: true });
    } catch (loginError) {
      setError(loginError?.reason || loginError?.message || 'No se pudo iniciar sesión. Comprueba tus datos.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    if (!credentialResponse?.credential || !googleConfig?.nonce || loadingGoogle || loading) {
      setError('Google no devolvió una credencial válida. Inténtalo de nuevo.');
      return;
    }

    setError('');
    setLoadingGoogle(true);
    try {
      await loginWithGoogleIdToken(credentialResponse.credential, googleConfig.nonce);
      navigate(location.state?.from || '/', { replace: true });
    } catch (loginError) {
      setError(loginError?.reason || loginError?.message || 'No se pudo completar el acceso con Google.');
      try {
        const nextConfig = await getGoogleClientConfig();
        setGoogleConfig(nextConfig?.enabled && nextConfig?.clientId && nextConfig?.nonce ? nextConfig : null);
      } catch (_configError) {
        setGoogleConfig(null);
      }
    } finally {
      setLoadingGoogle(false);
    }
  };

  return (
    <Box className="login-layout">
      <Box className="login-story">
        <Typography className="eyebrow" variant="overline">TU COMERCIO FAVORITO, MÁS CERCA</Typography>
        <Typography className="login-headline" variant="h2">Todo lo que te gusta, en un solo lugar.</Typography>
        <Typography color="text.secondary" sx={{ maxWidth: 460, lineHeight: 1.8 }}>
          Accede para guardar tus compras, seguir cada pedido y comprar de forma sencilla con la experiencia segura de VIDKAR.
        </Typography>
        <Stack className="login-trust" direction="row" spacing={1.25}>
          <VerifiedUserRoundedIcon color="success" />
          <Typography color="text.secondary" variant="body2">Tu cuenta está protegida por el servidor Meteor de VIDKAR.</Typography>
        </Stack>
      </Box>
      <Card className="login-card" elevation={0}>
        <CardContent>
          <Box className="login-card-heading">
            <Box className="login-icon"><LoginRoundedIcon /></Box>
            <Typography color="text.secondary" variant="overline">BIENVENIDO DE NUEVO</Typography>
            <Typography variant="h4">Inicia sesión</Typography>
            <Typography color="text.secondary" variant="body2">Usa tu cuenta VIDKAR para continuar con tu compra.</Typography>
          </Box>
          {error ? <Alert severity="error" sx={{ mb: 2.5 }}>{error}</Alert> : null}
          <Box component="form" onSubmit={handleSubmit}>
            <Stack spacing={2.1}>
              <TextField
                autoComplete="username"
                autoFocus
                fullWidth
                label="Usuario o correo electrónico"
                onChange={(event) => setIdentifier(event.target.value)}
                value={identifier}
                InputProps={{ startAdornment: <InputAdornment position="start"><AlternateEmailRoundedIcon fontSize="small" /></InputAdornment> }}
              />
              <TextField
                autoComplete="current-password"
                fullWidth
                label="Contraseña"
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                value={password}
                InputProps={{ startAdornment: <InputAdornment position="start"><LockRoundedIcon fontSize="small" /></InputAdornment> }}
              />
              <Button disabled={loading} fullWidth size="large" type="submit" variant="contained">
                {loading ? <CircularProgress color="inherit" size={20} /> : 'Continuar'}
              </Button>
            </Stack>
          </Box>
          {googleConfig ? (
            <Box sx={{ mt: 2.5 }}>
              <Box sx={{ alignItems: 'center', display: 'flex', gap: 1.5, mb: 2 }}>
                <Divider sx={{ flex: 1 }} />
                <Typography color="text.secondary" variant="caption">O continúa con</Typography>
                <Divider sx={{ flex: 1 }} />
              </Box>
              <Box
                className="login-google-button"
                aria-busy={loading || loadingGoogle}
                sx={{
                  display: 'flex',
                  justifyContent: 'center',
                  opacity: loading || loadingGoogle ? 0.65 : 1,
                  pointerEvents: loading || loadingGoogle ? 'none' : 'auto',
                }}
              >
                <GoogleOAuthProvider clientId={googleConfig.clientId}>
                  <GoogleLogin 
                    key={googleConfig.nonce}
                    containerProps={{ style: { colorScheme: 'normal' } }}
                    nonce={googleConfig.nonce}
                    onSuccess={handleGoogleSuccess}
                    onError={() => setError('No se pudo abrir el acceso de Google. Inténtalo de nuevo.')}
                    ux_mode="popup"
                    shape="pill"
                    size="large"
                    text="continue_with"
                    theme="filled_blue"
                    width={googleButtonWidth}
                  />
                </GoogleOAuthProvider>
              </Box>
              {loadingGoogle ? (
                <Box sx={{ alignItems: 'center', display: 'flex', gap: 1, justifyContent: 'center', mt: 1.5 }}>
                  <CircularProgress size={16} />
                  <Typography color="text.secondary" variant="caption">Verificando tu cuenta…</Typography>
                </Box>
              ) : null}
            </Box>
          ) : null}
          <Typography className="login-footnote" color="text.secondary" variant="caption">
            El inicio de sesión y la sesión persistente se gestionan con Meteor; no almacenamos tu contraseña en esta web.
          </Typography>
          <Button component={RouterLink} fullWidth to="/" variant="text">Volver a la tienda</Button>
        </CardContent>
      </Card>
    </Box>
  );
}
