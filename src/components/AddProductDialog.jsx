import React from 'react';
import { Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, TextField, Typography, useTheme } from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import LocalMallOutlinedIcon from '@mui/icons-material/LocalMallOutlined';
import RemoveRoundedIcon from '@mui/icons-material/RemoveRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { formatMoney } from '../domain/commerce';
import { callMeteor } from '../meteor/client';
import ProductImageCarousel from './ProductImageCarousel';

export default function AddProductDialog({
  adding,
  cartBlocked = false,
  cartReady = true,
  images = [],
  onAdd,
  onClose,
  open,
  product,
  store,
}) {
  const navigate = useNavigate();
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';
  const { auth } = useOutletContext();
  const [quantity, setQuantity] = React.useState(1);
  const [comment, setComment] = React.useState('');
  const [error, setError] = React.useState('');
  const [specifications, setSpecifications] = React.useState([]);
  const [loadingSpecifications, setLoadingSpecifications] = React.useState(false);
  const price = Number(product?.precio) || 0;
  const stock = Math.max(0, Number(product?.count) || 0);
  const isMadeToOrder = Boolean(product?.productoDeElaboracion);
  const productName = product?.name || 'Producto de comercio';
  const currency = product?.monedaPrecio || 'USD';
  const description = String(product?.descripcion || '').trim();
  const quantityValid = Number.isInteger(quantity) && quantity > 0 && (isMadeToOrder || quantity <= stock);
  const total = price * Math.max(0, quantity);
  const availabilityLabel = isMadeToOrder
    ? 'Por encargo'
    : stock === 0
      ? 'Agotado'
      : stock <= 5
        ? `Quedan ${stock} unidades`
        : 'Disponible';
  const availabilityColor = isMadeToOrder
    ? 'secondary'
    : stock === 0
      ? 'default'
      : stock <= 5
        ? 'warning'
        : 'success';

  React.useEffect(() => {
    if (open) {
      setQuantity(1);
      setComment('');
      setError('');
    }
  }, [open, product?._id]);

  React.useEffect(() => {
    let active = true;
    setSpecifications([]);
    setLoadingSpecifications(Boolean(open && product?._id));
    if (open && product?._id) {
      callMeteor('comercio.getProductSpecifications', product._id)
        .then((items) => { if (active) setSpecifications(Array.isArray(items) ? items : []); })
        .catch(() => { if (active) setSpecifications([]); })
        .finally(() => { if (active) setLoadingSpecifications(false); });
    }
    return () => { active = false; };
  }, [open, product?._id]);

  const submit = async () => {
    setError('');
    if (!auth?.userId) {
      onClose();
      navigate('/login', { state: { from: '/' } });
      return;
    }
    if (!quantityValid) {
      setError('La cantidad supera el stock disponible o no es válida.');
      return;
    }
    if (cartBlocked) {
      setError('Retira o finaliza la compra anterior antes de agregar este producto.');
      return;
    }
    if (!cartReady) {
      setError('Espera a que el carrito termine de sincronizarse.');
      return;
    }
    await onAdd(quantity, comment);
  };

  const handleClose = () => {
    if (!adding) onClose();
  };

  return (
    <Dialog
      aria-describedby="product-dialog-description"
      className={isDarkMode ? 'product-dialog product-dialog-dark' : 'product-dialog'}
      fullWidth
      maxWidth="sm"
      onClose={handleClose}
      open={open}
    >
      <DialogTitle className="product-dialog-title" component="div">
        <Box className="product-dialog-heading">
          <Box className="product-dialog-heading-copy">
            <Typography className="product-dialog-store" noWrap variant="overline">
              {store?.title || store?.name || 'Tienda'}
            </Typography>
            <Typography className="product-dialog-name" component="h2" variant="h5">
              {productName}
            </Typography>
            <Typography className="product-dialog-unit-price" variant="h6">
              {formatMoney(price, currency)} <span>/ unidad</span>
            </Typography>
          </Box>
        </Box>
        <IconButton aria-label="Cerrar detalle del producto" className="product-dialog-close" disabled={adding} onClick={handleClose}>
          <CloseRoundedIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent className="product-dialog-content">
        {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}
        {auth?.userId && cartBlocked ? (
          <Alert severity="warning">Tu carrito tiene una compra incompatible. Retírala o finalízala antes de continuar.</Alert>
        ) : null}
        {auth?.userId && !cartReady ? (
          <Alert severity="info">Sincronizando el carrito…</Alert>
        ) : null}

        <ProductImageCarousel
          alt={productName}
          className="product-dialog-gallery"
          fallback={<span className="product-dialog-gallery-fallback">{productName.trim().slice(0, 1).toUpperCase()}</span>}
          images={images}
        />

        <Box className="product-detail-description">
          <Box className="product-detail-heading">
            <Typography className="product-detail-label" variant="subtitle2">Descripción del producto</Typography>
            <Chip color={availabilityColor} label={availabilityLabel} size="small" />
          </Box>
          <Typography className="product-full-description" id="product-dialog-description" variant="body2">
            {description || 'El comercio todavía no ha añadido una descripción para este producto.'}
          </Typography>
        </Box>

        {loadingSpecifications || specifications.length > 0 ? (
          <Box className="product-detail-description" aria-live="polite">
            <Typography className="product-detail-label" component="h3" variant="subtitle2">Características del producto</Typography>
            {loadingSpecifications ? (
              <Typography color="text.secondary" variant="body2">Cargando características…</Typography>
            ) : (
              <Box component="dl" sx={{ display: 'grid', gridTemplateColumns: 'minmax(100px, 1fr) 2fr', gap: 1, m: 0 }}>
                {specifications.map(({ label, value }) => (
                  <React.Fragment key={label}>
                    <Typography component="dt" color="text.secondary" variant="body2">{label}</Typography>
                    <Typography component="dd" sx={{ m: 0, overflowWrap: 'anywhere' }} variant="body2">{value}</Typography>
                  </React.Fragment>
                ))}
              </Box>
            )}
          </Box>
        ) : null}

        <Box className="product-quantity-panel">
          <Box className="product-quantity-copy">
            <Typography className="product-quantity-title" variant="subtitle1">¿Cuántos deseas?</Typography>
            <Typography color="text.secondary" variant="caption">
              {isMadeToOrder ? 'Se prepara al confirmar el pedido' : `${stock} ${stock === 1 ? 'unidad disponible' : 'unidades disponibles'}`}
            </Typography>
          </Box>
          <Box className="product-quantity-controls">
            <IconButton
              aria-label="Reducir cantidad"
              className="product-quantity-button"
              disabled={quantity <= 1 || adding}
              onClick={() => setQuantity((value) => Math.max(1, value - 1))}
            >
              <RemoveRoundedIcon />
            </IconButton>
            <TextField
              aria-label="Cantidad"
              className="product-quantity-input"
              error={quantity > 0 && !quantityValid}
              inputProps={{ min: 1, max: isMadeToOrder ? undefined : stock, step: 1, inputMode: 'numeric' }}
              onChange={(event) => {
                const parsed = Number.parseInt(event.target.value, 10);
                setQuantity(Number.isFinite(parsed) ? parsed : 0);
              }}
              size="small"
              type="number"
              value={quantity}
            />
            <IconButton
              aria-label="Aumentar cantidad"
              className="product-quantity-button"
              disabled={adding || (!isMadeToOrder && quantity >= stock)}
              onClick={() => setQuantity((value) => value + 1)}
            >
              <AddRoundedIcon />
            </IconButton>
          </Box>
          {!isMadeToOrder && stock === 0 ? (
            <Typography className="product-stock-note" color="error" variant="caption">
              No hay unidades disponibles en este momento.
            </Typography>
          ) : null}
        </Box>

        <TextField
          className="product-note-field"
          fullWidth
          helperText={`${comment.length}/200 caracteres · opcional`}
          inputProps={{ maxLength: 200 }}
          label="Nota para la tienda (opcional)"
          multiline
          onChange={(event) => setComment(event.target.value)}
          placeholder="Ej.: sin cebolla, extra queso…"
          rows={2}
          value={comment}
        />

        <Box aria-live="polite" className="add-product-total" role="status">
          <Box className="detail-icon"><LocalMallOutlinedIcon /></Box>
          <Box className="add-product-total-copy">
            <Typography color="text.secondary" variant="caption">TOTAL ESTIMADO</Typography>
            <Typography className="add-product-total-value" variant="h5">
              {formatMoney(total, currency)}
            </Typography>
          </Box>
          <Typography className="add-product-unit-hint" color="text.secondary" variant="caption">
            {formatMoney(price, currency)} por unidad
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions className="product-dialog-actions">
        <Button disabled={adding} onClick={handleClose} variant="text">Seguir mirando</Button>
        <Button
          disabled={!quantityValid || adding || Boolean(auth?.userId && (!cartReady || cartBlocked))}
          onClick={submit}
          startIcon={adding ? null : <AddRoundedIcon />}
          variant="contained"
        >
          {adding ? 'Agregando…' : auth?.userId ? 'Agregar al carrito' : 'Iniciar sesión para comprar'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
