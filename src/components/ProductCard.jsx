import React from 'react';
import { Box, Button, Card, CardActionArea, CardContent, Chip, Typography } from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import BrokenImageOutlinedIcon from '@mui/icons-material/BrokenImageOutlined';
import LocalFloristOutlinedIcon from '@mui/icons-material/LocalFloristOutlined';
import { callMeteor } from '../meteor/client';
import { METEOR_HTTP_URL } from '../config';
import { formatMoney } from '../domain/commerce';
import AddProductDialog from './AddProductDialog';

function normalizeImageUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return '';
  const replaced = value.trim().replace(/^http:\/\/localhost:3000/i, METEOR_HTTP_URL);
  try {
    const url = new URL(replaced, METEOR_HTTP_URL || window.location.origin);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch (_error) {
    return '';
  }
}

export default function ProductCard({ cartBlocked, cartReady, onAdd, onNotify, product, store }) {
  const [imageUrl, setImageUrl] = React.useState(() => normalizeImageUrl(
    product?.imageUrl || product?.urlImagen || product?.imagenUrl || '',
  ));
  const [imageFailed, setImageFailed] = React.useState(false);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [adding, setAdding] = React.useState(false);
  const isMadeToOrder = Boolean(product?.productoDeElaboracion);
  const stock = Math.max(0, Number(product?.count) || 0);
  const available = isMadeToOrder || stock > 0;
  const productName = product?.name || 'Producto de comercio';
  const availabilityLabel = isMadeToOrder
    ? 'Hecho por encargo'
    : stock === 0
      ? 'Agotado'
      : stock <= 5
        ? `${stock} disponibles`
        : 'Disponible';

  React.useEffect(() => {
    let active = true;
    setImageFailed(false);

    if (imageUrl) return () => { active = false; };

    callMeteor('findImgbyProduct', product._id)
      .then((url) => {
        if (active && url) setImageUrl(normalizeImageUrl(url));
      })
      .catch(() => null);

    return () => { active = false; };
  }, [imageUrl, product._id]);

  const handleAdd = async (quantity, comment) => {
    setAdding(true);
    try {
      await onAdd(product, quantity, comment);
      onNotify?.(`${product.name} se agregó al carrito.`);
      setDialogOpen(false);
    } catch (error) {
      onNotify?.(error?.reason || error?.message || 'No se pudo agregar el producto.');
    } finally {
      setAdding(false);
    }
  };

  return (
    <>
      <Card className="product-card" elevation={0}>
        <CardActionArea
          aria-label={`Ver detalles de ${productName}`}
          className="product-card-action"
          onClick={() => setDialogOpen(true)}
        >
          <Box className="product-media">
            {imageUrl && !imageFailed ? (
              <img
                alt={productName}
                className="product-image"
                loading="lazy"
                onError={() => setImageFailed(true)}
                src={imageUrl}
              />
            ) : (
              <Box className="product-image-fallback">
                {product?.name ? <span>{String(product.name).trim().slice(0, 1).toUpperCase()}</span> : <BrokenImageOutlinedIcon />}
              </Box>
            )}
            {isMadeToOrder ? (
              <Chip className="product-ribbon" icon={<LocalFloristOutlinedIcon />} label="Por encargo" size="small" />
            ) : stock <= 5 ? (
              <Chip
                className="product-stock-chip"
                color={stock === 0 ? 'default' : 'success'}
                label={stock === 0 ? 'Agotado' : `Últimas ${stock} unid.`}
                size="small"
              />
            ) : null}
          </Box>
          <CardContent className="product-content">
            <Typography className="product-store-name" noWrap variant="caption">
              {store?.title || store?.name || 'Comercio'}
            </Typography>
            <Typography className="product-name" title={productName} variant="subtitle1">
              {productName}
            </Typography>
            <Box className="product-card-summary">
              <Typography className="product-price" variant="h6">
                {formatMoney(product?.precio, product?.monedaPrecio || 'USD')}
              </Typography>
              <Typography className="product-availability" color="text.secondary" variant="caption">
                {availabilityLabel}
              </Typography>
            </Box>
          </CardContent>
        </CardActionArea>
        <Box className="product-card-footer">
          <Button
            aria-label={available ? `Elegir cantidad de ${productName}` : `Ver detalles de ${productName}`}
            className="product-open-button"
            fullWidth
            onClick={() => setDialogOpen(true)}
            startIcon={available ? <AddRoundedIcon /> : undefined}
            variant={available ? 'contained' : 'outlined'}
          >
            {available ? 'Elegir cantidad' : 'Ver detalles'}
          </Button>
        </Box>
      </Card>

      <AddProductDialog
        adding={adding}
        cartBlocked={cartBlocked}
        cartReady={cartReady}
        imageUrl={imageUrl && !imageFailed ? imageUrl : ''}
        onAdd={handleAdd}
        onClose={() => setDialogOpen(false)}
        open={dialogOpen}
        product={product}
        store={store}
      />
    </>
  );
}
