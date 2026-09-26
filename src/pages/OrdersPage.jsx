import React from 'react';
import { Alert, Box, Button, CircularProgress, Paper, Typography } from '@mui/material';
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import PendingActionsRoundedIcon from '@mui/icons-material/PendingActionsRounded';
import ShoppingBagOutlinedIcon from '@mui/icons-material/ShoppingBagOutlined';
import { Link as RouterLink, useOutletContext } from 'react-router-dom';

import { getCommerceItems, getOrderStatus } from '../domain/commerce';
import { Meteor } from '../meteor/client';
import { VentasRechargeCollection } from '../meteor/collections';
import OrderCard from '../components/OrderCard';
import './orders.css';

const ORDER_FIELDS = {
  _id: 1,
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
  'producto.carritos.producto._id': 1,
  'producto.carritos.producto.name': 1,
  'producto.carritos.producto.descripcion': 1,
  'producto.carritos.producto.precio': 1,
  'producto.carritos.producto.monedaPrecio': 1,
  'producto.comisiones': 1,
};

export function useCommerceOrders(userId, storeIds) {
  const storeKey = [...(storeIds || [])].map(String).sort().join('|');
  return Meteor.useTracker(() => {
    const ids = storeKey ? storeKey.split('|') : [];
    if (!userId || !ids.length) return { loading: false, orders: [], ready: true };

    const selector = {
      userId,
      'producto.carritos.type': 'COMERCIO',
      'producto.carritos.idTienda': { $in: ids },
    };
    const handle = Meteor.subscribe('ventasRecharge', selector, {
      fields: ORDER_FIELDS,
      sort: { createdAt: -1 },
    });
    // ORDER_FIELDS ya limita los datos en el servidor. No volver a proyectar rutas
    // profundas de carritos en Minimongo: su proyección local descarta esos campos.
    const orders = VentasRechargeCollection.find({ userId }, {
      sort: { createdAt: -1 },
    }).fetch().filter((sale) => getCommerceItems(sale, ids).length > 0);

    return { loading: !handle.ready(), orders, ready: handle.ready() };
  }, [userId, storeKey]);
}

export function OrdersPage() {
  const { auth, storefront, user } = useOutletContext();
  const ordersState = useCommerceOrders(auth?.userId, storefront.storeIds);
  const orders = ordersState.orders;
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
      <Box className="orders-hero">
        <Box>
          <Typography className="eyebrow" variant="overline">SEGUIMIENTO DE COMERCIO</Typography>
          <Typography variant="h3">Mis pedidos</Typography>
          <Typography color="text.secondary">Revisa el estado, la entrega y los comprobantes de tus compras en esta empresa.</Typography>
        </Box>
        <Box className="orders-hero-icon"><HistoryRoundedIcon /></Box>
      </Box>

      <Box className="orders-metrics">
        <Paper className="order-metric" elevation={0}><Box className="order-metric-icon violet"><ShoppingBagOutlinedIcon /></Box><Box><Typography className="order-metric-value">{orders.length}</Typography><Typography color="text.secondary" variant="caption">PEDIDOS</Typography></Box></Paper>
        <Paper className="order-metric" elevation={0}><Box className="order-metric-icon orange"><PendingActionsRoundedIcon /></Box><Box><Typography className="order-metric-value">{pendingCount}</Typography><Typography color="text.secondary" variant="caption">PENDIENTES</Typography></Box></Paper>
        <Paper className="order-metric" elevation={0}><Box className="order-metric-icon blue"><LocalShippingOutlinedIcon /></Box><Box><Typography className="order-metric-value">{inRouteCount}</Typography><Typography color="text.secondary" variant="caption">EN REPARTO</Typography></Box></Paper>
        <Paper className="order-metric" elevation={0}><Box className="order-metric-icon green"><HistoryRoundedIcon /></Box><Box><Typography className="order-metric-value">{deliveredCount}</Typography><Typography color="text.secondary" variant="caption">ENTREGADOS</Typography></Box></Paper>
      </Box>

      {ordersState.loading ? (
        <Paper className="orders-loading" elevation={0}><CircularProgress size={24} /><Typography color="text.secondary">Sincronizando el historial con Meteor…</Typography></Paper>
      ) : null}

      {!ordersState.loading && orders.length === 0 ? (
        <Paper className="catalog-empty" elevation={0}>
          <Box className="empty-state-icon"><ShoppingBagOutlinedIcon /></Box>
          <Typography variant="h5">Todavía no tienes pedidos aquí</Typography>
          <Typography color="text.secondary">Cuando compres productos de {storefront.stores?.[0]?.title || 'esta empresa'}, podrás seguirlos desde esta página.</Typography>
          <Button component={RouterLink} sx={{ mt: 1 }} to="/" variant="contained">Explorar la tienda</Button>
        </Paper>
      ) : null}

      {!ordersState.loading && orders.length > 0 ? (
        <>
          <Box className="orders-list-heading"><Typography variant="h5">Historial de compras</Typography><Typography color="text.secondary" variant="body2">{user?.username ? `Cuenta @${user.username}` : 'Cuenta VIDKAR'}</Typography></Box>
          <Box className="orders-list">
            {orders.map((sale) => <OrderCard key={sale._id} sale={sale} storeIds={storefront.storeIds} />)}
          </Box>
        </>
      ) : null}
    </Box>
  );
}
