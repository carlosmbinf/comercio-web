import React from 'react';
import { Alert, Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, TextField, Typography } from '@mui/material';
import { callMeteor } from '../../meteor/client';

const labels = { holderName: 'Titular', recipientIdentifier: 'Cuenta / identificador', bankName: 'Banco', accountType: 'Tipo de cuenta', accountNumber: 'Número de cuenta', branch: 'Sucursal', documentType: 'Tipo de documento', documentNumber: 'Documento', monedaRecibirEnCuba: 'Moneda de entrega', metodoPago: 'Método de entrega', direccionCuba: 'Dirección en Cuba', tarjetaCUP: 'Tarjeta CUP' };
const money = (value, currency) => `${Number(value).toLocaleString('es-UY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;

export default function EmpresaFundsManual({ requests, onUpdated, onNotice }) {
  const [detail, setDetail] = React.useState(null);
  const [working, setWorking] = React.useState(false);
  const [error, setError] = React.useState('');
  const [confirmation, setConfirmation] = React.useState({ paymentReference: '', feeAmount: '', feeCurrency: '' });
  const [reason, setReason] = React.useState('');
  const [sent, setSent] = React.useState(false);
  const [noTransfer, setNoTransfer] = React.useState(false);
  const open = async (request) => {
    const starting = request.status === 'RESERVED';
    if (starting && !window.confirm(request.paymentMethod === 'REMESA'
      ? `¿Crear una remesa interna con ${money(request.amount, request.currency)} ya reservados? La liquidación se registra al confirmar la entrega real.`
      : '¿Confirmas que verificaste el saldo de la cuenta emisora para el importe y la comisión?')) return;
    setWorking(true); setError(''); setReason(''); setSent(false); setNoTransfer(false);
    try {
      const result = await callMeteor('pagos.liquidaciones.manual.instrucciones', request._id, starting);
      setDetail(result); setConfirmation({ paymentReference: '', feeAmount: '', feeCurrency: result.currency }); onUpdated();
    } catch (failure) { setError(failure.reason || failure.message || 'No se pudieron consultar las instrucciones.'); }
    finally { setWorking(false); }
  };
  const cancel = async (request) => {
    if (!window.confirm('¿Cancelar esta reserva antes de iniciar el envío o crear la remesa?')) return;
    setWorking(true); setError('');
    try { await callMeteor('pagos.liquidaciones.manual.resolver', { requestId: request._id, outcome: 'CANCELED', reason: 'Cancelada antes de iniciar la operación.' }); onNotice('Reserva cancelada; el saldo vuelve a estar disponible.'); onUpdated(); }
    catch (failure) { setError(failure.reason || failure.message || 'No se pudo cancelar la reserva.'); }
    finally { setWorking(false); }
  };
  const resolve = async (outcome) => {
    setWorking(true); setError('');
    try {
      await callMeteor('pagos.liquidaciones.manual.resolver', { requestId: detail.requestId, outcome, reason, ...(outcome === 'FAILED' ? { confirmedNoTransfer: true } : {}) });
      if (outcome === 'FAILED') setDetail(null); else setDetail((current) => ({ ...current, status: 'UNKNOWN', canSend: false }));
      onNotice(outcome === 'FAILED' ? 'Solicitud resuelta y saldo liberado.' : 'La reserva se conserva hasta aclarar el resultado.'); onUpdated();
    } catch (failure) { setError(failure.reason || failure.message || 'No se pudo resolver la solicitud.'); }
    finally { setWorking(false); }
  };
  const confirm = async () => {
    const isRemesa = detail.paymentMethod === 'REMESA';
    if (isRemesa && !window.confirm('¿Confirmas la entrega real en Cuba? Se registrarán entrega y liquidación juntas. Esta acción es irreversible.')) return;
    setWorking(true); setError('');
    try {
      if (isRemesa) await callMeteor('pagos.liquidaciones.remesa.entregar', detail.requestId);
      else await callMeteor('pagos.liquidaciones.manual.confirmar', { requestId: detail.requestId, ...confirmation });
      setDetail(null); onNotice(isRemesa ? 'Remesa entregada y saldo liquidado.' : 'Pago conciliado.'); onUpdated();
    } catch (failure) { setError(failure.reason || failure.message || 'No se pudo confirmar. Revisa la misma solicitud antes de reintentar.'); }
    finally { setWorking(false); }
  };
  const remesa = detail?.paymentMethod === 'REMESA';
  const saleId = detail?.remesaSaleId || detail?.remesa?.saleId;
  const destination = { ...(detail?.destination || {}), ...(detail?.destination?.details || {}) };
  const validRemesa = saleId && detail?.remesa?.recibirEnCuba != null && Number.isFinite(Number(detail.remesa.recibirEnCuba)) && ['CUP', 'USD'].includes(detail.remesa.monedaRecibirEnCuba) && ['IN_PROCESS', 'UNKNOWN'].includes(detail.status);
  return <>
    {error && !detail ? <Alert severity="error">{error}</Alert> : null}
    {requests.map((request) => ['RESERVED', 'IN_PROCESS', 'UNKNOWN'].includes(request.status) ? <Box key={request._id} className="empresa-funds-admin-actions">
      <Box display="flex" flexWrap="wrap" gap={1}>
        <Button disabled={working} onClick={() => open(request)} size="small" variant="outlined">{request.paymentMethod === 'REMESA' ? request.status === 'RESERVED' ? 'Crear remesa' : 'Ver remesa' : request.status === 'RESERVED' ? 'Iniciar envío manual' : 'Ver y conciliar'}</Button>
        {request.status === 'RESERVED' ? <Button disabled={working} onClick={() => cancel(request)} size="small">Cancelar reserva</Button> : null}
      </Box>
    </Box> : null)}
    <Dialog PaperProps={{ sx: { backgroundImage: 'none', bgcolor: 'background.paper', borderRadius: 3 } }} fullWidth maxWidth="sm" open={Boolean(detail)} onClose={() => { if (!working) { setDetail(null); setError(''); onUpdated(); } }}>
      <DialogTitle>{remesa ? 'Remesa interna' : 'Transferencia manual'} · {detail?.currency}</DialogTitle>
      <DialogContent><Box className="empresa-funds-form">
        <Alert severity={detail?.status === 'UNKNOWN' ? 'warning' : 'info'}>{detail?.destinationDetailsUnavailable ? 'Esta solicitud antigua no conserva un destinatario visible. No repitas el envío.' : detail?.status === 'UNKNOWN' ? 'El resultado es incierto. Verifica la operación existente y no repitas el envío.' : remesa ? 'La reserva financia la remesa. Confirma únicamente la entrega real en Cuba.' : 'La transferencia se realiza fuera de VIDKAR. Verifica los datos en el canal oficial.'}</Alert>
        {detail?.blockedBySaleReversal ? <Alert severity="error">{detail.blockedReason || 'La venta fue revertida. No inicies otra operación.'}</Alert> : null}
        {detail ? <Typography variant="h6">Importe reservado: {money(detail.amount, detail.currency)}</Typography> : null}
        {Object.entries(destination).filter(([key, value]) => labels[key] && value).map(([key, value]) => <Typography key={key} sx={{ overflowWrap: 'anywhere' }} variant="body2">{labels[key]}: <strong>{value}</strong></Typography>)}
        {remesa ? <><Typography variant="body2">Entrega: {detail?.remesa?.recibirEnCuba != null ? money(detail.remesa.recibirEnCuba, detail.remesa.monedaRecibirEnCuba) : 'No disponible'} · {detail?.remesa?.metodoPago || 'Método no disponible'} · {detail?.remesa?.estado || 'Estado no disponible'}</Typography>{saleId ? <Typography variant="body2">Remesa: {saleId}</Typography> : <Alert severity="warning">No se recibió el identificador de la remesa. Revisa la misma solicitud.</Alert>}<Alert severity="warning">Confirma importe, moneda y método y que el destinatario recibió la remesa. La entrega y liquidación son irreversibles.</Alert></> : <><TextField label="Referencia de transferencia completada" value={confirmation.paymentReference} onChange={(e) => setConfirmation({ ...confirmation, paymentReference: e.target.value })} inputProps={{ maxLength: 120 }} /><TextField label="Comisión cobrada a VIDKAR" value={confirmation.feeAmount} onChange={(e) => setConfirmation({ ...confirmation, feeAmount: e.target.value })} inputProps={{ inputMode: 'decimal' }} /><TextField label="Moneda de la comisión" value={confirmation.feeCurrency} onChange={(e) => setConfirmation({ ...confirmation, feeCurrency: e.target.value.toUpperCase() })} inputProps={{ maxLength: 3 }} /></>}
        {error ? <Alert severity="error">{error}</Alert> : null}
        <FormControlLabel control={<Checkbox checked={sent} onChange={(e) => setSent(e.target.checked)} />} label={remesa ? 'Verifiqué la entrega real al destinatario con el importe, moneda y método indicados.' : 'Confirmé en el canal oficial que el pago se completó al destinatario correcto.'} />
        {['IN_PROCESS', 'UNKNOWN'].includes(detail?.status) ? <><TextField label="Motivo de incertidumbre o fallo" value={reason} onChange={(e) => setReason(e.target.value)} inputProps={{ maxLength: 300 }} />{detail.status === 'IN_PROCESS' ? <Button disabled={working || reason.trim().length < 3} onClick={() => resolve('UNKNOWN')}>Dejar en estado incierto</Button> : null}<FormControlLabel control={<Checkbox checked={noTransfer} onChange={(e) => setNoTransfer(e.target.checked)} />} label={remesa ? 'Verifiqué que no hubo entrega ni transferencia en Cuba.' : 'Verifiqué que no hubo débito ni entrega de dinero.'} /><Button color="error" disabled={working || !noTransfer || reason.trim().length < 3} onClick={() => resolve('FAILED')}>Confirmar fallo y liberar saldo</Button></> : null}
      </Box></DialogContent>
      <DialogActions><Button disabled={working} onClick={() => { setDetail(null); setError(''); onUpdated(); }}>Cerrar</Button><Button disabled={working || !sent || (remesa ? !validRemesa : !confirmation.paymentReference.trim())} onClick={confirm} variant="contained">{working ? 'Registrando…' : remesa ? 'Confirmar entrega y liquidar' : 'Confirmar pago completado'}</Button></DialogActions>
    </Dialog>
  </>;
}
