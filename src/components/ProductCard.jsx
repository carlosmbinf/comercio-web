import React from 'react';
import { Box, Button, Card, CardActionArea, CardContent, Chip, Typography } from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import BrokenImageOutlinedIcon from '@mui/icons-material/BrokenImageOutlined';
import LocalFloristOutlinedIcon from '@mui/icons-material/LocalFloristOutlined';
import { callMeteor } from '../meteor/client';
import { METEOR_HTTP_URL } from '../config';
import { formatMoney } from '../domain/commerce';
import AddProductDialog from './AddProductDialog';
import ProductImageCarousel from './ProductImageCarousel';

const productImagesCache = new Map();

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

export default function ProductCard({ cartBlocked, cartReady, compact = true, onAdd, onNotify, product, store }) {
  const cardRef = React.useRef(null);
  const productId = String(product?._id || '');
  const [isVisible, setIsVisible] = React.useState(() => productImagesCache.has(productId));
  const [images, setImages] = React.useState(() => {
    if (productImagesCache.has(productId)) return productImagesCache.get(productId);
    const legacyUrl = normalizeImageUrl(product?.imageUrl || product?.urlImagen || product?.imagenUrl || '');
    return legacyUrl ? [{ id: `legacy-${productId}`, url: legacyUrl }] : [];
  });
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [adding, setAdding] = React.useState(false);
  const isMadeToOrder = Boolean(product?.productoDeElaboracion);
  const stock = Math.max(0, Number(product?.count) || 0);
  const available = isMadeToOrder || stock > 0;
  const productName = product?.name || 'Producto de comercio';
  const availabilityLabel = isMadeToOrder
    ? 'Por encargo'
    : stock === 0
      ? 'Agotado'
      : stock <= 5
        ? `Quedan ${stock}`
        : `${stock} disp.`;
  const statusTone = isMadeToOrder ? 'violet' : stock === 0 ? 'muted' : stock <= 5 ? 'orange' : 'green';

  React.useEffect(() => {
    if (isVisible || typeof IntersectionObserver === 'undefined') {
      setIsVisible(true);
      return undefined;
    }
    const element = cardRef.current;
    if (!element) {
      setIsVisible(true);
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '140px' },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [isVisible, productId]);

  React.useEffect(() => {
    if (!productId || !isVisible) return undefined;
    if (productImagesCache.has(productId)) {
      setImages(productImagesCache.get(productId));
      return undefined;
    }

    let active = true;

    const loadImages = async () => {
      try {
        const result = await callMeteor('comercio.getProductImages', productId);
        const gallery = (Array.isArray(result) ? result : [])
          .map((image) => ({ ...image, url: normalizeImageUrl(image?.url) }))
          .filter((image) => image.url);
        if (gallery.length) {
          productImagesCache.set(productId, gallery);
          if (active) setImages(gallery);
          return;
        }
      } catch (_error) {
        // Compatibilidad temporal con servidores que solo ofrecen la API singular.
      }

      try {
        const legacyUrl = normalizeImageUrl(await callMeteor('findImgbyProduct', productId));
        const fallbackGallery = legacyUrl ? [{ id: `legacy-${productId}`, url: legacyUrl }] : [];
        productImagesCache.set(productId, fallbackGallery);
        if (active) setImages(fallbackGallery);
      } catch (_error) {
        if (active) setImages([]);
      }
    };

    loadImages();

    return () => {
      active = false;
    };
  }, [isVisible, productId, product?.imageUrl, product?.urlImagen, product?.imagenUrl]);

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
      <Card className={compact ? 'product-card compact' : 'product-card comfortable'} elevation={0} ref={cardRef}>
        <CardActionArea
          aria-label={`Ver detalles de ${productName}`}
          className="product-card-action"
          disableRipple
          onClick={() => setDialogOpen(true)}
        >
          <Box className="product-media">
            <ProductImageCarousel
              alt={productName}
              fallback={(
                <Box className="product-image-fallback">
                  {product?.name ? <span>{String(product.name).trim().slice(0, 1).toUpperCase()}</span> : <BrokenImageOutlinedIcon />}
                </Box>
              )}
              imageClassName="product-image"
              images={images}
            />
            {isMadeToOrder ? (
              <Chip className="product-ribbon" icon={<LocalFloristOutlinedIcon />} label="Encargo" size="small" />
            ) : stock <= 5 ? (
              <Chip
                className="product-stock-chip"
                color={stock === 0 ? 'default' : 'warning'}
                label={stock === 0 ? 'Agotado' : `Últimas ${stock}`}
                size="small"
              />
            ) : null}
          </Box>
          <CardContent className="product-content">
            <Box className="product-card-meta-top">
              <Typography className="product-store-name" noWrap variant="caption">
                {store?.title || store?.name || 'Comercio'}
              </Typography>
              <span className={`product-availability-pill ${statusTone}`}>
                {availabilityLabel}
              </span>
            </Box>
            <Typography className="product-name" title={productName} variant="subtitle2">
              {productName}
            </Typography>
          </CardContent>
        </CardActionArea>

        <Box className="product-card-bottom-bar">
          <Box className="product-price-block">
            <Typography className="product-price" variant="subtitle1">
              {formatMoney(product?.precio, product?.monedaPrecio || 'USD')}
            </Typography>
          </Box>
          <Button
            aria-label={available ? `Elegir cantidad de ${productName}` : `Ver detalles de ${productName}`}
            className="product-open-button"
            disableRipple
            onClick={() => setDialogOpen(true)}
            size="small"
            startIcon={available ? <AddRoundedIcon fontSize="small" /> : undefined}
            variant={available ? 'contained' : 'outlined'}
          >
            {available ? 'Pedir' : 'Ver'}
          </Button>
        </Box>
      </Card>

      <AddProductDialog
        adding={adding}
        cartBlocked={cartBlocked}
        cartReady={cartReady}
        images={images}
        onAdd={handleAdd}
        onClose={() => setDialogOpen(false)}
        open={dialogOpen}
        product={product}
        store={store}
      />
    </>
  );
}
