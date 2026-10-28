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
const oauthFailureMessages = {
  previous_account_has_open_publications: 'Cierra las publicaciones abiertas de la cuenta anterior antes de vincular otro vendedor.',
  seller_already_linked: 'Esta cuenta de Mercado Libre ya está vinculada a otro usuario.',
  invalid_state: 'La autorización expiró o ya se utilizó. Vuelve a conectar Mercado Libre.',
  authorization_denied: 'No se autorizó la cuenta de Mercado Libre. Puedes intentarlo otra vez.',
  pkce_required: 'No se pudo completar la autorización de Mercado Libre. Contacta con administración para revisar la conexión.',
  redirect_uri_mismatch: 'Mercado Libre no aceptó la dirección de retorno. Administración debe revisar la configuración de la conexión.',
  invalid_client: 'Mercado Libre rechazó la configuración de esta conexión. Contacta con administración.',
  invalid_request: 'Mercado Libre no pudo completar la autorización. Administración debe revisar la configuración de la conexión.',
  invalid_grant: 'El código de autorización expiró, ya se usó o corresponde a otra aplicación o URI. Vuelve a conectar Mercado Libre.',
};
const getOAuthFailureMessage = (reason) => Object.prototype.hasOwnProperty.call(oauthFailureMessages, reason)
  ? oauthFailureMessages[reason]
  : 'Mercado Libre no completó la vinculación. Inténtalo de nuevo o contacta con administración.';

export default function EmpresaMercadoLibrePanel({ notify, stores = [], userId }) {
  const [integration, setIntegration] = React.useState(null);
  const [syncState, setSyncState] = React.useState(null);
  const [selectedStoreId, setSelectedStoreId] = React.useState('');
  const [stockLocations, setStockLocations] = React.useState([]);
  const [selectedStockLocation, setSelectedStockLocation] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [busyAction, setBusyAction] = React.useState('');
  const [error, setError] = React.useState('');
  const [syncStateError, setSyncStateError] = React.useState('');
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
      const nextSyncState = await callMeteor('comercio.mercadoLibre.estadoSincronizacion');
      setSyncState(nextSyncState || null);
      setSyncStateError('');
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
    if (!integration?.enabled || !['pending', 'processing', 'pausing'].includes(syncState?.status)) return undefined;
    let active = true;
    let timer;
    const refresh = async () => {
      try {
        const nextState = await callMeteor('comercio.mercadoLibre.estadoSincronizacion');
        if (!active) return;
        setSyncState(nextState);
        setSyncStateError('');
        if (!['pending', 'processing', 'pausing'].includes(nextState?.status)) return;
      } catch (stateError) {
        if (!active) return;
        setSyncStateError(getErrorMessage(stateError, 'No se pudo consultar el progreso. El estado mostrado es el último conocido; usa Actualizar estado.'));
      }
      if (active) timer = window.setTimeout(refresh, 1800);
    };
    timer = window.setTimeout(refresh, 1800);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [integration?.enabled, syncState?.status, syncState?.jobId]);

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
    if (!window.confirm('¿Desconectar esta cuenta? Primero deben estar cerradas todas las publicaciones vinculadas. Los artículos de tu tienda seguirán disponibles.')) return;
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
      setSyncState({ ...result, status: result?.status || 'pending', processed: 0, failed: 0, message: 'La sincronización se iniciará en segundo plano.' });
      setSyncStateError('');
      notify?.('La sincronización completa del catálogo se inició.');
    } catch (syncError) {
      setError(getErrorMessage(syncError, 'No se pudo iniciar la sincronización del catálogo.'));
    } finally {
      setBusyAction('');
    }
  };

  const pauseSync = async () => {
    if (!syncState?.jobId || busyAction) return;
    setError('');
    setBusyAction('pause');
    try {
      setSyncState(await callMeteor('comercio.mercadoLibre.pausarCatalogo', syncState.jobId));
    } catch (pauseError) {
      setError(getErrorMessage(pauseError, 'No se pudo pausar la sincronización.'));
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

  const isSyncing = ['pending', 'processing', 'pausing'].includes(syncState?.status);
  const configured = integration?.configured === true;
  const enabled = integration?.enabled === true;
  const oauthAppReady = integration?.oauthApp?.configured === true;
  const catalogAccessDenied = ['forbidden', 'missing_functional_permission', 'invalid_scopes', 'mercadolibre-access-denied', 'mercadolibre-reauthorization-required'].includes(syncState?.lastErrorCode);
  const pendingOAuthError = !configured && integration?.lastErrorCode
    ? getOAuthFailureMessage(integration.lastErrorCode)
    : '';

  if (loading) {
    return <Paper className="empresa-loading-inline" elevation={0}><CircularProgress size={22} /><Typography color="text.secondary">Consultando Mercado Libre…</Typography></Paper>;
  }

  return (
    <Box className="content-stack empresa-panel empresa-ml-panel">
      <Box className="empresa-ml-hero">
        <Box className="empresa-ml-brand" aria-hidden="true"><StorefrontRoundedIcon /></Box>
        <Box className="empresa-ml-hero-copy">
          <Typography className="empresa-ml-eyebrow">CANAL DE VENTAS · URUGUAY</Typography>
          <Typography component="h2" variant="h4">Mercado Libre</Typography>
          <Typography color="text.secondary" variant="body2">Conecta tu cuenta y administra tu catálogo desde un solo lugar.</Typography>
        </Box>
        <Chip
          color={enabled ? 'success' : configured ? 'default' : pendingOAuthError ? 'warning' : oauthAppReady ? 'primary' : 'warning'}
          icon={enabled ? <CheckCircleOutlineRoundedIcon /> : <StorefrontRoundedIcon />}
          label={enabled ? 'Integración habilitada' : configured ? 'Desactivado' : pendingOAuthError ? 'Error de autorización' : oauthAppReady ? 'Listo para vincular' : 'Conexión no configurada'}
        />
      </Box>

      {error ? <Alert onClose={() => setError('')} severity="error">{error}</Alert> : null}
      {syncStateError ? <Alert severity="warning">No se pudo verificar el progreso. {syncStateError} El estado mostrado puede estar desactualizado.</Alert> : null}
      {!error && pendingOAuthError ? <Alert severity="warning">{pendingOAuthError}</Alert> : null}
      {integration?.status === 'reauthorization_required' ? (
        <Alert severity="warning">La autorización expiró o fue revocada. Vuelve a autorizar para reanudar catálogo y stock.</Alert>
      ) : null}
      <Box className="empresa-ml-workspace">
      <Paper className="empresa-ml-card" elevation={0}>
        <Box className="empresa-ml-section-heading">
          <Box className="empresa-ml-icon"><LinkRoundedIcon /></Box>
          <Box>
            <Typography className="empresa-ml-eyebrow">CUENTA VENDEDORA</Typography>
            <Typography fontWeight={750} variant="h6">Tu conexión</Typography>
            <Typography color="text.secondary" variant="body2">
              La conexión se administra de forma centralizada. Autoriza tu propia cuenta y no compartas tu contraseña fuera del sitio oficial de Mercado Libre.
            </Typography>
          </Box>
        </Box>
        {!oauthAppReady ? (
          <Alert severity="warning">
            La conexión con Mercado Libre todavía no está disponible. Contacta con administración.
            {integration?.oauthApp?.missing?.length ? ` Falta: ${integration.oauthApp.missing.join(', ')}.` : ''}
          </Alert>
        ) : null}
        {oauthAppReady && !integration?.oauthApp?.webReturnUrl ? (
          <Alert severity="warning">La conexión aún no puede iniciarse desde este sitio. Contacta con administración.</Alert>
        ) : null}
        <Box className="empresa-ml-account" sx={{ alignItems: 'center', display: 'flex', flexWrap: 'wrap', gap: 1.5, justifyContent: 'space-between' }}>
          <Box>
            <Typography fontWeight={750} variant="h6">{configured ? (integration.account?.nickname || `Vendedor ${integration.account?.sellerId || ''}`) : 'Vincula tu cuenta'}</Typography>
            <Typography color="text.secondary" variant="body2">
              {configured
                ? `Cuenta vendedora ${integration.account?.sellerId || ''} · ${integration.account?.siteId || 'MLU'}`
                : 'Conecta tu cuenta de vendedor desde el sitio oficial de Mercado Libre. Tu contraseña solo se introduce allí.'}
            </Typography>
          </Box>
          {(!configured || integration?.status === 'reauthorization_required' || catalogAccessDenied) ? (
            <Tooltip arrow describeChild title={configured
              ? 'Renueva el permiso de esta cuenta para continuar actualizando sus publicaciones.'
              : 'Abre el sitio oficial de Mercado Libre para conectar esta cuenta de vendedor.'}>
              <span>
                <Button
                  disabled={isSyncing || Boolean(busyAction) || !oauthAppReady || !integration?.oauthApp?.webReturnUrl}
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
          <Box className="empresa-ml-availability" sx={{ alignItems: 'center', display: 'flex', flexWrap: 'wrap', gap: 1.5, justifyContent: 'space-between' }}>
            <Box>
              <Typography fontWeight={700}>Disponibilidad de la integración</Typography>
              <Typography color="text.secondary" variant="body2">Solo se puede desactivar cuando todas las publicaciones estén cerradas. Ciérralas desde Productos; los artículos locales seguirán disponibles.</Typography>
            </Box>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              <Tooltip arrow describeChild title={enabled
                ? 'Pausa las actualizaciones automáticas. Primero deben cerrarse todas las publicaciones abiertas.'
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
        ) : null}
      </Paper>

      <Box className="empresa-ml-operations">
      {enabled ? (
        <Paper className="empresa-ml-toolbar" elevation={0}>
          <Box sx={{ flex: 1, minWidth: 240 }}>
            <Typography className="empresa-ml-eyebrow">CATÁLOGO</Typography>
            <Typography fontWeight={750} variant="h6">Importar o actualizar catálogo</Typography>
            <Typography color="text.secondary" variant="body2">Incluye publicaciones activas, pausadas, cerradas y en estados relevantes. También vincula los productos ya importados con sus categorías y subcategorías locales.</Typography>
          </Box>
          <Typography className="empresa-ml-field-label">Tienda destino</Typography>
          <FormControl size="small" fullWidth>
            <Select
              aria-label="Tienda destino"
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
        <Paper className="empresa-ml-toolbar" elevation={0}>
          <Box sx={{ flex: 1, minWidth: 240 }}>
            <Typography fontWeight={750} variant="subtitle1">Depósito de stock multiorigen</Typography>
            <Typography color="text.secondary" variant="body2">Asocia el depósito de Mercado Libre a esta tienda para que las ventas actualicen solo ese stock.</Typography>
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
          <Tooltip arrow describeChild title="Vincula esta tienda con el depósito elegido. Las ventas actualizarán solo ese stock de Mercado Libre.">
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

      {syncState && syncState.status !== 'idle' ? (
        <Alert severity={syncState.status === 'failed' ? 'error' : syncState.status === 'completed_with_errors' ? 'warning' : syncState.status === 'completed' ? 'success' : 'info'}>
          <Box sx={{ alignItems: 'center', display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            <Typography component="span" fontWeight={700}>{syncState.message || 'Estado de sincronización'}</Typography>
            {Number.isFinite(Number(syncState.processed)) ? <Chip label={`${syncState.processed} procesadas`} size="small" /> : null}
            {Number.isFinite(Number(syncState.failed)) && Number(syncState.failed) > 0 ? <Chip color="warning" label={`${syncState.failed} con errores`} size="small" /> : null}
            {syncState.lastErrorCode ? <Typography component="span" variant="body2">Código: {syncState.lastErrorCode}</Typography> : null}
            {isSyncing ? (
              <Button disabled={Boolean(busyAction) || syncState.status === 'pausing'} onClick={pauseSync} size="small">
                {syncState.status === 'pausing' ? 'Pausando…' : 'Pausar sincronización'}
              </Button>
            ) : null}
            <Tooltip arrow describeChild title="Consulta de nuevo el progreso y el resultado de la última importación del catálogo.">
              <span><Button onClick={loadState} size="small" startIcon={<RefreshRoundedIcon />}>Actualizar estado</Button></span>
            </Tooltip>
          </Box>
        </Alert>
      ) : null}

      {enabled ? (
        <Alert severity="info">Las publicaciones importadas y los productos locales vinculados se gestionan desde <strong>Productos</strong>. Tener la integración habilitada no garantiza permiso para consultar todos los recursos de Mercado Libre.</Alert>
      ) : null}
      </Box>
      </Box>
    </Box>
  );
}
