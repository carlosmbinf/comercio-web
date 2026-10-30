import React from 'react';
import { Alert, Box, Button, Chip, CircularProgress, Paper, Typography } from '@mui/material';
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded';
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import PendingActionsRoundedIcon from '@mui/icons-material/PendingActionsRounded';
import RadarRoundedIcon from '@mui/icons-material/RadarRounded';
import ShoppingBagOutlinedIcon from '@mui/icons-material/ShoppingBagOutlined';
import { Link as RouterLink, useOutletContext } from 'react-router-dom';

import {
  getCommerceItems,
  getOrderStatus,
  getOrdersViewState,
  partitionCommerceOrders,
} from '../domain/commerce';
import { Meteor } from '../meteor/client';
import { VentasRechargeCollection } from '../meteor/collections';
import FinalizedOrdersTable from '../components/FinalizedOrdersTable';
import OrderCard from '../components/OrderCard';
import OrdersHero from '../components/OrdersHero';
import { useStoreBranding } from '../components/StoreBranding';
import { getCommerceDisplayName } from '../config';
import './orders.css';

const ORDERS_SUBSCRIPTION_TIMEOUT_MS = 12000;

const ORDER_FIELDS = {
  _id: 1,
  idOrder: 1,
  userId: 1,
  createdAt: 1,
  estado: 1,
  cadeteid: 1,
  isCancelada: 1,
  isCobrado: 1,
  metodoPago: 1,
  monedaCobrado: 1,
  cobrado: 1,
  refundStatus: 1,
  refundedAmount: 1,
  refundableAmount: 1,
  refundCurrency: 1,
  'producto.type': 1,
  'producto.status': 1,
  'producto.carritos._id': 1,
  'producto.carritos.type': 1,
  'producto.carritos.idTienda': 1,
  'producto.carritos.nombre': 1,
  'producto.carritos.cantidad': 1,
  'producto.carritos.cobrarUSD': 1,
  'producto.carritos.monedaACobrar': 1,
  'producto.carritos.comentario': 1,
  'producto.carritos.coordenadas': 1,
  'producto.carritos.nombreCalle': 1,
  'producto.carritos.numeroCasa': 1,
  'producto.carritos.tienda.title': 1,
  'producto.carritos.producto._id': 1,
  'producto.carritos.producto.name': 1,
  'producto.carritos.producto.titulo': 1,
  'producto.carritos.producto.descripcion': 1,
  'producto.carritos.producto.precio': 1,
  'producto.carritos.producto.monedaPrecio': 1,
  'producto.comisiones': 1,
};

export function useCommerceOrders(userId, storeIds, retryVersion = 0) {
  const storeKey = [...(storeIds || [])].map(String).sort().join('|');
  const [timedOut, setTimedOut] = React.useState(false);

  React.useEffect(() => {
    setTimedOut(false);
  }, [retryVersion, storeKey, userId]);

  const ordersState = Meteor.useTracker(() => {
    const ids = storeKey ? storeKey.split('|') : [];
    if (!userId || !ids.length) return { loading: false, orders: [], ready: true };

    const orders = VentasRechargeCollection.find({ userId }, {
      sort: { createdAt: -1 },
    }).fetch().filter((sale) => getCommerceItems(sale, ids).length > 0);

    const selector = {
      userId,
      'producto.carritos.type': 'COMERCIO',
      'producto.carritos.idTienda': { $in: ids },
    };
    const handle = Meteor.subscribe(
      'ventasRecharge',
      selector,
      { fields: ORDER_FIELDS, sort: { createdAt: -1 } },
      retryVersion,
    );
    // ORDER_FIELDS ya limita los datos en el servidor. No volver a proyectar rutas
    // profundas de carritos en Minimongo: su proyección local descarta esos campos.
    return { loading: !handle.ready(), orders, ready: handle.ready() };
  }, [retryVersion, storeKey, userId]);

  React.useEffect(() => {
    if (!ordersState.loading) {
      setTimedOut(false);
      return undefined;
    }

    const timer = window.setTimeout(() => setTimedOut(true), ORDERS_SUBSCRIPTION_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [ordersState.loading, retryVersion, storeKey, userId]);

  return { ...ordersState, error: timedOut };
}

export function OrdersPage() {
  const { auth, storefront, user } = useOutletContext();
  const { appearance } = useStoreBranding();
  const [retryVersion, setRetryVersion] = React.useState(0);
  const ordersState = useCommerceOrders(auth?.userId, storefront.storeIds, retryVersion);
  const orders = ordersState.orders;
  const { activeOrders, finalizedOrders } = React.useMemo(
    () => partitionCommerceOrders(orders),
    [orders],
  );
  const viewState = getOrdersViewState({
    ...ordersState,
    loading: Boolean(storefront.loading || ordersState.loading),
  });
  const pendingCount = orders.filter((order) => getOrderStatus(order) === 'PENDIENTE_PAGO').length;
  const inRouteCount = orders.filter((order) => getOrderStatus(order) === 'EN_RUTA').length;
  const deliveredCount = orders.filter((order) => getOrderStatus(order) === 'ENTREGADO').length;

  if (!auth?.userId) {
    return (
      <Box className="simple-state">
        <Paper className="empty-state-card" elevation={0}>
          <Box className="empty-state-icon"><HistoryRoundedIcon /></Box>
          <Typography variant="h5">Tus pedidos, siempre a mano</Typography>
          <Typography color="text.secondary">Inicia sesión para consultar el historial y el seguimiento de tus compras de comercio.</Typography>
          <Button component={RouterLink} sx={{ mt: 1 }} to="/login" variant="contained">Iniciar sesión</Button>
        </Paper>
      </Box>
    );
  }

  return (
    <Box className="content-stack orders-page">
      <OrdersHero image={appearance.ordersCover} />

      {viewState === 'history' || viewState === 'empty' ? <Box className="orders-metrics">
        <Paper className="order-metric" elevation={0}><Box className="order-metric-icon violet"><ShoppingBagOutlinedIcon /></Box><Box><Typography className="order-metric-value">{orders.length}</Typography><Typography color="text.secondary" variant="caption">PEDIDOS</Typography></Box></Paper>
        <Paper className="order-metric" elevation={0}><Box className="order-metric-icon orange"><PendingActionsRoundedIcon /></Box><Box><Typography className="order-metric-value">{activeOrders.length || pendingCount}</Typography><Typography color="text.secondary" variant="caption">ACTIVOS</Typography></Box></Paper>
        <Paper className="order-metric" elevation={0}><Box className="order-metric-icon blue"><LocalShippingOutlinedIcon /></Box><Box><Typography className="order-metric-value">{inRouteCount}</Typography><Typography color="text.secondary" variant="caption">EN REPARTO</Typography></Box></Paper>
        <Paper className="order-metric" elevation={0}><Box className="order-metric-icon green"><CheckCircleOutlineRoundedIcon /></Box><Box><Typography className="order-metric-value">{deliveredCount}</Typography><Typography color="text.secondary" variant="caption">ENTREGADOS</Typography></Box></Paper>
      </Box> : null}

      {viewState === 'loading' ? (
        <Paper className="orders-loading" elevation={0}><CircularProgress size={24} /><Typography color="text.secondary">Cargando tu historial de pedidos…</Typography></Paper>
      ) : null}

      {ordersState.error ? (
        <Alert
          action={<Button color="inherit" onClick={() => setRetryVersion((version) => version + 1)} size="small">Reintentar</Button>}
          severity="warning"
        >
          No se pudo actualizar tu historial de pedidos. Revisa tu conexión e inténtalo de nuevo.
        </Alert>
      ) : null}

      {viewState === 'empty' ? (
        <Paper className="catalog-empty" elevation={0}>
          <Box className="empty-state-icon"><ShoppingBagOutlinedIcon /></Box>
          <Typography variant="h5">Todavía no tienes pedidos aquí</Typography>
          <Typography color="text.secondary">Cuando compres productos de {appearance.design.siteName || getCommerceDisplayName(storefront.stores)}, podrás seguirlos desde esta página.</Typography>
          <Button component={RouterLink} sx={{ mt: 1 }} to="/" variant="contained">Explorar la tienda</Button>
        </Paper>
      ) : null}

      {viewState === 'history' ? (
        <>
          <Box className="active-orders-block">
            <Box className="orders-list-heading">
              <Box className="orders-heading-title-group">
                <Typography variant="h5">Compras activas</Typography>
                <Chip
                  className={activeOrders.length ? 'live-orders-badge active' : 'live-orders-badge'}
                  icon={<RadarRoundedIcon fontSize="small" />}
                  label={activeOrders.length ? `${activeOrders.length} en tiempo real` : 'Sin pedidos en curso'}
                  size="small"
                />
              </Box>
              <Typography color="text.secondary" variant="body2">
                {user?.username ? `Cuenta @${user.username}` : 'Seguimiento en vivo'}
              </Typography>
            </Box>

            {activeOrders.length > 0 ? (
              <Box className="orders-list">
                {activeOrders.map((sale) => (
                  <OrderCard key={sale._id} sale={sale} storeIds={storefront.storeIds} />
                ))}
              </Box>
            ) : (
              <Paper className="active-orders-empty-banner" elevation={0}>
                <Box className="active-orders-empty-icon">
                  <LocalShippingOutlinedIcon />
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography fontWeight={750} variant="subtitle1">
                    No hay compras activas en proceso
                  </Typography>
                  <Typography color="text.secondary" variant="body2">
                    Los pedidos pendientes de pago, en preparación o en reparto aparecerán aquí como tarjetas con seguimiento en tiempo real.
                  </Typography>
                </Box>
              </Paper>
            )}
          </Box>

          <FinalizedOrdersTable
            orders={finalizedOrders}
            showEvidenceHistory
            storeIds={storefront.storeIds}
            stores={storefront.stores}
            subtitle="Compras entregadas, canceladas o cerradas con su estado, método de pago y acceso a toda la información del pedido."
            title="Historial de compras"
          />
        </>
      ) : null}
    </Box>
  );
}
