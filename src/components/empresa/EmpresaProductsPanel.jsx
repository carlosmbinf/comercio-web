import React from 'react';
import { Alert, Box, Button, Card, CardContent, Chip, CircularProgress, FormControl, InputAdornment, MenuItem, Paper, Select, TextField, Typography } from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import Inventory2RoundedIcon from '@mui/icons-material/Inventory2Rounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import { Meteor, callMeteor } from '../../meteor/client';
import { CategoriasComercioCollection, ConfigCollection, ProductosComercioCollection, TiendasComercioCollection } from '../../meteor/collections';
import { formatMoney } from '../../domain/commerce';
import { ensureEmpresaMethodSuccess } from '../../domain/empresa';
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

export default function EmpresaProductsPanel({ notify, user }) {
  const [search, setSearch] = React.useState('');
  const [storeFilter, setStoreFilter] = React.useState('all');
  const [editingProduct, setEditingProduct] = React.useState(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [panelError, setPanelError] = React.useState('');

  const data = Meteor.useTracker(() => {
    const storesHandle = user?._id ? Meteor.subscribe('comercio.tiendasEmpresa') : null;
    const stores = storesHandle?.ready()
      ? TiendasComercioCollection.find({ idUser: user._id }, { fields: STORE_FIELDS, sort: { title: 1 } }).fetch()
      : [];
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

  const saveProduct = async ({ images = [], product, removedImageIds = [], removeAllImages = false, values }) => {
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

    notify?.(imageErrors.length
      ? `Producto guardado; ${imageErrors.length} imagen(es) requieren atención: ${imageErrors[0]}`
      : product ? 'Producto actualizado.' : 'Producto creado.');
  };

  const deleteProduct = async (product) => {
    if (!window.confirm(`¿Eliminar “${product.name || 'este producto'}” y su imagen?`)) return;
    setPanelError('');
    try {
      ensureEmpresaMethodSuccess(await callMeteor('comercio.deleteProductImage', product._id));
      ensureEmpresaMethodSuccess(await callMeteor('removeProducto', product._id));
      notify?.('Producto eliminado.');
    } catch (deleteError) {
      setPanelError(deleteError?.reason || deleteError?.message || 'No se pudo eliminar el producto.');
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
      {!data.stores.length ? (
        <Paper className="empresa-empty" elevation={0}><Inventory2RoundedIcon color="disabled" fontSize="large" /><Typography variant="h6">Primero registra una tienda</Typography><Typography color="text.secondary" variant="body2">Los productos siempre deben pertenecer a una de tus sucursales.</Typography></Paper>
      ) : !data.ready ? (
        <Paper className="empresa-loading-inline" elevation={0}><CircularProgress size={22} /><Typography color="text.secondary">Cargando catálogo y categorías…</Typography></Paper>
      ) : !products.length ? (
        <Paper className="empresa-empty" elevation={0}><Inventory2RoundedIcon color="primary" fontSize="large" /><Typography variant="h6">No hay productos con esos filtros</Typography><Typography color="text.secondary" variant="body2">Crea un producto o ajusta la búsqueda para ver el catálogo.</Typography>{data.products.length ? <Button onClick={() => { setSearch(''); setStoreFilter('all'); }} variant="outlined">Limpiar filtros</Button> : null}</Paper>
      ) : (
        <Box className="empresa-product-grid">
          {products.map((product) => {
            const store = data.stores.find((item) => String(item._id) === String(product.idTienda));
            const stock = Math.max(0, Number(product.count || 0));
            return (
              <Card className="empresa-product-card" elevation={0} key={product._id}>
                <CardContent>
                  <Box className="empresa-product-card-heading">
                    <Box className="empresa-product-avatar">{String(product.name || 'P').trim().slice(0, 1).toUpperCase()}</Box>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography fontWeight={750} noWrap variant="subtitle1">{product.name || 'Producto'}</Typography>
                      <Typography color="text.secondary" noWrap variant="caption">{store?.title || 'Tienda'}</Typography>
                    </Box>
                    <Button aria-label={`Eliminar ${product.name || 'producto'}`} color="error" onClick={() => deleteProduct(product)} size="small" startIcon={<DeleteOutlineRoundedIcon />} variant="text">Eliminar</Button>
                  </Box>
                  <Typography className="empresa-product-description" color="text.secondary" variant="body2">{product.descripcion || 'Sin descripción.'}</Typography>
                  <Box className="empresa-product-meta">
                    <Typography fontWeight={750} variant="h6">{formatMoney(product.precio, product.monedaPrecio || 'USD')}</Typography>
                    <Chip label={product.productoDeElaboracion ? 'Por encargo' : stock ? `${stock} disponibles` : 'Agotado'} size="small" color={product.productoDeElaboracion ? 'secondary' : stock ? 'success' : 'default'} />
                  </Box>
                  {product.idCategoria ? <Typography color="text.secondary" variant="caption">Categoría asignada</Typography> : <Typography color="text.secondary" variant="caption">Sin categoría</Typography>}
                  <Button fullWidth onClick={() => openEdit(product)} sx={{ mt: 1.5 }} variant="outlined">Editar producto</Button>
                </CardContent>
              </Card>
            );
          })}
        </Box>
      )}

      <EmpresaProductDialog
        categories={categoryOptions}
        currencyOptions={data.currencies}
        onClose={() => setDialogOpen(false)}
        onSave={saveProduct}
        open={dialogOpen}
        product={editingProduct}
        stores={data.stores}
      />
    </Box>
  );
}