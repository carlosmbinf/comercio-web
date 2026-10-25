import React from 'react';
import {
  Alert,
  Badge,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Drawer,
  FormControl,
  IconButton,
  InputAdornment,
  MenuItem,
  Paper,
  Select,
  Skeleton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import CategoryOutlinedIcon from '@mui/icons-material/CategoryOutlined';
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import ExpandLessRoundedIcon from '@mui/icons-material/ExpandLessRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import FilterAltOffRoundedIcon from '@mui/icons-material/FilterAltOffRounded';
import GridViewRoundedIcon from '@mui/icons-material/GridViewRounded';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import RestartAltRoundedIcon from '@mui/icons-material/RestartAltRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import StorefrontRoundedIcon from '@mui/icons-material/StorefrontRounded';
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';
import ViewAgendaOutlinedIcon from '@mui/icons-material/ViewAgendaOutlined';
import { useOutletContext } from 'react-router-dom';

import { getCommerceDisplayName, isCompanyConfigured } from '../config';
import ProductCard from '../components/ProductCard';
import { CATALOG_LIMIT_STEP, INITIAL_CATALOG_LIMIT, MAX_CATALOG_LIMIT } from '../domain/commerce';
import { UNCATEGORIZED_CATEGORY_ID, categoryIdsFor, getCatalogCategories } from '../domain/categories';
import { useCatalogProducts } from '../hooks/useStorefront';
import './store.css';

const AVAILABILITY_OPTIONS = [
  { label: 'Todos los productos', shortLabel: 'Todos', value: 'all' },
  { label: 'En stock inmediato', shortLabel: 'Disponibles', value: 'available' },
  { label: 'Hechos por encargo', shortLabel: 'Por encargo', value: 'made' },
];

const SORT_OPTIONS = [
  { label: 'Recomendados', value: 'recommended' },
  { label: 'Nombre (A-Z)', value: 'name' },
  { label: 'Precio: menor a mayor', value: 'price-asc' },
  { label: 'Precio: mayor a menor', value: 'price-desc' },
];

const CURRENCY_OPTIONS = ['CUP', 'UYU', 'USD'];

export function StorePage() {
  const { cart, notify, storefront, user } = useOutletContext();
  const [search, setSearch] = React.useState('');
  const [debouncedSearch, setDebouncedSearch] = React.useState('');
  const [selectedStore, setSelectedStore] = React.useState('all');
  const [availability, setAvailability] = React.useState('all');
  const [selectedCategory, setSelectedCategory] = React.useState('all');
  const [selectedCurrency, setSelectedCurrency] = React.useState('all');
  const [minPrice, setMinPrice] = React.useState('');
  const [maxPrice, setMaxPrice] = React.useState('');
  const [sort, setSort] = React.useState('recommended');
  const [limit, setLimit] = React.useState(INITIAL_CATALOG_LIMIT);
  const [viewMode, setViewMode] = React.useState('compact');
  const [filterDrawerOpen, setFilterDrawerOpen] = React.useState(false);
  const [categorySearch, setCategorySearch] = React.useState('');
  const [drawerCategoryLimit, setDrawerCategoryLimit] = React.useState(10);
  const [clearingCart, setClearingCart] = React.useState(false);
  const [cartActionError, setCartActionError] = React.useState('');

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 260);
    return () => window.clearTimeout(timer);
  }, [search]);

  React.useEffect(() => {
    setLimit(INITIAL_CATALOG_LIMIT);
  }, [
    availability,
    debouncedSearch,
    maxPrice,
    minPrice,
    selectedCategory,
    selectedCurrency,
    selectedStore,
    sort,
  ]);

  const storesById = React.useMemo(
    () => new Map(storefront.stores.map((store) => [String(store._id), store])),
    [storefront.stores],
  );
  const visibleStores = storefront.stores;
  const categories = React.useMemo(
    () => getCatalogCategories(storefront.categories, user?.categoriasComercioInicio).filter((entry) => entry.visible),
    [storefront.categories, user?.categoriasComercioInicio],
  );
  const categoryIds = React.useMemo(
    () => new Map(categories.map((category) => [category.id, categoryIdsFor(storefront.categories, category.id)])),
    [categories, storefront.categories],
  );
  const categoryOptions = React.useMemo(
    () => [...categories, { id: UNCATEGORIZED_CATEGORY_ID, label: 'Sin categoría', visible: true }],
    [categories],
  );

  const catalogState = useCatalogProducts({
    availability,
    categories: storefront.categories,
    categoryIds,
    limit,
    maxPrice,
    minPrice,
    search: debouncedSearch,
    selectedCategory,
    selectedCurrency,
    selectedStore,
    sort,
    storeIds: storefront.storeIds,
    uncategorizedId: UNCATEGORIZED_CATEGORY_ID,
  });

  const filteredProducts = catalogState.products;
  const isInitialLoading = Boolean(storefront.loading || (catalogState.loading && !filteredProducts.length));

  const quickCategories = React.useMemo(() => {
    const activeCatIds = new Set(
      [...storefront.products, ...filteredProducts]
        .map((product) => String(product?.idCategoria || '').trim())
        .filter(Boolean),
    );
    const hasUncategorized = [...storefront.products, ...filteredProducts].some(
      (product) => !String(product?.idCategoria || '').trim(),
    );

    const prioritized = [];
    const seen = new Set();
    const pushUnique = (cat) => {
      if (!cat || seen.has(cat.id)) return;
      seen.add(cat.id);
      prioritized.push(cat);
    };

    if (selectedCategory !== 'all') {
      pushUnique(categoryOptions.find((cat) => cat.id === selectedCategory));
    }
    categories.filter((cat) => activeCatIds.has(cat.id)).forEach(pushUnique);
    if (hasUncategorized) {
      pushUnique({ id: UNCATEGORIZED_CATEGORY_ID, label: 'Sin categoría', visible: true });
    }
    categories.filter((cat) => !cat.label.includes(' › ')).slice(0, 6).forEach(pushUnique);

    return prioritized.slice(0, 6);
  }, [categories, categoryOptions, filteredProducts, selectedCategory, storefront.products]);

  const filteredDrawerCategories = React.useMemo(() => {
    const q = categorySearch.trim().toLocaleLowerCase('es');
    if (!q) return categoryOptions;
    return categoryOptions.filter((cat) => cat.label.toLocaleLowerCase('es').includes(q));
  }, [categoryOptions, categorySearch]);

  React.useEffect(() => {
    if (!storefront.loading && selectedCategory !== 'all' && !categoryOptions.some((category) => category.id === selectedCategory)) {
      setSelectedCategory('all');
    }
  }, [categoryOptions, selectedCategory, storefront.loading]);

  React.useEffect(() => {
    if (!storefront.loading && selectedStore !== 'all' && !visibleStores.some((store) => String(store._id) === selectedStore)) {
      setSelectedStore('all');
    }
  }, [selectedStore, storefront.loading, visibleStores]);

  const activeFiltersCount = React.useMemo(() => {
    let count = 0;
    if (selectedStore !== 'all') count += 1;
    if (selectedCategory !== 'all') count += 1;
    if (availability !== 'all') count += 1;
    if (selectedCurrency !== 'all') count += 1;
    if (minPrice !== '' || maxPrice !== '') count += 1;
    if (sort !== 'recommended') count += 1;
    return count;
  }, [availability, maxPrice, minPrice, selectedCategory, selectedCurrency, selectedStore, sort]);

  const hasAnyFilter = activeFiltersCount > 0 || search.trim().length > 0;

  const resetAllFilters = () => {
    setSearch('');
    setDebouncedSearch('');
    setSelectedStore('all');
    setSelectedCategory('all');
    setAvailability('all');
    setSelectedCurrency('all');
    setMinPrice('');
    setMaxPrice('');
    setSort('recommended');
    setLimit(INITIAL_CATALOG_LIMIT);
  };

  const scrollToCatalog = () => {
    document.getElementById('catalogo')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const selectCategoryFromSubheader = (categoryId) => {
    setSelectedCategory((current) => (current === categoryId && categoryId !== 'all' ? 'all' : categoryId));
  };

  const storeLabel = visibleStores.length === 1
    ? visibleStores[0]?.title || visibleStores[0]?.name || getCommerceDisplayName(storefront.stores)
    : getCommerceDisplayName(storefront.stores);
  const isCartBlocked = cart.conflicts.foreignCommerceItems.length > 0 || cart.conflicts.incompatibleItems.length > 0;
  const selectedCategoryObj = categoryOptions.find((cat) => cat.id === selectedCategory);
  const selectedStoreObj = visibleStores.find((st) => String(st._id) === selectedStore);

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
      {/* SEGUNDO HEADER PROFESIONAL: Búsqueda rápida, categorías y botón de filtros (Drawer) */}
      <Paper
        aria-label="Barra de categorías y filtros del catálogo"
        className="store-subheader"
        component="section"
        elevation={0}
      >
        <Box className="store-subheader-top">
          <Button
            aria-label="Abrir panel de filtros"
            className={activeFiltersCount > 0 ? 'subheader-filter-trigger active' : 'subheader-filter-trigger'}
            onClick={() => setFilterDrawerOpen(true)}
            startIcon={
              <Badge badgeContent={activeFiltersCount} color="primary">
                <TuneRoundedIcon fontSize="small" />
              </Badge>
            }
            variant="outlined"
          >
            Filtros
          </Button>

          <TextField
            className="subheader-search"
            onChange={(event) => setSearch(event.target.value)}
            placeholder={`Buscar en ${storeLabel} por producto o descripción…`}
            size="small"
            value={search}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchRoundedIcon fontSize="small" />
                </InputAdornment>
              ),
              endAdornment: search ? (
                <InputAdornment position="end">
                  <IconButton aria-label="Limpiar búsqueda" edge="end" onClick={() => setSearch('')} size="small">
                    <CloseRoundedIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ) : null,
            }}
          />

          <Box className="subheader-right-controls">
            <FormControl className="subheader-sort" size="small">
              <Select
                aria-label="Ordenar productos"
                onChange={(event) => setSort(event.target.value)}
                value={sort}
              >
                {SORT_OPTIONS.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Box className="subheader-density-toggle" role="group" aria-label="Tamaño de tarjetas">
              <Tooltip title="Vista compacta">
                <IconButton
                  aria-label="Vista compacta"
                  className={viewMode === 'compact' ? 'density-btn active' : 'density-btn'}
                  onClick={() => setViewMode('compact')}
                  size="small"
                >
                  <GridViewRoundedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Vista cómoda">
                <IconButton
                  aria-label="Vista cómoda"
                  className={viewMode === 'comfortable' ? 'density-btn active' : 'density-btn'}
                  onClick={() => setViewMode('comfortable')}
                  size="small"
                >
                  <ViewAgendaOutlinedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>
        </Box>

        <Box className="store-subheader-categories" role="navigation" aria-label="Explorar por categorías">
          <Box className="subheader-categories-track">
            <Chip
              clickable
              className={selectedCategory === 'all' ? 'subheader-cat-chip active' : 'subheader-cat-chip'}
              icon={<CategoryOutlinedIcon fontSize="small" />}
              label="Destacados"
              onClick={() => selectCategoryFromSubheader('all')}
              size="small"
            />
            {quickCategories.map((category) => {
              const active = selectedCategory === category.id;
              return (
                <Chip
                  clickable
                  className={active ? 'subheader-cat-chip active' : 'subheader-cat-chip'}
                  key={category.id}
                  label={category.label}
                  onClick={() => selectCategoryFromSubheader(category.id)}
                  size="small"
                />
              );
            })}
            {categoryOptions.length > quickCategories.length ? (
              <Chip
                clickable
                className="subheader-cat-chip more"
                icon={<TuneRoundedIcon fontSize="small" />}
                label="Ver más categorías…"
                onClick={() => setFilterDrawerOpen(true)}
                size="small"
              />
            ) : null}
          </Box>

          {visibleStores.length > 1 ? (
            <Box className="subheader-stores-strip">
              <Typography className="subheader-strip-label" variant="caption">
                Tiendas:
              </Typography>
              <button
                className={selectedStore === 'all' ? 'subheader-store-pill active' : 'subheader-store-pill'}
                onClick={() => setSelectedStore('all')}
                type="button"
              >
                Todas ({visibleStores.length})
              </button>
              {visibleStores.map((store) => {
                const id = String(store._id);
                return (
                  <button
                    className={selectedStore === id ? 'subheader-store-pill active' : 'subheader-store-pill'}
                    key={id}
                    onClick={() => setSelectedStore((curr) => (curr === id ? 'all' : id))}
                    type="button"
                  >
                    <StorefrontRoundedIcon sx={{ fontSize: 13 }} />
                    <span>{store.title || store.name || 'Tienda'}</span>
                  </button>
                );
              })}
            </Box>
          ) : null}
        </Box>
      </Paper>

      {/* BANNER EJECUTIVO COMPACTO */}
      <section className="store-compact-banner">
        <Box className="store-compact-banner-main">
          <Chip
            className="hero-kicker"
            icon={<CheckCircleOutlineRoundedIcon />}
            label="CARGA BAJO DEMANDA · SEGUIMIENTO EN TIEMPO REAL"
            size="small"
          />
          <Typography className="store-compact-banner-title" variant="h2">
            {visibleStores.length === 1 ? (
              <>
                {storeLabel} <span>en tu puerta.</span>
              </>
            ) : (
              <>
                Catálogo oficial de <span>{storeLabel}</span>
              </>
            )}
          </Typography>
          <Typography className="store-compact-banner-desc" variant="body2">
            {visibleStores.length === 1
              ? visibleStores[0]?.descripcion || 'Selecciona una categoría, busca un producto o carga más resultados según lo que necesites.'
              : 'Elige una categoría o sucursal arriba para consultar sus productos al instante sin recargar toda la tienda.'}
          </Typography>
        </Box>

        <Box className="store-compact-kpis">
          <Box className="store-compact-kpi">
            <Box className="highlight-icon violet"><StorefrontRoundedIcon fontSize="small" /></Box>
            <Box>
              <strong>{visibleStores.length}</strong>
              <span>{visibleStores.length === 1 ? 'Sucursal' : 'Sucursales'}</span>
            </Box>
          </Box>
          <Box className="store-compact-kpi">
            <Box className="highlight-icon orange"><CheckCircleOutlineRoundedIcon fontSize="small" /></Box>
            <Box>
              <strong>{INITIAL_CATALOG_LIMIT}</strong>
              <span>Por bloque inicial</span>
            </Box>
          </Box>
          <Box className="store-compact-kpi">
            <Box className="highlight-icon green"><LocalShippingOutlinedIcon fontSize="small" /></Box>
            <Box>
              <strong>En vivo</strong>
              <span>Entrega rastreable</span>
            </Box>
          </Box>
        </Box>
      </section>

      {!isCompanyConfigured ? (
        <Alert severity="info">
          Esta tienda todavía está en preparación. Vuelve a intentarlo más tarde.
        </Alert>
      ) : null}

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

      {/* SECCIÓN PRINCIPAL DEL CATÁLOGO CON CARGA PROGRESIVA */}
      <section className="catalog-section" id="catalogo">
        <Box className="catalog-bar">
          <Box className="catalog-bar-summary">
            <Typography className="catalog-bar-title" variant="h5">
              {selectedCategoryObj
                ? selectedCategoryObj.label
                : selectedStoreObj
                  ? selectedStoreObj.title || selectedStoreObj.name
                  : hasAnyFilter
                    ? 'Resultados filtrados'
                    : 'Selección inicial'}
            </Typography>
            <Chip
              className="catalog-count"
              label={
                catalogState.hasMore
                  ? `Mostrando ${filteredProducts.length} (hay más disponibles)`
                  : `${filteredProducts.length} ${filteredProducts.length === 1 ? 'producto' : 'productos'}`
              }
              size="small"
              variant="outlined"
            />
            {catalogState.loading && filteredProducts.length > 0 ? (
              <CircularProgress size={16} sx={{ ml: 0.5 }} />
            ) : null}
          </Box>

          <Box className="catalog-bar-actions">
            {AVAILABILITY_OPTIONS.map((option) => (
              <Chip
                clickable
                className={availability === option.value ? 'availability-quick-chip active' : 'availability-quick-chip'}
                key={option.value}
                label={option.shortLabel}
                onClick={() => setAvailability(option.value)}
                size="small"
              />
            ))}
            {hasAnyFilter ? (
              <Button
                className="clear-filters-inline-btn"
                onClick={resetAllFilters}
                size="small"
                startIcon={<RestartAltRoundedIcon fontSize="small" />}
              >
                Restablecer
              </Button>
            ) : null}
          </Box>
        </Box>

        {/* CHIPS DE FILTROS ACTIVOS */}
        {hasAnyFilter ? (
          <Box className="active-filters-bar" aria-label="Filtros aplicados">
            {search.trim() ? (
              <Chip
                label={`Búsqueda: "${search.trim()}"`}
                onDelete={() => setSearch('')}
                size="small"
              />
            ) : null}
            {selectedStoreObj ? (
              <Chip
                label={`Tienda: ${selectedStoreObj.title || selectedStoreObj.name}`}
                onDelete={() => setSelectedStore('all')}
                size="small"
              />
            ) : null}
            {selectedCategoryObj ? (
              <Chip
                label={`Categoría: ${selectedCategoryObj.label}`}
                onDelete={() => setSelectedCategory('all')}
                size="small"
              />
            ) : null}
            {availability !== 'all' ? (
              <Chip
                label={`Disponibilidad: ${AVAILABILITY_OPTIONS.find((item) => item.value === availability)?.shortLabel || availability}`}
                onDelete={() => setAvailability('all')}
                size="small"
              />
            ) : null}
            {selectedCurrency !== 'all' ? (
              <Chip
                label={`Moneda: ${selectedCurrency}`}
                onDelete={() => setSelectedCurrency('all')}
                size="small"
              />
            ) : null}
            {(minPrice !== '' || maxPrice !== '') ? (
              <Chip
                label={`Precio: ${minPrice || '0'} - ${maxPrice || '∞'}`}
                onDelete={() => {
                  setMinPrice('');
                  setMaxPrice('');
                }}
                size="small"
              />
            ) : null}
          </Box>
        ) : null}

        {isInitialLoading ? (
          <Box className={`product-grid ${viewMode}`} aria-label="Cargando catálogo">
            {Array.from({ length: INITIAL_CATALOG_LIMIT }, (_, index) => (
              <Paper className="product-skeleton" elevation={0} key={index}>
                <Skeleton animation="wave" height={118} variant="rounded" />
                <Skeleton animation="wave" height={20} sx={{ mt: 1 }} width="65%" />
                <Skeleton animation="wave" height={18} width="90%" />
                <Skeleton animation="wave" height={34} sx={{ mt: 1 }} width="100%" />
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
            <Box className="empty-state-icon"><FilterAltOffRoundedIcon /></Box>
            <Typography variant="h5">No hay productos con esos filtros</Typography>
            <Typography color="text.secondary">Prueba otra categoría, cambia la búsqueda o restablece los filtros.</Typography>
            <Button onClick={resetAllFilters} startIcon={<RestartAltRoundedIcon />} variant="outlined">
              Limpiar filtros
            </Button>
          </Paper>
        ) : (
          <>
            <Box className={`product-grid ${viewMode}`}>
              {filteredProducts.map((product, index) => (
                <div className="product-entry" key={product._id} style={{ animationDelay: `${Math.min(index * 20, 200)}ms` }}>
                  <ProductCard
                    cartBlocked={isCartBlocked}
                    cartReady={cart.ready}
                    compact={viewMode === 'compact'}
                    onAdd={cart.addProduct}
                    onNotify={notify}
                    product={product}
                    store={storesById.get(String(product.idTienda))}
                  />
                </div>
              ))}
            </Box>

            <Paper className="catalog-load-more-bar" elevation={0}>
              <Box className="catalog-load-more-copy">
                <Typography fontWeight={750} variant="body2">
                  {catalogState.hasMore
                    ? `Mostrando ${filteredProducts.length} productos iniciales para no sobrecargar tu conexión.`
                    : `Has visto los ${filteredProducts.length} productos de esta selección.`}
                </Typography>
                <Typography color="text.secondary" variant="caption">
                  Usa las categorías del encabezado, el panel de filtros o carga más productos cuando lo necesites.
                </Typography>
              </Box>

              <Box className="catalog-load-more-actions">
                {limit > INITIAL_CATALOG_LIMIT ? (
                  <Button
                    className="catalog-collapse-btn"
                    onClick={() => {
                      setLimit(INITIAL_CATALOG_LIMIT);
                      scrollToCatalog();
                    }}
                    size="small"
                    startIcon={<ExpandLessRoundedIcon />}
                    variant="text"
                  >
                    Ver menos
                  </Button>
                ) : null}

                {catalogState.hasMore && limit < MAX_CATALOG_LIMIT ? (
                  <Button
                    className="catalog-load-more-btn"
                    disabled={catalogState.loading}
                    onClick={() => setLimit((current) => Math.min(MAX_CATALOG_LIMIT, current + CATALOG_LIMIT_STEP))}
                    startIcon={
                      catalogState.loading ? (
                        <CircularProgress color="inherit" size={16} />
                      ) : (
                        <ExpandMoreRoundedIcon />
                      )
                    }
                    variant="contained"
                  >
                    {catalogState.loading ? 'Cargando…' : `Cargar ${CATALOG_LIMIT_STEP} productos más`}
                  </Button>
                ) : null}
              </Box>
            </Paper>
          </>
        )}
      </section>

      {/* DRAWER LATERAL DE FILTROS AVANZADOS */}
      <Drawer
        anchor="left"
        className="catalog-filter-drawer"
        onClose={() => setFilterDrawerOpen(false)}
        open={filterDrawerOpen}
      >
        <Box className="filter-drawer-shell" role="dialog" aria-label="Filtrar catálogo">
          <Box className="filter-drawer-header">
            <Box className="filter-drawer-title-wrap">
              <Box className="filter-drawer-icon"><TuneRoundedIcon fontSize="small" /></Box>
              <Box>
                <Typography fontWeight={800} variant="subtitle1">Filtrar catálogo</Typography>
                <Typography color="text.secondary" variant="caption">
                  Consulta bajo demanda · {filteredProducts.length} visibles
                </Typography>
              </Box>
            </Box>
            <IconButton aria-label="Cerrar filtros" onClick={() => setFilterDrawerOpen(false)} size="small">
              <CloseRoundedIcon />
            </IconButton>
          </Box>

          <Box className="filter-drawer-body">
            {/* Ordenar por */}
            <Box className="filter-drawer-group">
              <Typography className="filter-group-label" variant="overline">Ordenar por</Typography>
              <Stack spacing={0.75}>
                {SORT_OPTIONS.map((option) => (
                  <Button
                    className={sort === option.value ? 'drawer-option-btn active' : 'drawer-option-btn'}
                    fullWidth
                    key={option.value}
                    onClick={() => setSort(option.value)}
                    variant="text"
                  >
                    <span>{option.label}</span>
                    {sort === option.value ? <CheckCircleOutlineRoundedIcon fontSize="small" /> : null}
                  </Button>
                ))}
              </Stack>
            </Box>

            <Divider />

            {/* Disponibilidad */}
            <Box className="filter-drawer-group">
              <Typography className="filter-group-label" variant="overline">Disponibilidad</Typography>
              <Stack spacing={0.75}>
                {AVAILABILITY_OPTIONS.map((option) => (
                  <Button
                    className={availability === option.value ? 'drawer-option-btn active' : 'drawer-option-btn'}
                    fullWidth
                    key={option.value}
                    onClick={() => setAvailability(option.value)}
                    variant="text"
                  >
                    <span>{option.label}</span>
                    {availability === option.value ? <CheckCircleOutlineRoundedIcon fontSize="small" /> : null}
                  </Button>
                ))}
              </Stack>
            </Box>

            <Divider />

            {/* Categorías */}
            <Box className="filter-drawer-group">
              <Typography className="filter-group-label" variant="overline">Categorías</Typography>
              {categoryOptions.length > 8 ? (
                <TextField
                  fullWidth
                  onChange={(event) => {
                    setCategorySearch(event.target.value);
                    setDrawerCategoryLimit(10);
                  }}
                  placeholder="Buscar categoría…"
                  size="small"
                  value={categorySearch}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchRoundedIcon fontSize="small" />
                      </InputAdornment>
                    ),
                  }}
                />
              ) : null}
              <Stack spacing={0.75}>
                <Button
                  className={selectedCategory === 'all' ? 'drawer-option-btn active' : 'drawer-option-btn'}
                  fullWidth
                  onClick={() => setSelectedCategory('all')}
                  variant="text"
                >
                  <span>Todas las categorías</span>
                  {selectedCategory === 'all' ? <CheckCircleOutlineRoundedIcon fontSize="small" /> : null}
                </Button>
                {filteredDrawerCategories.slice(0, drawerCategoryLimit).map((category) => (
                  <Button
                    className={selectedCategory === category.id ? 'drawer-option-btn active' : 'drawer-option-btn'}
                    fullWidth
                    key={category.id}
                    onClick={() => setSelectedCategory(category.id)}
                    variant="text"
                  >
                    <span>{category.label}</span>
                    {selectedCategory === category.id ? <CheckCircleOutlineRoundedIcon fontSize="small" /> : null}
                  </Button>
                ))}
                {filteredDrawerCategories.length > drawerCategoryLimit ? (
                  <Button
                    onClick={() => setDrawerCategoryLimit((curr) => curr + 12)}
                    size="small"
                    variant="text"
                  >
                    Ver más categorías ({filteredDrawerCategories.length - drawerCategoryLimit})
                  </Button>
                ) : null}
              </Stack>
            </Box>

            {visibleStores.length > 0 ? (
              <>
                <Divider />
                <Box className="filter-drawer-group">
                  <Typography className="filter-group-label" variant="overline">Tiendas / Sucursales</Typography>
                  <Stack spacing={0.75}>
                    <Button
                      className={selectedStore === 'all' ? 'drawer-option-btn active' : 'drawer-option-btn'}
                      fullWidth
                      onClick={() => setSelectedStore('all')}
                      variant="text"
                    >
                      <span>Todas las tiendas</span>
                      {selectedStore === 'all' ? <CheckCircleOutlineRoundedIcon fontSize="small" /> : null}
                    </Button>
                    {visibleStores.map((store) => {
                      const id = String(store._id);
                      return (
                        <Button
                          className={selectedStore === id ? 'drawer-option-btn active' : 'drawer-option-btn'}
                          fullWidth
                          key={id}
                          onClick={() => setSelectedStore(id)}
                          variant="text"
                        >
                          <span>{store.title || store.name || 'Tienda'}</span>
                          {selectedStore === id ? <CheckCircleOutlineRoundedIcon fontSize="small" /> : null}
                        </Button>
                      );
                    })}
                  </Stack>
                </Box>
              </>
            ) : null}

            <Divider />

            <Box className="filter-drawer-group">
              <Typography className="filter-group-label" variant="overline">Moneda</Typography>
              <Box className="drawer-chip-row">
                <Chip
                  clickable
                  color={selectedCurrency === 'all' ? 'primary' : 'default'}
                  label="Todas"
                  onClick={() => setSelectedCurrency('all')}
                  size="small"
                  variant={selectedCurrency === 'all' ? 'filled' : 'outlined'}
                />
                {CURRENCY_OPTIONS.map((currency) => (
                  <Chip
                    clickable
                    color={selectedCurrency === currency ? 'primary' : 'default'}
                    key={currency}
                    label={currency}
                    onClick={() => setSelectedCurrency(currency)}
                    size="small"
                    variant={selectedCurrency === currency ? 'filled' : 'outlined'}
                  />
                ))}
              </Box>
            </Box>

            <Divider />

            {/* Rango de precio */}
            <Box className="filter-drawer-group">
              <Typography className="filter-group-label" variant="overline">Rango de precio</Typography>
              <Box className="drawer-price-inputs">
                <TextField
                  inputProps={{ min: 0 }}
                  label="Mínimo"
                  onChange={(event) => setMinPrice(event.target.value)}
                  placeholder="0"
                  size="small"
                  type="number"
                  value={minPrice}
                />
                <TextField
                  inputProps={{ min: 0 }}
                  label="Máximo"
                  onChange={(event) => setMaxPrice(event.target.value)}
                  placeholder="Sin límite"
                  size="small"
                  type="number"
                  value={maxPrice}
                />
              </Box>
            </Box>
          </Box>

          <Box className="filter-drawer-footer">
            <Button
              disabled={!hasAnyFilter}
              fullWidth
              onClick={resetAllFilters}
              startIcon={<RestartAltRoundedIcon />}
              variant="outlined"
            >
              Limpiar
            </Button>
            <Button
              fullWidth
              onClick={() => {
                setFilterDrawerOpen(false);
                scrollToCatalog();
              }}
              variant="contained"
            >
              Aplicar filtros
            </Button>
          </Box>
        </Box>
      </Drawer>
    </Box>
  );
}
