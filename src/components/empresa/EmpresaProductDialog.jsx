import React from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  Divider,
  Fade,
  FormControl,
  FormControlLabel,
  IconButton,
  InputAdornment,
  InputLabel,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AddPhotoAlternateRoundedIcon from '@mui/icons-material/AddPhotoAlternateRounded';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import AttachMoneyRoundedIcon from '@mui/icons-material/AttachMoneyRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import CategoryRoundedIcon from '@mui/icons-material/CategoryRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import DescriptionRoundedIcon from '@mui/icons-material/DescriptionRounded';
import EditNoteRoundedIcon from '@mui/icons-material/EditNoteRounded';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import Inventory2RoundedIcon from '@mui/icons-material/Inventory2Rounded';
import LocalOfferRoundedIcon from '@mui/icons-material/LocalOfferRounded';
import RocketLaunchRoundedIcon from '@mui/icons-material/RocketLaunchRounded';
import StorefrontRoundedIcon from '@mui/icons-material/StorefrontRounded';
import UploadFileRoundedIcon from '@mui/icons-material/UploadFileRounded';
import { callMeteor } from '../../meteor/client';
import { formatMoney } from '../../domain/commerce';
import { buildMercadoLibrePublication, validateMercadoLibrePublicationAttributes } from '../../domain/mercadoLibrePublication';
import ProductImage from '../ProductImage';

const SUPPORTED_CURRENCIES = ['USD', 'CUP', 'UYU'];
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

export default function EmpresaProductDialog({
  categories = [],
  currencyOptions = [],
  mercadoLibreEnabled = false,
  onClose,
  onSave,
  open,
  product,
  stores = [],
}) {
  const [currentStep, setCurrentStep] = React.useState(0);
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
  const [showComment, setShowComment] = React.useState(false);

  const [mercadoLibreForm, setMercadoLibreForm] = React.useState({
    publish: false,
    categoryId: '',
    condition: 'new',
    familyName: '',
    title: '',
    listingTypeId: 'gold_special',
    userProductId: '',
    manufacturingDays: '',
  });
  const [mercadoLibreQuery, setMercadoLibreQuery] = React.useState('');
  const [mercadoLibreCategories, setMercadoLibreCategories] = React.useState([]);
  const [mercadoLibreAttributes, setMercadoLibreAttributes] = React.useState([]);
  const [mercadoLibreAttributesLoaded, setMercadoLibreAttributesLoaded] = React.useState(false);
  const [mercadoLibreAttributeValues, setMercadoLibreAttributeValues] = React.useState({});
  const [mercadoLibreMaxTitleLength, setMercadoLibreMaxTitleLength] = React.useState(60);
  const [mercadoLibreListingTypes, setMercadoLibreListingTypes] = React.useState([]);
  const [loadingMercadoLibre, setLoadingMercadoLibre] = React.useState(false);

  const fileInputRef = React.useRef(null);
  const isEditing = Boolean(product?._id);
  const firstStoreId = stores[0]?._id || '';
  const pendingImagesRef = React.useRef([]);
  const categoryRequestRef = React.useRef(0);

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

  const steps = React.useMemo(() => {
    const list = [
      { id: 'basics', label: 'Básico', icon: <LocalOfferRoundedIcon fontSize="small" /> },
      { id: 'pricing', label: 'Precio & Stock', icon: <AttachMoneyRoundedIcon fontSize="small" /> },
      { id: 'details', label: 'Fotos & Detalles', icon: <AddPhotoAlternateRoundedIcon fontSize="small" /> },
    ];
    if (mercadoLibreEnabled) {
      list.push({ id: 'mercadolibre', label: 'Mercado Libre', icon: <RocketLaunchRoundedIcon fontSize="small" /> });
    }
    return list;
  }, [mercadoLibreEnabled]);
  const stepProgress = steps.length > 1 ? (currentStep / (steps.length - 1)) * 100 : 0;

  React.useEffect(() => {
    if (!open) return undefined;
    setCurrentStep(0);
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
    setShowComment(Boolean(product?.comentario));
    pendingImagesRef.current.forEach((image) => URL.revokeObjectURL(image.previewUrl));
    pendingImagesRef.current = [];
    setPendingImages([]);
    setExistingImages([]);
    setRemovedImageIds([]);
    setRemoveAllImages(false);
    setMercadoLibreForm({
      publish: false,
      categoryId: product?.mercadoLibre?.categoryId || '',
      condition: 'new',
      familyName: product?.mercadoLibre?.familyName || product?.name || '',
      title: '',
      listingTypeId: 'gold_special',
      userProductId: '',
      manufacturingDays: '',
    });
    setMercadoLibreQuery(product?.name || '');
    setMercadoLibreCategories([]);
    setMercadoLibreAttributes([]);
    setMercadoLibreAttributesLoaded(false);
    categoryRequestRef.current += 1;
    setMercadoLibreAttributeValues({});
    setMercadoLibreMaxTitleLength(60);
    setMercadoLibreListingTypes([]);

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

  React.useEffect(() => {
    if (!open || typeof window === 'undefined') return undefined;

    const { body, documentElement } = document;
    const scrollY = window.scrollY;
    const previousBodyStyles = {
      left: body.style.left,
      overflow: body.style.overflow,
      position: body.style.position,
      right: body.style.right,
      top: body.style.top,
      width: body.style.width,
    };
    const previousDocumentOverflow = documentElement.style.overflow;

    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.left = '0';
    body.style.right = '0';
    body.style.width = '100%';
    body.style.overflow = 'hidden';
    documentElement.style.overflow = 'hidden';

    return () => {
      Object.entries(previousBodyStyles).forEach(([property, value]) => {
        body.style[property] = value;
      });
      documentElement.style.overflow = previousDocumentOverflow;
      window.scrollTo(0, scrollY);
    };
  }, [open]);

  const update = (key, value) => {
    setForm((current) => {
      const next = { ...current, [key]: value };
      if (key === 'name' && !mercadoLibreForm.familyName && !isEditing) {
        setMercadoLibreQuery(value);
        setMercadoLibreForm((prev) => ({ ...prev, familyName: value }));
      }
      return next;
    });
  };

  const updateMercadoLibre = (key, value) => setMercadoLibreForm((current) => ({ ...current, [key]: value }));

  const searchMercadoLibreCategories = async () => {
    const query = mercadoLibreQuery.replace(/\s+/g, ' ').trim();
    if (query.length < 3) {
      setError('Escribe al menos 3 caracteres para buscar categorías de Mercado Libre.');
      return;
    }
    setError('');
    setLoadingMercadoLibre(true);
    try {
      const categoriesFound = await callMeteor('comercio.mercadoLibre.sugerirCategorias', query);
      setMercadoLibreCategories(Array.isArray(categoriesFound) ? categoriesFound : []);
      if (!categoriesFound?.length) setError('Mercado Libre no encontró categorías para ese nombre.');
    } catch (categoryError) {
      setError(categoryError?.reason || categoryError?.message || 'No se pudieron buscar categorías de Mercado Libre.');
    } finally {
      setLoadingMercadoLibre(false);
    }
  };

  const selectMercadoLibreCategory = async (categoryId) => {
    const requestId = ++categoryRequestRef.current;
    updateMercadoLibre('categoryId', categoryId);
    setMercadoLibreAttributeValues({});
    setMercadoLibreAttributes([]);
    setMercadoLibreAttributesLoaded(false);
    setMercadoLibreMaxTitleLength(60);
    if (!categoryId) return;
    setLoadingMercadoLibre(true);
    setError('');
    try {
      const category = await callMeteor('comercio.mercadoLibre.atributosCategoria', categoryId);
      if (requestId !== categoryRequestRef.current) return;
      setMercadoLibreAttributes(Array.isArray(category?.attributes) ? category.attributes : []);
      setMercadoLibreAttributesLoaded(true);
      setMercadoLibreMaxTitleLength(category?.maxTitleLength || 60);
      setMercadoLibreForm((current) => ({
        ...current,
        categoryId,
        familyName: current.familyName || form.name,
      }));
      const types = await callMeteor('comercio.mercadoLibre.tiposPublicacion', Number(form.price) || 1).catch(() => []);
      if (requestId !== categoryRequestRef.current) return;
      setMercadoLibreListingTypes(Array.isArray(types) ? types : []);
    } catch (categoryError) {
      if (requestId === categoryRequestRef.current) setError(categoryError?.reason || categoryError?.message || 'No se pudieron cargar los atributos de la categoría.');
    } finally {
      if (requestId === categoryRequestRef.current) setLoadingMercadoLibre(false);
    }
  };

  const updateMercadoLibreAttribute = (attribute, selectedValue) => {
    const value = attribute.values.find((item) => String(item.id || item.name) === String(selectedValue));
    setMercadoLibreAttributeValues((current) => ({
      ...current,
      [attribute.id]: value
        ? { valueId: value.id || '', valueName: value.name || '' }
        : { valueId: '', valueName: String(selectedValue || '').trim() },
      ...(['GTIN', 'EMPTY_GTIN_REASON'].includes(attribute.id) && selectedValue
        ? { [attribute.id === 'GTIN' ? 'EMPTY_GTIN_REASON' : 'GTIN']: { valueId: '', valueName: '' } }
        : {}),
    }));
  };

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

  // Validaciones de progreso en vivo
  const nameValid = form.name.trim().length >= 3 && form.name.trim().length <= 50;
  const priceValid = Number.isFinite(Number(form.price)) && Number(form.price) > 0 && Number(form.price) <= 999999;
  const descValid = form.description.trim().length >= 10 && form.description.trim().length <= 200;
  const storeValid = Boolean(form.storeId);
  const categoryValid = !categories.length || Boolean(form.categoryId) || isEditing;

  const step0Complete = nameValid && storeValid && categoryValid;
  const step1Complete = priceValid;
  const step2Complete = descValid;

  const completionPercentage = Math.round(
    (Number(storeValid && categoryValid) * 20) +
    (Number(nameValid) * 30) +
    (Number(priceValid) * 25) +
    (Number(descValid) * 25),
  );

  const selectedStore = stores.find((item) => String(item._id) === String(form.storeId));
  const categorySearchOptions = React.useMemo(() => {
    const options = categories.map((category) => ({ ...category, id: String(category.id) }));
    if (form.categoryId && !options.some((category) => category.id === String(form.categoryId))) {
      options.unshift({ id: String(form.categoryId), label: 'Categoría actual no disponible' });
    }
    return options;
  }, [categories, form.categoryId]);
  const selectedCategoryOption = categorySearchOptions.find((category) => category.id === String(form.categoryId)) || null;
  const selectedCategory = categories.find((item) => String(item.id) === String(form.categoryId));
  const firstPreviewImage = previewImages[0]?.url;

  const submit = async (event) => {
    if (event?.preventDefault) event.preventDefault();
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
    if (mercadoLibreForm.publish) {
      if (!mercadoLibreEnabled) return setError('La integración de Mercado Libre está deshabilitada para esta cuenta.');
      if (form.currency !== 'UYU') return setError('Mercado Libre Uruguay requiere que el producto use UYU. El artículo local se puede guardar igualmente quitando esta opción.');
      if (!mercadoLibreForm.categoryId) return setError('Selecciona una categoría de Mercado Libre Uruguay.');
      if (!mercadoLibreAttributesLoaded) return setError('Carga los atributos de la categoría de Mercado Libre antes de publicar.');
      const attributesError = validateMercadoLibrePublicationAttributes(mercadoLibreAttributes, mercadoLibreAttributeValues, mercadoLibreForm.condition);
      if (attributesError) return setError(attributesError);
      if (!(mercadoLibreForm.familyName.trim() || name)) return setError('Indica el nombre genérico de la familia del producto.');
      if (mercadoLibreForm.title.trim().length > mercadoLibreMaxTitleLength) return setError(`El título de Mercado Libre no puede superar ${mercadoLibreMaxTitleLength} caracteres.`);
      if (form.madeToOrder && (!Number.isInteger(Number(mercadoLibreForm.manufacturingDays)) || Number(mercadoLibreForm.manufacturingDays) < 1 || Number(mercadoLibreForm.manufacturingDays) > 60)) {
        return setError('Indica entre 1 y 60 días de elaboración para Mercado Libre.');
      }
    }

    setError('');
    setSaving(true);
    try {
      await onSave({
        images: pendingImages,
        mercadoLibrePublication: buildMercadoLibrePublication(mercadoLibreForm.publish, {
          categoryId: mercadoLibreForm.categoryId,
          condition: mercadoLibreForm.condition,
          familyName: mercadoLibreForm.familyName.trim() || name,
          title: mercadoLibreForm.title.trim(),
          listingTypeId: mercadoLibreForm.listingTypeId,
          userProductId: mercadoLibreForm.userProductId.trim(),
          manufacturingDays: form.madeToOrder ? Number(mercadoLibreForm.manufacturingDays) : undefined,
          attributes: Object.entries(mercadoLibreAttributeValues)
            .map(([id, value]) => ({
              id,
              ...(value.valueId ? { valueId: value.valueId } : {}),
              ...(value.valueName ? { valueName: value.valueName } : {}),
            }))
            .filter((attribute) => attribute.valueId || attribute.valueName),
        }),
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
    <Dialog
      className="empresa-pro-dialog"
      container={() => document.querySelector('.app-root')}
      fullWidth
      maxWidth="md"
      onClose={handleClose}
      open={open}
    >
      {/* Header profesional */}
      <Box className="empresa-pro-dialog-header">
        <Box className="empresa-pro-dialog-header-copy">
          <Box className="empresa-pro-dialog-title-row" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography fontWeight={800} variant="h5">
              {isEditing ? 'Editar producto' : 'Nuevo producto'}
            </Typography>
            <Chip
              color={isEditing ? 'secondary' : 'primary'}
              label={isEditing ? 'Actualizando' : 'Creación guiada'}
              size="small"
              sx={{ fontWeight: 700, borderRadius: '8px' }}
            />
          </Box>
          <Typography color="text.secondary" variant="body2">
            {isEditing
              ? `Modifica los campos necesarios para “${product?.name || 'este producto'}”.`
              : 'Completa los datos esenciales. La vista previa se rellenará automáticamente en tiempo real.'}
          </Typography>
        </Box>
        <IconButton aria-label="Cerrar" onClick={handleClose} size="small" sx={{ color: 'text.secondary' }}>
          <CloseRoundedIcon />
        </IconButton>
      </Box>

      {/* Indicador visual del progreso */}
      <Box
        aria-label="Progreso de edición del producto"
        className="empresa-pro-stepper"
        component="div"
        role="list"
      >
        <span
          aria-hidden="true"
          className="empresa-pro-stepper-track"
          style={{ left: `${50 / steps.length}%`, right: `${50 / steps.length}%` }}
        >
          <span className="empresa-pro-stepper-progress" style={{ width: `${stepProgress}%` }} />
        </span>
        {steps.map((step, idx) => {
          const isDone = (idx === 0 && step0Complete) || (idx === 1 && step1Complete) || (idx === 2 && step2Complete);
          return (
            <Box
              aria-current={currentStep === idx ? 'step' : undefined}
              aria-label={`Paso ${idx + 1}: ${step.label}${isDone ? ', completado' : ''}${currentStep === idx ? ', actual' : ''}`}
              className={`empresa-pro-step ${currentStep === idx ? 'active' : ''} ${isDone ? 'completed' : ''}`}
              component="div"
              key={step.id}
              role="listitem"
            >
              <span className="empresa-pro-step-visual">
                {isDone && currentStep !== idx ? <CheckCircleRoundedIcon fontSize="small" /> : step.icon}
              </span>
              <span className="empresa-pro-step-copy">
                <span className="empresa-pro-step-kicker">Paso {idx + 1}</span>
                <span className="empresa-pro-step-label">{step.label}</span>
              </span>
            </Box>
          );
        })}
      </Box>

      {/* Barra de progreso de completitud */}
      <LinearProgress
        color={completionPercentage === 100 ? 'success' : 'primary'}
        sx={{ height: 3, opacity: 0.85 }}
        value={completionPercentage}
        variant="determinate"
      />

      <Box className="empresa-pro-dialog-form" component="form" onSubmit={submit}>
        <DialogContent className="empresa-pro-dialog-body">
          {/* Columna Izquierda: Formulario paso a paso */}
          <Box className="empresa-pro-form-col">
            {error ? <Alert onClose={() => setError('')} severity="error">{error}</Alert> : null}

            {/* PASO 0: Información básica */}
            {currentStep === 0 && (
              <Fade in timeout={200}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 1.25, sm: 2.2 } }}>
                  <Typography fontWeight={750} sx={{ display: 'flex', alignItems: 'center', gap: 1 }} variant="subtitle1">
                    <LocalOfferRoundedIcon color="primary" fontSize="small" /> 1. Datos básicos
                  </Typography>

                  <FormControl fullWidth size="medium">
                    <InputLabel id="empresa-store-select-label">Sucursal / Tienda *</InputLabel>
                    <Select
                      disabled={isEditing}
                      label="Sucursal / Tienda *"
                      labelId="empresa-store-select-label"
                      onChange={(event) => update('storeId', event.target.value)}
                      startAdornment={<InputAdornment position="start"><StorefrontRoundedIcon color="action" /></InputAdornment>}
                      value={form.storeId}
                    >
                      {stores.map((store) => (
                        <MenuItem key={store._id} value={store._id}>
                          {store.title || store.name || 'Tienda'}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  <TextField
                    autoFocus
                    fullWidth
                    helperText={
                      <Box component="span" sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Nombre comercial claro y atractivo (3 a 50 letras).</span>
                        <span className={`empresa-pro-char-badge ${nameValid ? 'valid' : form.name.length ? 'invalid' : ''}`}>
                          {form.name.length}/50
                        </span>
                      </Box>
                    }
                    InputProps={{
                      startAdornment: <InputAdornment position="start"><LocalOfferRoundedIcon color="action" /></InputAdornment>,
                    }}
                    label="Nombre del producto *"
                    onChange={(event) => update('name', event.target.value)}
                    placeholder="Ej. Mouse Gamer Inalámbrico G502"
                    value={form.name}
                  />

                  <Autocomplete
                    autoHighlight
                    className="empresa-category-autocomplete"
                    disablePortal
                    disabled={!categorySearchOptions.length}
                    fullWidth
                    getOptionLabel={(option) => option?.label || ''}
                    isOptionEqualToValue={(option, value) => String(option.id) === String(value.id)}
                    noOptionsText={categorySearchOptions.length ? 'No encontramos esa categoría' : 'No hay categorías activas'}
                    onChange={(_event, category) => update('categoryId', category?.id || '')}
                    options={categorySearchOptions}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        fullWidth
                        helperText={categories.length
                          ? `Busca por nombre o ruta entre ${categories.length} categorías.`
                          : 'No hay categorías activas disponibles.'}
                        label="Buscar categoría en catálogo *"
                        placeholder={categories.length ? 'Escribe para filtrar…' : 'Sin categorías activas'}
                        InputProps={{
                          ...params.InputProps,
                          startAdornment: (
                            <>
                              <InputAdornment position="start"><CategoryRoundedIcon color="action" /></InputAdornment>
                              {params.InputProps.startAdornment}
                            </>
                          ),
                        }}
                      />
                    )}
                    value={selectedCategoryOption}
                  />

                </Box>
              </Fade>
            )}

            {/* PASO 1: Precio e inventario */}
            {currentStep === 1 && (
              <Fade in timeout={200}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 1.25, sm: 2.2 } }}>
                  <Typography fontWeight={750} sx={{ display: 'flex', alignItems: 'center', gap: 1 }} variant="subtitle1">
                    <AttachMoneyRoundedIcon color="primary" fontSize="small" /> 2. Precio y modalidad de entrega
                  </Typography>

                  <Box>
                    <Typography color="text.secondary" sx={{ mb: 1 }} variant="caption">Moneda del producto:</Typography>
                    <Box className="empresa-pro-currency-bar">
                      {currencies.map((currency) => (
                        <button
                          className={`empresa-pro-currency-pill ${form.currency === currency ? 'selected' : ''}`}
                          key={currency}
                          onClick={() => update('currency', currency)}
                          type="button"
                        >
                          {currency}
                        </button>
                      ))}
                    </Box>
                  </Box>

                  <TextField
                    autoFocus
                    fullWidth
                    inputProps={{ min: 0.01, step: '0.01' }}
                    InputProps={{
                      startAdornment: <InputAdornment position="start">{form.currency === 'USD' ? 'US$' : '$'}</InputAdornment>,
                    }}
                    label="Precio de venta *"
                    onChange={(event) => update('price', event.target.value)}
                    placeholder="0.00"
                    type="number"
                    value={form.price}
                  />

                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.2 }}>
                    <Typography color="text.secondary" variant="caption">Disponibilidad del producto:</Typography>
                    <Box className="empresa-pro-delivery-options" sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.2 }}>
                      <Box
                        className={`empresa-pro-delivery-card ${!form.madeToOrder ? 'active' : ''}`}
                        onClick={() => update('madeToOrder', false)}
                      >
                        <Inventory2RoundedIcon color={!form.madeToOrder ? 'primary' : 'disabled'} />
                        <Box>
                          <Typography fontWeight={700} variant="body2">En inventario</Typography>
                          <Typography color="text.secondary" variant="caption">Stock físico disponible</Typography>
                        </Box>
                      </Box>
                      <Box
                        className={`empresa-pro-delivery-card ${form.madeToOrder ? 'active' : ''}`}
                        onClick={() => update('madeToOrder', true)}
                      >
                        <AutoAwesomeRoundedIcon color={form.madeToOrder ? 'primary' : 'disabled'} />
                        <Box>
                          <Typography fontWeight={700} variant="body2">Por encargo</Typography>
                          <Typography color="text.secondary" variant="caption">Se prepara a pedido</Typography>
                        </Box>
                      </Box>
                    </Box>
                  </Box>

                  <Collapse in={!form.madeToOrder}>
                    <TextField
                      fullWidth
                      helperText="Cantidad de unidades actualmente disponibles en tu tienda."
                      inputProps={{ min: 0, step: 1 }}
                      InputProps={{
                        startAdornment: <InputAdornment position="start"><Inventory2RoundedIcon color="action" /></InputAdornment>,
                      }}
                      label="Cantidad en inventario *"
                      onChange={(event) => update('count', event.target.value)}
                      type="number"
                      value={form.count}
                    />
                  </Collapse>

                </Box>
              </Fade>
            )}

            {/* PASO 2: Fotos y detalles */}
            {currentStep === 2 && (
              <Fade in timeout={200}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 1.25, sm: 2.2 } }}>
                  <Typography fontWeight={750} sx={{ display: 'flex', alignItems: 'center', gap: 1 }} variant="subtitle1">
                    <AddPhotoAlternateRoundedIcon color="primary" fontSize="small" /> 3. Galería y descripción
                  </Typography>

                  {/* Dropzone visual moderno */}
                  <Tooltip arrow describeChild title="Las fotos se guardan en VIDKAR; si el producto está vinculado, se ponen en cola para actualizar el anuncio de Mercado Libre.">
                    <Box className="empresa-pro-dropzone" onClick={() => fileInputRef.current?.click()}>
                      <UploadFileRoundedIcon color="primary" sx={{ fontSize: 36 }} />
                      <Box>
                        <Typography fontWeight={700} variant="body2">Arrastra fotos aquí o haz clic para subir</Typography>
                        <Typography color="text.secondary" variant="caption">JPG o PNG de alta calidad (hasta 10 MB cada una)</Typography>
                      </Box>
                      <input accept="image/jpeg,image/png,image/jpg" hidden multiple onChange={pickImage} ref={fileInputRef} type="file" />
                    </Box>
                  </Tooltip>

                  {/* Lista de miniaturas */}
                  {previewImages.length ? (
                    <Box sx={{ display: 'flex', gap: 1.2, overflowX: 'auto', py: 0.5 }}>
                      {previewImages.map((img, i) => (
                        <Paper className="empresa-product-image-item" elevation={0} key={img.id} sx={{ position: 'relative' }}>
                          <ProductImage alt={`Foto ${i + 1}`} src={img.url} />
                          <Tooltip arrow describeChild title="Quita esta foto de VIDKAR y solicita su actualización en la publicación vinculada.">
                            <span>
                              <Button
                                color="error"
                                disabled={saving}
                                onClick={(e) => { e.stopPropagation(); removeImage(img); }}
                                size="small"
                                startIcon={<DeleteOutlineRoundedIcon />}
                              >
                                Quitar
                              </Button>
                            </span>
                          </Tooltip>
                        </Paper>
                      ))}
                    </Box>
                  ) : null}

                  <TextField
                    autoFocus
                    fullWidth
                    helperText={
                      <Box component="span" sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Describe las características clave (10 a 200 caracteres).</span>
                        <span className={`empresa-pro-char-badge ${descValid ? 'valid' : form.description.length ? 'invalid' : ''}`}>
                          {form.description.length}/200
                        </span>
                      </Box>
                    }
                    InputProps={{
                      startAdornment: <InputAdornment position="start"><DescriptionRoundedIcon color="action" /></InputAdornment>,
                    }}
                    label="Descripción del producto *"
                    minRows={3}
                    multiline
                    onChange={(event) => update('description', event.target.value)}
                    placeholder="Ej. Mouse ergonómico inalámbrico con sensor HERO de 25K DPI, 11 botones programables y batería recargable."
                    value={form.description}
                  />

                  {/* Comentario adicional opcional */}
                  <Box>
                    <Button
                      onClick={() => setShowComment(!showComment)}
                      size="small"
                      startIcon={<EditNoteRoundedIcon />}
                      sx={{ textTransform: 'none', color: 'text.secondary' }}
                    >
                      {showComment ? 'Ocultar comentario adicional' : '+ Agregar comentario o nota interna (opcional)'}
                    </Button>
                    <Collapse in={showComment}>
                      <TextField
                        fullWidth
                        helperText={`${form.comment.length}/500 · visible para el equipo`}
                        inputProps={{ maxLength: 500 }}
                        label="Comentario interno"
                        minRows={2}
                        multiline
                        onChange={(event) => update('comment', event.target.value)}
                        sx={{ mt: 1 }}
                        value={form.comment}
                      />
                    </Collapse>
                  </Box>

                </Box>
              </Fade>
            )}

            {/* PASO 3: Mercado Libre Uruguay (Si está habilitado) */}
            {mercadoLibreEnabled && currentStep === 3 && (
              <Fade in timeout={200}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 1.25, sm: 2.2 } }}>
                  <Typography fontWeight={750} sx={{ display: 'flex', alignItems: 'center', gap: 1 }} variant="subtitle1">
                    <RocketLaunchRoundedIcon color="primary" fontSize="small" /> 4. Mercado Libre Uruguay
                  </Typography>

                  {product?.mercadoLibre?.itemId ? (
                    <Paper elevation={0} sx={{ p: 2, borderRadius: '16px', background: 'var(--surface-soft)' }}>
                      <Typography fontWeight={750} variant="subtitle2">Publicación vinculada en Mercado Libre</Typography>
                      <Typography color="text.secondary" variant="body2">
                        Ítem {product.mercadoLibre.itemId}{product.mercadoLibre.userProductId ? ` · User Product ${product.mercadoLibre.userProductId}` : ''}.
                        Los cambios de precio, stock, descripción e imágenes se enviarán automáticamente al guardar.
                      </Typography>
                    </Paper>
                  ) : (
                    <>
                      <Tooltip arrow describeChild title="Activa la publicación opcional. VIDKAR enviará el producto a Mercado Libre al guardar; sin activarla, se guarda solo en VIDKAR.">
                        <FormControlLabel
                          control={
                            <Switch
                              checked={mercadoLibreForm.publish}
                              onChange={(event) => updateMercadoLibre('publish', event.target.checked)}
                            />
                          }
                          label={
                            <Box>
                              <Typography fontWeight={700} variant="body2">Publicar también en Mercado Libre Uruguay</Typography>
                            </Box>
                          }
                        />
                      </Tooltip>

                      {mercadoLibreForm.publish && (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
                          {form.currency !== 'UYU' && (
                            <Alert
                              action={
                                <Button color="inherit" onClick={() => update('currency', 'UYU')} size="small">
                                  Cambiar a UYU
                                </Button>
                              }
                              severity="warning"
                            >
                              Mercado Libre Uruguay requiere precios en UYU. Tu producto usa {form.currency}.
                            </Alert>
                          )}

                          <Box className="empresa-pro-mercadolibre-search" sx={{ display: 'flex', gap: 1 }}>
                            <TextField
                              fullWidth
                              label="Buscar categoría sugerida en Mercado Libre"
                              onChange={(event) => setMercadoLibreQuery(event.target.value)}
                              placeholder="Ej. Mouse Gamer"
                              value={mercadoLibreQuery}
                            />
                            <Tooltip arrow describeChild title="Busca sugerencias de categoría en Mercado Libre; la categoría elegida define sus atributos obligatorios.">
                              <span>
                                <Button disabled={loadingMercadoLibre} onClick={searchMercadoLibreCategories} variant="outlined">
                                  {loadingMercadoLibre ? <CircularProgress size={18} /> : 'Buscar'}
                                </Button>
                              </span>
                            </Tooltip>
                          </Box>

                          {mercadoLibreCategories.length ? (
                            <FormControl fullWidth>
                              <InputLabel id="mercadolibre-cat-label">Categoría MLU sugerida</InputLabel>
                              <Select
                                label="Categoría MLU sugerida"
                                labelId="mercadolibre-cat-label"
                                onChange={(event) => selectMercadoLibreCategory(event.target.value)}
                                value={mercadoLibreForm.categoryId}
                              >
                                {mercadoLibreCategories.map((cat) => (
                                  <MenuItem key={cat.categoryId} value={cat.categoryId}>
                                    {cat.categoryName} ({cat.categoryId})
                                  </MenuItem>
                                ))}
                              </Select>
                            </FormControl>
                          ) : null}

                          {mercadoLibreForm.categoryId && (
                            <>
                              <Box className="empresa-pro-mercadolibre-attributes" sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
                                <TextField
                                  fullWidth
                                  helperText="Nombre genérico de la familia."
                                  label="Nombre de familia"
                                  onChange={(event) => updateMercadoLibre('familyName', event.target.value)}
                                  value={mercadoLibreForm.familyName || form.name}
                                />
                                <TextField
                                  fullWidth
                                  helperText={`Título (máx ${mercadoLibreMaxTitleLength}). Vacío usa el nombre local.`}
                                  label="Título en Mercado Libre"
                                  onChange={(event) => updateMercadoLibre('title', event.target.value)}
                                  value={mercadoLibreForm.title}
                                />
                                <FormControl fullWidth>
                                  <InputLabel id="ml-condition-label">Condición</InputLabel>
                                  <Select
                                    label="Condición"
                                    labelId="ml-condition-label"
                                    onChange={(event) => updateMercadoLibre('condition', event.target.value)}
                                    value={mercadoLibreForm.condition}
                                  >
                                    <MenuItem value="new">Nuevo</MenuItem>
                                    <MenuItem value="used">Usado</MenuItem>
                                  </Select>
                                </FormControl>
                                <FormControl fullWidth>
                                  <InputLabel id="ml-listing-label">Tipo de publicación</InputLabel>
                                  <Select
                                    label="Tipo de publicación"
                                    labelId="ml-listing-label"
                                    onChange={(event) => updateMercadoLibre('listingTypeId', event.target.value)}
                                    value={mercadoLibreForm.listingTypeId}
                                  >
                                    {(mercadoLibreListingTypes.length ? mercadoLibreListingTypes : [{ id: 'gold_special', name: 'Clásica' }]).map((t) => (
                                      <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>
                                    ))}
                                  </Select>
                                </FormControl>
                              </Box>

                              {/* Atributos dinámicos */}
                              {mercadoLibreAttributes.filter((att) =>
                                att.required || att.newRequired || att.conditionalRequired || ['BRAND', 'MODEL', 'GTIN', 'SELLER_SKU'].includes(att.id),
                              ).map((attribute) => {
                                const selected = mercadoLibreAttributeValues[attribute.id] || { valueId: '', valueName: '' };
                                const required = attribute.required || (mercadoLibreForm.condition === 'new' && attribute.newRequired);
                                const gtinHint = attribute.id === 'GTIN'
                                  ? 'Solo el código de barras real: 8, 12, 13 o 14 dígitos con verificador. Si no tiene, usa «sin código».'
                                  : '';
                                return attribute.values.length ? (
                                  <FormControl fullWidth key={attribute.id}>
                                    <InputLabel id={`attr-select-${attribute.id}`}>{`${attribute.name}${required ? ' *' : ''}`}</InputLabel>
                                    <Select
                                      label={`${attribute.name}${required ? ' *' : ''}`}
                                      labelId={`attr-select-${attribute.id}`}
                                      onChange={(event) => updateMercadoLibreAttribute(attribute, event.target.value)}
                                      value={selected.valueId || selected.valueName}
                                    >
                                      <MenuItem value="">Sin especificar</MenuItem>
                                      {attribute.values.map((val) => (
                                        <MenuItem key={val.id || val.name} value={val.id || val.name}>{val.name}</MenuItem>
                                      ))}
                                    </Select>
                                    {gtinHint ? <Typography color="text.secondary" variant="caption">{gtinHint}</Typography> : null}
                                  </FormControl>
                                ) : (
                                  <TextField
                                    fullWidth
                                    helperText={gtinHint}
                                    inputProps={attribute.id === 'GTIN' ? { inputMode: 'numeric' } : undefined}
                                    key={attribute.id}
                                    label={`${attribute.name}${required ? ' *' : ''}`}
                                    onChange={(event) => updateMercadoLibreAttribute(attribute, event.target.value)}
                                    value={selected.valueName}
                                  />
                                );
                              })}
                            </>
                          )}
                        </Box>
                      )}
                    </>
                  )}

                </Box>
              </Fade>
            )}
          </Box>

          {/* Columna Derecha: Live Preview Card (Se va rellenando en vivo) */}
          <Box className="empresa-pro-preview-col">
            <Paper className="empresa-pro-preview-card" elevation={0}>
              <Box className="empresa-pro-preview-badge">
                <AutoAwesomeRoundedIcon sx={{ fontSize: 16 }} />
                <span>Vista previa en vivo</span>
              </Box>

              <Box className="empresa-pro-preview-img-wrap">
                {firstPreviewImage ? (
                  <ProductImage alt={form.name || 'Producto'} className="empresa-pro-preview-img" src={firstPreviewImage} />
                ) : (
                  <Box className="empresa-pro-preview-img-empty">
                    <ImageOutlinedIcon sx={{ fontSize: 44, opacity: 0.4 }} />
                    <Typography variant="caption">Sin imagen todavía</Typography>
                  </Box>
                )}
                {selectedCategory ? (
                  <Chip
                    label={selectedCategory.label}
                    size="small"
                    sx={{
                      position: 'absolute',
                      top: 10,
                      left: 10,
                      backdropFilter: 'blur(8px)',
                      background: 'rgba(0,0,0,0.65)',
                      color: '#fff',
                      fontWeight: 700,
                      fontSize: '0.7rem',
                    }}
                  />
                ) : null}
              </Box>

              <Box className="empresa-pro-preview-content">
                <Typography color="text.secondary" noWrap sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }} variant="caption">
                  <StorefrontRoundedIcon sx={{ fontSize: 14 }} />
                  {selectedStore?.title || selectedStore?.name || 'Sucursal seleccionada'}
                </Typography>

                <Typography fontWeight={800} noWrap sx={{ color: form.name ? 'text.primary' : 'text.disabled' }} variant="h6">
                  {form.name || 'Nombre de tu producto…'}
                </Typography>

                <Typography
                  color="text.secondary"
                  sx={{
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    minHeight: 38,
                    fontStyle: form.description ? 'normal' : 'italic',
                  }}
                  variant="body2"
                >
                  {form.description || 'La descripción del producto aparecerá aquí a medida que la escribas…'}
                </Typography>

                <Divider sx={{ my: 0.5 }} />

                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Typography fontWeight={800} sx={{ color: 'primary.main' }} variant="h6">
                    {priceValid ? formatMoney(form.price, form.currency) : `${form.currency} 0.00`}
                  </Typography>

                  <Chip
                    color={form.madeToOrder ? 'secondary' : Number(form.count) > 0 ? 'success' : 'default'}
                    label={
                      form.madeToOrder
                        ? 'Por encargo'
                        : Number(form.count) > 0
                          ? `${form.count} en stock`
                          : 'Sin stock'
                    }
                    size="small"
                    sx={{ fontWeight: 700 }}
                  />
                </Box>

                {mercadoLibreEnabled && mercadoLibreForm.publish && (
                  <Chip
                    color="warning"
                    icon={<RocketLaunchRoundedIcon />}
                    label="Mercado Libre activado"
                    size="small"
                    sx={{ mt: 0.5, fontWeight: 700 }}
                    variant="outlined"
                  />
                )}
              </Box>
            </Paper>

            <Typography align="center" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }} variant="caption">
              <InfoOutlinedIcon sx={{ fontSize: 14 }} />
              Los cambios se reflejan al instante en la tienda al guardar.
            </Typography>
          </Box>
        </DialogContent>

        <DialogActions
          className="empresa-pro-dialog-actions"
          disableSpacing
          sx={{ gap: 1, justifyContent: 'space-between', p: '14px 24px', borderTop: '1px solid var(--line-soft)' }}
        >
          <Box className="empresa-pro-dialog-navigation">
            {currentStep > 0 ? (
              <Button
                aria-label={`Atrás: ${steps[currentStep - 1].label}`}
                disabled={saving}
                onClick={() => setCurrentStep((step) => Math.max(step - 1, 0))}
                startIcon={<ArrowBackRoundedIcon />}
                type="button"
              >
                Atrás
              </Button>
            ) : null}
            {currentStep < steps.length - 1 ? (
              <Button
                aria-label={`Siguiente: ${steps[currentStep + 1].label}`}
                disabled={saving || (currentStep === 0 && (!nameValid || !storeValid)) || (currentStep === 1 && !priceValid)}
                endIcon={<ArrowForwardRoundedIcon />}
                onClick={() => setCurrentStep((step) => Math.min(step + 1, steps.length - 1))}
                type="button"
                variant={currentStep === 2 ? 'outlined' : 'contained'}
              >
                Siguiente
              </Button>
            ) : null}
          </Box>
          <Box className="empresa-pro-dialog-actions-primary">
            <Button disabled={saving} onClick={handleClose} type="button">
              Cancelar
            </Button>
            <Button
              disabled={saving || !nameValid || !priceValid || !descValid}
              startIcon={saving ? <CircularProgress color="inherit" size={16} /> : null}
              type="submit"
              variant="contained"
            >
              {saving ? 'Guardando…' : isEditing ? 'Guardar cambios' : 'Crear producto'}
            </Button>
          </Box>
        </DialogActions>
      </Box>
    </Dialog>
  );
}