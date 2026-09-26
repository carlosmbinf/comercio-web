import React from 'react';
import { Alert, Box, Button, Chip, Collapse, Divider, Paper, Stack, Typography } from '@mui/material';
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import ScheduleRoundedIcon from '@mui/icons-material/ScheduleRounded';
import ShoppingBagOutlinedIcon from '@mui/icons-material/ShoppingBagOutlined';

import { formatDateTime, formatMoney, getCommerceItems, getOrderStatus } from '../domain/commerce';
import EvidenceCard from './EvidenceCard';
import TrackMap from './TrackMap';

const STATUS_META = {
  CANCELADA: { label: 'Cancelada', tone: 'red' },
  PENDIENTE_PAGO: { label: 'Pendiente de pago', tone: 'orange' },
  EN_RUTA: { label: 'En reparto', tone: 'blue' },
  ENTREGADO: { label: 'Entregado', tone: 'green' },
  PREPARANDO: { label: 'En preparación', tone: 'violet' },
};
const STATUS_STEP = { PREPARANDO: 0, CADETEENLOCAL: 1, ENCAMINO: 2, CADETEENDESTINO: 3, ENTREGADO: 4 };
const STEPS = ['Preparando', 'Tienda', 'En camino', 'En destino', 'Entregado'];

function OrderTimeline({ sale }) {
  if (sale?.isCancelada) return <Alert severity="error" sx={{ mt: 2 }}>Este pedido fue cancelado y ya no seguirá en proceso.</Alert>;
  const currentStep = STATUS_STEP[sale?.estado] ?? 0;
  return (
    <Box className="order-timeline" aria-label={`Estado del pedido: ${STEPS[currentStep]}`}>
      {STEPS.map((step, index) => (
        <Box className={index <= currentStep ? 'timeline-step complete' : 'timeline-step'} key={step}>
          <span className="timeline-node">{index < currentStep ? '✓' : index + 1}</span>
          <Typography variant="caption">{step}</Typography>
        </Box>
      ))}
    </Box>
  );
}

export default function OrderCard({ sale, storeIds }) {
  const [expanded, setExpanded] = React.useState(false);
  const status = getOrderStatus(sale);
  const statusMeta = STATUS_META[status] || STATUS_META.PREPARANDO;
  const items = getCommerceItems(sale, storeIds);
  const itemCount = items.reduce((total, item) => total + Math.max(1, Number(item?.cantidad || 1)), 0);
  const firstItem = items[0];
  const estimatedTotal = items.reduce((total, item) => (
    total + (Number(item?.cobrarUSD || item?.producto?.precio || 0) * Math.max(1, Number(item?.cantidad || 1)))
  ), 0);
  const currency = firstItem?.monedaACobrar || firstItem?.producto?.monedaPrecio || sale?.monedaCobrado || 'USD';
  const showTrackingMap = Boolean(
    sale?.isCancelada !== true &&
    sale?.cadeteid &&
    ['CADETEENLOCAL', 'ENCAMINO', 'CADETEENDESTINO'].includes(sale?.estado) &&
    firstItem?.coordenadas,
  );
  const showEvidence = !sale?.isCancelada && sale?.isCobrado === false && ['EFECTIVO', 'TRANSFERENCIA'].includes(String(sale?.metodoPago || '').toUpperCase());

  return (
    <Paper className="order-card" elevation={0}>
      <Box className="order-card-main">
        <Box className="order-card-topline">
          <Box>
            <Typography className="order-number" variant="h6">Pedido #{String(sale?._id || '').slice(-6).toUpperCase()}</Typography>
            <Typography color="text.secondary" variant="body2">{formatDateTime(sale?.createdAt)}</Typography>
          </Box>
          <Chip className={`status-chip ${statusMeta.tone}`} label={statusMeta.label} size="small" />
        </Box>
        <Box className="order-meta-chips">
          <Chip label={`Pago: ${sale?.metodoPago || 'N/D'}`} size="small" variant="outlined" />
          <Chip label={`${itemCount} producto${itemCount === 1 ? '' : 's'}`} size="small" variant="outlined" />
          <Chip label={`Subtotal estimado: ${formatMoney(estimatedTotal, currency)}`} size="small" variant="outlined" />
          {sale?.refundStatus ? <Chip color="warning" label={sale.refundStatus === 'FULL' ? 'Reembolsado' : 'Reembolso parcial'} size="small" /> : null}
        </Box>

        {status === 'PENDIENTE_PAGO' && !showEvidence ? (
          <Alert className="order-inline-alert" severity="info">El pago está pendiente de confirmación.</Alert>
        ) : null}
        {status === 'EN_RUTA' ? (
          <Alert className="order-inline-alert" icon={<LocalShippingOutlinedIcon />} severity="info">Tu pedido está avanzando. El mapa se habilita cuando hay una ubicación activa del cadete.</Alert>
        ) : null}
        {status === 'ENTREGADO' ? (
          <Alert className="order-inline-alert" icon={<CheckCircleOutlineRoundedIcon />} severity="success">Pedido entregado. ¡Gracias por comprar en este comercio!</Alert>
        ) : null}

        <OrderTimeline sale={sale} />
        <Button
          className="order-detail-toggle"
          endIcon={<ExpandMoreRoundedIcon sx={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 180ms ease' }} />}
          onClick={() => setExpanded((current) => !current)}
          variant="outlined"
        >
          {expanded ? 'Ocultar detalles' : 'Ver detalles del pedido'}
        </Button>

        <Collapse in={expanded} timeout={220} unmountOnExit>
          <Box className="order-expanded-content">
            {showTrackingMap ? <TrackMap cadeteId={sale?.cadeteid} item={firstItem} /> : null}
            {!showTrackingMap && sale?.cadeteid && sale?.estado === 'PREPARANDO' ? (
              <Alert icon={<ScheduleRoundedIcon />} severity="info">El pedido está en preparación. El seguimiento aparecerá cuando el cadete salga a recogerlo.</Alert>
            ) : null}
            {sale?.refundStatus ? (
              <Alert severity="warning">{sale.refundStatus === 'FULL' ? 'Esta compra fue reembolsada completamente.' : 'Esta compra tiene un reembolso parcial.'} Devuelto: {formatMoney(sale.refundedAmount, sale.refundCurrency || sale.monedaCobrado)}.</Alert>
            ) : null}

            {showEvidence ? <EvidenceCard items={items} sale={sale} /> : null}

            <Divider />
            <Typography fontWeight={800} variant="h6">Productos ({items.length})</Typography>
            <Stack spacing={1}>
              {items.map((item, index) => {
                const name = item?.producto?.name || item?.nombre || 'Producto de comercio';
                const quantity = Math.max(1, Number(item?.cantidad || 1));
                const itemPrice = Number(item?.cobrarUSD || item?.producto?.precio || 0);
                const itemCurrency = item?.monedaACobrar || item?.producto?.monedaPrecio || currency;
                const address = [item?.nombreCalle, item?.numeroCasa].filter(Boolean).join(' · ');
                return (
                  <Paper className="order-product-line" elevation={0} key={item?._id || `${sale?._id}-${index}`}>
                    <Box className="checkout-line-icon"><ShoppingBagOutlinedIcon /></Box>
                    <Box className="order-product-copy">
                      <Typography fontWeight={750}>{name}</Typography>
                      {item?.producto?.descripcion ? <Typography color="text.secondary" variant="body2">{item.producto.descripcion}</Typography> : null}
                      {item?.comentario ? <Typography color="text.secondary" variant="caption">Nota: {item.comentario}</Typography> : null}
                      {address ? <Typography color="text.secondary" variant="caption">Entrega: {address}</Typography> : null}
                    </Box>
                    <Box className="order-product-price"><Typography color="text.secondary" variant="caption">× {quantity}</Typography><Typography fontWeight={800}>{formatMoney(itemPrice * quantity, itemCurrency)}</Typography></Box>
                  </Paper>
                );
              })}
            </Stack>
          </Box>
        </Collapse>
      </Box>
    </Paper>
  );
}
