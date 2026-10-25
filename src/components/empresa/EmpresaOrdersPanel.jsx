import React from 'react';
import { Alert, Box, Button, Chip, CircularProgress, FormControl, MenuItem, Paper, Select, Stack, TextField, Typography } from '@mui/material';
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded';
import RadarRoundedIcon from '@mui/icons-material/RadarRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import { Meteor, callMeteor } from '../../meteor/client';
import { VentasRechargeCollection } from '../../meteor/collections';
import {
  formatDateTime,
  formatMoney,
  getCommerceItems,
  partitionCommerceOrders,
} from '../../domain/commerce';
import { ensureEmpresaMethodSuccess, getNextPreparationStatus } from '../../domain/empresa';
import FinalizedOrdersTable from '../FinalizedOrdersTable';
import '../../pages/orders.css';

const STATUS_LABELS = {
  CADETEENDESTINO: 'Cadete en destino',
  CADETEENLOCAL: 'Cadete en el local',
  ENCAMINO: 'En camino',
  PENDIENTE: 'Pendiente',
  PREPARACION_LISTO: 'Listo para recoger',
  PREPARANDO: 'Preparando',
};

const STATUS_COLORS = {
  CADETEENDESTINO: 'info',
  CADETEENLOCAL: 'info',
  ENCAMINO: 'info',
  PENDIENTE: 'warning',
  PREPARACION_LISTO: 'success',
  PREPARANDO: 'primary',
};

const getOrderItems = (sale) => Array.isArray(sale?.producto?.carritos) ? sale.producto.carritos : [];

function OrderCard({ busy, onAdvance, onUnassign, order, storeIds }) {
  const items = getCommerceItems(order, storeIds);
  const nextStatus = getNextPreparationStatus(order.estado);
  const quantity = items.reduce((sum, item) => sum + Number(item?.cantidad || item?.producto?.cantidad || 1), 0);

  return (
    <Paper className="empresa-order-card" elevation={0}>
      <Box className="empresa-order-heading">
        <Box>
          <Typography fontWeight={750} variant="h6">Pedido #{String(order._id || order.idOrder || '').slice(-6)}</Typography>
          <Typography color="text.secondary" variant="body2">Recibido {formatDateTime(order.createdAt)}</Typography>
        </Box>
        <Chip color={STATUS_COLORS[order.estado] || 'default'} label={STATUS_LABELS[order.estado] || order.estado || 'Estado no disponible'} />
      </Box>

      {order.comercioCompartido ? (
        <Alert severity="warning">
          Este pedido incluye productos de otro comercio. Como en la app, el estado que avances aplica a la orden completa.
        </Alert>
      ) : null}
      {order.contieneOtrosArticulos ? (
        <Alert severity="warning">
          La orden incluye artículos ajenos al flujo de comercio y no se puede avanzar desde este panel.
        </Alert>
      ) : null}

      <Box className="empresa-order-meta">
        <Box><span>Artículos</span><strong>{quantity}</strong></Box>
        <Box><span>Tiendas propias</span><strong>{[...new Set(items.map((item) => item?.tienda?.title).filter(Boolean))].join(', ') || 'Comercio'}</strong></Box>
        <Box><span>Cadete</span><strong>{order.cadeteid ? 'Asignado' : 'Esperando asignación'}</strong></Box>
      </Box>

      <Box className="empresa-order-items">
        <Typography fontWeight={700} variant="subtitle2">Productos del pedido</Typography>
        {items.map((item, index) => {
          const product = item?.producto || item || {};
          const name = product.name || product.titulo || 'Producto';
          const count = Number(item?.cantidad || product.cantidad || 1);
          const price = product.precio ?? item?.cobrarUSD ?? 0;
          const currency = product.monedaPrecio || item?.monedaACobrar || 'USD';
          const comment = item?.comentario || product.comentario;

          return (
            <Box className="empresa-order-item" key={`${order._id}-${item?.idTienda || 'store'}-${product._id || index}`}>
              <span className="empresa-order-bullet" />
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography fontWeight={650} variant="body2">{name}</Typography>
                <Typography color="text.secondary" variant="caption">
                  {count} × {formatMoney(price, currency)}{comment ? ` · ${comment}` : ''}
                </Typography>
              </Box>
            </Box>
          );
        })}
      </Box>

      {nextStatus ? (
        <Button
          disabled={busy || Boolean(order.contieneOtrosArticulos)}
          onClick={() => onAdvance(order, nextStatus)}
          startIcon={busy ? <CircularProgress color="inherit" size={17} /> : <CheckCircleOutlineRoundedIcon />}
          variant="contained"
        >
          {busy ? 'Actualizando…' : order.estado === 'PENDIENTE' ? 'Empezar preparación' : 'Marcar listo para recoger'}
        </Button>
      ) : order.estado === 'PREPARACION_LISTO' && order.cadeteid ? (
        <Button color="error" disabled={busy || Boolean(order.contieneOtrosArticulos)} onClick={() => onUnassign(order)} variant="outlined">
          Desasignar cadete
        </Button>
      ) : (
        <Typography color="text.secondary" variant="body2">El seguimiento continúa en el flujo de entrega.</Typography>
      )}
    </Paper>
  );
}

export default function EmpresaOrdersPanel({ notify, storeIds = [], stores = [], userId }) {
  const storeKey = [...storeIds].map(String).sort().join('|');
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('ACTIVOS');
  const [processingId, setProcessingId] = React.useState('');
  const [error, setError] = React.useState('');

  const ordersState = Meteor.useTracker(() => {
    const ids = storeKey ? storeKey.split('|') : [];
    if (!userId || !ids.length) return { orders: [], ready: true };

    const handle = Meteor.subscribe('comercio.pedidosPreparacion', ids);
    const orders = VentasRechargeCollection.find({}, { sort: { createdAt: -1 } })
      .fetch()
      .map((sale) => ({ ...sale, items: getCommerceItems(sale, ids) }))
      .filter((sale) => sale.items.length > 0)
      .sort((left, right) => new Date(right.createdAt || 0) - new Date(left.createdAt || 0));

    return { orders, ready: handle.ready() };
  }, [storeKey, userId]);

  const { activeOrders, finalizedOrders } = React.useMemo(
    () => partitionCommerceOrders(ordersState.orders),
    [ordersState.orders],
  );

  const visibleOrders = React.useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase('es');
    return activeOrders.filter((order) => {
      const matchesStatus = statusFilter === 'ACTIVOS' || order.estado === statusFilter;
      const itemText = order.items.map((item) => `${item?.producto?.name || item?.producto?.titulo || ''} ${item?.tienda?.title || ''}`).join(' ');
      const matchesSearch = !normalizedSearch || `${order._id} ${order.estado} ${itemText}`.toLocaleLowerCase('es').includes(normalizedSearch);
      return matchesStatus && matchesSearch;
    });
  }, [activeOrders, search, statusFilter]);

  const statusCounts = React.useMemo(() => ({
    total: activeOrders.length,
    pendientes: activeOrders.filter((order) => order.estado === 'PENDIENTE').length,
    preparando: activeOrders.filter((order) => order.estado === 'PREPARANDO').length,
    listos: activeOrders.filter((order) => order.estado === 'PREPARACION_LISTO').length,
    finalizados: finalizedOrders.length,
  }), [activeOrders, finalizedOrders.length]);

  const advanceOrder = async (order, nextStatus) => {
    const action = nextStatus === 'PREPARANDO' ? 'empezar a preparar' : 'marcar como listo para recoger';
    if (!window.confirm(`¿Quieres ${action} el pedido #${String(order._id).slice(-6)}?`)) return;

    setError('');
    setProcessingId(order._id);
    try {
      ensureEmpresaMethodSuccess(await callMeteor('comercio.pedidos.avanzar', { idPedido: order._id }));
      notify?.(`Pedido actualizado: ${STATUS_LABELS[nextStatus]}.`);
    } catch (methodError) {
      setError(methodError?.reason || methodError?.message || 'No se pudo avanzar el pedido.');
    } finally {
      setProcessingId('');
    }
  };

  const unassignCadete = async (order) => {
    if (!window.confirm(`¿Desasignar el cadete del pedido #${String(order._id).slice(-6)}?`)) return;

    setError('');
    setProcessingId(order._id);
    try {
      ensureEmpresaMethodSuccess(await callMeteor('comercio.pedidos.desasignarCadete', { ventaId: order._id }));
      notify?.('El pedido quedó listo para una nueva asignación.');
    } catch (methodError) {
      setError(methodError?.reason || methodError?.message || 'No se pudo desasignar el cadete.');
    } finally {
      setProcessingId('');
    }
  };

  if (!storeIds.length) {
    return <Paper className="empresa-empty" elevation={0}><Typography variant="h6">Primero registra una tienda</Typography><Typography color="text.secondary">Cuando tu comercio tenga una tienda, los pedidos pagos aparecerán aquí.</Typography></Paper>;
  }

  return (
    <Box className="content-stack empresa-panel">
      <Box className="empresa-panel-heading">
        <Box>
          <Box className="orders-heading-title-group">
            <Typography variant="h4">Preparación de pedidos</Typography>
            <Chip
              className={activeOrders.length ? 'live-orders-badge active' : 'live-orders-badge'}
              icon={<RadarRoundedIcon fontSize="small" />}
              label={activeOrders.length ? `${activeOrders.length} activos en tiempo real` : 'Sin activos en curso'}
              size="small"
            />
          </Box>
          <Typography color="text.secondary" variant="body2">
            Avanza los pedidos activos como tarjetas en tiempo real y consulta las compras finalizadas en la tabla inferior.
          </Typography>
        </Box>
      </Box>

      <Box className="empresa-metrics-row">
        <Paper className="empresa-metric" elevation={0}><strong>{statusCounts.total}</strong><span>Activos</span></Paper>
        <Paper className="empresa-metric" elevation={0}><strong>{statusCounts.pendientes}</strong><span>Pendientes</span></Paper>
        <Paper className="empresa-metric" elevation={0}><strong>{statusCounts.preparando}</strong><span>Preparando</span></Paper>
        <Paper className="empresa-metric" elevation={0}><strong>{statusCounts.finalizados}</strong><span>Finalizados</span></Paper>
      </Box>

      <Paper className="empresa-toolbar" elevation={0}>
        <TextField
          fullWidth
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar pedido activo o producto"
          value={search}
          InputProps={{ startAdornment: <SearchRoundedIcon color="action" sx={{ mr: 1 }} /> }}
        />
        <FormControl size="small" sx={{ minWidth: 190 }}>
          <Select onChange={(event) => setStatusFilter(event.target.value)} value={statusFilter}>
            <MenuItem value="ACTIVOS">Todos los pedidos activos</MenuItem>
            {Object.entries(STATUS_LABELS).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
          </Select>
        </FormControl>
      </Paper>

      {error ? <Alert onClose={() => setError('')} severity="error">{error}</Alert> : null}
      {!ordersState.ready ? <Paper className="empresa-loading-inline" elevation={0}><CircularProgress size={22} /><Typography color="text.secondary">Sincronizando pedidos propios…</Typography></Paper> : null}
      {ordersState.ready && !visibleOrders.length ? (
        <Paper className="empresa-empty" elevation={0}>
          <CheckCircleOutlineRoundedIcon color="success" fontSize="large" />
          <Typography variant="h6">No hay pedidos activos para mostrar</Typography>
          <Typography color="text.secondary" variant="body2">Los pedidos cobrados en preparación o entrega de tus tiendas aparecerán aquí como tarjetas en tiempo real.</Typography>
        </Paper>
      ) : null}
      {visibleOrders.length > 0 ? (
        <Stack spacing={2}>
          {visibleOrders.map((order) => (
            <OrderCard
              busy={processingId === order._id}
              key={order._id}
              onAdvance={advanceOrder}
              onUnassign={unassignCadete}
              order={order}
              storeIds={storeKey.split('|')}
            />
          ))}
        </Stack>
      ) : null}

      <FinalizedOrdersTable
        emptyMessage="Las compras entregadas, canceladas o cerradas de tus tiendas se mostrarán en esta tabla."
        orders={finalizedOrders}
        showEvidenceHistory={false}
        storeIds={storeKey.split('|')}
        stores={stores}
        subtitle="Registro de compras hechas, entregadas o canceladas de tus tiendas con método de pago y detalle completo."
        title="Historial de compras finalizadas"
      />
    </Box>
  );
}