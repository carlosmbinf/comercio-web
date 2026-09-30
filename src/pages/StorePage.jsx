import React from 'react';
import { Alert, Box, Button, Chip, CircularProgress, FormControl, InputAdornment, MenuItem, Paper, Select, Skeleton, TextField, Typography } from '@mui/material';
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import StorefrontRoundedIcon from '@mui/icons-material/StorefrontRounded';
import { useOutletContext } from 'react-router-dom';

import { getCommerceDisplayName, isCompanyConfigured } from '../config';
import ProductCard from '../components/ProductCard';
import { selectStoresWithProducts } from '../domain/commerce';
import { UNCATEGORIZED_CATEGORY_ID, categoryIdsFor, getCatalogCategories, getPopulatedCategoryRows } from '../domain/categories';
import './store.css';

const getProductCategory = (product) => String(product?.idCategoria || '').trim();

export function StorePage() {
  const { cart, notify, storefront, user } = useOutletContext();
  const [search, setSearch] = React.useState('');
  const [selectedStore, setSelectedStore] = React.useState('all');
  const [availability, setAvailability] = React.useState('all');
  const [selectedCategory, setSelectedCategory] = React.useState('all');
  const [sort, setSort] = React.useState('recommended');
  const [clearingCart, setClearingCart] = React.useState(false);
  const [cartActionError, setCartActionError] = React.useState('');

  const storesById = React.useMemo(
    () => new Map(storefront.stores.map((store) => [String(store._id), store])),
    [storefront.stores],
  );
  const visibleStores = React.useMemo(
    () => selectStoresWithProducts(storefront.stores, storefront.products),
    [storefront.stores, storefront.products],
  );
  const categories = React.useMemo(
    () => getCatalogCategories(storefront.categories, user?.categoriasComercioInicio).filter((entry) => entry.visible),
    [storefront.categories, user?.categoriasComercioInicio],
  );
  const categoryIds = React.useMemo(
    () => new Map(categories.map((category) => [category.id, categoryIdsFor(storefront.categories, category.id)])),
    [categories, storefront.categories],
  );
  const categoryRows = React.useMemo(
    () => getPopulatedCategoryRows(categories, categoryIds, storefront.products),
    [categories, categoryIds, storefront.products],
  );
  const availableCount = storefront.products.filter(
    (product) => product?.productoDeElaboracion || Number(product?.count || 0) > 0,
  ).length;
  const filteredProducts = React.useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase('es');
    const filtered = storefront.products.filter((product) => {
      const storeId = String(product?.idTienda || '');
      const isAvailable = Boolean(product?.productoDeElaboracion) || Number(product?.count || 0) > 0;
      const isMadeToOrder = Boolean(product?.productoDeElaboracion);
      const category = getProductCategory(product);
      const store = storesById.get(storeId);
      const matchesStore = selectedStore === 'all' || storeId === selectedStore;
      const matchesAvailability = availability === 'all' || (availability === 'available' && isAvailable) || (availability === 'made' && isMadeToOrder);
      const matchesCategory = selectedCategory === 'all'
        || (selectedCategory === UNCATEGORIZED_CATEGORY_ID ? !category : categoryIds.get(selectedCategory)?.has(category));
      const matchesSearch = !normalizedSearch || [product?.name, product?.descripcion, store?.title]
        .some((value) => String(value || '').toLocaleLowerCase('es').includes(normalizedSearch));
      return matchesStore && matchesAvailability && matchesCategory && matchesSearch;
    });

    if (sort === 'price-asc') filtered.sort((a, b) => Number(a?.precio || 0) - Number(b?.precio || 0));
    if (sort === 'price-desc') filtered.sort((a, b) => Number(b?.precio || 0) - Number(a?.precio || 0));
    if (sort === 'name') filtered.sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || ''), 'es'));
    if (sort === 'recommended') filtered.sort((a, b) => new Date(b?.createdAt || 0) - new Date(a?.createdAt || 0));
    return filtered;
  }, [availability, categoryIds, search, selectedCategory, selectedStore, sort, storesById, storefront.products]);

  React.useEffect(() => {
    if (!storefront.loading && selectedCategory !== 'all' && !categoryRows.some((category) => category.id === selectedCategory)) setSelectedCategory('all');
  }, [categoryRows, selectedCategory, storefront.loading]);

  React.useEffect(() => {
    if (!storefront.loading && selectedStore !== 'all' && !visibleStores.some((store) => String(store._id) === selectedStore)) setSelectedStore('all');
  }, [selectedStore, storefront.loading, visibleStores]);

  const openCatalog = (storeId, categoryId) => {
    setSelectedStore(storeId);
    setSelectedCategory(categoryId);
    document.getElementById('catalogo')?.scrollIntoView({ behavior: 'smooth' });
  };

  const storeLabel = visibleStores.length === 1
    ? visibleStores[0]?.title || visibleStores[0]?.name || getCommerceDisplayName(storefront.stores)
    : 'Compra en las tiendas de tu empresa favorita';
  const isCartBlocked = cart.conflicts.foreignCommerceItems.length > 0 || cart.conflicts.incompatibleItems.length > 0;

  const handleClearConflictingItems = async () => {
    const itemCount = cart.conflicts.foreignCommerceItems.length + cart.conflicts.incompatibleItems.length;
    if (!itemCount || !window.confirm(`¿Eliminar ${itemCount === 1 ? 'el artículo' : `los ${itemCount} artículos`} que bloquean este carrito?`)) return;
    setClearingCart(true);
    setCartActionError('');
    try {
      await cart.clearConflictingItems();
    } catch (error) {
      setCartActionError(error?.reason || error?.message || 'No se pudo limpiar el carrito. Inténtalo de nuevo.');
    } finally {
      setClearingCart(false);
    }
  };

  return (
    <Box className="content-stack store-page">
      <section className="store-hero">
        <Box className="store-hero-copy">
          <Chip className="hero-kicker" icon={<CheckCircleOutlineRoundedIcon />} label="TU COMERCIO DE CONFIANZA" size="small" />
          <Typography className="store-hero-title" variant="h1">
            {visibleStores.length === 1 ? <>{storeLabel}<br /><span>en tu puerta.</span></> : <>Lo mejor de <span>tu comercio</span>, cerca de ti.</>}
          </Typography>
          <Typography className="store-hero-description" variant="body1">
            {visibleStores.length === 1
              ? visibleStores[0]?.descripcion || 'Explora el catálogo, elige tus favoritos y sigue tu pedido desde el mismo lugar.'
              : 'Explora sus tiendas, descubre productos seleccionados y recibe tus compras con seguimiento en tiempo real.'}
          </Typography>
          <Box className="store-hero-actions">
            <Button href="#catalogo" size="large" variant="contained">Explorar productos</Button>
            <Typography color="text.secondary" variant="body2"><ShieldOutlinedIcon fontSize="small" /> Compra protegida en {getCommerceDisplayName(storefront.stores)}</Typography>
          </Box>
        </Box>
        <Box aria-hidden="true" className="hero-art">
          <Box className="hero-orbit hero-orbit-one" />
          <Box className="hero-orbit hero-orbit-two" />
          <Box className="hero-bag"><ShoppingBagIllustration /></Box>
          <Paper className="hero-float-card hero-float-top" elevation={0}>
            <span className="float-dot green" />
              <Box className="hero-float-copy">
                <span>Pedido en camino</span>
                <strong>En tiempo real</strong>
              </Box>
          </Paper>
          <Paper className="hero-float-card hero-float-bottom" elevation={0}>
            <span className="float-rating">✦</span>
              <Box className="hero-float-copy">
                <span>Compra local</span>
                <strong>Hecho para ti</strong>
              </Box>
          </Paper>
        </Box>
      </section>

      {!isCompanyConfigured ? (
        <Alert severity="info">
          Esta tienda todavía está en preparación. Vuelve a intentarlo más tarde.
        </Alert>
      ) : null}

      <Box className="store-highlights">
        <Paper className="highlight-card" elevation={0}>
          <Box className="highlight-icon violet"><StorefrontRoundedIcon /></Box>
          <Box><Typography className="highlight-value">{visibleStores.length}</Typography><Typography color="text.secondary" variant="caption">{visibleStores.length === 1 ? 'TIENDA' : 'TIENDAS'}</Typography></Box>
        </Paper>
        <Paper className="highlight-card" elevation={0}>
          <Box className="highlight-icon orange"><CheckCircleOutlineRoundedIcon /></Box>
          <Box><Typography className="highlight-value">{availableCount}</Typography><Typography color="text.secondary" variant="caption">PRODUCTOS DISPONIBLES</Typography></Box>
        </Paper>
        <Paper className="highlight-card">
          <Box className="highlight-icon green"><LocalShippingOutlinedIcon /></Box>
          <Box><Typography className="highlight-word">A tu manera</Typography><Typography color="text.secondary" variant="caption">SEGUIMIENTO DE PEDIDOS</Typography></Box>
        </Paper>
      </Box>

      {visibleStores.length ? (
        <section className="storefront-discovery" aria-label="Explorar por tiendas y categorías">
          <Typography variant="h4">Explora por tiendas</Typography>
          {visibleStores.map((store) => {
            const items = storefront.products.filter((product) => String(product.idTienda) === String(store._id));
            return (
              <Box className="discovery-section" key={store._id}>
                <Box className="discovery-heading">
                  <Typography variant="h6">{store.title || store.name || 'Tienda'}</Typography>
                  <Button onClick={() => openCatalog(String(store._id), 'all')}>Ver todos ({items.length})</Button>
                </Box>
                <Box className="discovery-scroller">
                  {items.slice(0, 6).map((product) => (
                    <Box className="discovery-item" key={product._id}>
                      <ProductCard cartBlocked={isCartBlocked} cartReady={cart.ready} onAdd={cart.addProduct} onNotify={notify} product={product} store={store} />
                    </Box>
                  ))}
                </Box>
              </Box>
            );
          })}
          {categoryRows.length ? <Typography variant="h4">Explora por categorías</Typography> : null}
          {categoryRows.map((category) => (
            <Box className="discovery-section" key={category.id}>
              <Box className="discovery-heading">
                <Typography variant="h6">{category.label}</Typography>
                <Button onClick={() => openCatalog('all', category.id)}>Ver todos ({category.items.length})</Button>
              </Box>
              <Box className="discovery-scroller">
                {category.items.slice(0, 6).map((product) => (
                  <Box className="discovery-item" key={product._id}>
                    <ProductCard cartBlocked={isCartBlocked} cartReady={cart.ready} onAdd={cart.addProduct} onNotify={notify} product={product} store={storesById.get(String(product.idTienda))} />
                  </Box>
                ))}
              </Box>
            </Box>
          ))}
        </section>
      ) : null}

      <section className="catalog-section" id="catalogo">
        <Box className="catalog-heading">
          <Box>
            <Typography className="eyebrow" variant="overline">CATÁLOGO SELECCIONADO</Typography>
            <Typography variant="h3">Encuentra algo que te encante</Typography>
            <Typography color="text.secondary">Productos de las tiendas pertenecientes a esta empresa.</Typography>
          </Box>
          <Chip className="catalog-count" label={`${filteredProducts.length} productos`} variant="outlined" />
        </Box>

        {isCartBlocked ? (
          <Alert
            action={(
              <Button
                color="inherit"
                disabled={clearingCart || cart.loading}
                onClick={handleClearConflictingItems}
                size="small"
                startIcon={clearingCart ? <CircularProgress color="inherit" size={15} /> : <DeleteOutlineRoundedIcon />}
                sx={{ whiteSpace: 'nowrap' }}
              >
                {clearingCart ? 'Limpiando…' : 'Limpiar carrito'}
              </Button>
            )}
            className="cart-conflict-alert"
            severity="warning"
          >
            {cart.conflicts.foreignCommerceItems.length
              ? 'Tu carrito tiene productos de otra tienda. Para evitar mezclar empresas, finaliza o retira esa compra desde donde la agregaste antes de continuar aquí.'
              : 'Tu carrito contiene una compra de otro tipo. Finalízala o cancélala antes de comprar en este comercio.'}
          </Alert>
        ) : null}
        {cartActionError ? <Alert className="cart-conflict-alert" onClose={() => setCartActionError('')} severity="error">{cartActionError}</Alert> : null}

        <Paper className="catalog-toolbar" elevation={0}>
          <TextField
            className="catalog-search"
            fullWidth
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Busca productos en esta tienda…"
            value={search}
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchRoundedIcon /></InputAdornment> }}
          />
          <FormControl className="catalog-sort" size="small">
            <Select aria-label="Ordenar productos" onChange={(event) => setSort(event.target.value)} value={sort}>
              <MenuItem value="recommended">Recomendados</MenuItem>
              <MenuItem value="name">Nombre</MenuItem>
              <MenuItem value="price-asc">Precio: menor a mayor</MenuItem>
              <MenuItem value="price-desc">Precio: mayor a menor</MenuItem>
            </Select>
          </FormControl>
        </Paper>

        <Box className="filter-row" aria-label="Filtros del catálogo">
          <Box className="filter-scroller">
            <Button className={selectedStore === 'all' ? 'filter-pill selected' : 'filter-pill'} onClick={() => setSelectedStore('all')}>Todas las tiendas</Button>
            {visibleStores.map((store) => (
              <Button
                className={selectedStore === String(store._id) ? 'filter-pill selected' : 'filter-pill'}
                key={store._id}
                onClick={() => setSelectedStore(String(store._id))}
              >
                {store.title || store.name || 'Tienda'}
              </Button>
            ))}
          </Box>
          <Box className="filter-scroller secondary-filters">
            {[
              { label: 'Todos', value: 'all' },
              { label: 'Disponibles', value: 'available' },
              { label: 'Por encargo', value: 'made' },
            ].map((filter) => (
              <Chip
                clickable
                color={availability === filter.value ? 'primary' : 'default'}
                key={filter.value}
                label={filter.label}
                onClick={() => setAvailability(filter.value)}
                variant={availability === filter.value ? 'filled' : 'outlined'}
              />
            ))}
            {categoryRows.map((category) => (
              <Chip
                clickable
                color={selectedCategory === category.id ? 'primary' : 'default'}
                key={category.id}
                label={category.label}
                onClick={() => setSelectedCategory((current) => current === category.id ? 'all' : category.id)}
                variant={selectedCategory === category.id ? 'filled' : 'outlined'}
              />
            ))}
          </Box>
        </Box>

        {storefront.loading ? (
          <Box className="product-grid" aria-label="Cargando catálogo">
            {Array.from({ length: 8 }, (_, index) => (
              <Paper className="product-skeleton" elevation={0} key={index}>
                <Skeleton animation="wave" height={150} variant="rounded" />
                <Skeleton animation="wave" height={28} sx={{ mt: 1 }} width="65%" />
                <Skeleton animation="wave" height={22} width="90%" />
                <Skeleton animation="wave" height={42} sx={{ mt: 1 }} width="100%" />
              </Paper>
            ))}
          </Box>
        ) : !isCompanyConfigured ? (
          <Paper className="catalog-empty" elevation={0}>
            <Box className="empty-state-icon"><StorefrontRoundedIcon /></Box>
            <Typography variant="h5">Tu escaparate está preparado</Typography>
            <Typography color="text.secondary">Configura el ID del propietario o de una de sus tiendas para cargar únicamente el catálogo de esa empresa.</Typography>
          </Paper>
        ) : !storefront.stores.length ? (
          <Paper className="catalog-empty" elevation={0}>
            <Box className="empty-state-icon"><StorefrontRoundedIcon /></Box>
            <Typography variant="h5">No encontramos tiendas para esta empresa</Typography>
            <Typography color="text.secondary">Verifica que el ID configurado corresponda al propietario o a una tienda existente de la empresa.</Typography>
          </Paper>
        ) : !filteredProducts.length ? (
          <Paper className="catalog-empty" elevation={0}>
            <Box className="empty-state-icon"><SearchRoundedIcon /></Box>
            <Typography variant="h5">No hay productos con esos filtros</Typography>
            <Typography color="text.secondary">Prueba otra búsqueda o vuelve a mostrar el catálogo completo.</Typography>
            <Button onClick={() => { setSearch(''); setAvailability('all'); setSelectedCategory('all'); setSelectedStore('all'); }} variant="outlined">Limpiar filtros</Button>
          </Paper>
        ) : (
          <Box className="product-grid">
            {filteredProducts.map((product, index) => (
              <div className="product-entry" key={product._id} style={{ animationDelay: `${Math.min(index * 35, 350)}ms` }}>
                <ProductCard
                  cartBlocked={isCartBlocked}
                  cartReady={cart.ready}
                  onAdd={cart.addProduct}
                  onNotify={notify}
                  product={product}
                  store={storesById.get(String(product.idTienda))}
                />
              </div>
            ))}
          </Box>
        )}
      </section>
    </Box>
  );
}

function ShoppingBagIllustration() {
  return (
    <svg aria-hidden="true" viewBox="0 0 160 170" width="132" xmlns="http://www.w3.org/2000/svg">
      <path d="M29 51h102l-9 103H38L29 51Z" fill="url(#bag-gradient)" />
      <path d="M55 60V43c0-15 11-27 25-27s25 12 25 27v17" fill="none" stroke="#fff" strokeLinecap="round" strokeWidth="9" />
      <path d="M59 96c7 10 13 15 21 15s15-5 21-15" fill="none" stroke="#fff" strokeLinecap="round" strokeWidth="6" />
      <defs><linearGradient id="bag-gradient" x1="30" x2="130" y1="45" y2="155" gradientUnits="userSpaceOnUse"><stop stopColor="#AA88FF"/><stop offset="1" stopColor="#653BCB"/></linearGradient></defs>
    </svg>
  );
}
