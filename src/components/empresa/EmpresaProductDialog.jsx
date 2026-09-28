import React from 'react';
import { Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, FormControlLabel, InputLabel, MenuItem, Paper, Select, Switch, TextField, Typography } from '@mui/material';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import UploadFileRoundedIcon from '@mui/icons-material/UploadFileRounded';
import { callMeteor } from '../../meteor/client';
import ProductImageCarousel from '../ProductImageCarousel';

const SUPPORTED_CURRENCIES = ['USD', 'CUP', 'UYU'];
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

export default function EmpresaProductDialog({
  categories = [],
  currencyOptions = [],
  onClose,
  onSave,
  open,
  product,
  stores = [],
}) {
  const [form, setForm] = React.useState({
    categoryId: '',
    comment: '',
    count: '0',
    description: '',
    madeToOrder: false,
    name: '',
    price: '',
    storeId: '',
    currency: 'USD',
  });
  const [existingImages, setExistingImages] = React.useState([]);
  const [pendingImages, setPendingImages] = React.useState([]);
  const [removedImageIds, setRemovedImageIds] = React.useState([]);
  const [removeAllImages, setRemoveAllImages] = React.useState(false);
  const [loadingImage, setLoadingImage] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');
  const fileInputRef = React.useRef(null);
  const isEditing = Boolean(product?._id);
  const firstStoreId = stores[0]?._id || '';
  const pendingImagesRef = React.useRef([]);
  const previewImages = React.useMemo(() => [
    ...existingImages
      .filter((image) => !removedImageIds.includes(image.id))
      .map((image) => ({ ...image, isPending: false })),
    ...pendingImages.map((image) => ({ id: image.id, url: image.previewUrl, isPending: true })),
  ], [existingImages, pendingImages, removedImageIds]);
  const currencies = [...new Set([
    ...(currencyOptions.length ? currencyOptions : SUPPORTED_CURRENCIES).filter((currency) => SUPPORTED_CURRENCIES.includes(currency)),
    ...(form.currency ? [form.currency] : []),
  ])];

  React.useEffect(() => {
    if (!open) return undefined;
    setForm({
      categoryId: product?.idCategoria || '',
      comment: product?.comentario || '',
      count: String(product?.count ?? 0),
      description: product?.descripcion || '',
      madeToOrder: Boolean(product?.productoDeElaboracion),
      name: product?.name || '',
      price: product?.precio != null ? String(product.precio) : '',
      storeId: product?.idTienda || firstStoreId,
      currency: product?.monedaPrecio || 'USD',
    });
    setError('');
    pendingImagesRef.current.forEach((image) => URL.revokeObjectURL(image.previewUrl));
    pendingImagesRef.current = [];
    setPendingImages([]);
    setExistingImages([]);
    setRemovedImageIds([]);
    setRemoveAllImages(false);

    if (!product?._id) {
      setLoadingImage(false);
      return undefined;
    }

    let active = true;
    setLoadingImage(true);
    callMeteor('comercio.getProductImages', product._id)
      .then(async (result) => {
        const images = Array.isArray(result) ? result : [];
        if (images.length) {
          if (active) setExistingImages(images);
          return;
        }

        const legacyUrl = await callMeteor('findImgbyProduct', product._id).catch(() => null);
        if (active && typeof legacyUrl === 'string' && legacyUrl) {
          setExistingImages([{ id: `legacy-${product._id}`, url: legacyUrl, legacy: true }]);
        }
      })
      .catch(() => null)
      .finally(() => {
        if (active) setLoadingImage(false);
      });

    return () => { active = false; };
  }, [firstStoreId, open, product?._id]);

  React.useEffect(() => () => {
    pendingImagesRef.current.forEach((image) => URL.revokeObjectURL(image.previewUrl));
  }, []);

  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const pickImage = (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (!files.length) return;

    const validImages = [];
    const rejected = [];
    files.forEach((file, index) => {
      if (!['image/jpeg', 'image/png', 'image/jpg'].includes(file.type)) {
        rejected.push(`${file.name}: formato no permitido`);
        return;
      }
      if (file.size > MAX_IMAGE_SIZE) {
        rejected.push(`${file.name}: supera 10 MB`);
        return;
      }
      validImages.push({
        file,
        id: `${Date.now()}-${index}-${Math.random().toString(36).slice(2)}`,
        name: file.name,
        previewUrl: URL.createObjectURL(file),
        size: file.size,
        type: file.type,
      });
    });

    if (validImages.length) {
      const next = [...pendingImagesRef.current, ...validImages];
      pendingImagesRef.current = next;
      setPendingImages(next);
      setRemoveAllImages(false);
    }
    setError(rejected.length ? `No se agregaron ${rejected.length} archivo(s): ${rejected.join('; ')}` : '');
  };

  const removeImage = (image) => {
    if (image.isPending) {
      const removedPending = pendingImagesRef.current.find((pending) => pending.id === image.id);
      if (removedPending) URL.revokeObjectURL(removedPending.previewUrl);
      const next = pendingImagesRef.current.filter((pending) => pending.id !== image.id);
      pendingImagesRef.current = next;
      setPendingImages(next);
      return;
    }

    if (image.legacy) {
      setRemoveAllImages(true);
      setExistingImages([]);
      return;
    }

    setRemovedImageIds((current) => current.includes(image.id) ? current : [...current, image.id]);
  };

  const handleClose = () => {
    if (saving) return;
    pendingImagesRef.current.forEach((image) => URL.revokeObjectURL(image.previewUrl));
    pendingImagesRef.current = [];
    setPendingImages([]);
    onClose();
  };

  const submit = async (event) => {
    event.preventDefault();
    const name = form.name.replace(/\s+/g, ' ').trim();
    const description = form.description.replace(/\s+/g, ' ').trim();
    const comment = form.comment.trim();
    const price = Number(form.price);
    const count = Number(form.count || 0);

    if (!form.storeId) return setError('Selecciona la tienda donde se publicará el producto.');
    if (categories.length && !form.categoryId && !isEditing) return setError('Selecciona una categoría activa.');
    if (name.length < 3 || name.length > 50) return setError('El nombre debe tener entre 3 y 50 caracteres.');
    if (description.length < 10 || description.length > 200) return setError('La descripción debe tener entre 10 y 200 caracteres.');
    if (!Number.isFinite(price) || price <= 0 || price > 999999) return setError('Indica un precio válido mayor que cero.');
    if (!form.madeToOrder && (!Number.isFinite(count) || count < 0 || count > 999999)) return setError('Indica una cantidad disponible válida.');
    if (!SUPPORTED_CURRENCIES.includes(form.currency)) return setError('Selecciona una moneda válida.');
    if (comment.length > 500) return setError('El comentario no puede exceder 500 caracteres.');

    setError('');
    setSaving(true);
    try {
      await onSave({
        images: pendingImages,
        product,
        removedImageIds,
        removeAllImages,
        values: {
          comentario: comment,
          count: form.madeToOrder ? 0 : count,
          descripcion: description,
          idCategoria: form.categoryId,
          idTienda: form.storeId,
          monedaPrecio: form.currency,
          name,
          precio: price,
          productoDeElaboracion: Boolean(form.madeToOrder),
        },
      });
      pendingImagesRef.current.forEach((image) => URL.revokeObjectURL(image.previewUrl));
      pendingImagesRef.current = [];
      setPendingImages([]);
      onClose();
    } catch (saveError) {
      setError(saveError?.reason || saveError?.message || 'No se pudo guardar el producto.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog fullWidth maxWidth="md" onClose={handleClose} open={open}>
      <DialogTitle>{isEditing ? 'Editar producto' : 'Nuevo producto'}</DialogTitle>
      <Box component="form" onSubmit={submit}>
        <DialogContent className="empresa-product-dialog-content">
          {error ? <Alert severity="error">{error}</Alert> : null}
          <FormControl fullWidth>
            <InputLabel id="empresa-product-store-label">Tienda</InputLabel>
            <Select disabled={isEditing} label="Tienda" labelId="empresa-product-store-label" onChange={(event) => update('storeId', event.target.value)} value={form.storeId}>
              {stores.map((store) => <MenuItem key={store._id} value={store._id}>{store.title || store.name || 'Tienda'}</MenuItem>)}
            </Select>
          </FormControl>

          <Box className="empresa-form-grid">
            <TextField fullWidth label="Nombre" onChange={(event) => update('name', event.target.value)} value={form.name} />
            <FormControl fullWidth>
              <InputLabel id="empresa-product-category-label">Categoría</InputLabel>
              <Select label="Categoría" labelId="empresa-product-category-label" onChange={(event) => update('categoryId', event.target.value)} value={form.categoryId}>
                <MenuItem value="">{categories.length ? 'Sin categoría' : 'Sin categorías activas'}</MenuItem>
                {form.categoryId && !categories.some((category) => category.id === form.categoryId) ? <MenuItem value={form.categoryId}>Categoría actual no disponible</MenuItem> : null}
                {categories.map((category) => <MenuItem key={category.id} value={category.id}>{category.label}</MenuItem>)}
              </Select>
            </FormControl>
          </Box>

          <TextField fullWidth label="Descripción" multiline minRows={3} onChange={(event) => update('description', event.target.value)} value={form.description} />
          <Box className="empresa-form-grid">
            <TextField fullWidth inputProps={{ min: 0.01, step: '0.01' }} label="Precio" onChange={(event) => update('price', event.target.value)} type="number" value={form.price} />
            <FormControl fullWidth>
              <InputLabel id="empresa-product-currency-label">Moneda</InputLabel>
              <Select label="Moneda" labelId="empresa-product-currency-label" onChange={(event) => update('currency', event.target.value)} value={form.currency}>
                {currencies.map((currency) => <MenuItem key={currency} value={currency}>{currency}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField disabled={form.madeToOrder} fullWidth inputProps={{ min: 0, step: 1 }} label="Cantidad" onChange={(event) => update('count', event.target.value)} type="number" value={form.count} />
          </Box>

          <FormControlLabel
            control={<Switch checked={form.madeToOrder} onChange={(event) => update('madeToOrder', event.target.checked)} />}
            label="Producto de elaboración (se prepara a pedido)"
          />
          <TextField fullWidth helperText={`${form.comment.length}/500 · opcional`} inputProps={{ maxLength: 500 }} label="Comentario adicional" multiline minRows={2} onChange={(event) => update('comment', event.target.value)} value={form.comment} />

          <Paper className="empresa-product-image-panel" elevation={0}>
            <Box className="empresa-product-image-copy">
              <Typography fontWeight={700} variant="subtitle2">Imagen del producto</Typography>
              <Typography color="text.secondary" variant="body2">
                {loadingImage ? 'Cargando galería…' : 'Agrega todas las imágenes que necesites; cada archivo puede pesar hasta 10 MB.'}
              </Typography>
              <ProductImageCarousel
                alt={form.name || 'Vista previa del producto'}
                className="empresa-product-gallery"
                fallback={<ImageOutlinedIcon color="disabled" fontSize="large" />}
                images={previewImages}
              />
              {previewImages.length ? (
                <Box className="empresa-product-image-list">
                  {previewImages.map((image, index) => (
                    <Paper className="empresa-product-image-item" elevation={0} key={image.id}>
                      <img alt={`Imagen ${index + 1}`} src={image.url} />
                      <Button
                        aria-label={`Quitar imagen ${index + 1}`}
                        disabled={saving}
                        onClick={() => removeImage(image)}
                        size="small"
                        startIcon={<DeleteOutlineRoundedIcon />}
                      >
                        Quitar
                      </Button>
                    </Paper>
                  ))}
                </Box>
              ) : null}
              <Box className="empresa-product-image-actions">
                <Button component="label" disabled={saving} startIcon={<UploadFileRoundedIcon />} variant="outlined">
                  Agregar imágenes
                  <input accept="image/jpeg,image/png" hidden multiple onChange={pickImage} ref={fileInputRef} type="file" />
                </Button>
                {previewImages.length ? (
                  <Button
                    disabled={saving}
                    onClick={() => {
                      pendingImagesRef.current.forEach((image) => URL.revokeObjectURL(image.previewUrl));
                      pendingImagesRef.current = [];
                      setPendingImages([]);
                      setRemovedImageIds(existingImages.map((image) => image.id));
                      setRemoveAllImages(true);
                      setExistingImages([]);
                    }}
                    startIcon={<DeleteOutlineRoundedIcon />}
                    variant="text"
                  >
                    Quitar todas
                  </Button>
                ) : null}
              </Box>
            </Box>
          </Paper>
        </DialogContent>
        <DialogActions>
          <Button disabled={saving} onClick={handleClose}>Cancelar</Button>
          <Button disabled={saving || !stores.length} startIcon={saving ? <CircularProgress color="inherit" size={16} /> : null} type="submit" variant="contained">
            {saving ? 'Guardando…' : isEditing ? 'Guardar cambios' : 'Crear producto'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}