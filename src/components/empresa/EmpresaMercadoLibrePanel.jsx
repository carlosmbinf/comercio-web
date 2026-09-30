import React from 'react';
import { Alert, Box, Button, Chip, CircularProgress, FormControl, MenuItem, Paper, Select, Tooltip, Typography } from '@mui/material';
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded';
import CloudSyncRoundedIcon from '@mui/icons-material/CloudSyncRounded';
import LinkRoundedIcon from '@mui/icons-material/LinkRounded';
import LinkOffRoundedIcon from '@mui/icons-material/LinkOffRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import StorefrontRoundedIcon from '@mui/icons-material/StorefrontRounded';

import { METEOR_HTTP_URL } from '../../config';
import { callMeteor } from '../../meteor/client';

const getErrorMessage = (error, fallback) => error?.reason || error?.message || fallback;
const getServerOrigin = () => {
  try {
    return new URL(METEOR_HTTP_URL || window.location.origin).origin;
  } catch (_error) {
    return window.location.origin;
  }
};
const getDefaultRedirectUri = () => new URL('/api/mercadolibre/oauth/callback', getServerOrigin()).toString();
const oauthFailureMessages = {
  previous_account_has_open_publications: 'Cierra las publicaciones abiertas de la cuenta anterior antes de vincular otro vendedor.',
  seller_already_linked: 'Esta cuenta de Mercado Libre ya está vinculada a otro usuario VIDKAR.',
  invalid_state: 'La autorización expiró o ya se utilizó. Vuelve a conectar Mercado Libre.',
  authorization_denied: 'No se autorizó la cuenta de Mercado Libre. Puedes intentarlo otra vez.',
  pkce_required: 'La aplicación de Mercado Libre requiere PKCE, pero VIDKAR no envió un verificador válido. Administración debe igualar la configuración PKCE del servidor y DevCenter antes de volver a conectar.',
  redirect_uri_mismatch: 'Mercado Libre rechazó la URI de retorno. Administración debe confirmar que coincide exactamente con la registrada en DevCenter.',
  invalid_client: 'Mercado Libre rechazó la identificación de la aplicación. Administración debe revisar sus credenciales en el servidor.',
  invalid_request: 'Mercado Libre rechazó el canje OAuth (invalid_request). Administración debe verificar PKCE y la URI de retorno de la aplicación en DevCenter.',
  invalid_grant: 'El código de autorización expiró, ya se usó o corresponde a otra aplicación o URI. Vuelve a conectar Mercado Libre.',
};
const getOAuthFailureMessage = (reason) => Object.prototype.hasOwnProperty.call(oauthFailureMessages, reason)
  ? oauthFailureMessages[reason]
  : 'Mercado Libre no completó la vinculación. Comprueba la configuración OAuth y vuelve a intentarlo.';

export default function EmpresaMercadoLibrePanel({ notify, stores = [], userId }) {
  const [integration, setIntegration] = React.useState(null);
  const [syncState, setSyncState] = React.useState(null);
  const [selectedStoreId, setSelectedStoreId] = React.useState('');
  const [stockLocations, setStockLocations] = React.useState([]);
  const [selectedStockLocation, setSelectedStockLocation] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [busyAction, setBusyAction] = React.useState('');
  const [error, setError] = React.useState('');
  const popupMessageHandler = React.useRef(null);
  const oauthCleanup = React.useRef(null);

  const loadState = React.useCallback(async () => {
    if (!userId) {
      setIntegration(null);
      setSyncState(null);
      setLoading(false);
      return;
    }
    try {
      const nextIntegration = await callMeteor('comercio.mercadoLibre.getEstado');
      setIntegration(nextIntegration || null);
      const nextSyncState = await callMeteor('comercio.mercadoLibre.estadoSincronizacion').catch(() => null);
      setSyncState(nextSyncState || null);
      setSelectedStoreId((current) => current || stores[0]?._id || '');
      setError('');
    } catch (loadError) {
      setError(getErrorMessage(loadError, 'No se pudo cargar la configuración de Mercado Libre.'));
    } finally {
      setLoading(false);
    }
  }, [stores, userId]);

  React.useEffect(() => {
    setLoading(true);
    loadState();
  }, [loadState]);

  React.useEffect(() => {
    if (!integration?.enabled || !['pending', 'processing'].includes(syncState?.status)) return undefined;
    const timer = window.setInterval(() => {
      callMeteor('comercio.mercadoLibre.estadoSincronizacion')
        .then(setSyncState)
        .catch(() => null);
    }, 1800);
    return () => window.clearInterval(timer);
  }, [integration?.enabled, syncState?.status]);

  React.useEffect(() => {
    if (!integration?.enabled || !(integration.sellerTags || []).includes('warehouse_management') || !selectedStoreId) {
      setStockLocations([]);
      setSelectedStockLocation('');
      return undefined;
    }
    let active = true;
    callMeteor('comercio.mercadoLibre.ubicacionesStock', selectedStoreId)
      .then((result) => {
        if (!active) return;
        const locations = Array.isArray(result?.locations) ? result.locations : [];
        setStockLocations(locations);
        const selected = result?.selected;
        setSelectedStockLocation(selected
          ? `${selected.storeId}|${selected.networkNodeId}`
          : locations.length === 1 ? `${locations[0].storeId}|${locations[0].networkNodeId}` : '');
      })
      .catch((locationError) => {
        if (active) setError(getErrorMessage(locationError, 'No se pudieron consultar los depósitos de Mercado Libre.'));
      });
    return () => { active = false; };
  }, [integration?.enabled, integration?.sellerTags, selectedStoreId]);

  React.useEffect(() => () => {
    oauthCleanup.current?.();
  }, []);

  const connect = async () => {
    if (busyAction || !oauthAppReady || !integration?.oauthApp?.webReturnUrl) return;
    setError('');
    setBusyAction('connect');
    const popup = window.open('', 'vidkar-mercadolibre-oauth', 'popup,width=560,height=760');
    if (!popup) {
      setBusyAction('');
      setError('Permite las ventanas emergentes para completar la autorización de Mercado Libre.');
      return;
    }
    let pollTimer;
    let timeoutTimer;
    let finished = false;
    let checking = false;
    let closedChecks = 0;
    const startedAt = Date.now();
    const cleanup = () => {
      window.clearInterval(pollTimer);
      window.clearTimeout(timeoutTimer);
      if (popupMessageHandler.current) window.removeEventListener('message', popupMessageHandler.current);
      popupMessageHandler.current = null;
      oauthCleanup.current = null;
    };
    oauthCleanup.current = cleanup;
    const finish = async (reason = '') => {
      if (finished) return;
      finished = true;
      cleanup();
      try {
        if (reason) throw new Error(getOAuthFailureMessage(reason));
        await loadState();
        notify?.('Cuenta de Mercado Libre vinculada. Ya puedes administrar catálogo y publicaciones.');
      } catch (oauthError) {
        setError(getErrorMessage(oauthError, 'Mercado Libre no completó la autorización.'));
      } finally {
        setBusyAction('');
        if (!popup.closed) popup.close();
      }
    };
    try {
      const callbackOrigin = getServerOrigin();
      const onMessage = async (event) => {
        if (event.origin !== callbackOrigin || event.source !== popup || event.data?.type !== 'VIDKAR_MERCADOLIBRE_OAUTH') return;
        await finish(event.data.success ? '' : event.data.reason || 'authorization_failed');
      };
      popupMessageHandler.current = onMessage;
      window.addEventListener('message', onMessage);
      const result = await callMeteor('comercio.mercadoLibre.iniciarOAuth', 'web', window.location.origin);
      if (!result?.authorizationUrl) throw new Error('El servidor no devolvió la URL de autorización.');
      if (popup.closed) throw new Error('La ventana de autorización se cerró antes de iniciar.');
      popup.location.href = result.authorizationUrl;
      pollTimer = window.setInterval(async () => {
        if (finished || checking) return;
        checking = true;
        try {
          const current = await callMeteor('comercio.mercadoLibre.getEstado');
          if (current?.configured && current?.status !== 'reauthorization_required' && Date.parse(current.authorizedAt || '') >= startedAt) {
            await finish();
          } else if (current?.lastErrorCode && Date.parse(current.updatedAt || '') >= startedAt) {
            await finish(current.lastErrorCode);
          } else if (popup.closed && ++closedChecks >= 3) {
            await finish('authorization_cancelled');
          }
        } catch (_pollError) {
          // Un fallo transitorio de red no debe dar por concluida la autorización.
        } finally {
          checking = false;
        }
      }, 2500);
      timeoutTimer = window.setTimeout(() => finish('authorization_timeout'), 10 * 60 * 1000 + 30000);
    } catch (connectError) {
      if (popup && !popup.closed) popup.close();
      cleanup();
      setError(getErrorMessage(connectError, 'No se pudo iniciar la autorización de Mercado Libre.'));
      setBusyAction('');
    }
  };

  const toggleIntegration = async () => {
    const nextEnabled = !integration?.enabled;
    if (!integration?.configured || busyAction) return;
    setError('');
    setBusyAction(nextEnabled ? 'enable' : 'disable');
    try {
      const nextState = await callMeteor(nextEnabled
        ? 'comercio.mercadoLibre.habilitar'
        : 'comercio.mercadoLibre.desactivar');
      setIntegration(nextState);
      notify?.(nextEnabled ? 'Mercado Libre quedó habilitado.' : 'Mercado Libre quedó desactivado.');
    } catch (toggleError) {
      setError(getErrorMessage(toggleError, 'No se pudo cambiar el estado de la integración.'));
    } finally {
      setBusyAction('');
    }
  };

  const disconnect = async () => {
    if (!integration?.configured || busyAction) return;
    if (!window.confirm('¿Desconectar esta cuenta? Primero deben estar cerradas todas las publicaciones vinculadas. Los artículos locales seguirán disponibles; si quedan publicaciones activas, VIDKAR bloqueará la desconexión para evitar ventas sin sincronización.')) return;
    setError('');
    setBusyAction('disconnect');
    try {
      const nextState = await callMeteor('comercio.mercadoLibre.desconectar');
      setIntegration(nextState);
      setSyncState(null);
      notify?.('Cuenta de Mercado Libre desconectada.');
    } catch (disconnectError) {
      setError(getErrorMessage(disconnectError, 'No se pudo desconectar la cuenta.'));
    } finally {
      setBusyAction('');
    }
  };

  const synchronize = async () => {
    if (!integration?.enabled || !selectedStoreId || busyAction) return;
    setError('');
    setBusyAction('sync');
    try {
      const result = await callMeteor('comercio.mercadoLibre.sincronizarCatalogo', selectedStoreId);
      setSyncState({ ...syncState, ...result, status: result?.status || 'pending' });
      notify?.('La sincronización completa del catálogo se inició.');
    } catch (syncError) {
      setError(getErrorMessage(syncError, 'No se pudo iniciar la sincronización del catálogo.'));
    } finally {
      setBusyAction('');
    }
  };

  const saveStockLocation = async () => {
    if (!selectedStoreId || !selectedStockLocation || busyAction) return;
    const [storeId, networkNodeId] = selectedStockLocation.split('|');
    const location = stockLocations.find((entry) => entry.storeId === storeId && entry.networkNodeId === networkNodeId);
    if (!location) return;
    setError('');
    setBusyAction('location');
    try {
      await callMeteor('comercio.mercadoLibre.asignarUbicacionStock', {
        localStoreId: selectedStoreId,
        storeId: location.storeId,
        networkNodeId: location.networkNodeId,
      });
      notify?.(`Depósito asociado a ${stores.find((store) => String(store._id) === selectedStoreId)?.title || 'la tienda'}.`);
    } catch (locationError) {
      setError(getErrorMessage(locationError, 'No se pudo asociar el depósito.'));
    } finally {
      setBusyAction('');
    }
  };

  const isSyncing = ['pending', 'processing'].includes(syncState?.status);
  const configured = integration?.configured === true;
  const enabled = integration?.enabled === true;
  const oauthAppReady = integration?.oauthApp?.configured === true;
  const pendingOAuthError = !configured && integration?.lastErrorCode
    ? getOAuthFailureMessage(integration.lastErrorCode)
    : '';

  if (loading) {
    return <Paper className="empresa-loading-inline" elevation={0}><CircularProgress size={22} /><Typography color="text.secondary">Consultando Mercado Libre…</Typography></Paper>;
  }

  return (
    <Box className="content-stack empresa-panel">
      <Box className="empresa-panel-heading">
        <Box>
          <Typography variant="h4">Mercado Libre Uruguay</Typography>
          <Typography color="text.secondary" variant="body2">Vincula una cuenta propia. La autorización y sus publicaciones quedan aisladas por usuario VIDKAR.</Typography>
        </Box>
        <Chip
          color={enabled ? 'success' : configured ? 'default' : pendingOAuthError ? 'warning' : oauthAppReady ? 'primary' : 'warning'}
          icon={enabled ? <CheckCircleOutlineRoundedIcon /> : <StorefrontRoundedIcon />}
          label={enabled ? 'Habilitado' : configured ? 'Desactivado' : pendingOAuthError ? 'Error de autorización' : oauthAppReady ? 'Listo para vincular' : 'OAuth no configurado'}
        />
      </Box>

      {error ? <Alert onClose={() => setError('')} severity="error">{error}</Alert> : null}
      {!error && pendingOAuthError ? <Alert severity="warning">{pendingOAuthError}</Alert> : null}
      {integration?.status === 'reauthorization_required' ? (
        <Alert severity="warning">La autorización expiró o fue revocada. Vuelve a autorizar para reanudar catálogo y stock.</Alert>
      ) : null}
      <Paper className="empresa-empty" elevation={0}>
        <Box>
          <Typography fontWeight={750} variant="h6">Aplicación OAuth de VIDKAR</Typography>
          <Typography color="text.secondary" variant="body2">
            VIDKAR administra una única aplicación OAuth desde la configuración privada del servidor. Cada comercio autoriza su propia cuenta; no ingreses ni compartas Client ID o Client Secret aquí.
          </Typography>
        </Box>
        {!oauthAppReady ? (
          <Alert severity="warning">
            La integración OAuth aún no está configurada por VIDKAR en el servidor. Contacta a administración.
            {integration?.oauthApp?.missing?.length ? ` Falta: ${integration.oauthApp.missing.join(', ')}.` : ''}
          </Alert>
        ) : null}
        {oauthAppReady && !integration?.oauthApp?.webReturnUrl ? (
          <Alert severity="warning">Administración debe configurar <code>MERCADOLIBRE_WEB_RETURN_URL</code> para conectar desde la web.</Alert>
        ) : null}
      </Paper>

      <Paper className="empresa-empty" elevation={0}>
        <Box sx={{ alignItems: 'center', display: 'flex', flexWrap: 'wrap', gap: 1.5, justifyContent: 'space-between' }}>
          <Box>
            <Typography fontWeight={750} variant="h6">{configured ? (integration.account?.nickname || `Vendedor ${integration.account?.sellerId || ''}`) : 'Vincula tu cuenta'}</Typography>
            <Typography color="text.secondary" variant="body2">
              {configured
                ? `Cuenta vendedora ${integration.account?.sellerId || ''} · ${integration.account?.siteId || 'MLU'}`
                : 'Autoriza tu cuenta de Mercado Libre con el flujo oficial. VIDKAR no recibe ni almacena tu contraseña.'}
            </Typography>
          </Box>
          {(!configured || integration?.status === 'reauthorization_required') ? (
            <Tooltip arrow describeChild title={configured
              ? 'Renueva el permiso de esta cuenta para que VIDKAR pueda seguir sincronizando sus publicaciones.'
              : 'Abre Mercado Libre para autorizar el vendedor de este usuario VIDKAR. VIDKAR nunca recibe tu contraseña.'}>
              <span>
                <Button
                  disabled={Boolean(busyAction) || !oauthAppReady || !integration?.oauthApp?.webReturnUrl}
                  onClick={connect}
                  startIcon={busyAction === 'connect' ? <CircularProgress color="inherit" size={16} /> : <LinkRoundedIcon />}
                  variant="contained"
                >
                  {configured ? 'Reautorizar cuenta' : 'Conectar Mercado Libre'}
                </Button>
              </span>
            </Tooltip>
          ) : null}
        </Box>

        {configured ? (
          <Box sx={{ alignItems: 'center', borderTop: 1, borderColor: 'divider', display: 'flex', flexWrap: 'wrap', gap: 1.5, justifyContent: 'space-between', mt: 2, pt: 2 }}>
            <Box>
              <Typography fontWeight={700}>Disponibilidad de la integración</Typography>
              <Typography color="text.secondary" variant="body2">Solo se puede desactivar cuando todas las publicaciones estén cerradas. Ciérralas desde Productos; los artículos locales seguirán disponibles.</Typography>
            </Box>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              <Tooltip arrow describeChild title={enabled
                ? 'Pausa la sincronización automática. VIDKAR no permite desactivar mientras queden publicaciones abiertas.'
                : 'Reanuda la sincronización para las publicaciones ya vinculadas; no crea anuncios nuevos.'}>
                <span>
                  <Button disabled={Boolean(busyAction)} onClick={toggleIntegration} variant={enabled ? 'outlined' : 'contained'}>
                    {busyAction === 'enable' || busyAction === 'disable' ? <CircularProgress color="inherit" size={16} /> : enabled ? 'Desactivar' : 'Activar'}
                  </Button>
                </span>
              </Tooltip>
              <Tooltip arrow describeChild title="Quita el vínculo y los tokens de esta cuenta. Primero cierra todas las publicaciones abiertas.">
                <span>
                  <Button color="error" disabled={Boolean(busyAction)} onClick={disconnect} startIcon={<LinkOffRoundedIcon />} variant="text">Desconectar</Button>
                </span>
              </Tooltip>
            </Box>
          </Box>
        ) : (
          <Alert severity="info" sx={{ mt: 2 }}>
            {oauthAppReady
              ? <>Al continuar, inicia sesión y autoriza tu cuenta de vendedor. El callback de la aplicación de VIDKAR es <code>{integration?.oauthApp?.redirectUri || getDefaultRedirectUri()}</code>.</>
              : 'La conexión estará disponible cuando administración configure la aplicación OAuth común de VIDKAR.'}
          </Alert>
        )}
      </Paper>

      {enabled ? (
        <Paper className="empresa-toolbar" elevation={0}>
          <Box sx={{ flex: 1, minWidth: 240 }}>
            <Typography fontWeight={750} variant="subtitle1">Importar o actualizar catálogo</Typography>
            <Typography color="text.secondary" variant="body2">Incluye publicaciones activas, pausadas, cerradas y en estados relevantes. También vincula los productos ya importados con sus categorías y subcategorías locales.</Typography>
          </Box>
          <FormControl size="small" sx={{ minWidth: 220 }}>
            <Select
              aria-label="Tienda VIDKAR destino"
              displayEmpty
              onChange={(event) => setSelectedStoreId(event.target.value)}
              value={selectedStoreId}
            >
              <MenuItem disabled value="">Selecciona la tienda destino</MenuItem>
              {stores.map((store) => <MenuItem key={store._id} value={String(store._id)}>{store.title || store.name || 'Tienda'}</MenuItem>)}
            </Select>
          </FormControl>
          <Tooltip arrow describeChild title="Importa o actualiza en la tienda elegida las publicaciones existentes de Mercado Libre; no crea anuncios nuevos.">
            <span>
              <Button
                disabled={!selectedStoreId || isSyncing || Boolean(busyAction)}
                onClick={synchronize}
                startIcon={isSyncing || busyAction === 'sync' ? <CircularProgress color="inherit" size={17} /> : <CloudSyncRoundedIcon />}
                variant="contained"
              >
                {isSyncing ? 'Sincronizando…' : 'Sincronizar catálogo'}
              </Button>
            </span>
          </Tooltip>
        </Paper>
      ) : null}

      {enabled && (integration.sellerTags || []).includes('warehouse_management') ? (
        <Paper className="empresa-toolbar" elevation={0}>
          <Box sx={{ flex: 1, minWidth: 240 }}>
            <Typography fontWeight={750} variant="subtitle1">Depósito de stock multiorigen</Typography>
            <Typography color="text.secondary" variant="body2">Asocia el depósito de Mercado Libre a la tienda VIDKAR seleccionada para que las ventas cambien solo ese stock.</Typography>
          </Box>
          {stockLocations.length ? (
            <FormControl size="small" sx={{ minWidth: 240 }}>
              <Select
                aria-label="Depósito Mercado Libre"
                displayEmpty
                onChange={(event) => setSelectedStockLocation(event.target.value)}
                value={selectedStockLocation}
              >
                <MenuItem disabled value="">Selecciona un depósito</MenuItem>
                {stockLocations.map((location) => (
                  <MenuItem key={`${location.storeId}|${location.networkNodeId}`} value={`${location.storeId}|${location.networkNodeId}`}>
                    {location.description}{location.city ? ` · ${location.city}` : ''}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          ) : (
            <Chip label="No hay depósitos Mercado Libre" size="small" />
          )}
          <Tooltip arrow describeChild title="Vincula esta tienda VIDKAR con el depósito elegido. Las ventas actualizarán solo ese stock de Mercado Libre.">
            <span>
              <Button
                disabled={!selectedStoreId || !selectedStockLocation || Boolean(busyAction)}
                onClick={saveStockLocation}
                variant="outlined"
              >
                {busyAction === 'location' ? <CircularProgress color="inherit" size={16} /> : 'Asociar depósito'}
              </Button>
            </span>
          </Tooltip>
        </Paper>
      ) : null}

      {enabled && syncState && syncState.status !== 'idle' ? (
        <Alert severity={syncState.status === 'failed' || syncState.status === 'completed_with_errors' ? 'warning' : 'info'}>
          <Box sx={{ alignItems: 'center', display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            <Typography component="span" fontWeight={700}>{syncState.message || 'Estado de sincronización'}</Typography>
            {Number.isFinite(Number(syncState.processed)) ? <Chip label={`${syncState.processed} procesadas`} size="small" /> : null}
            {Number.isFinite(Number(syncState.failed)) && Number(syncState.failed) > 0 ? <Chip color="warning" label={`${syncState.failed} con errores`} size="small" /> : null}
            <Tooltip arrow describeChild title="Consulta de nuevo el progreso y el resultado de la última importación del catálogo.">
              <span><Button onClick={loadState} size="small" startIcon={<RefreshRoundedIcon />}>Actualizar estado</Button></span>
            </Tooltip>
          </Box>
        </Alert>
      ) : null}

      {enabled ? (
        <Alert severity="success">Las publicaciones importadas y los productos locales vinculados se gestionan desde <strong>Productos</strong>. Si el vendedor usa User Products o stock multiorigen, se conserva esa relación y se aplica la API correspondiente.</Alert>
      ) : null}
    </Box>
  );
}
