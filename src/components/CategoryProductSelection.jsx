import React from 'react';
import { Alert, Box, Button, Chip, Paper, Skeleton, Typography } from '@mui/material';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import ShuffleRoundedIcon from '@mui/icons-material/ShuffleRounded';
import { CATEGORY_SELECTION_LIMIT } from '../domain/categories';
import { useCategorySelection } from '../hooks/useStorefront';
import ProductCard from './ProductCard';

export default function CategoryProductSelection({ category, storefront, storesById, cart, cartBlocked, notify, onSelect, viewMode }) {
  const sectionRef = React.useRef(null);
  const instanceId = React.useId();
  const [visible, setVisible] = React.useState(false);
  const [revision, setRevision] = React.useState(0);
  const selectionKey = `${instanceId}-${revision}`;
  const { products, loading, error } = useCategorySelection({
    enabled: visible,
    ownerId: storefront.companyId,
    rootId: category.id,
    selectionKey,
    categories: storefront.categories,
    storeIds: storefront.storeIds,
  });

  React.useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return undefined;
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      setVisible(true);
      observer.disconnect();
    }, { rootMargin: '240px' });
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  // Esperar a la carga real: las secciones fuera de pantalla aún no se consultaron.
  if (visible && !loading && !error && products.length === 0) return null;

  return (
    <Box component="section" className="category-product-section" ref={sectionRef} aria-label={category.name || category.label}>
      <Box className="category-product-heading">
        <Box>
          <Typography component="h2" variant="h5" className="catalog-bar-title">{category.name || category.label}</Typography>
          <Typography color="text.secondary" variant="body2">Una selección para descubrir, incluyendo sus subcategorías.</Typography>
        </Box>
        <Box className="category-product-actions">
          <Chip label={visible && !loading && !error ? `${products.length} productos` : `Hasta ${CATEGORY_SELECTION_LIMIT} productos`} size="small" variant="outlined" />
          <Button aria-label={`Otra selección de ${category.name || category.label}`} disabled={!visible || (loading && !error)} onClick={() => setRevision((value) => value + 1)} size="small" startIcon={<ShuffleRoundedIcon />}>Otra selección</Button>
          <Button onClick={() => onSelect(category.id)} size="small" endIcon={<ArrowForwardRoundedIcon />}>Ver categoría</Button>
        </Box>
      </Box>
      {error ? (
        <Alert severity="warning" action={<Button color="inherit" onClick={() => setRevision((value) => value + 1)}>Reintentar</Button>}>{error}</Alert>
      ) : !visible || loading ? (
        <Box className={`product-grid ${viewMode}`} aria-label={`Cargando ${category.name || category.label}`}>
          {Array.from({ length: 3 }, (_, index) => (
            <Paper className="product-skeleton" elevation={0} key={index}>
              <Skeleton height={118} variant="rounded" />
              <Skeleton height={24} width="85%" />
              <Skeleton height={34} width="60%" />
            </Paper>
          ))}
        </Box>
      ) : (
        <Box className={`product-grid ${viewMode}`}>
          {products.map((product) => (
            <ProductCard key={product._id} product={product} store={storesById.get(String(product.idTienda))} cartBlocked={cartBlocked} cartReady={cart.ready} compact={viewMode === 'compact'} onAdd={cart.addProduct} onNotify={notify} />
          ))}
        </Box>
      )}
    </Box>
  );
}
