import React from 'react';
import { Alert, Box, Button, Chip, CircularProgress, FormControl, InputAdornment, MenuItem, Paper, Select, TextField, Tooltip, Typography } from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import Inventory2RoundedIcon from '@mui/icons-material/Inventory2Rounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import StopCircleRoundedIcon from '@mui/icons-material/StopCircleRounded';
import PauseCircleOutlineRoundedIcon from '@mui/icons-material/PauseCircleOutlineRounded';
import PlayCircleOutlineRoundedIcon from '@mui/icons-material/PlayCircleOutlineRounded';
import { Meteor, callMeteor } from '../../meteor/client';
import { CategoriasComercioCollection, ConfigCollection, ProductosComercioCollection, TiendasComercioCollection } from '../../meteor/collections';
import { formatMoney } from '../../domain/commerce';
import { ensureEmpresaMethodSuccess } from '../../domain/empresa';
import { getMercadoLibreStatusPresentation, hasMercadoLibreListing } from '../../domain/mercadoLibreStatus';
import EmpresaProductDialog from './EmpresaProductDialog';

const STORE_FIELDS = {
  _id: 1,
  idUser: 1,
  title: 1,
};

const CATEGORY_FIELDS = {
  _id: 1,
  activa: 1,
  creadaPor: 1,
  idCategoriaHeredada: 1,
  nombre: 1,
};

const CURRENCY_SELECTOR = {
  active: true,
  clave: 'monedasPreciosProductosComercios',
  type: 'CONFIG',
};
const SUPPORTED_CURRENCIES = ['USD', 'CUP', 'UYU'];

const buildFileData = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve({
    base64: String(reader.result || ''),
    name: file.name,
    size: file.size,
    type: file.type,
  });
  reader.onerror = () => reject(new Error(`No se pudo leer ${file.name}.`));
  reader.readAsDataURL(file);
});

const getConfiguredCurrencies = (value) => {
  let parsed = value;
  if (typeof value === 'string') {
    try { parsed = JSON.parse(value); } catch { parsed = [value]; }
  }
  const values = Array.isArray(parsed) ? parsed : typeof parsed === 'string' ? [parsed] : [];
  return [...new Set(values
    .filter((currency) => typeof currency === 'string')
    .map((currency) => currency.trim().toUpperCase())
    .filter((currency) => SUPPORTED_CURRENCIES.includes(currency)))];
};

const getCategoryPath = (category, categoriesById) => {
  const names = [];
  const visited = new Set();
  let current = category;
  let activePath = true;

  while (current && !visited.has(current._id)) {
    visited.add(current._id);
    names.unshift(current.nombre);
    if (current.activa === false) activePath = false;
    const parentId = current.idCategoriaHeredada;
    if (!parentId) break;
    current = categoriesById.get(String(parentId));
    if (!current) activePath = false;
  }

  if (current && visited.has(current._id) && current.idCategoriaHeredada) activePath = false;
  return { active: activePath, label: names.join(' › ') };
};

export default function EmpresaProductsPanel({ notify, storefront, user }) {
  const [search, setSearch] = React.useState('');
  const [storeFilter, setStoreFilter] = React.useState('all');
  const [editingProduct, setEditingProduct] = React.useState(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [panelError, setPanelError] = React.useState('');
  const [mercadoLibreEnabled, setMercadoLibreEnabled] = React.useState(false);
  const [syncingProductId, setSyncingProductId] = React.useState('');
  const [closingProductId, setClosingProductId] = React.useState('');
  const [deletingProductId, setDeletingProductId] = React.useState('');

  const data = Meteor.useTracker(() => {
    const storesHandle = user?._id ? Meteor.subscribe('comercio.tiendasEmpresa') : null;
    const subscriptionStores = storesHandle?.ready()
      ? TiendasComercioCollection.find({ idUser: user._id }, { fields: STORE_FIELDS, sort: { title: 1 } }).fetch()
      : [];
    const stores = subscriptionStores.length ? subscriptionStores : (storefront?.stores || []);
    const ids = stores.map((store) => String(store._id));
    const productHandle = ids.length
      ? Meteor.subscribe('comercio.productosEmpresa', ids)
      : null;
    const categoriesHandle = user?._id ? Meteor.subscribe('categoriasComercio') : null;
    const currencyHandle = Meteor.subscribe('propertys', CURRENCY_SELECTOR, { fields: { valor: 1 } });

    return {
      categories: categoriesHandle?.ready()
        ? CategoriasComercioCollection.find({}, { fields: CATEGORY_FIELDS, sort: { nombre: 1 } }).fetch()
        : [],
      currencies: currencyHandle.ready()
        ? ConfigCollection.find(CURRENCY_SELECTOR, { fields: { valor: 1 } }).fetch().flatMap((property) => getConfiguredCurrencies(property.valor))
        : [],
      products: ids.length && productHandle?.ready()
        ? ProductosComercioCollection.find({ idTienda: { $in: ids } }, { sort: { name: 1 } }).fetch()
        : [],
      ready: Boolean((!storesHandle || storesHandle.ready()) && (!productHandle || productHandle.ready()) && (!categoriesHandle || categoriesHandle.ready()) && currencyHandle.ready()),
      stores,
    };
  }, [user?._id, storefront?.stores]);

  React.useEffect(() => {
    let active = true;
    if (!user?._id) {
      setMercadoLibreEnabled(false);
      return undefined;
    }
    callMeteor('comercio.mercadoLibre.getEstado')
      .then((state) => { if (active) setMercadoLibreEnabled(state?.enabled === true); })
      .catch(() => { if (active) setMercadoLibreEnabled(false); });
    return () => { active = false; };
  }, [user?._id]);

  const categoryOptions = React.useMemo(() => {
    const byId = new Map(data.categories.map((category) => [String(category._id), category]));
    return data.categories.map((category) => {
      const path = getCategoryPath(category, byId);
      return path.active ? { id: String(category._id), label: path.label } : null;
    }).filter(Boolean).sort((left, right) => left.label.localeCompare(right.label, 'es'));
  }, [data.categories]);

  const products = React.useMemo(() => {
    const query = search.trim().toLocaleLowerCase('es');
    return data.products.filter((product) => {
      const matchesStore = storeFilter === 'all' || String(product.idTienda) === storeFilter;
      const store = data.stores.find((item) => String(item._id) === String(product.idTienda));
      const matchesSearch = !query || `${product.name || ''} ${product.descripcion || ''} ${store?.title || ''}`.toLocaleLowerCase('es').includes(query);
      return matchesStore && matchesSearch;
    });
  }, [data.products, data.stores, search, storeFilter]);

  const openCreate = () => {
    setEditingProduct(null);
    setDialogOpen(true);
  };

  const openEdit = (product) => {
    setEditingProduct(product);
    setDialogOpen(true);
  };

  const saveProduct = async ({ images = [], mercadoLibrePublication, product, removedImageIds = [], removeAllImages = false, values }) => {
    let productId = product?._id;
    if (productId) {
      const { idTienda: _storeId, ...productData } = values;
      const result = ensureEmpresaMethodSuccess(await callMeteor('comercio.editProducto', productId, productData));
      if (result?.success !== true) throw new Error('El servidor no confirmó la actualización del producto.');
      if (String(result.idCategoria || '') !== String(values.idCategoria || '')) {
        throw new Error('El servidor no confirmó la categoría seleccionada.');
      }
    } else {
      productId = ensureEmpresaMethodSuccess(await callMeteor('addProducto', values));
      if (typeof productId !== 'string' || !productId) throw new Error('El servidor no devolvió el identificador del producto.');
    }

    const imageErrors = [];
    if (removeAllImages && productId) {
      try {
        ensureEmpresaMethodSuccess(await callMeteor('comercio.deleteProductImage', productId));
      } catch (imageError) {
        imageErrors.push(imageError?.reason || imageError?.message || 'No se pudieron quitar las imágenes anteriores.');
      }
    } else {
      for (const imageId of removedImageIds) {
        try {
          ensureEmpresaMethodSuccess(await callMeteor('comercio.deleteProductImageById', productId, imageId));
        } catch (imageError) {
          imageErrors.push(imageError?.reason || imageError?.message || 'No se pudo quitar una imagen.');
        }
      }
    }

    for (const image of images) {
      try {
        ensureEmpresaMethodSuccess(await callMeteor(
          'comercio.uploadProductImage',
          productId,
          await buildFileData(image.file),
        ));
      } catch (imageError) {
        imageErrors.push(imageError?.reason || imageError?.message || `No se pudo subir ${image.name || 'una imagen'}.`);
      }
    }

    let mercadoLibreMessage = '';
    if (mercadoLibreEnabled && mercadoLibrePublication?.publish === true) {
      try {
        const publication = await callMeteor('comercio.mercadoLibre.publicarProducto', productId, mercadoLibrePublication);
        if (publication?.success !== true) throw new Error('Mercado Libre no confirmó la publicación.');
        const publicationWarnings = [];
        if (publication.stockSynced === false) publicationWarnings.push('el stock requiere atención');
        if (publication.descriptionSynced === false) publicationWarnings.push('la descripción requiere atención');
        if (publication.picturesSynced === false || publication.picturesWarning) publicationWarnings.push('las fotos aún no se confirmaron en Mercado Libre');
        mercadoLibreMessage = ` Publicado en Mercado Libre (${publication.itemId}).${publicationWarnings.length ? ` Sincronización parcial: ${publicationWarnings.join(' y ')}. Revisa el producto desde Productos.` : ''}`;
      } catch (publicationError) {
        const reason = String(publicationError?.reason || publicationError?.message || 'revisa los datos de publicación').trim().replace(/[.!?]+$/u, '');
        mercadoLibreMessage = ` El artículo se guardó en el catálogo, pero no se publicó en Mercado Libre: ${reason}.`;
      }
    } else if (mercadoLibreEnabled && product?.mercadoLibre?.itemId) {
      mercadoLibreMessage = ' La actualización de Mercado Libre quedó en cola.';
    }

    notify?.(imageErrors.length
      ? `Producto guardado; ${imageErrors.length} imagen(es) requieren atención: ${imageErrors[0]}.${mercadoLibreMessage}`
      : `${product ? 'Producto actualizado.' : 'Producto creado.'}${mercadoLibreMessage}`);
  };

  const changeMercadoLibreStatus = async (product) => {
    if (syncingProductId || closingProductId || deletingProductId) return;
    const status = product.mercadoLibre?.status === 'paused' ? 'active' : 'paused';
    if (!window.confirm(`¿${status === 'paused' ? 'Pausar' : 'Activar'} la publicación de “${product.name || 'este producto'}”? El cambio afecta todas sus publicaciones y variantes vinculadas.`)) return;
    setPanelError('');
    setSyncingProductId(product._id);
    try {
      const result = await callMeteor('comercio.mercadoLibre.cambiarEstadoProducto', product._id, status);
      if (result?.success !== true) throw new Error('Mercado Libre no confirmó el cambio.');
      notify?.(status === 'paused' ? 'Publicación pausada en Mercado Libre y la tienda.' : 'Publicación activada en Mercado Libre y la tienda.');
    } catch (error) {
      setPanelError(error?.reason || error?.message || 'No se pudo cambiar el estado de la publicación.');
    } finally { setSyncingProductId(''); }
  };

  const closeMercadoLibreProduct = async (product) => {
    if (!mercadoLibreEnabled || !product?._id || syncingProductId || closingProductId || deletingProductId) return;
    const isVariation = product.mercadoLibre?.variationId != null;
    const confirmation = isVariation
      ? `¿Retirar la variante de “${product.name || 'este producto'}” de Mercado Libre? El producto seguirá disponible en tu tienda.`
      : `¿Cerrar la publicación de “${product.name || 'este producto'}” en Mercado Libre? El producto y el stock seguirán disponibles en tu tienda.`;
    if (!window.confirm(confirmation)) return;
    setPanelError('');
    setClosingProductId(product._id);
    try {
      const result = await callMeteor('comercio.mercadoLibre.cerrarPublicacion', product._id);
      if (result?.success !== true) throw new Error('Mercado Libre no confirmó el cierre de la publicación.');
      notify?.(result.removedVariation
        ? 'Variante retirada de Mercado Libre; el producto local sigue disponible.'
        : 'Publicación cerrada en Mercado Libre; el producto local sigue disponible.');
    } catch (closeError) {
      setPanelError(closeError?.reason || closeError?.message || 'No se pudo cerrar la publicación.');
    } finally {
      setClosingProductId('');
    }
  };

  const deleteProduct = async (product) => {
    if (!product?._id || syncingProductId || closingProductId || deletingProductId) return;
    const mercadoLibreMetadata = product.mercadoLibre || {};
    const hasLinkedListing = hasMercadoLibreListing(mercadoLibreMetadata);
    const isVariation = mercadoLibreMetadata.variationId != null;
    const listingIsClosed = String(mercadoLibreMetadata.status || '').toLowerCase() === 'closed';
    const store = data.stores.find((item) => String(item._id) === String(product.idTienda));
    const confirmation = hasLinkedListing
      ? `¿Eliminar “${product.name || 'este producto'}” de ${store?.title || store?.name || 'tu tienda'}? ${listingIsClosed
        ? 'La publicación figura cerrada. Si la cuenta sigue vinculada, se intentará retirarla; si ya se desconectó, solo se eliminará el producto local.'
        : `Se retirará primero ${isVariation ? 'la variante' : 'la publicación'} vinculada de Mercado Libre. Si Mercado Libre no confirma la baja, el producto local no se eliminará.`}`
      : `¿Eliminar “${product.name || 'este producto'}” y su imagen?`;
    if (!window.confirm(confirmation)) return;
    setPanelError('');
    setDeletingProductId(product._id);
    try {
      ensureEmpresaMethodSuccess(await callMeteor('removeProducto', product._id));
      notify?.('Producto eliminado de la tienda.');
    } catch (deleteError) {
      setPanelError(deleteError?.reason || deleteError?.message || 'No se pudo eliminar el producto.');
    } finally {
      setDeletingProductId('');
    }
  };

  return (
    <Box className="content-stack empresa-panel">
      <Box className="empresa-panel-heading">
        <Box>
          <Typography variant="h4">Productos</Typography>
          <Typography color="text.secondary" variant="body2">Administra el catálogo de las tiendas pertenecientes a esta cuenta.</Typography>
        </Box>
        <Button disabled={!data.stores.length} onClick={openCreate} startIcon={<AddRoundedIcon />} variant="contained">Nuevo producto</Button>
      </Box>

      <Box className="empresa-product-toolbar">
        <TextField
          fullWidth
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar producto"
          value={search}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchRoundedIcon /></InputAdornment> }}
        />
        <FormControl size="small" sx={{ minWidth: 210 }}>
          <Select onChange={(event) => setStoreFilter(event.target.value)} value={storeFilter}>
            <MenuItem value="all">Todas las tiendas</MenuItem>
            {data.stores.map((store) => <MenuItem key={store._id} value={String(store._id)}>{store.title || store.name || 'Tienda'}</MenuItem>)}
          </Select>
        </FormControl>
      </Box>

      {panelError ? <Alert onClose={() => setPanelError('')} severity="error">{panelError}</Alert> : null}
      {!data.ready ? (
        <Paper className="empresa-loading-inline" elevation={0}><CircularProgress size={22} /><Typography color="text.secondary">Cargando catálogo y categorías…</Typography></Paper>
      ) : !data.stores.length ? (
        <Paper className="empresa-empty" elevation={0}><Inventory2RoundedIcon color="disabled" fontSize="large" /><Typography variant="h6">Primero registra una tienda</Typography><Typography color="text.secondary" variant="body2">Los productos siempre deben pertenecer a una de tus sucursales.</Typography></Paper>
      ) : !products.length ? (
        <Paper className="empresa-empty" elevation={0}><Inventory2RoundedIcon color="primary" fontSize="large" /><Typography variant="h6">No hay productos con esos filtros</Typography><Typography color="text.secondary" variant="body2">Crea un producto o ajusta la búsqueda para ver el catálogo.</Typography>{data.products.length ? <Button onClick={() => { setSearch(''); setStoreFilter('all'); }} variant="outlined">Limpiar filtros</Button> : null}</Paper>
      ) : (
        <Paper className="empresa-product-list" elevation={0}>
          <Box aria-hidden="true" className="empresa-product-list-header">
            <span>Producto y tienda</span>
            <span>Precio e inventario</span>
            <span>Acciones</span>
          </Box>
          <Box aria-label="Lista de productos" className="empresa-product-list-items" component="ul">
          {products.map((product) => {
            const store = data.stores.find((item) => String(item._id) === String(product.idTienda));
            const stock = Math.max(0, Number(product.count || 0));
            const hasLinkedMercadoLibreListing = hasMercadoLibreListing(product.mercadoLibre);
            const mercadoLibreStatus = getMercadoLibreStatusPresentation(product.mercadoLibre?.status);
            const mercadoLibreClosed = String(product.mercadoLibre?.status || '').toLowerCase() === 'closed';
            const mercadoLibreWarnings = [
              product.mercadoLibre?.stockSyncSupported === false
                ? 'El stock de esta variante/depósito no se puede sincronizar automáticamente; revisa el inventario en Mercado Libre.'
                : product.mercadoLibre?.stockLocationRequired === true
                  ? 'Asocia esta tienda con un depósito de Mercado Libre en Integraciones antes de sincronizar su stock.'
                : '',
              product.mercadoLibre?.priceSyncWarning === 'pricing-automation-active'
                ? 'El precio está gestionado por una automatización de Mercado Libre y no se sobrescribió.'
                : product.mercadoLibre?.priceSyncWarning === 'pricing-automation-unverified'
                  ? 'No se pudo verificar la automatización de precios; el precio remoto se dejó intacto.'
                  : product.mercadoLibre?.priceSyncWarning
                    ? 'El precio requiere revisión en Mercado Libre.'
                  : '',
              product.mercadoLibre?.picturesSyncWarning ? 'Las imágenes requieren revisión en Mercado Libre.' : '',
              product.mercadoLibre?.descriptionSynced === false ? 'La descripción requiere revisión en Mercado Libre.' : '',
              product.mercadoLibre?.titleSyncWarning ? 'El título requiere revisión en Mercado Libre.' : '',
            ].filter(Boolean);
            return (
              <Box className="empresa-product-row" component="li" key={product._id}>
                <Box className="empresa-product-row-main">
                      <Box className="empresa-product-avatar">{String(product.name || 'P').trim().slice(0, 1).toUpperCase()}</Box>
                      <Box className="empresa-product-row-copy">
                        <Typography className="empresa-product-row-name" component="h3" fontWeight={750} noWrap variant="subtitle1">{product.name || 'Producto'}</Typography>
                        <Typography className="empresa-product-row-store" color="text.secondary" noWrap variant="caption">{store?.title || 'Tienda'}</Typography>
                        <Typography className="empresa-product-row-description" color="text.secondary" variant="body2">{product.descripcion || 'Sin descripción.'}</Typography>
                        <Typography className="empresa-product-row-category" color="text.secondary" variant="caption">{product.idCategoria ? 'Categoría asignada' : 'Sin categoría'}</Typography>
                      </Box>
                </Box>

                <Box className="empresa-product-row-meta">
                  <Typography className="empresa-product-row-price" fontWeight={800} variant="subtitle1">{formatMoney(product.precio, product.monedaPrecio || 'USD')}</Typography>
                  <Chip label={product.productoDeElaboracion ? 'Por encargo' : stock ? `${stock} disponibles` : 'Agotado'} size="small" color={product.productoDeElaboracion ? 'secondary' : stock ? 'success' : 'default'} />
                </Box>
                <Box className="empresa-product-row-actions">
                  <Tooltip arrow describeChild title="Edita los datos, fotos e inventario local. Los cambios compatibles de Mercado Libre se sincronizan según el estado de la publicación.">
                      <span>
                        <Button aria-label={`Editar ${product.name || 'producto'}`} onClick={() => openEdit(product)} size="small" variant="outlined">Editar</Button>
                      </span>
                  </Tooltip>
                  <Tooltip arrow describeChild title={hasLinkedMercadoLibreListing
                        ? 'Elimina el producto local y retira primero su anuncio o variante de Mercado Libre.'
                        : 'Elimina este producto y sus fotos de la tienda.'}>
                      <span>
                        <Button
                          aria-label={`Eliminar ${product.name || 'producto'}`}
                          color="error"
                          disabled={Boolean(deletingProductId || syncingProductId || closingProductId)}
                          onClick={() => deleteProduct(product)}
                          size="small"
                          startIcon={deletingProductId === product._id ? <CircularProgress color="inherit" size={14} /> : <DeleteOutlineRoundedIcon />}
                          variant="text"
                        >
                          {deletingProductId === product._id ? 'Eliminando…' : 'Eliminar'}
                        </Button>
                      </span>
                    </Tooltip>
                </Box>

                {mercadoLibreEnabled && hasLinkedMercadoLibreListing ? (
                    <Box className="empresa-product-row-marketplace">
                      <Chip
                        color={mercadoLibreStatus.color}
                        label={`Mercado Libre · ${mercadoLibreStatus.label}`}
                        size="small"
                      />
                      {['active', 'paused'].includes(String(product.mercadoLibre.status || '').toLowerCase()) && product.mercadoLibre.itemId ? (
                        <Button disabled={Boolean(syncingProductId || closingProductId || deletingProductId)} onClick={() => changeMercadoLibreStatus(product)} size="small" startIcon={syncingProductId === product._id ? <CircularProgress color="inherit" size={14} /> : product.mercadoLibre.status === 'paused' ? <PlayCircleOutlineRoundedIcon /> : <PauseCircleOutlineRoundedIcon />}>
                          {product.mercadoLibre.status === 'paused' ? 'Activar' : 'Pausar'} publicación
                        </Button>
                      ) : null}
                      {!mercadoLibreClosed && product.mercadoLibre.itemId ? (
                        <Tooltip arrow describeChild title={product.mercadoLibre.variationId != null
                          ? 'Retira solo esta variante de Mercado Libre; el producto seguirá disponible en tu tienda.'
                          : 'Cierra el anuncio en Mercado Libre. El producto y el stock seguirán disponibles en tu tienda.'}>
                          <span>
                            <Button
                              disabled={Boolean(syncingProductId || closingProductId || deletingProductId)}
                              onClick={() => closeMercadoLibreProduct(product)}
                              size="small"
                              startIcon={closingProductId === product._id ? <CircularProgress color="inherit" size={14} /> : <StopCircleRoundedIcon />}
                            >
                              {product.mercadoLibre.variationId != null ? 'Retirar variante' : 'Cerrar publicación'}
                            </Button>
                          </span>
                        </Tooltip>
                      ) : null}
                    </Box>
                ) : null}
                {mercadoLibreEnabled && hasLinkedMercadoLibreListing && mercadoLibreWarnings.length ? (
                    <Alert className="empresa-product-row-warning" severity="warning">
                      {mercadoLibreWarnings.join(' ')}
                    </Alert>
                ) : null}
              </Box>
            );
          })}
          </Box>
        </Paper>
      )}

      <EmpresaProductDialog
        categories={categoryOptions}
        currencyOptions={data.currencies}
        mercadoLibreEnabled={mercadoLibreEnabled}
        onClose={() => setDialogOpen(false)}
        onSave={saveProduct}
        open={dialogOpen}
        product={editingProduct}
        stores={data.stores}
      />
    </Box>
  );
}
