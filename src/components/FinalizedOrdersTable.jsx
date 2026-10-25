import React from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  InputAdornment,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import AccountBalanceOutlinedIcon from '@mui/icons-material/AccountBalanceOutlined';
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import CreditCardRoundedIcon from '@mui/icons-material/CreditCardRounded';
import LocalAtmRoundedIcon from '@mui/icons-material/LocalAtmRounded';
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined';
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded';
import ReplayRoundedIcon from '@mui/icons-material/ReplayRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import ShoppingBagOutlinedIcon from '@mui/icons-material/ShoppingBagOutlined';
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';

import { buildOrderRowSummary, formatDateTime, formatMoney } from '../domain/commerce';
import { Meteor } from '../meteor/client';
import { EvidenciasVentasEfectivoCollection } from '../meteor/collections';

const STEPS = ['Preparando', 'Tienda', 'En camino', 'En destino', 'Entregado'];
const STATUS_STEP = { PREPARANDO: 0, CADETEENLOCAL: 1, ENCAMINO: 2, CADETEENDESTINO: 3, ENTREGADO: 4 };
const FINALIZED_EVIDENCE_FIELDS = {
  _id: 1,
  ventaId: 1,
  aprobado: 1,
  denegado: 1,
  rechazado: 1,
  cancelado: 1,
  cancelada: 1,
  isCancelada: 1,
  estado: 1,
  createdAt: 1,
  fecha: 1,
  fechaSubida: 1,
  base64: 1,
  dataBase64: 1,
  data: 1,
  dataB64: 1,
  nombre: 1,
  tipo: 1,
  descripcion: 1,
  metadata: 1,
};

function FinalizedEvidenceHistory({ items, sale }) {
  const evidenceIds = React.useMemo(() => {
    const itemIds = (items || []).map((item) => item?._id).filter(Boolean);
    return [...new Set([sale?._id, ...itemIds].filter(Boolean).map(String))];
  }, [items, sale?._id]);
  const evidenceKey = evidenceIds.join('|');

  const docs = Meteor.useTracker(() => {
    if (!evidenceKey) return [];
    const selector = evidenceIds.length === 1 ? { ventaId: evidenceIds[0] } : { ventaId: { $in: evidenceIds } };
    Meteor.subscribe('evidenciasVentasEfectivoRecharge', selector, { fields: FINALIZED_EVIDENCE_FIELDS });
    return EvidenciasVentasEfectivoCollection.find(selector, {
      fields: FINALIZED_EVIDENCE_FIELDS,
      sort: { createdAt: -1 },
    })
      .fetch()
      .filter((doc) => Boolean(doc?.base64 || doc?.dataBase64 || doc?.data || doc?.dataB64));
  }, [evidenceKey]);

  if (!docs.length) return null;

  return (
    <>
      <Divider />
      <Box className="evidence-history">
        <Typography fontWeight={800} sx={{ mb: 1 }} variant="subtitle1">
          Comprobantes adjuntos ({docs.length})
        </Typography>
        <Stack spacing={1}>
          {docs.map((doc) => {
            const raw = doc?.base64 || doc?.dataBase64 || doc?.data || doc?.dataB64 || '';
            const mime = String(doc?.tipo || doc?.metadata?.mimeType || 'image/jpeg');
            const src = raw ? `data:${mime.startsWith('image/') ? mime : 'image/jpeg'};base64,${raw}` : '';
            const approved = Boolean(doc?.aprobado);
            const rejected = Boolean(
              doc?.denegado || doc?.rechazado || doc?.cancelado || doc?.cancelada || doc?.isCancelada || doc?.estado === 'RECHAZADA',
            );
            return (
              <Paper className="order-product-line" elevation={0} key={doc._id}>
                {src ? (
                  <img
                    alt={doc.nombre || 'Comprobante'}
                    src={src}
                    style={{ width: 52, height: 52, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }}
                  />
                ) : null}
                <Box className="order-product-copy">
                  <Typography fontWeight={750} noWrap>{doc.nombre || 'Comprobante de pago'}</Typography>
                  <Typography color="text.secondary" variant="caption">
                    {formatDateTime(doc.createdAt || doc.fecha || doc.fechaSubida)}
                  </Typography>
                  {doc.descripcion ? (
                    <Typography color="text.secondary" display="block" variant="caption">
                      {doc.descripcion}
                    </Typography>
                  ) : null}
                </Box>
                <Chip
                  color={approved ? 'success' : rejected ? 'error' : 'info'}
                  label={approved ? 'Aprobado' : rejected ? 'Rechazado' : 'Registrado'}
                  size="small"
                />
              </Paper>
            );
          })}
        </Stack>
      </Box>
    </>
  );
}

function PaymentIcon({ code }) {
  switch (code) {
    case 'EFECTIVO':
      return <LocalAtmRoundedIcon fontSize="small" />;
    case 'PAYPAL':
    case 'MERCADOPAGO':
      return <CreditCardRoundedIcon fontSize="small" />;
    case 'TRANSFERENCIA':
      return <AccountBalanceOutlinedIcon fontSize="small" />;
    default:
      return <AccountBalanceWalletOutlinedIcon fontSize="small" />;
  }
}

function FinalizedOrderTimeline({ sale }) {
  if (sale?.isCancelada || String(sale?.estado || '').toUpperCase() === 'CANCELADO') {
    return (
      <Alert className="order-inline-alert" icon={<CancelOutlinedIcon />} severity="error">
        Este pedido fue cancelado y finalizó sin entrega.
      </Alert>
    );
  }
  const currentStep = STATUS_STEP[sale?.estado] ?? 4;
  return (
    <Box className="order-timeline" aria-label={`Estado del pedido: ${STEPS[currentStep] || 'Entregado'}`}>
      {STEPS.map((step, index) => (
        <Box className={index <= currentStep ? 'timeline-step complete' : 'timeline-step'} key={step}>
          <span className="timeline-node">{index <= currentStep ? '✓' : index + 1}</span>
          <Typography variant="caption">{step}</Typography>
        </Box>
      ))}
    </Box>
  );
}

function OrderDetailDialog({ onClose, sale, showEvidenceHistory = true, storeIds, stores }) {
  if (!sale) return null;

  const summary = buildOrderRowSummary(sale, storeIds, stores);
  const canInspectEvidence =
    showEvidenceHistory &&
    ['EFECTIVO', 'TRANSFERENCIA'].includes(summary.payment.code);

  return (
    <Dialog
      aria-labelledby="finalized-order-dialog-title"
      className="finalized-order-dialog"
      disablePortal
      fullWidth
      maxWidth="md"
      onClose={onClose}
      open={Boolean(sale)}
    >
      <DialogTitle className="finalized-order-dialog-header" id="finalized-order-dialog-title">
        <Box className="finalized-order-dialog-title-wrap">
          <Box className="finalized-order-dialog-badge">
            <ReceiptLongRoundedIcon />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Box className="finalized-order-dialog-topline">
              <Typography className="order-number" variant="h6">
                Pedido {summary.shortId}
              </Typography>
              <Chip
                className={`status-chip ${summary.statusTone}`}
                icon={summary.status === 'ENTREGADO' ? <CheckCircleOutlineRoundedIcon /> : <CancelOutlinedIcon />}
                label={summary.statusLabel}
                size="small"
              />
              {summary.refundStatus ? (
                <Chip
                  color="warning"
                  icon={<ReplayRoundedIcon />}
                  label={summary.refundStatus === 'FULL' ? 'Reembolsado' : 'Reembolso parcial'}
                  size="small"
                />
              ) : null}
            </Box>
            <Typography color="text.secondary" variant="body2">
              Registrado el {summary.dateLabel} · ID completo: {summary.id}
            </Typography>
          </Box>
        </Box>
        <IconButton aria-label="Cerrar detalle del pedido" onClick={onClose} size="small">
          <CloseRoundedIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent className="finalized-order-dialog-content" dividers>
        <Box className="finalized-order-summary-grid">
          <Paper className="finalized-order-summary-box" elevation={0}>
            <Typography color="text.secondary" variant="caption">ESTADO FINAL</Typography>
            <Typography fontWeight={800} variant="subtitle1">{summary.statusLabel}</Typography>
            <Typography color="text.secondary" variant="caption">
              {summary.status === 'ENTREGADO' ? 'Entrega completada' : 'Orden cerrada'}
            </Typography>
          </Paper>

          <Paper className="finalized-order-summary-box" elevation={0}>
            <Typography color="text.secondary" variant="caption">MÉTODO DE PAGO</Typography>
            <Box className="finalized-order-payment-inline">
              <PaymentIcon code={summary.payment.code} />
              <Typography fontWeight={800} variant="subtitle1">{summary.payment.label}</Typography>
            </Box>
            <Typography color="text.secondary" variant="caption">{summary.payment.collectionLabel}</Typography>
          </Paper>

          <Paper className="finalized-order-summary-box" elevation={0}>
            <Typography color="text.secondary" variant="caption">ARTÍCULOS Y COMERCIO</Typography>
            <Typography fontWeight={800} variant="subtitle1">
              {summary.itemCount} {summary.itemCount === 1 ? 'unidad' : 'unidades'}
            </Typography>
            <Typography color="text.secondary" noWrap title={summary.storesSummary} variant="caption">
              {summary.storesSummary}
            </Typography>
          </Paper>

          <Paper className="finalized-order-summary-box" elevation={0}>
            <Typography color="text.secondary" variant="caption">IMPORTE DEL PEDIDO</Typography>
            <Typography className="finalized-order-total-highlight" fontWeight={800} variant="subtitle1">
              {summary.subtotalFormatted}
            </Typography>
            <Typography color="text.secondary" variant="caption">
              {summary.showChargedDifference && summary.chargedFormatted
                ? `Cobrado: ${summary.chargedFormatted}`
                : `Moneda base: ${summary.currency}`}
            </Typography>
          </Paper>
        </Box>

        {(summary.recipientName || summary.deliveryAddress || summary.notes.length > 0) ? (
          <Paper className="finalized-order-delivery-box" elevation={0}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="space-between">
              {summary.recipientName ? (
                <Box>
                  <Typography color="text.secondary" variant="caption">CLIENTE / DESTINATARIO</Typography>
                  <Typography fontWeight={700} variant="body2">{summary.recipientName}</Typography>
                </Box>
              ) : null}
              {summary.deliveryAddress ? (
                <Box>
                  <Typography color="text.secondary" variant="caption">DIRECCIÓN DE ENTREGA</Typography>
                  <Typography fontWeight={700} variant="body2">{summary.deliveryAddress}</Typography>
                </Box>
              ) : null}
              <Box>
                <Typography color="text.secondary" variant="caption">TIENDA</Typography>
                <Typography fontWeight={700} variant="body2">{summary.storesSummary}</Typography>
              </Box>
            </Stack>
          </Paper>
        ) : null}

        {summary.status === 'ENTREGADO' ? (
          <Alert className="order-inline-alert" icon={<CheckCircleOutlineRoundedIcon />} severity="success">
            Pedido entregado satisfactoriamente.
          </Alert>
        ) : null}

        {summary.refundStatus ? (
          <Alert severity="warning">
            {summary.refundStatus === 'FULL'
              ? 'Esta compra fue reembolsada completamente.'
              : 'Esta compra tiene un reembolso parcial.'}{' '}
            Devuelto: {summary.refundFormatted}.
          </Alert>
        ) : null}

        <FinalizedOrderTimeline sale={sale} />

        <Divider />

        <Box>
          <Typography fontWeight={800} sx={{ mb: 1.25 }} variant="subtitle1">
            Productos del pedido ({summary.items.length})
          </Typography>
          <Stack spacing={1}>
            {summary.items.map((item, index) => {
              const name = item?.producto?.name || item?.producto?.titulo || item?.nombre || 'Producto de comercio';
              const quantity = Math.max(1, Number(item?.cantidad || item?.producto?.cantidad || 1));
              const itemPrice = Number(item?.cobrarUSD ?? item?.producto?.precio ?? 0);
              const itemCurrency = item?.monedaACobrar || item?.producto?.monedaPrecio || summary.currency;
              const address = [item?.nombreCalle, item?.numeroCasa].filter(Boolean).join(' · ');
              const storeTitle = item?.tienda?.title || summary.storesSummary;
              const note = item?.comentario || item?.producto?.comentario;

              return (
                <Paper className="order-product-line" elevation={0} key={item?._id || `${summary.id}-${index}`}>
                  <Box className="checkout-line-icon"><ShoppingBagOutlinedIcon /></Box>
                  <Box className="order-product-copy">
                    <Typography fontWeight={750}>{name}</Typography>
                    {item?.producto?.descripcion ? (
                      <Typography color="text.secondary" variant="body2">{item.producto.descripcion}</Typography>
                    ) : null}
                    <Stack direction="row" flexWrap="wrap" gap={1.5} sx={{ mt: 0.5 }}>
                      {storeTitle ? (
                        <Typography color="text.secondary" variant="caption">Tienda: {storeTitle}</Typography>
                      ) : null}
                      {address ? (
                        <Typography color="text.secondary" variant="caption">Entrega: {address}</Typography>
                      ) : null}
                      {note ? (
                        <Typography color="text.secondary" variant="caption">Nota: {note}</Typography>
                      ) : null}
                    </Stack>
                  </Box>
                  <Box className="order-product-price">
                    <Typography color="text.secondary" variant="caption">
                      {quantity} × {formatMoney(itemPrice, itemCurrency)}
                    </Typography>
                    <Typography fontWeight={800}>{formatMoney(itemPrice * quantity, itemCurrency)}</Typography>
                  </Box>
                </Paper>
              );
            })}
          </Stack>
        </Box>

        {canInspectEvidence ? (
          <FinalizedEvidenceHistory items={summary.items} sale={sale} />
        ) : null}
      </DialogContent>

      <DialogActions className="finalized-order-dialog-actions">
        <Button onClick={onClose} variant="contained">
          Cerrar detalle
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default function FinalizedOrdersTable({
  emptyMessage = 'Cuando se entreguen o cancelen pedidos, aparecerán organizados en esta tabla.',
  orders = [],
  showEvidenceHistory = true,
  storeIds = [],
  stores = [],
  subtitle = 'Registro histórico de compras entregadas, canceladas o cerradas.',
  title = 'Historial de compras finalizadas',
}) {
  const [statusFilter, setStatusFilter] = React.useState('ALL');
  const [search, setSearch] = React.useState('');
  const [selectedOrderId, setSelectedOrderId] = React.useState('');

  const rows = React.useMemo(
    () => orders.map((sale) => ({ sale, summary: buildOrderRowSummary(sale, storeIds, stores) })),
    [orders, storeIds, stores],
  );

  const counts = React.useMemo(() => ({
    all: rows.length,
    delivered: rows.filter(({ summary }) => summary.status === 'ENTREGADO').length,
    cancelled: rows.filter(({ summary }) => summary.status === 'CANCELADA').length,
    refunded: rows.filter(({ summary }) => Boolean(summary.refundStatus)).length,
  }), [rows]);

  const filteredRows = React.useMemo(() => {
    const query = search.trim().toLocaleLowerCase('es');
    return rows.filter(({ summary }) => {
      if (statusFilter === 'ENTREGADO' && summary.status !== 'ENTREGADO') return false;
      if (statusFilter === 'CANCELADA' && summary.status !== 'CANCELADA') return false;
      if (statusFilter === 'REEMBOLSADO' && !summary.refundStatus) return false;

      if (!query) return true;
      const haystack = [
        summary.id,
        summary.shortId,
        summary.dateLabel,
        summary.statusLabel,
        summary.payment.label,
        summary.payment.code,
        summary.payment.collectionLabel,
        summary.productsSummary,
        summary.storesSummary,
        summary.recipientName,
        summary.deliveryAddress,
        summary.subtotalFormatted,
        summary.chargedFormatted,
      ]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase('es');

      return haystack.includes(query);
    });
  }, [rows, search, statusFilter]);

  const selectedSale = React.useMemo(
    () => orders.find((sale) => String(sale?._id || sale?.idOrder || '') === selectedOrderId) || null,
    [orders, selectedOrderId],
  );

  return (
    <Box className="finalized-orders-section">
      <Paper className="finalized-orders-card" elevation={0}>
        <Box className="finalized-orders-header">
          <Box>
            <Box className="finalized-orders-title-row">
              <Typography variant="h5">{title}</Typography>
              <Chip
                className="finalized-orders-count-chip"
                label={`${counts.all} ${counts.all === 1 ? 'registro' : 'registros'}`}
                size="small"
              />
            </Box>
            <Typography color="text.secondary" variant="body2">
              {subtitle}
            </Typography>
          </Box>

          <Box className="finalized-orders-controls">
            <Box className="finalized-filter-pills" role="group" aria-label="Filtrar compras finalizadas">
              <Chip
                clickable
                className={statusFilter === 'ALL' ? 'finalized-filter-pill active' : 'finalized-filter-pill'}
                label={`Todas (${counts.all})`}
                onClick={() => setStatusFilter('ALL')}
                size="small"
              />
              <Chip
                clickable
                className={statusFilter === 'ENTREGADO' ? 'finalized-filter-pill active green' : 'finalized-filter-pill'}
                label={`Entregadas (${counts.delivered})`}
                onClick={() => setStatusFilter('ENTREGADO')}
                size="small"
              />
              <Chip
                clickable
                className={statusFilter === 'CANCELADA' ? 'finalized-filter-pill active red' : 'finalized-filter-pill'}
                label={`Canceladas (${counts.cancelled})`}
                onClick={() => setStatusFilter('CANCELADA')}
                size="small"
              />
              {counts.refunded > 0 ? (
                <Chip
                  clickable
                  className={statusFilter === 'REEMBOLSADO' ? 'finalized-filter-pill active orange' : 'finalized-filter-pill'}
                  label={`Reembolsadas (${counts.refunded})`}
                  onClick={() => setStatusFilter('REEMBOLSADO')}
                  size="small"
                />
              ) : null}
            </Box>

            <TextField
              className="finalized-orders-search"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar #pedido, producto, pago o tienda…"
              size="small"
              value={search}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchRoundedIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />
          </Box>
        </Box>

        {!filteredRows.length ? (
          <Box className="finalized-orders-empty">
            <ReceiptLongRoundedIcon color="disabled" fontSize="large" />
            <Typography fontWeight={700} variant="subtitle1">
              {rows.length ? 'No hay compras que coincidan con el filtro' : 'Sin compras finalizadas todavía'}
            </Typography>
            <Typography color="text.secondary" variant="body2">
              {rows.length
                ? 'Prueba cambiando el estado seleccionado o el texto de búsqueda.'
                : emptyMessage}
            </Typography>
          </Box>
        ) : (
          <TableContainer className="finalized-orders-table-container">
            <Table aria-label={title} className="finalized-orders-table" size="medium">
              <TableHead>
                <TableRow>
                  <TableCell>Pedido y fecha</TableCell>
                  <TableCell>Productos y datos clave</TableCell>
                  <TableCell>Tipo de pago</TableCell>
                  <TableCell align="right">Importe</TableCell>
                  <TableCell>Estado</TableCell>
                  <TableCell align="right">Detalle</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredRows.map(({ sale, summary }) => (
                  <TableRow
                    className="finalized-order-row"
                    hover
                    key={summary.id}
                    onClick={() => setSelectedOrderId(summary.id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setSelectedOrderId(summary.id);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                  >
                    <TableCell className="finalized-cell-order">
                      <Box className="finalized-order-id-wrap">
                        <span className={`finalized-order-dot ${summary.statusTone}`} />
                        <Box>
                          <Typography className="finalized-order-id" variant="subtitle2">
                            Pedido {summary.shortId}
                          </Typography>
                          <Typography color="text.secondary" variant="caption">
                            {summary.dateLabel}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>

                    <TableCell className="finalized-cell-products">
                      <Box className="finalized-product-main">
                        <Typography className="finalized-product-title" fontWeight={700} variant="body2">
                          {summary.primaryProduct}
                        </Typography>
                        {summary.extraProductsCount > 0 ? (
                          <Chip
                            className="finalized-extra-items-chip"
                            label={`+${summary.extraProductsCount} más`}
                            size="small"
                          />
                        ) : null}
                      </Box>
                      <Box className="finalized-product-submeta">
                        <span>
                          <ShoppingBagOutlinedIcon sx={{ fontSize: 13 }} />
                          {summary.itemCount} {summary.itemCount === 1 ? 'unidad' : 'unidades'}
                        </span>
                        <span>
                          <StorefrontOutlinedIcon sx={{ fontSize: 13 }} />
                          {summary.storesSummary}
                        </span>
                        {summary.deliveryAddress ? (
                          <span>
                            <PlaceOutlinedIcon sx={{ fontSize: 13 }} />
                            {summary.deliveryAddress}
                          </span>
                        ) : summary.recipientName ? (
                          <span>Cliente: {summary.recipientName}</span>
                        ) : null}
                      </Box>
                    </TableCell>

                    <TableCell className="finalized-cell-payment">
                      <Box className={`payment-badge ${summary.payment.tone}`}>
                        <PaymentIcon code={summary.payment.code} />
                        <span>{summary.payment.label}</span>
                      </Box>
                      <Typography className={`payment-substatus ${summary.payment.collectionTone}`} variant="caption">
                        {summary.payment.collectionLabel}
                      </Typography>
                    </TableCell>

                    <TableCell align="right" className="finalized-cell-amount">
                      <Typography className="finalized-amount-primary" fontWeight={800} variant="body2">
                        {summary.subtotalFormatted}
                      </Typography>
                      {summary.showChargedDifference && summary.chargedFormatted ? (
                        <Typography color="text.secondary" display="block" variant="caption">
                          Cobrado: {summary.chargedFormatted}
                        </Typography>
                      ) : null}
                    </TableCell>

                    <TableCell className="finalized-cell-status">
                      <Stack alignItems="flex-start" spacing={0.5}>
                        <Chip
                          className={`status-chip ${summary.statusTone}`}
                          label={summary.statusLabel}
                          size="small"
                        />
                        {summary.refundStatus ? (
                          <Chip
                            color="warning"
                            label={summary.refundStatus === 'FULL' ? 'Reembolsado' : 'Reembolso parcial'}
                            size="small"
                            variant="outlined"
                          />
                        ) : null}
                      </Stack>
                    </TableCell>

                    <TableCell align="right" className="finalized-cell-action">
                      <Button
                        className="finalized-detail-btn"
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedOrderId(summary.id);
                        }}
                        size="small"
                        startIcon={<VisibilityOutlinedIcon fontSize="small" />}
                        variant="outlined"
                      >
                        Ver info
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      <OrderDetailDialog
        onClose={() => setSelectedOrderId('')}
        sale={selectedSale}
        showEvidenceHistory={showEvidenceHistory}
        storeIds={storeIds}
        stores={stores}
      />
    </Box>
  );
}
