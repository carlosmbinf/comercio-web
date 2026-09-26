import React from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import { callMeteor, Meteor } from '../meteor/client';
import { EvidenciasVentasEfectivoCollection } from '../meteor/collections';
import { formatMoney, formatDateTime } from '../domain/commerce';
import './evidence.css';

const EVIDENCE_FIELDS = {
  _id: 1,
  ventaId: 1,
  userId: 1,
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
  size: 1,
  tamano: 1,
  descripcion: 1,
  detalles: 1,
  analisisIA: 1,
  metadata: 1,
};

const getEvidenceData = (evidence) =>
  evidence?.base64 || evidence?.dataBase64 || evidence?.data || evidence?.dataB64 || '';

const getEvidenceStatus = (evidence) => {
  if (evidence?.aprobado) return { label: 'Aprobada', tone: 'success' };
  if (evidence?.denegado || evidence?.rechazado || evidence?.cancelado || evidence?.cancelada || evidence?.isCancelada || evidence?.estado === 'RECHAZADA') {
    return { label: 'Revisar comprobante', tone: 'error' };
  }
  return { label: 'En revisión', tone: 'info' };
};

const toDataUri = (evidence) => {
  const base64 = getEvidenceData(evidence);
  if (!base64) return '';
  const type = String(evidence?.tipo || evidence?.metadata?.mimeType || 'image/jpeg');
  return `data:${type.startsWith('image/') ? type : 'image/jpeg'};base64,${base64}`;
};

const fileToBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => {
    const dataUri = String(reader.result || '');
    resolve(dataUri.includes(',') ? dataUri.split(',')[1] : dataUri);
  };
  reader.onerror = () => reject(new Error('No se pudo leer la imagen seleccionada.'));
  reader.readAsDataURL(file);
});

async function copyToClipboard(value) {
  if (!value) return false;
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return true;
  }
  const helper = document.createElement('textarea');
  helper.value = value;
  helper.setAttribute('readonly', 'readonly');
  helper.style.position = 'fixed';
  helper.style.opacity = '0';
  document.body.appendChild(helper);
  helper.select();
  const copied = document.execCommand('copy');
  document.body.removeChild(helper);
  return copied;
}

export default function EvidenceCard({ items, sale }) {
  const fileInputRef = React.useRef(null);
  const [description, setDescription] = React.useState('');
  const [selectedFile, setSelectedFile] = React.useState(null);
  const [previewUrl, setPreviewUrl] = React.useState('');
  const [uploading, setUploading] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState(null);
  const [accountInfo, setAccountInfo] = React.useState({ value: '', loading: false });
  const [commissionInfo, setCommissionInfo] = React.useState({ value: 0, error: '', loading: false });
  const [feedback, setFeedback] = React.useState({ open: false, message: '', severity: 'success' });
  const userId = Meteor.useTracker(() => Meteor.userId(), []);
  const saleUserId = sale?.userId || sale?.producto?.userId;
  const currency = String(sale?.monedaCobrado || 'USD').toUpperCase();
  const firstCommerceItem = (items || []).find((item) => item?.type === 'COMERCIO');
  const storeId = firstCommerceItem?.idTienda || firstCommerceItem?.producto?.idTienda;
  const evidenceIds = React.useMemo(() => {
    const itemIds = (items || []).map((item) => item?._id).filter(Boolean);
    return [...new Set([sale?._id, ...itemIds].filter(Boolean).map(String))];
  }, [items, sale?._id]);
  const evidenceKey = evidenceIds.join('|');
  const uploadDisabled = sale?.isCobrado === true || sale?.isCancelada === true;

  const saleUserState = Meteor.useTracker(() => {
    if (!saleUserId) return { paymentOwnerId: null, ready: false };
    const selector = { _id: saleUserId };
    const fields = { _id: 1, bloqueadoDesbloqueadoPor: 1 };
    const handle = Meteor.subscribe('user', selector, { fields });
    const saleUser = Meteor.users.findOne(selector, { fields });
    return {
      paymentOwnerId: saleUser?.bloqueadoDesbloqueadoPor || saleUserId,
      ready: handle.ready(),
    };
  }, [saleUserId]);

  const evidenceState = Meteor.useTracker(() => {
    if (!evidenceKey) return { docs: [], ready: true };
    const selector = evidenceIds.length === 1
      ? { ventaId: evidenceIds[0] }
      : { ventaId: { $in: evidenceIds } };
    const handle = Meteor.subscribe('evidenciasVentasEfectivoRecharge', selector, { fields: EVIDENCE_FIELDS });
    return {
      docs: EvidenciasVentasEfectivoCollection.find(selector, {
        fields: EVIDENCE_FIELDS,
        sort: { createdAt: -1 },
      }).fetch().filter((evidence) => Boolean(getEvidenceData(evidence))),
      ready: handle.ready(),
    };
  }, [evidenceKey]);

  React.useEffect(() => {
    let active = true;
    if (!sale?._id || !storeId || !currency) {
      setCommissionInfo({ value: 0, error: '', loading: false });
      return () => { active = false; };
    }
    setCommissionInfo({ value: 0, error: '', loading: true });
    callMeteor('calculoDeComisionesPorTiendaFinanl', sale._id, storeId, currency)
      .then((result) => {
        if (!active) return;
        if (!result?.success) {
          setCommissionInfo({ value: 0, error: result?.message || 'No se pudieron calcular las comisiones.', loading: false });
          return;
        }
        setCommissionInfo({ value: Number(result?.montoTotal || 0), error: '', loading: false });
      })
      .catch((error) => {
        if (active) setCommissionInfo({ value: 0, error: error?.reason || error?.message || 'No se pudieron calcular las comisiones.', loading: false });
      });
    return () => { active = false; };
  }, [currency, sale?._id, storeId]);

  React.useEffect(() => {
    let active = true;
    const ownerId = saleUserState.paymentOwnerId;
    if (!ownerId || !saleUserState.ready) {
      setAccountInfo({ value: '', loading: Boolean(saleUserId) });
      return () => { active = false; };
    }
    const key = currency === 'CUP' ? `TARJETA_CUP_${ownerId}` : `CUENTA_${currency}_${ownerId}`;
    setAccountInfo({ value: '', loading: true });
    callMeteor('property.getValor', 'CONFIG', key)
      .then((value) => { if (active) setAccountInfo({ value: String(value || ''), loading: false }); })
      .catch(() => { if (active) setAccountInfo({ value: '', loading: false }); });
    return () => { active = false; };
  }, [currency, saleUserId, saleUserState.paymentOwnerId, saleUserState.ready]);

  React.useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const showFeedback = (message, severity = 'success') => setFeedback({ open: true, message, severity });

  const handleSelectFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(String(file.type || '').toLowerCase())) {
      showFeedback('Selecciona una imagen JPG, PNG, GIF o WEBP.', 'error');
      event.target.value = '';
      return;
    }
    if (file.size <= 0 || file.size > 10 * 1024 * 1024) {
      showFeedback('La imagen debe pesar menos de 10 MB.', 'error');
      event.target.value = '';
      return;
    }
    try {
      const base64 = await fileToBase64(file);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setSelectedFile({ base64, name: file.name, size: file.size, type: file.type });
      setPreviewUrl(URL.createObjectURL(file));
    } catch (error) {
      showFeedback(error?.message || 'No se pudo preparar la imagen.', 'error');
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !sale?._id || uploadDisabled || uploading) return;
    setUploading(true);
    try {
      await callMeteor(
        'archivos.upload',
        {
          data: selectedFile.base64,
          name: selectedFile.name,
          size: selectedFile.size,
          type: selectedFile.type,
          ventaId: sale._id,
        },
        { categoria: 'general', descripcion: description.trim() },
      );
      setDescription('');
      setSelectedFile(null);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      showFeedback('Comprobante enviado correctamente para validación.');
    } catch (error) {
      showFeedback(error?.reason || error?.message || 'No se pudo subir el comprobante.', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteEvidence = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      await callMeteor('archivos.delete', deleteTarget._id);
      setDeleteTarget(null);
      showFeedback('Comprobante eliminado.');
    } catch (error) {
      showFeedback(error?.reason || error?.message || 'No se pudo eliminar el comprobante.', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const handleCopy = async () => {
    try {
      const copied = await copyToClipboard(accountInfo.value);
      showFeedback(copied ? 'Datos de pago copiados.' : 'No hay datos de pago disponibles.', copied ? 'success' : 'warning');
    } catch (_error) {
      showFeedback('No se pudo copiar la información.', 'error');
    }
  };

  const subtotal = Number(sale?.cobrado || 0);
  const total = subtotal + Number(commissionInfo.value || 0);
  const uploadLabel = currency === 'CUP' ? 'Tarjeta de destino (CUP)' : `Datos de pago (${currency})`;

  return (
    <Paper className="evidence-card" elevation={0}>
      <Box className="evidence-card-heading">
        <Box className="evidence-heading-icon"><CloudUploadOutlinedIcon /></Box>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography fontWeight={800} variant="subtitle1">Comprobante de pago</Typography>
          <Typography color="text.secondary" variant="body2">
            {evidenceState.docs.length ? `${evidenceState.docs.length} archivo(s) enviados` : 'Pendiente de evidencia'}
          </Typography>
        </Box>
        {evidenceState.docs.length ? <Chip color="info" label={`${evidenceState.docs.length} evidencia(s)`} size="small" /> : null}
      </Box>

      <Alert className="evidence-instructions" severity="warning">
        Realiza el pago con el importe exacto y adjunta un comprobante legible con fecha y referencia.
      </Alert>

      <Box className="evidence-amount-card">
        <Box>
          <Typography color="text.secondary" variant="caption">TOTAL A PAGAR</Typography>
          <Typography fontWeight={850} variant="h5">{formatMoney(total, currency)}</Typography>
          <Typography color="text.secondary" variant="caption">
            Subtotal {formatMoney(subtotal, currency)} · Comisiones {commissionInfo.loading ? 'calculando…' : formatMoney(commissionInfo.value, currency)}
          </Typography>
        </Box>
        <Chip className="evidence-method-chip" label={currency === 'CUP' ? 'TARJETA CUP' : 'TRANSFERENCIA'} size="small" />
      </Box>
      {commissionInfo.error ? <Typography color="error" variant="caption">{commissionInfo.error}</Typography> : null}

      <Paper className="evidence-payment-data" elevation={0}>
        <Box className="evidence-payment-heading">
          <Box><Typography fontWeight={800} variant="body2">{uploadLabel}</Typography><Typography color="text.secondary" variant="caption">Información configurada por VIDKAR</Typography></Box>
          <IconButton aria-label="Copiar datos de pago" disabled={!accountInfo.value} onClick={handleCopy} size="small"><ContentCopyRoundedIcon fontSize="small" /></IconButton>
        </Box>
        {accountInfo.loading ? (
          <Box className="evidence-loading"><CircularProgress size={17} /><Typography color="text.secondary" variant="caption">Consultando datos de pago…</Typography></Box>
        ) : accountInfo.value ? (
          <Typography className="evidence-account-value" variant="body2">{accountInfo.value}</Typography>
        ) : (
          <Typography color="text.secondary" variant="body2">No hay datos de pago configurados para {currency}. Contacta al comercio antes de realizar la transferencia.</Typography>
        )}
      </Paper>

      <Box className="evidence-upload-section">
        <Typography fontWeight={800} variant="subtitle2">Envía tu comprobante</Typography>
        <input accept="image/jpeg,image/png,image/gif,image/webp" className="evidence-file-input" onChange={handleSelectFile} ref={fileInputRef} type="file" />
        <Button
          disabled={uploadDisabled || uploading}
          onClick={() => fileInputRef.current?.click()}
          startIcon={<ImageOutlinedIcon />}
          variant="outlined"
        >
          {selectedFile ? 'Cambiar imagen' : 'Seleccionar imagen'}
        </Button>
        {selectedFile ? (
          <Paper className="evidence-selected-file" elevation={0}>
            {previewUrl ? <img alt={selectedFile.name} src={previewUrl} /> : null}
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography noWrap fontWeight={750}>{selectedFile.name}</Typography>
              <Typography color="text.secondary" variant="caption">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</Typography>
            </Box>
          </Paper>
        ) : null}
        <TextField
          disabled={uploadDisabled || uploading}
          fullWidth
          inputProps={{ maxLength: 200 }}
          label="Descripción (opcional)"
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Ej. pago realizado desde mi banco"
          value={description}
        />
        {uploadDisabled ? <Alert severity="info">Esta venta ya fue cobrada o cancelada; puedes consultar el historial, pero no enviar más archivos.</Alert> : null}
        <Button disabled={!selectedFile || uploadDisabled || uploading} onClick={handleUpload} startIcon={uploading ? <CircularProgress color="inherit" size={17} /> : <CloudUploadOutlinedIcon />} variant="contained">
          {uploading ? 'Enviando…' : 'Enviar para validación'}
        </Button>
      </Box>

      {evidenceState.docs.length ? (
        <Box className="evidence-history">
          <Typography fontWeight={800} variant="subtitle2">Historial de comprobantes</Typography>
          <Stack spacing={1}>
            {evidenceState.docs.map((evidence) => {
              const status = getEvidenceStatus(evidence);
              const image = toDataUri(evidence);
              return (
                <Paper className="evidence-history-item" elevation={0} key={evidence._id}>
                  {image ? <img alt={evidence.nombre || 'Comprobante enviado'} src={image} /> : null}
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography noWrap fontWeight={750}>{evidence.nombre || 'Comprobante'}</Typography>
                    <Typography color="text.secondary" variant="caption">{formatDateTime(evidence.createdAt || evidence.fecha || evidence.fechaSubida)}</Typography>
                    <Box className="evidence-status-row">
                      <Chip color={status.tone} label={status.label} size="small" />
                      {evidence.descripcion ? <Typography color="text.secondary" variant="caption">{evidence.descripcion}</Typography> : null}
                    </Box>
                    {evidence?.analisisIA?.summary ? <Typography className="evidence-analysis" color="text.secondary" variant="caption">{evidence.analisisIA.summary}</Typography> : null}
                  </Box>
                  {evidence.userId === userId && !evidence.aprobado && !uploadDisabled ? (
                    <IconButton aria-label={`Eliminar ${evidence.nombre || 'comprobante'}`} color="error" onClick={() => setDeleteTarget(evidence)} size="small"><DeleteOutlineRoundedIcon fontSize="small" /></IconButton>
                  ) : null}
                </Paper>
              );
            })}
          </Stack>
        </Box>
      ) : evidenceState.ready ? (
        <Typography color="text.secondary" variant="caption">Aún no hay comprobantes asociados a esta compra.</Typography>
      ) : null}

      <Dialog onClose={() => !deleting && setDeleteTarget(null)} open={Boolean(deleteTarget)}>
        <DialogTitle>¿Eliminar comprobante?</DialogTitle>
        <DialogContent><Typography color="text.secondary">Este archivo se quitará del historial de evidencias de la compra.</Typography></DialogContent>
        <DialogActions>
          <Button disabled={deleting} onClick={() => setDeleteTarget(null)}>Cancelar</Button>
          <Button color="error" disabled={deleting} onClick={handleDeleteEvidence} variant="contained">{deleting ? 'Eliminando…' : 'Eliminar'}</Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        autoHideDuration={4500}
        message={feedback.message}
        onClose={() => setFeedback((current) => ({ ...current, open: false }))}
        open={feedback.open}
        anchorOrigin={{ horizontal: 'center', vertical: 'bottom' }}
      />
    </Paper>
  );
}
