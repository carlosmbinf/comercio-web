import React from 'react';
import {
  Alert, Box, Button, Card, CardContent, Checkbox, Chip, CircularProgress,
  Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel,
  MenuItem, Paper, TextField, Typography,
} from '@mui/material';
import AccountBalanceWalletRoundedIcon from '@mui/icons-material/AccountBalanceWalletRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import { callMeteor, Meteor } from '../../meteor/client';
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

    setSummaryState({ ownerId: userId, data: null, loading: true, error: '' });
    callMeteor('pagos.liquidaciones.resumen', userId, {}).then((data) => {
      if (active && Meteor.userId() === userId) {
        setSummaryState({ ownerId: userId, data, loading: false, error: '' });
      }
    }).catch((error) => {
      if (active && Meteor.userId() === userId) {
        setSummaryState({
          ownerId: userId,
          data: null,
          loading: false,
          error: error?.reason || error?.message || 'No se pudo consultar el resumen de fondos.',
        });
      }
    });

    return () => { active = false; };
  }, [revision, userId]);

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
  const requests = Array.isArray(currentSummary?.manualRequests) ? currentSummary.manualRequests : [];
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
      setNotice('Destino guardado. El servidor devuelve solo una máscara; administración procesa la liquidación desde su pantalla autorizada.');
      setRevision((value) => value + 1);
    } catch (error) {
      setDestinationError(error?.reason || error?.message || 'No se pudo guardar el destino. Revisa los datos e inténtalo de nuevo.');
    } finally {
      setDestinationWorking(false);
    }
  };

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
        PayPal admite USD; Mercado Pago, UYU; y el banco en Uruguay, USD o UYU. El saldo CUP solo se liquida mediante REMESA/FONDO, cobrada y entregada por el mismo importe CUP. Configurar un destino no solicita ni ejecuta un pago: administración procesa las liquidaciones de forma manual.
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
                    {destination ? <Typography color="text.secondary" variant="body2">Dato protegido: {destination.masked || 'Máscara no disponible'} · versión {destination.version}</Typography> : null}
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

          <Box>
            <Typography sx={{ mb: 1.5 }} variant="h6">Solicitudes de liquidación</Typography>
            <Alert severity="info" sx={{ mb: 1.5 }}>
              Este historial es de solo lectura. No hay una acción de solicitud de pago en la cuenta del beneficiario; la preparación y conciliación se realizan desde la pantalla autorizada de administración.
            </Alert>
            {requests.length ? (
              <Box className="empresa-funds-history">
                {requests.map((request) => (
                  <Paper className="empresa-funds-history-row" elevation={0} key={request._id}>
                    <Box>
                      <Typography fontWeight={750} variant="body2">
                        {formatMoney(request.amount, request.currency)} · {request.domain === 'CURSO' ? 'Cursos' : 'Comercio'} · {getMethodLabel(request.paymentMethod, request.currency)}
                      </Typography>
                      <Typography color="text.secondary" variant="caption">
                        {getStatusLabel(request.status)} · {request.destinationMask || 'Destino no disponible'} · {formatDate(request.createdAt)}
                      </Typography>
                    </Box>
                  </Paper>
                ))}
              </Box>
            ) : <Paper className="empresa-funds-empty" elevation={0}><Typography color="text.secondary" variant="body2">No hay solicitudes de liquidación registradas.</Typography></Paper>}
          </Box>
        </>
      ) : null}

      <Dialog aria-labelledby="empresa-funds-destination-title" fullWidth maxWidth="sm" onClose={() => !destinationWorking && setDestinationDialog(false)} open={destinationDialog}>
        <DialogTitle id="empresa-funds-destination-title">Configurar destino · {destinationForm.currency}</DialogTitle>
        <DialogContent>
          <Box className="empresa-funds-form">
            <Alert severity="warning">
              Los datos se guardan en la base de VIDKAR sin cifrado adicional de aplicación. El resumen muestra solo una máscara y los operadores autorizados consultan los datos al procesar el pago. No ingreses contraseñas, PIN ni códigos de seguridad.
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