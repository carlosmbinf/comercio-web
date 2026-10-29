import React from 'react';
import {
  Alert, Box, Button, Card, CardContent, Checkbox, Chip, CircularProgress,
  Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel,
  MenuItem, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import AccountBalanceWalletRoundedIcon from '@mui/icons-material/AccountBalanceWalletRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import StorefrontRoundedIcon from '@mui/icons-material/StorefrontRounded';
import SchoolRoundedIcon from '@mui/icons-material/SchoolRounded';
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded';
import PaymentsRoundedIcon from '@mui/icons-material/PaymentsRounded';
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded';
import ScheduleRoundedIcon from '@mui/icons-material/ScheduleRounded';
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined';
import { callMeteor, Meteor } from '../../meteor/client';
import EmpresaFundsManual from './EmpresaFundsManual';
import {
  buildDestinationPayload,
  getDefaultDestinationMethod,
  getDestinationMethodsForCurrency,
  getRemittanceCurrenciesForBalance,
  getRemittanceMethodsForCurrency,
  parseRemesaOptions,
  validateDestinationForm,
} from '../../domain/fondos';

const EMPTY_FORM = {
  accountNumber: '', accountType: 'CORRIENTE', bankName: '', branch: '', confirmOwnership: false,
  currency: 'USD', direccionCuba: '', documentNumber: '', documentType: '', holderName: '',
  method: 'PAYPAL', metodoPago: 'EFECTIVO', monedaRecibirEnCuba: 'CUP', recipientIdentifier: '', tarjetaCUP: '',
};

const METHOD_LABELS = {
  MERCADOPAGO: 'Mercado Pago', PAYPAL: 'PayPal', REMESA: 'Remesa a Cuba', TRANSFERENCIA: 'Banco en Uruguay',
};
const SALE_METHOD_LABELS = { PAYPAL: 'PayPal', MERCADOPAGO: 'Mercado Pago' };
const ROLE_LABELS = { STORE_OWNER: 'Venta de producto', VIDKAR: 'Comisión VIDKAR', PROFESSOR: 'Ingreso como profesor', ADMIN: 'Comisión de administración', GENERAL_ADMIN: 'Comisión de administración general' };
const STATUS_LABELS = {
  CANCELED: 'Reserva cancelada', FAILED: 'Cancelada sin entrega', IN_PROCESS: 'En proceso',
  PAID: 'Pagada', RESERVED: 'Saldo reservado', UNKNOWN: 'Pendiente de conciliación',
};

const formatMoney = (value, currency) => {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return `— ${currency}`;
  return `${new Intl.NumberFormat('es-UY', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)} ${currency}`;
};

const formatDate = (value) => {
  const date = value ? new Date(value) : null;
  return date && Number.isFinite(date.getTime())
    ? date.toLocaleString('es-UY', { dateStyle: 'medium', timeStyle: 'short' })
    : 'Fecha no disponible';
};

const getMethodLabel = (method, currency) => method === 'REMESA' && currency === 'CUP'
  ? 'FONDO · Remesa CUP'
  : METHOD_LABELS[method] || method || 'Método no disponible';

const getStatusLabel = (status) => STATUS_LABELS[status] || status || 'Estado no disponible';

export default function EmpresaFundsPanel({ userId }) {
  const [revision, setRevision] = React.useState(0);
  const [linePage, setLinePage] = React.useState(0);
  const [historyPage, setHistoryPage] = React.useState(0);
  const [requestPage, setRequestPage] = React.useState(0);
  const [historicalPage, setHistoricalPage] = React.useState(0);
  const [lineDomain, setLineDomain] = React.useState('');
  const [lineCurrency, setLineCurrency] = React.useState('');
  const [selectedLine, setSelectedLine] = React.useState(null);
  const [selectedPayment, setSelectedPayment] = React.useState(null);
  const [paymentForm, setPaymentForm] = React.useState(null);
  const [paymentWorking, setPaymentWorking] = React.useState(false);
  const [paymentSubmitted, setPaymentSubmitted] = React.useState(false);
  const [paymentError, setPaymentError] = React.useState('');
  const [summaryState, setSummaryState] = React.useState({ ownerId: '', data: null, loading: true, error: '' });
  const [notice, setNotice] = React.useState('');
  const [destinationDialog, setDestinationDialog] = React.useState(false);
  const [destinationForm, setDestinationForm] = React.useState(EMPTY_FORM);
  const [destinationError, setDestinationError] = React.useState('');
  const [destinationWorking, setDestinationWorking] = React.useState(false);
  const [remesaOptions, setRemesaOptions] = React.useState({ currencies: [], deliveryMethods: [] });
  const [remesaOptionsLoading, setRemesaOptionsLoading] = React.useState(false);
  const [remesaOptionsError, setRemesaOptionsError] = React.useState('');

  React.useEffect(() => {
    let active = true;
    if (!userId) {
      setSummaryState({ ownerId: '', data: null, loading: false, error: '' });
      return () => { active = false; };
    }

    setSummaryState((current) => current.ownerId === userId && current.data
      ? { ...current, error: '' }
      : { ownerId: userId, data: null, loading: true, error: '' });
    callMeteor('pagos.liquidaciones.resumen', userId, { page: linePage, historyPage, manualHistoryPage: requestPage, historicalPage, domain: lineDomain, currency: lineCurrency }).then((data) => {
      if (active && Meteor.userId() === userId) {
        setSummaryState({ ownerId: userId, data, loading: false, error: '' });
      }
    }).catch((error) => {
      if (active && Meteor.userId() === userId) {
        setSummaryState((current) => ({
          ownerId: userId,
          data: current.ownerId === userId ? current.data : null,
          loading: false,
          error: error?.reason || error?.message || 'No se pudo consultar el resumen de fondos.',
        }));
      }
    });

    return () => { active = false; };
  }, [revision, userId, linePage, historyPage, requestPage, historicalPage, lineDomain, lineCurrency]);

  React.useEffect(() => {
    if (!destinationDialog || destinationForm.method !== 'REMESA') {
      setRemesaOptionsLoading(false);
      setRemesaOptionsError('');
      return undefined;
    }

    let active = true;
    setRemesaOptions({ currencies: [], deliveryMethods: [] });
    setRemesaOptionsLoading(true);
    setRemesaOptionsError('');
    callMeteor('property.get', ['REMESA']).then((properties) => {
      if (active) setRemesaOptions(parseRemesaOptions(properties));
    }).catch((error) => {
      if (active) setRemesaOptionsError(error?.reason || error?.message || 'No se pudieron cargar las opciones activas de remesa.');
    }).finally(() => {
      if (active) setRemesaOptionsLoading(false);
    });

    return () => { active = false; };
  }, [destinationDialog, destinationForm.method]);

  const currentSummary = summaryState.ownerId === userId ? summaryState.data : null;
  const loading = summaryState.ownerId !== userId || summaryState.loading;
  const summaryError = summaryState.ownerId === userId ? summaryState.error : '';
  const destinations = Array.isArray(currentSummary?.destinations) ? currentSummary.destinations : [];
  const balances = Array.isArray(currentSummary?.balances) ? currentSummary.balances : [];
  const requests = [...new Map([...(currentSummary?.manualRequests || []).filter((request) => ['RESERVED', 'IN_PROCESS', 'UNKNOWN'].includes(request.status)), ...(currentSummary?.manualHistory || [])].map((request) => [request._id, request])).values()];
  const allowedRemesaCurrencies = React.useMemo(
    () => getRemittanceCurrenciesForBalance(destinationForm.currency, remesaOptions),
    [destinationForm.currency, remesaOptions],
  );
  const allowedRemesaMethods = React.useMemo(
    () => getRemittanceMethodsForCurrency(destinationForm.monedaRecibirEnCuba, remesaOptions),
    [destinationForm.monedaRecibirEnCuba, remesaOptions],
  );

  React.useEffect(() => {
    if (!destinationDialog || destinationForm.method !== 'REMESA' || remesaOptionsLoading || remesaOptionsError) return;
    setDestinationForm((current) => {
      const receiveCurrency = allowedRemesaCurrencies.includes(current.monedaRecibirEnCuba)
        ? current.monedaRecibirEnCuba
        : allowedRemesaCurrencies[0] || '';
      const deliveryMethods = getRemittanceMethodsForCurrency(receiveCurrency, remesaOptions);
      const deliveryMethod = deliveryMethods.includes(current.metodoPago)
        ? current.metodoPago
        : deliveryMethods[0] || '';
      if (receiveCurrency === current.monedaRecibirEnCuba && deliveryMethod === current.metodoPago) return current;
      return { ...current, monedaRecibirEnCuba: receiveCurrency, metodoPago: deliveryMethod };
    });
  }, [allowedRemesaCurrencies, destinationDialog, destinationForm.method, remesaOptions, remesaOptionsError, remesaOptionsLoading]);

  const openDestinationEditor = (currency) => {
    const existing = destinations.find((destination) => destination.currency === currency);
    const methods = getDestinationMethodsForCurrency(currency);
    const method = methods.includes(existing?.method) ? existing.method : getDefaultDestinationMethod(currency);
    setDestinationForm({
      ...EMPTY_FORM,
      currency,
      method,
      monedaRecibirEnCuba: currency === 'CUP' ? 'CUP' : '',
    });
    setDestinationError('');
    setDestinationDialog(true);
  };

  const updateDestinationField = (field) => (event) => {
    const value = event.target.value;
    setDestinationForm((current) => {
      const next = { ...current, [field]: value, confirmOwnership: false };
      if (field === 'monedaRecibirEnCuba' && value === 'USD') {
        next.metodoPago = 'EFECTIVO';
        next.tarjetaCUP = '';
      }
      if (field === 'metodoPago') {
        next.direccionCuba = value === 'EFECTIVO' ? current.direccionCuba : '';
        next.tarjetaCUP = value === 'TRANSFERENCIA' ? current.tarjetaCUP : '';
      }
      if (field === 'tarjetaCUP') next.tarjetaCUP = String(value).replace(/\D/g, '').slice(0, 16);
      if (field === 'documentType' && !value) next.documentNumber = '';
      return next;
    });
    setDestinationError('');
  };

  const saveDestination = async () => {
    if (Meteor.userId() !== userId) {
      setDestinationError('Vuelve a entrar con la cuenta propietaria antes de guardar el destino.');
      return;
    }
    const validationError = validateDestinationForm(destinationForm, remesaOptions);
    if (validationError) {
      setDestinationError(validationError);
      return;
    }

    setDestinationWorking(true);
    setDestinationError('');
    setNotice('');
    try {
      await callMeteor('pagos.liquidaciones.destino.guardar', buildDestinationPayload(destinationForm));
      setDestinationDialog(false);
      setDestinationForm(EMPTY_FORM);
      setNotice('Destino guardado correctamente. Ya puedes usarlo para solicitar tus cobros.');
      setRevision((value) => value + 1);
    } catch (error) {
      setDestinationError(error?.reason || error?.message || 'No se pudo guardar el destino. Revisa los datos e inténtalo de nuevo.');
    } finally {
      setDestinationWorking(false);
    }
  };

  const openPayment = (balance) => {
    const destination = destinations.find((entry) => entry.currency === balance.currency);
    const requestId = Array.from(crypto.getRandomValues(new Uint8Array(24)), (byte) => byte.toString(16).padStart(2, '0')).join('');
    setPaymentForm({ requestId, beneficiaryId: userId, domain: balance.domain, currency: balance.currency, destinationVersion: destination?.version, paymentType: 'TOTAL', amount: '', available: balance.payable, method: destination?.method });
    setPaymentSubmitted(false);
    setPaymentError('');
  };
  const closePayment = () => {
    if (paymentWorking) return;
    if (paymentSubmitted && !window.confirm('La reserva pudo haberse creado. Es más seguro reintentar con la misma solicitud. ¿Cerrar y actualizar el saldo?')) return;
    setPaymentForm(null);
    setRevision((value) => value + 1);
  };
  const preparePayment = async () => {
    if (Meteor.userId() !== userId || paymentForm.beneficiaryId !== userId) {
      setPaymentError('Vuelve a entrar con la cuenta propietaria antes de solicitar el cobro.');
      return;
    }
    setPaymentWorking(true); setPaymentSubmitted(true); setPaymentError('');
    const { available, method, ...payload } = paymentForm;
    try {
      const result = await callMeteor('pagos.liquidaciones.solicitar', payload);
      setNotice(`${result.reused ? 'Reserva existente' : 'Saldo reservado'}: ${formatMoney(result.amount, result.currency)}. La reserva no envía dinero; administración continuará el proceso.`);
      setPaymentForm(null);
      setRevision((value) => value + 1);
    } catch (failure) { setPaymentError(failure.reason || failure.message || 'No se pudo reservar el saldo.'); }
    finally { setPaymentWorking(false); }
  };
  const partialValue = Number(String(paymentForm?.amount || '').replace(',', '.'));
  const paymentInvalid = !paymentForm?.destinationVersion || (paymentForm?.paymentType === 'PARTIAL'
    && (!/^\d+(?:[.,]\d{1,2})?$/.test(paymentForm.amount.trim()) || partialValue <= 0 || partialValue > paymentForm.available));

  const destinationFormInvalid = !destinationForm.holderName.trim()
    || destinationForm.confirmOwnership !== true
    || (destinationForm.method === 'REMESA' && (
      remesaOptionsLoading || Boolean(remesaOptionsError)
      || !allowedRemesaCurrencies.includes(destinationForm.monedaRecibirEnCuba)
      || !allowedRemesaMethods.includes(destinationForm.metodoPago)
    ));

  return (
    <Box className="empresa-funds">
      <Box className="empresa-funds-heading">
        <Box>
          <Typography className="eyebrow" variant="overline">LIQUIDACIONES DEL COMERCIO</Typography>
          <Typography variant="h4">Fondos y cobros</Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5 }} variant="body2">
            Consulta tu saldo por moneda y configura dónde quieres recibir las liquidaciones.
          </Typography>
        </Box>
        <Button disabled={loading || destinationWorking} onClick={() => setRevision((value) => value + 1)} startIcon={<RefreshRoundedIcon />} variant="outlined">
          Actualizar
        </Button>
      </Box>

      <Alert severity="info">
        PayPal admite USD; Mercado Pago, UYU; y el banco en Uruguay, USD o UYU. El saldo CUP solo se liquida mediante REMESA/FONDO, cobrada y entregada por el mismo importe CUP. La solicitud reserva el saldo; administración procesa y concilia la liquidación de forma manual.
      </Alert>
      {notice ? <Alert onClose={() => setNotice('')} severity="success">{notice}</Alert> : null}
      {summaryError ? <Alert action={<Button color="inherit" disabled={loading} onClick={() => setRevision((value) => value + 1)} size="small">Reintentar</Button>} severity="error">{summaryError}</Alert> : null}
      {loading ? <Box className="empresa-loading-inline"><CircularProgress /><Typography color="text.secondary">Consultando tus fondos…</Typography></Box> : null}

      {!loading && currentSummary ? (
        <>
          <Box>
            <Typography sx={{ mb: 1.5 }} variant="h6">Saldo disponible</Typography>
            {balances.length ? (
              <Box className="empresa-funds-grid">
                {balances.map((balance, index) => (
                  <Card className="empresa-funds-card" elevation={0} key={`${balance.domain}-${balance.currency}-${index}`}>
                    <CardContent>
                      <Box className="empresa-funds-card-heading">
                        <AccountBalanceWalletRoundedIcon color="primary" />
                        <Chip label={`${balance.domain === 'CURSO' ? 'Cursos' : 'Comercio'} · ${balance.currency}`} size="small" />
                      </Box>
                      <Typography color="text.secondary" variant="body2">Disponible para cobrar</Typography>
                      <Typography className={`empresa-funds-amount${Number(balance.payable) < 0 ? ' negative' : ''}`} variant="h4">
                        {formatMoney(balance.payable, balance.currency)}
                      </Typography>
                      <Box className="empresa-funds-metrics">
                        <Box><span>Generado elegible</span><strong>{formatMoney(balance.generated, balance.currency)}</strong></Box>
                        <Box><span>Pagado</span><strong>{formatMoney(balance.paid, balance.currency)}</strong></Box>
                        <Box><span>En reserva</span><strong>{formatMoney(balance.reserved, balance.currency)}</strong></Box>
                      </Box>
                      {balance.reconciliationRequired ? <Alert severity="warning">Los pagos históricos requieren conciliación antes de solicitar este saldo.</Alert> : null}
                      {Number(balance.balance) < 0 ? <Alert severity="warning">Un ajuste de ventas reduce futuras liquidaciones.</Alert> : null}
                      <Button disabled={Number(balance.payable) <= 0 || balance.reconciliationRequired || paymentWorking || !destinations.some((entry) => entry.currency === balance.currency && entry.status === 'BENEFICIARY_CONFIRMED' && entry.compatible !== false)} onClick={() => openPayment(balance)} variant="contained">
                        {balance.currency === 'CUP' ? 'Preparar remesa' : 'Solicitar cobro'}
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </Box>
            ) : (
              <Paper className="empresa-funds-empty" elevation={0}>
                <Typography fontWeight={700}>Todavía no tienes saldo liquidable.</Typography>
                <Typography color="text.secondary" variant="body2">Los saldos aparecerán aquí cuando haya ingresos elegibles asociados a tu cuenta.</Typography>
              </Paper>
            )}
          </Box>

          <Box>
            <Typography sx={{ mb: 1.5 }} variant="h6">Destinos por moneda</Typography>
            <Box className="empresa-funds-grid">
              {['CUP', 'USD', 'UYU'].map((currency) => {
                const destination = destinations.find((entry) => entry.currency === currency);
                return (
                  <Paper className="empresa-funds-destination" elevation={0} key={currency}>
                    <Box className="empresa-funds-destination-heading">
                      <Box>
                        <Typography fontWeight={800} variant="subtitle1">{currency}</Typography>
                        <Typography color="text.secondary" variant="body2">
                          {destination ? getMethodLabel(destination.method, currency) : 'Sin destino configurado'}
                        </Typography>
                      </Box>
                      {destination ? <Chip color={destination.compatible === false ? 'warning' : 'success'} label={destination.compatible === false ? 'Actualizar destino' : destination.status === 'BENEFICIARY_CONFIRMED' ? 'Confirmado' : 'Revisar'} size="small" /> : null}
                    </Box>
                    {destination ? <Typography color="text.secondary" variant="body2">Cuenta: {destination.masked || 'No disponible'}</Typography> : null}
                    {currency === 'CUP' ? <Typography color="text.secondary" variant="caption">Solo REMESA con entrega exacta en CUP.</Typography> : null}
                    <Button disabled={destinationWorking} onClick={() => openDestinationEditor(currency)} size="small" variant="outlined">
                      {destination ? 'Actualizar destino' : 'Configurar destino'}
                    </Button>
                  </Paper>
                );
              })}
            </Box>
            <Typography color="text.secondary" sx={{ display: 'block', mt: 1.5 }} variant="caption">
              Solo se muestran los datos enmascarados. No compartas contraseñas, PIN, códigos 2FA ni credenciales de acceso.
            </Typography>
          </Box>

          {currentSummary.totalIssues > 0 ? <Alert severity="warning">Hay {currentSummary.totalIssues} ingresos que necesitan revisión antes de incluirse en el saldo.</Alert> : null}
          <Paper className="empresa-funds-table-card" elevation={0}>
            <Box className="empresa-funds-table-header"><Box><Box className="empresa-funds-table-title"><Typography variant="h5">Ingresos por venta</Typography><Chip className="empresa-funds-table-count" size="small" label={`${currentSummary.totalLines || 0} ingresos`} /></Box><Typography color="text.secondary" variant="body2">Consulta cómo se compone tu saldo.</Typography></Box>
              <Box className="empresa-funds-filters"><TextField size="small" select label="Origen" value={lineDomain} onChange={(event) => { setLineDomain(event.target.value); setLinePage(0); }}><MenuItem value="">Todos</MenuItem><MenuItem value="COMERCIO">Comercio</MenuItem><MenuItem value="CURSO">Cursos</MenuItem></TextField><TextField size="small" select label="Moneda" value={lineCurrency} onChange={(event) => { setLineCurrency(event.target.value); setLinePage(0); }}><MenuItem value="">Todas</MenuItem>{['CUP', 'USD', 'UYU'].map((currency) => <MenuItem key={currency} value={currency}>{currency}</MenuItem>)}</TextField></Box>
            </Box>
            <TableContainer className="empresa-funds-table-wrap">
              <Table className="empresa-funds-table" aria-label="Ingresos por venta">
                <TableHead><TableRow><TableCell>Venta / producto</TableCell><TableCell>Concepto</TableCell><TableCell align="right">Ingreso</TableCell><TableCell align="right">Cobrado</TableCell><TableCell align="right">Reservado</TableCell><TableCell align="right">Disponible</TableCell><TableCell align="right"><span className="empresa-funds-visually-hidden">Detalle</span></TableCell></TableRow></TableHead>
                <TableBody>{(currentSummary.lines || []).map((line) => <TableRow key={line.key}>
                  <TableCell><Typography fontWeight={750} variant="body2">{line.label || 'Venta'}</Typography><Typography color="text.secondary" variant="caption">{formatDate(line.createdAt)}{line.storeTitle ? ` · ${line.storeTitle}` : ''}</Typography></TableCell>
                  <TableCell><Typography variant="body2">{ROLE_LABELS[line.role] || (line.domain === 'CURSO' ? 'Curso' : 'Comercio')}</Typography><Typography color="text.secondary" variant="caption">{SALE_METHOD_LABELS[line.method] || 'Método no disponible'}</Typography></TableCell>
                  <TableCell align="right">{formatMoney(line.amount, line.currency)}</TableCell><TableCell align="right">{formatMoney(line.paid, line.currency)}</TableCell><TableCell align="right">{formatMoney(line.reserved, line.currency)}</TableCell><TableCell align="right" className="empresa-funds-table-available">{formatMoney(line.pending, line.currency)}</TableCell>
                  <TableCell align="right"><Button size="small" variant="outlined" onClick={() => setSelectedLine(line)} aria-label={`Ver detalle de ${line.label || 'la venta'}`}>Ver detalle</Button></TableCell>
                </TableRow>)}{!currentSummary.lines?.length ? <TableRow><TableCell colSpan={7}>No hay ingresos para estos filtros.</TableCell></TableRow> : null}</TableBody>
              </Table>
            </TableContainer>
            <Box className="empresa-funds-pagination"><Button disabled={linePage === 0} onClick={() => setLinePage((page) => page - 1)}>Anterior</Button><Typography color="text.secondary" variant="body2">Página {linePage + 1} · {currentSummary.totalLines || 0} ingresos</Typography><Button disabled={(linePage + 1) * 25 >= currentSummary.totalLines} onClick={() => setLinePage((page) => page + 1)}>Siguiente</Button></Box>
          </Paper>
          <Paper className="empresa-funds-table-card" elevation={0}>
            <Box className="empresa-funds-table-header"><Box><Box className="empresa-funds-table-title"><Typography variant="h5">Cobros realizados</Typography><Chip className="empresa-funds-table-count" size="small" label={`${currentSummary.totalPayments || 0} cobros`} /></Box><Typography color="text.secondary" variant="body2">Revisa los pagos registrados en tu cuenta.</Typography></Box></Box>
            <TableContainer className="empresa-funds-table-wrap">
              <Table className="empresa-funds-table" aria-label="Cobros realizados">
                <TableHead><TableRow><TableCell>Fecha</TableCell><TableCell>Origen</TableCell><TableCell>Método de cobro</TableCell><TableCell>Referencia</TableCell><TableCell align="right">Importe</TableCell><TableCell align="right">Detalle</TableCell></TableRow></TableHead>
                <TableBody>
                  {(currentSummary.payments || []).map((payment) => <TableRow key={payment._id}>
                    <TableCell><Typography variant="body2">{formatDate(payment.createdAt)}</Typography></TableCell>
                    <TableCell><Typography variant="body2">{payment.domain === 'CURSO' ? 'Cursos' : 'Comercio'}</Typography><Typography color="text.secondary" variant="caption">{payment.paymentType === 'PARTIAL' ? 'Cobro parcial' : payment.paymentType === 'TOTAL' ? 'Cobro total' : ''}</Typography></TableCell>
                    <TableCell><Typography variant="body2">{getMethodLabel(payment.paymentMethod, payment.currency)}</Typography></TableCell>
                    <TableCell><Typography color={payment.paymentReference ? 'text.primary' : 'text.secondary'} variant="body2">{payment.paymentReference || '—'}</Typography></TableCell>
                    <TableCell align="right"><Typography fontWeight={750} variant="body2">{formatMoney(payment.amount, payment.currency)}</Typography></TableCell>
                    <TableCell align="right"><Button size="small" variant="outlined" onClick={() => setSelectedPayment(payment)} aria-label={`Ver detalle del cobro de ${formatMoney(payment.amount, payment.currency)}`}>Ver detalle</Button></TableCell>
                  </TableRow>)}
                  {!currentSummary.payments?.length ? <TableRow><TableCell colSpan={6}><Typography color="text.secondary" variant="body2">Todavía no tienes cobros registrados.</Typography></TableCell></TableRow> : null}
                </TableBody>
              </Table>
            </TableContainer>
            <Box className="empresa-funds-pagination"><Button disabled={historyPage === 0} onClick={() => setHistoryPage((page) => page - 1)}>Anterior</Button><Typography color="text.secondary" variant="body2">Página {historyPage + 1} · {currentSummary.totalPayments || 0} cobros</Typography><Button disabled={(historyPage + 1) * 25 >= currentSummary.totalPayments} onClick={() => setHistoryPage((page) => page + 1)}>Siguiente</Button></Box>
          </Paper>
          {currentSummary.historicalCount > 0 ? <Box className="empresa-funds-section"><Box><Typography variant="h6">Cobros anteriores de cursos</Typography><Typography color="text.secondary" variant="body2">Estos cobros están pendientes de revisión y no se descuentan nuevamente.</Typography></Box><Box className="empresa-funds-history">{(currentSummary.historicalPayments || []).map((payment) => <Paper className="empresa-funds-history-row" elevation={0} key={payment._id}><Typography fontWeight={700}>{formatMoney(payment.amountUsd, 'USD')}</Typography><Typography color="text.secondary" variant="body2">{formatDate(payment.createdAt)}{payment.paymentReference ? ` · ${payment.paymentReference}` : ''}</Typography></Paper>)}</Box><Box className="empresa-funds-pagination"><Button disabled={historicalPage === 0} onClick={() => setHistoricalPage((page) => page - 1)}>Anterior</Button><Typography color="text.secondary" variant="body2">Página {historicalPage + 1} · {currentSummary.historicalCount} cobros</Typography><Button disabled={(historicalPage + 1) * 25 >= currentSummary.historicalCount} onClick={() => setHistoricalPage((page) => page + 1)}>Siguiente</Button></Box></Box> : null}

          <Paper className="empresa-funds-table-card" elevation={0}>
            <Box className="empresa-funds-table-header"><Box><Box className="empresa-funds-table-title"><Typography variant="h5">Solicitudes de liquidación</Typography><Chip className="empresa-funds-table-count" size="small" label={`${currentSummary.totalManualHistory || 0} solicitudes`} /></Box><Typography color="text.secondary" variant="body2">Una reserva no significa que el dinero haya sido enviado ni que una remesa haya sido entregada.</Typography></Box></Box>
            <TableContainer className="empresa-funds-table-wrap">
              <Table className="empresa-funds-table empresa-funds-requests-table" aria-label="Solicitudes de liquidación">
                <TableHead><TableRow><TableCell>Fecha</TableCell><TableCell>Importe</TableCell><TableCell>Destino</TableCell><TableCell>Estado</TableCell><TableCell>Referencia y detalle</TableCell>{currentSummary.canRegister ? <TableCell>Acciones</TableCell> : null}</TableRow></TableHead>
                <TableBody>
                  {requests.map((request) => <TableRow key={request._id}>
                    <TableCell><Typography variant="body2">{formatDate(request.createdAt)}</Typography><Typography color="text.secondary" variant="caption">{request.domain === 'CURSO' ? 'Cursos' : 'Comercio'}</Typography></TableCell>
                    <TableCell><Typography fontWeight={750} variant="body2">{formatMoney(request.amount, request.currency)}</Typography><Typography color="text.secondary" variant="caption">{request.paymentType === 'PARTIAL' ? 'Cobro parcial' : request.paymentType === 'TOTAL' ? 'Cobro total' : ''}</Typography></TableCell>
                    <TableCell><Typography variant="body2">{getMethodLabel(request.paymentMethod, request.currency)}</Typography><Typography color="text.secondary" variant="caption">{request.destinationMask || 'Destino no disponible'}</Typography></TableCell>
                    <TableCell><Chip size="small" variant="outlined" color={request.blockedBySaleReversal || request.status === 'UNKNOWN' ? 'warning' : request.status === 'PAID' ? 'success' : request.status === 'FAILED' || request.status === 'CANCELED' ? 'error' : 'primary'} label={request.blockedBySaleReversal ? 'Requiere revisión' : getStatusLabel(request.status)} /></TableCell>
                    <TableCell className="empresa-funds-request-detail">{request.paymentReference ? <Typography variant="body2">{request.paymentReference}</Typography> : null}{request.resolutionReason ? <Typography color="text.secondary" variant="caption">{request.resolutionReason}</Typography> : null}{!request.paymentReference && !request.resolutionReason ? <Typography color="text.secondary" variant="body2">—</Typography> : null}</TableCell>
                    {currentSummary.canRegister ? <TableCell>{['RESERVED', 'IN_PROCESS', 'UNKNOWN'].includes(request.status) ? <EmpresaFundsManual requests={[request]} onUpdated={() => setRevision((value) => value + 1)} onNotice={setNotice} /> : <Typography color="text.secondary" variant="body2">—</Typography>}</TableCell> : null}
                  </TableRow>)}
                  {!requests.length ? <TableRow><TableCell colSpan={currentSummary.canRegister ? 6 : 5}><Typography color="text.secondary" variant="body2">No hay solicitudes de liquidación registradas.</Typography></TableCell></TableRow> : null}
                </TableBody>
              </Table>
            </TableContainer>
            {(currentSummary.totalManualHistory || 0) > 25 ? <Box className="empresa-funds-pagination"><Button disabled={requestPage === 0} onClick={() => setRequestPage((page) => page - 1)}>Anterior</Button><Typography color="text.secondary" variant="body2">Página {requestPage + 1} · {currentSummary.totalManualHistory} solicitudes</Typography><Button disabled={(requestPage + 1) * 25 >= currentSummary.totalManualHistory} onClick={() => setRequestPage((page) => page + 1)}>Siguiente</Button></Box> : null}
          </Paper>
        </>
      ) : null}

      <Dialog PaperProps={{ sx: (theme) => ({ backgroundImage: 'none', bgcolor: 'background.paper', borderRadius: 3, '--line-soft': theme.palette.divider, '--muted': theme.palette.text.secondary, '--accent': theme.palette.primary.main, '--accent-soft': theme.palette.mode === 'dark' ? 'rgba(167,139,250,.14)' : 'rgba(117,73,223,.09)', '--surface-soft': theme.palette.mode === 'dark' ? '#201f29' : '#f4f3f8' }) }} fullWidth maxWidth="sm" open={Boolean(selectedLine)} onClose={() => setSelectedLine(null)} aria-labelledby="empresa-funds-sale-title">
        <DialogTitle id="empresa-funds-sale-title">Detalle de la venta</DialogTitle>
        <DialogContent>{selectedLine ? <Box className="empresa-funds-sale-detail">
          <Box className="empresa-funds-sale-intro"><Box className="empresa-funds-sale-intro-icon">{selectedLine.domain === 'CURSO' ? <SchoolRoundedIcon /> : <StorefrontRoundedIcon />}</Box><Box><Typography className="empresa-funds-sale-kicker" variant="overline">{selectedLine.domain === 'CURSO' ? 'Curso' : 'Comercio'}</Typography><Typography variant="h6" fontWeight={800}>{selectedLine.label || 'Venta'}</Typography><Typography color="text.secondary" variant="body2">{formatDate(selectedLine.createdAt)}</Typography></Box></Box>
          <Typography className="empresa-funds-sale-heading" fontWeight={750}><ReceiptLongRoundedIcon /> Datos de la venta</Typography>
          <Box className="empresa-funds-sale-facts">
            <Box><span>Concepto</span><strong>{ROLE_LABELS[selectedLine.role] || 'Ingreso'}</strong></Box>
            <Box><span>Método de pago</span><strong>{SALE_METHOD_LABELS[selectedLine.method] || 'No disponible'}</strong></Box>
            {selectedLine.storeTitle ? <Box><span>Tienda</span><strong>{selectedLine.storeTitle}</strong></Box> : null}
            {selectedLine.role === 'STORE_OWNER' && selectedLine.quantity != null ? <Box><span>Cantidad</span><strong>{selectedLine.quantity}</strong></Box> : null}
            {selectedLine.saleId ? <Box><span>Referencia de venta</span><strong>{selectedLine.saleId}</strong></Box> : null}
            {selectedLine.sourceAmount != null && selectedLine.sourceCurrency ? <Box><span>Importe de origen</span><strong>{formatMoney(selectedLine.sourceAmount, selectedLine.sourceCurrency)}</strong></Box> : null}
          </Box>
          <Typography className="empresa-funds-sale-heading" fontWeight={750}><AccountBalanceWalletOutlinedIcon /> Estado de este ingreso</Typography>
          <Box className="empresa-funds-sale-amounts"><Box><span><PaymentsRoundedIcon /> Ingreso</span><strong>{formatMoney(selectedLine.amount, selectedLine.currency)}</strong></Box><Box><span><CheckCircleOutlineRoundedIcon /> Cobrado</span><strong>{formatMoney(selectedLine.paid, selectedLine.currency)}</strong></Box><Box><span><ScheduleRoundedIcon /> Reservado</span><strong>{formatMoney(selectedLine.reserved, selectedLine.currency)}</strong></Box><Box className="empresa-funds-sale-available"><span><AccountBalanceWalletOutlinedIcon /> Disponible</span><strong>{formatMoney(selectedLine.pending, selectedLine.currency)}</strong></Box></Box>
          {selectedLine.domain === 'CURSO' && selectedLine.grossAmountUsd != null ? <><Typography fontWeight={750}>Distribución del curso</Typography><Box className="empresa-funds-sale-facts"><Box><span>Importe total</span><strong>{formatMoney(selectedLine.grossAmountUsd, 'USD')}</strong></Box><Box><span>Profesor</span><strong>{formatMoney(selectedLine.professorAmountUsd, 'USD')}</strong></Box><Box><span>Administración</span><strong>{formatMoney(selectedLine.adminAmountUsd, 'USD')}</strong></Box><Box><span>Administración general</span><strong>{formatMoney(selectedLine.generalAmountUsd, 'USD')}</strong></Box></Box></> : null}
          {selectedLine.role === 'STORE_OWNER' ? <Typography color="text.secondary" variant="body2">El ingreso corresponde al precio de los productos vendidos. No incluye el costo de entrega ni la comisión de VIDKAR.</Typography> : null}
        </Box> : null}</DialogContent><DialogActions><Button onClick={() => setSelectedLine(null)}>Cerrar</Button></DialogActions>
      </Dialog>

      <Dialog PaperProps={{ sx: { backgroundImage: 'none', bgcolor: 'background.paper', borderRadius: 3 } }} fullWidth maxWidth="sm" open={Boolean(selectedPayment)} onClose={() => setSelectedPayment(null)} aria-labelledby="empresa-funds-payment-detail-title">
        <DialogTitle id="empresa-funds-payment-detail-title">Detalle del cobro</DialogTitle><DialogContent><Box className="empresa-funds-form">{selectedPayment ? <><Typography variant="h5" fontWeight={800}>{formatMoney(selectedPayment.amount, selectedPayment.currency)}</Typography><Typography color="text.secondary" variant="body2">{getMethodLabel(selectedPayment.paymentMethod, selectedPayment.currency)} · {formatDate(selectedPayment.createdAt)}</Typography>{selectedPayment.paymentReference ? <Typography variant="body2">Referencia: {selectedPayment.paymentReference}</Typography> : null}<Typography fontWeight={700}>Ingresos incluidos</Typography>{(selectedPayment.allocations || []).map((line, index) => <Box className="empresa-funds-allocation" key={line.key || index}><Typography variant="body2">{line.label || 'Ingreso por venta'}</Typography><Typography fontWeight={700} variant="body2">{formatMoney(line.amount, selectedPayment.currency)}</Typography></Box>)}</> : null}</Box></DialogContent><DialogActions><Button onClick={() => setSelectedPayment(null)}>Cerrar</Button></DialogActions>
      </Dialog>

      <Dialog PaperProps={{ sx: { backgroundImage: 'none', bgcolor: 'background.paper', borderRadius: 3 } }} aria-labelledby="empresa-funds-payment-title" fullWidth maxWidth="sm" onClose={closePayment} open={Boolean(paymentForm)}>
        <DialogTitle id="empresa-funds-payment-title">{paymentForm?.currency === 'CUP' ? 'Preparar remesa' : 'Solicitar cobro'} · {paymentForm?.currency}</DialogTitle>
        <DialogContent><Box className="empresa-funds-form">
          <Alert severity="info">Al confirmar, reservaremos el importe para tu cobro. No se enviará dinero todavía. {paymentForm?.method === 'REMESA' ? 'La liquidación se registra al confirmar la entrega real de la remesa.' : 'Administración debe ejecutar y conciliar la transferencia.'}</Alert>
          <Typography>Disponible para reservar: {paymentForm ? formatMoney(paymentForm.available, paymentForm.currency) : ''}</Typography>
          <Typography color="text.secondary" variant="body2">Destino confirmado: {paymentForm ? getMethodLabel(paymentForm.method, paymentForm.currency) : ''}.</Typography>
          {paymentError ? <Alert severity="error">{paymentError} Si no sabes si se creó la reserva, reintenta con la misma solicitud.</Alert> : null}
          <TextField disabled={paymentSubmitted} label="Tipo de pago" select value={paymentForm?.paymentType || 'TOTAL'} onChange={(event) => setPaymentForm((current) => ({ ...current, paymentType: event.target.value }))}><MenuItem value="TOTAL">Total disponible</MenuItem><MenuItem value="PARTIAL">Parcial</MenuItem></TextField>
          {paymentForm?.paymentType === 'PARTIAL' ? <TextField disabled={paymentSubmitted} label={`Importe en ${paymentForm.currency}`} value={paymentForm.amount} onChange={(event) => setPaymentForm((current) => ({ ...current, amount: event.target.value }))} inputProps={{ inputMode: 'decimal' }} /> : null}
        </Box></DialogContent>
        <DialogActions><Button disabled={paymentWorking} onClick={closePayment}>Cerrar</Button><Button disabled={paymentWorking || paymentInvalid} onClick={preparePayment} variant="contained">{paymentWorking ? 'Reservando…' : paymentSubmitted ? 'Reintentar misma solicitud' : 'Reservar saldo'}</Button></DialogActions>
      </Dialog>

      <Dialog PaperProps={{ sx: { backgroundImage: 'none', bgcolor: 'background.paper', borderRadius: 3 } }} aria-labelledby="empresa-funds-destination-title" fullWidth maxWidth="sm" onClose={() => !destinationWorking && setDestinationDialog(false)} open={destinationDialog}>
        <DialogTitle id="empresa-funds-destination-title">Configurar destino · {destinationForm.currency}</DialogTitle>
        <DialogContent>
          <Box className="empresa-funds-form">
            <Alert severity="warning">
              Comprueba los datos de tu cuenta antes de guardarlos. No ingreses contraseñas, PIN ni códigos de seguridad.
            </Alert>
            <TextField disabled label="Moneda del saldo" value={destinationForm.currency} />
            <TextField disabled={destinationForm.currency === 'CUP'} label="Método de cobro" onChange={updateDestinationField('method')} select value={destinationForm.method}>
              {getDestinationMethodsForCurrency(destinationForm.currency).map((method) => <MenuItem key={method} value={method}>{METHOD_LABELS[method]}</MenuItem>)}
            </TextField>
            <TextField autoComplete="name" inputProps={{ maxLength: 120 }} label={destinationForm.method === 'REMESA' ? 'Nombre y apellidos del destinatario' : 'Nombre del titular'} onChange={updateDestinationField('holderName')} required value={destinationForm.holderName} />

            {destinationForm.method === 'PAYPAL' || destinationForm.method === 'MERCADOPAGO' ? <TextField
              autoComplete="off"
              helperText={destinationForm.method === 'PAYPAL' ? 'Correo, celular o usuario admitido por PayPal.' : 'Usa el identificador que el flujo oficial de Mercado Pago indique.'}
              inputProps={{ maxLength: 180 }}
              label="Identificador de la cuenta receptora"
              onChange={updateDestinationField('recipientIdentifier')}
              required
              value={destinationForm.recipientIdentifier}
            /> : null}

            {destinationForm.method === 'TRANSFERENCIA' ? <>
              <Alert severity="info">Destino bancario en Uruguay. El saldo se mantiene en su moneda; VIDKAR no convierte USD y UYU.</Alert>
              <TextField inputProps={{ maxLength: 100 }} label="Banco" onChange={updateDestinationField('bankName')} required value={destinationForm.bankName} />
              <TextField label="Tipo de cuenta" onChange={updateDestinationField('accountType')} select value={destinationForm.accountType}>
                <MenuItem value="CORRIENTE">Corriente</MenuItem><MenuItem value="AHORRO">Ahorro</MenuItem><MenuItem value="OTRO">Otro</MenuItem>
              </TextField>
              <TextField autoComplete="off" inputProps={{ maxLength: 80 }} label="Número / identificador de cuenta" onChange={updateDestinationField('accountNumber')} required value={destinationForm.accountNumber} />
              <TextField inputProps={{ maxLength: 80 }} label="Sucursal (opcional)" onChange={updateDestinationField('branch')} value={destinationForm.branch} />
              <TextField label="Documento (opcional)" onChange={updateDestinationField('documentType')} select value={destinationForm.documentType}>
                <MenuItem value="">No indicar</MenuItem><MenuItem value="CI">CI</MenuItem><MenuItem value="RUT">RUT</MenuItem><MenuItem value="PASSPORT">Pasaporte</MenuItem><MenuItem value="OTRO">Otro</MenuItem>
              </TextField>
              {destinationForm.documentType ? <TextField inputProps={{ maxLength: 50 }} label="Número de documento" onChange={updateDestinationField('documentNumber')} required value={destinationForm.documentNumber} /> : null}
            </> : null}

            {destinationForm.method === 'REMESA' ? <>
              {remesaOptionsLoading ? <Box alignItems="center" display="flex" gap={1}><CircularProgress size={18} /><Typography variant="body2">Cargando opciones activas…</Typography></Box> : null}
              {remesaOptionsError ? <Alert severity="error">{remesaOptionsError}</Alert> : null}
              <TextField disabled={destinationForm.currency === 'CUP' || remesaOptionsLoading || !allowedRemesaCurrencies.length} label="Moneda de entrega en Cuba" onChange={updateDestinationField('monedaRecibirEnCuba')} select value={destinationForm.monedaRecibirEnCuba}>
                {allowedRemesaCurrencies.map((currency) => <MenuItem key={currency} value={currency}>{currency}</MenuItem>)}
              </TextField>
              <TextField disabled={remesaOptionsLoading || !allowedRemesaMethods.length} label="Método de entrega" onChange={updateDestinationField('metodoPago')} select value={destinationForm.metodoPago}>
                {allowedRemesaMethods.map((method) => <MenuItem key={method} value={method}>{method === 'EFECTIVO' ? 'Efectivo en domicilio' : 'Transferencia a tarjeta CUP'}</MenuItem>)}
              </TextField>
              {destinationForm.metodoPago === 'EFECTIVO' ? <TextField inputProps={{ maxLength: 300 }} label="Dirección de entrega en Cuba" multiline onChange={updateDestinationField('direccionCuba')} required value={destinationForm.direccionCuba} /> : null}
              {destinationForm.metodoPago === 'TRANSFERENCIA' ? <TextField autoComplete="off" inputProps={{ inputMode: 'numeric', maxLength: 16 }} label="Tarjeta CUP (16 dígitos)" onChange={updateDestinationField('tarjetaCUP')} required value={destinationForm.tarjetaCUP} /> : null}
              <Typography color="text.secondary" variant="caption">
                {destinationForm.currency === 'CUP'
                  ? 'FONDO: se cobra y entrega exactamente el mismo importe CUP, sin conversión.'
                  : 'La remesa USD conserva la cotización normal del módulo REMESA al iniciarse; no es un pago automático.'}
              </Typography>
            </> : null}

            <FormControlLabel
              control={<Checkbox checked={destinationForm.confirmOwnership} onChange={(event) => setDestinationForm((current) => ({ ...current, confirmOwnership: event.target.checked }))} />}
              label="Confirmo que soy titular o estoy autorizado a recibir pagos en este destino."
            />
            {destinationError ? <Alert severity="error">{destinationError}</Alert> : null}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button disabled={destinationWorking} onClick={() => setDestinationDialog(false)}>Cancelar</Button>
          <Button disabled={destinationWorking || destinationFormInvalid} onClick={saveDestination} startIcon={destinationWorking ? <CircularProgress color="inherit" size={16} /> : null} variant="contained">
            {destinationWorking ? 'Guardando…' : 'Guardar destino'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}