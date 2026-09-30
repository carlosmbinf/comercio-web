import React from 'react';
import { Alert, Box, Button, Card, CardContent, Checkbox, Chip, CircularProgress, Divider, FormControlLabel, List, ListItem, ListItemIcon, ListItemText, Paper, Tab, Tabs, Typography } from '@mui/material';
import BusinessCenterRoundedIcon from '@mui/icons-material/BusinessCenterRounded';
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded';
import Inventory2RoundedIcon from '@mui/icons-material/Inventory2Rounded';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import StorefrontRoundedIcon from '@mui/icons-material/StorefrontRounded';
import CategoryRoundedIcon from '@mui/icons-material/CategoryRounded';
import ExitToAppRoundedIcon from '@mui/icons-material/ExitToAppRounded';
import CloudSyncRoundedIcon from '@mui/icons-material/CloudSyncRounded';
import { Navigate, useLocation, useNavigate, useOutletContext } from 'react-router-dom';

import { isCompanyConfigured } from '../config';
import { canManageEmpresaFromWeb, ensureEmpresaMethodSuccess, EMPRESA_TERMS, getEmpresaAccessState, isConfiguredCommerceOwner } from '../domain/empresa';
import { callMeteor } from '../meteor/client';
import EmpresaCategoriesPanel from '../components/empresa/EmpresaCategoriesPanel';
import EmpresaOrdersPanel from '../components/empresa/EmpresaOrdersPanel';
import EmpresaProductsPanel from '../components/empresa/EmpresaProductsPanel';
import EmpresaStoresPanel from '../components/empresa/EmpresaStoresPanel';
import EmpresaMercadoLibrePanel from '../components/empresa/EmpresaMercadoLibrePanel';
import '../styles/empresa.css';

const SECTIONS = [
  { icon: <LocalShippingOutlinedIcon />, label: 'Pedidos', value: 'pedidos' },
  { icon: <Inventory2RoundedIcon />, label: 'Productos', value: 'productos' },
  { icon: <StorefrontRoundedIcon />, label: 'Tiendas', value: 'tiendas' },
  { icon: <CategoryRoundedIcon />, label: 'Categorías', value: 'categorias' },
  { icon: <CloudSyncRoundedIcon />, label: 'Integraciones', value: 'integraciones' },
];

const getUserName = (user) =>
  [user?.profile?.firstName, user?.profile?.lastName].filter(Boolean).join(' ').trim() ||
  user?.profile?.name || user?.username || 'comercio';

function EmpresaAccessPanel({ accessState, user, notify }) {
  const [termsConfirmed, setTermsConfirmed] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const needsTerms = accessState === 'terms';

  const acceptTermsAndContinue = async () => {
    setError('');
    setBusy(true);

    try {
      if (needsTerms) {
        if (!termsConfirmed) {
          setError('Confirma que leíste y aceptas los términos para continuar.');
          return;
        }
        ensureEmpresaMethodSuccess(await callMeteor('users.aceptarTerminosEmpresa'));
      }
      notify?.('Términos aceptados. Ya puedes gestionar tu comercio desde la web.');
    } catch (activationError) {
      setError(activationError?.reason || activationError?.message || 'No se pudo habilitar la gestión empresa.');
    } finally {
      setBusy(false);
    }
  };

  const blocked = accessState === 'blocked';
  const notEnabled = accessState === 'not-enabled';

  return (
    <Box className="content-stack empresa-page">
      <Paper className="empresa-hero" elevation={0}>
        <Box className="empresa-hero-icon"><BusinessCenterRoundedIcon /></Box>
        <Box className="empresa-hero-copy">
          <Typography className="eyebrow" variant="overline">GESTIÓN PRIVADA DEL COMERCIO</Typography>
          <Typography variant="h3">Hola, {getUserName(user)}</Typography>
          <Typography color="text.secondary" variant="body1">
            Esta sección está vinculada a la cuenta propietaria de este comercio.
          </Typography>
        </Box>
      </Paper>

      <Card className="empresa-access-card" elevation={0}>
        <CardContent>
          <Box className="empresa-access-heading">
            <Box>
              <Typography variant="h5">{blocked ? 'Acceso suspendido' : needsTerms ? 'Acepta los términos para continuar' : 'Cuenta pendiente de habilitación'}</Typography>
              <Typography color="text.secondary" sx={{ mt: 0.75 }} variant="body2">
                {blocked
                  ? 'El acceso de empresa está bloqueado. Contacta con administración para revisar el estado de la cuenta.'
                  : needsTerms
                    ? 'Lee y acepta las condiciones. No hace falta activar el modo empresa de la app para entrar desde esta web.'
                    : 'La cuenta propietaria todavía no tiene habilitado el acceso al modo empresa. La tienda pública sigue disponible.'}
              </Typography>
            </Box>
            <Chip color={blocked ? 'error' : notEnabled ? 'warning' : 'primary'} label={blocked ? 'Bloqueada' : notEnabled ? 'Pendiente' : 'Verificación requerida'} />
          </Box>

          {needsTerms ? (
            <>
              <Divider sx={{ my: 2.5 }} />
              <Typography fontWeight={700} variant="subtitle1">Compromiso de comercio responsable</Typography>
              <Typography color="text.secondary" sx={{ mt: 0.75 }} variant="body2">
                Al continuar, confirmas que publicarás productos legales, seguros y permitidos. VIDKAR puede retirar contenido, pausar tiendas o suspender el modo empresa si detecta incumplimientos.
              </Typography>
              <List dense sx={{ py: 1 }}>
                {EMPRESA_TERMS.map((term) => (
                  <ListItem key={term} disableGutters>
                    <ListItemIcon sx={{ minWidth: 34 }}><CheckCircleOutlineRoundedIcon color="error" fontSize="small" /></ListItemIcon>
                    <ListItemText primary={term} primaryTypographyProps={{ color: 'text.secondary', variant: 'body2' }} />
                  </ListItem>
                ))}
              </List>
              <FormControlLabel
                control={<Checkbox checked={termsConfirmed} onChange={(event) => setTermsConfirmed(event.target.checked)} />}
                label="Leí y acepto los términos y condiciones del modo empresa."
              />
            </>
          ) : null}

          {error ? <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert> : null}
          {needsTerms ? (
            <Button
              disabled={busy || !termsConfirmed}
              onClick={acceptTermsAndContinue}
              size="large"
              startIcon={busy ? <CircularProgress color="inherit" size={18} /> : <BusinessCenterRoundedIcon />}
              sx={{ mt: 2 }}
              variant="contained"
            >
              {busy ? 'Guardando…' : 'Aceptar y entrar'}
            </Button>
          ) : null}
        </CardContent>
      </Card>
    </Box>
  );
}

export function EmpresaPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { auth, notify, storefront, user, userReady } = useOutletContext();
  const [section, setSection] = React.useState('pedidos');
  const [exiting, setExiting] = React.useState(false);

  if (!isCompanyConfigured) {
    return (
      <Box className="simple-state">
        <Alert severity="warning">Configura <strong>VITE_COMERCIO_EMPRESA_ID</strong> para asociar esta web al comercio.</Alert>
      </Box>
    );
  }

  if (!auth?.userId) {
    return <Navigate replace state={{ from: location.pathname }} to="/login" />;
  }

  if (storefront.loading || !userReady) {
    return <Box className="empresa-loading"><CircularProgress /><Typography color="text.secondary">Verificando la cuenta del comercio…</Typography></Box>;
  }

  if (!isConfiguredCommerceOwner(user, storefront.companyId)) {
    return <Navigate replace to="/" />;
  }

  const accessState = getEmpresaAccessState(user, storefront.companyId);
  if (!canManageEmpresaFromWeb(user, storefront.companyId)) {
    return <EmpresaAccessPanel accessState={accessState} notify={notify} user={user} />;
  }

  const storeName = storefront.stores?.[0]?.title || storefront.stores?.[0]?.name || 'Tu comercio';
  const exitEmpresaMode = async () => {
    if (exiting || !window.confirm('¿Salir del modo empresa? Tus tiendas y productos seguirán disponibles.')) return;
    setExiting(true);
    try {
      ensureEmpresaMethodSuccess(await callMeteor('users.toggleModoEmpresa', false));
      notify?.('Saliste del modo empresa.');
      navigate('/', { replace: true });
    } catch (error) {
      notify?.(error?.reason || error?.message || 'No se pudo salir del modo empresa.');
    } finally {
      setExiting(false);
    }
  };

  return (
    <Box className="content-stack empresa-page">
      <Paper className="empresa-hero" elevation={0}>
        <Box className="empresa-hero-icon"><BusinessCenterRoundedIcon /></Box>
        <Box className="empresa-hero-copy">
          <Box className="empresa-title-row">
            <Box>
              <Typography className="eyebrow" variant="overline">ESPACIO PRIVADO DEL COMERCIO</Typography>
              <Typography variant="h3">Modo empresa</Typography>
            </Box>
              <Box className="empresa-heading-actions">
                <Chip color="success" icon={<CheckCircleOutlineRoundedIcon />} label="Panel web disponible" />
                {user?.modoEmpresa === true ? (
                  <Button disabled={exiting} onClick={exitEmpresaMode} startIcon={exiting ? <CircularProgress color="inherit" size={16} /> : <ExitToAppRoundedIcon />} variant="outlined">
                    {exiting ? 'Saliendo…' : 'Salir del modo empresa'}
                  </Button>
                ) : null}
              </Box>
          </Box>
          <Typography color="text.secondary" variant="body1">
            Gestiona pedidos, productos, tiendas y categorías de {storeName}.
          </Typography>
          <Box className="empresa-hero-metrics">
            <Box><strong>{storefront.stores?.length || 0}</strong><span>tiendas</span></Box>
            <Box><strong>{storefront.products?.length || 0}</strong><span>productos visibles</span></Box>
            <Box><strong>{getUserName(user)}</strong><span>cuenta propietaria</span></Box>
          </Box>
        </Box>
      </Paper>

      <Paper className="empresa-tabs-shell" elevation={0}>
        <Tabs
          aria-label="Secciones del modo empresa"
          onChange={(_event, value) => setSection(value)}
          scrollButtons="auto"
          value={section}
          variant="scrollable"
        >
          {SECTIONS.map((item) => <Tab icon={item.icon} iconPosition="start" key={item.value} label={item.label} value={item.value} />)}
        </Tabs>
      </Paper>

      <Box className="empresa-section" role="tabpanel">
        {section === 'pedidos' ? <EmpresaOrdersPanel notify={notify} storeIds={storefront.storeIds} userId={auth.userId} /> : null}
        {section === 'productos' ? <EmpresaProductsPanel notify={notify} storefront={storefront} user={user} /> : null}
        {section === 'tiendas' ? <EmpresaStoresPanel notify={notify} storefront={storefront} user={user} /> : null}
        {section === 'categorias' ? <EmpresaCategoriesPanel notify={notify} userId={auth.userId} /> : null}
        {section === 'integraciones' ? <EmpresaMercadoLibrePanel notify={notify} stores={storefront.stores} userId={auth.userId} /> : null}
      </Box>
    </Box>
  );
}