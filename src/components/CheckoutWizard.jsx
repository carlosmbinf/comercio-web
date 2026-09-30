import React from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  Stack,
  Step,
  StepLabel,
  Stepper,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import CreditCardRoundedIcon from '@mui/icons-material/CreditCardRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import ShoppingBagOutlinedIcon from '@mui/icons-material/ShoppingBagOutlined';
import { formatMoney } from '../domain/commerce';
import { getCommerceDisplayName } from '../config';
import { callMeteor, Meteor } from '../meteor/client';
import { OrdenesCollection } from '../meteor/collections';
import GoogleAddressAutocomplete from './GoogleAddressAutocomplete';
import MapPicker from './MapPicker';
import './checkout.css';

const STEPS = ['Tu pedido', 'Pago', 'Entrega', 'Condiciones', 'Confirmación'];
const PAYMENT_LABELS = {
  paypal: 'PayPal',
  mercadopago: 'MercadoPago',
  efectivo: 'Efectivo o transferencia',
};
const PAYMENT_METHODS = {
  paypal: 'PAYPAL',
  mercadopago: 'MERCADOPAGO',
  efectivo: 'EFECTIVO',
};

const normalizePoint = (value) => {
  if (!value || typeof value !== 'object') return null;
  const latitude = Number(value.latitude ?? value.latitud ?? value.lat);
  const longitude = Number(value.longitude ?? value.longitud ?? value.lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  return { latitude, longitude };
};

const parseCashCurrencies = (result) => {
  if (!Array.isArray(result)) return [{ label: 'Cuba', value: 'CUP' }];
  const options = result
    .filter((item) => item?.active && item?.valor)
    .map((item) => {
      const [country, currency] = String(item.valor).split('-').map((part) => part.trim());
      if (!country || !currency) return null;
      return {
        label: country.charAt(0).toUpperCase() + country.slice(1).toLowerCase(),
        value: currency.toUpperCase(),
      };
    })
    .filter(Boolean);
  return options.length ? options : [{ label: 'Cuba', value: 'CUP' }];
};

const paymentTerms = {
  paypal: [
    'El pago se realizará en la pasarela segura de PayPal; no almacenamos datos bancarios.',
    'El total mostrado incluye la comisión de procesamiento informada por el sistema.',
    'Al continuar, confirmas que revisaste los productos, cantidades y dirección de entrega.',
  ],
  mercadopago: [
    'MercadoPago procesa los datos del medio de pago de forma segura; no almacenamos datos de tarjeta.',
    'El total mostrado incluye la comisión de procesamiento informada por el sistema.',
    'Al continuar, confirmas que revisaste los productos, cantidades y dirección de entrega.',
  ],
  efectivo: [
    'El pedido requiere enviar un comprobante legible con fecha, monto y referencia para validar el pago.',
    'El equipo revisará el comprobante antes de confirmar el cobro y continuar el pedido.',
    'Verifica los datos de pago, productos, cantidades y dirección antes de generar la venta.',
  ],
};

function CheckoutLine({ disabled, item, onRemove }) {
  const name = item?.producto?.name || item?.nombre || 'Producto de comercio';
  const quantity = Math.max(1, Number(item?.cantidad || 1));
  const price = Number(item?.cobrarUSD || item?.producto?.precio || 0);
  const currency = String(item?.monedaACobrar || item?.producto?.monedaPrecio || 'USD').trim().toUpperCase();
  return (
    <Box className="checkout-line">
      <Box className="checkout-line-icon"><ShoppingBagOutlinedIcon /></Box>
      <Box className="checkout-line-copy">
        <Typography fontWeight={750}>{name}</Typography>
        <Typography color="text.secondary" variant="caption">Cantidad: {quantity}</Typography>
      </Box>
      <Typography fontWeight={800} variant="body2">{formatMoney(price * quantity, currency)}</Typography>
      {onRemove ? (
        <IconButton aria-label={`Quitar ${name} del carrito`} color="error" disabled={disabled} onClick={() => onRemove(item)} size="small">
          <DeleteOutlineRoundedIcon fontSize="small" />
        </IconButton>
      ) : null}
    </Box>
  );
}

function MoneyRow({ label, value, currency, strong = false }) {
  return (
    <Box className={strong ? 'money-row total' : 'money-row'}>
      <Typography color={strong ? 'text.primary' : 'text.secondary'} fontWeight={strong ? 800 : 500} variant={strong ? 'subtitle1' : 'body2'}>{label}</Typography>
      <Typography fontWeight={strong ? 850 : 650} variant={strong ? 'h6' : 'body2'}>{formatMoney(value, currency)}</Typography>
    </Box>
  );
}

export default function CheckoutWizard({ cart, onClose, onCompleted, onLogin, open, storefront, user }) {
  const isMobile = useMediaQuery('(max-width:640px)');
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';
  const companyName = getCommerceDisplayName(storefront?.stores);
  const [activeStep, setActiveStep] = React.useState(0);
  const [paymentMethod, setPaymentMethod] = React.useState('');
  const [cashCurrencies, setCashCurrencies] = React.useState([]);
  const [cashCurrency, setCashCurrency] = React.useState('');
  const [countryLoading, setCountryLoading] = React.useState(false);
  const [point, setPoint] = React.useState(null);
  const [addressSearch, setAddressSearch] = React.useState('');
  const [googlePlaceSelected, setGooglePlaceSelected] = React.useState(false);
  const [street, setStreet] = React.useState('');
  const [houseNumber, setHouseNumber] = React.useState('');
  const [savingLocation, setSavingLocation] = React.useState(false);
  const [preparing, setPreparing] = React.useState(false);
  const [calculatingSummary, setCalculatingSummary] = React.useState(false);
  const [processing, setProcessing] = React.useState(false);
  const [fees, setFees] = React.useState(null);
  const [priceSummary, setPriceSummary] = React.useState(null);
  const [checkoutLink, setCheckoutLink] = React.useState('');
  const [waitingForLink, setWaitingForLink] = React.useState(false);
  const [cashOrder, setCashOrder] = React.useState(null);
  const [success, setSuccess] = React.useState('');
  const [error, setError] = React.useState('');
  const [removeTarget, setRemoveTarget] = React.useState(null);
  const [removing, setRemoving] = React.useState(false);
  const orderRequestRef = React.useRef('');
  const waitingTimerRef = React.useRef(null);
  const paymentReturnItemIdsRef = React.useRef(null);
  const paymentReturnAttemptsRef = React.useRef(0);
  const paymentReturnTimeoutRef = React.useRef(null);
  const cartItemsRef = React.useRef(cart.items);
  cartItemsRef.current = cart.items;

  const userId = user?._id;
  const currency = paymentMethod === 'paypal'
    ? 'USD'
    : paymentMethod === 'mercadopago'
      ? 'UYU'
      : cashCurrency || 'CUP';
  const cashAllowed = Boolean(user?.permitirPagoEfectivoCUP);
  const hasCartConflict = cart.conflicts.foreignCommerceItems.length > 0 || cart.conflicts.incompatibleItems.length > 0;
  const firstStore = storefront.stores?.[0];
  const storeCenter = normalizePoint(
    firstStore?.coordenadas || firstStore?.ubicacion || firstStore?.cordenadas,
  );
  const itemsForCheckout = React.useMemo(() => {
    if (!point) return cart.items;
    const coordenadas = { latitude: Number(point.latitude), longitude: Number(point.longitude) };
    return cart.items.map((item) => ({
      ...item,
      coordenadas,
      nombreCalle: street.trim(),
      numeroCasa: houseNumber.trim(),
    }));
  }, [cart.items, houseNumber, point, street]);

  const activeOrderState = Meteor.useTracker(() => {
    if (!userId) return { order: null, ready: false };
    const selector = { userId, status: { $nin: ['COMPLETED', 'CANCELLED'] } };
    const handle = Meteor.subscribe('ordenes', selector, {
      fields: { _id: 1, userId: 1, type: 1, status: 1, link: 1, carritos: 1, comisiones: 1, createdAt: 1 },
    });
    return {
      order: OrdenesCollection.findOne(selector, { sort: { createdAt: -1 } }) || null,
      ready: handle.ready(),
    };
  }, [userId]);

  React.useEffect(() => {
    if (!open || point || !cart.items.length) return;
    const savedItem = cart.items.find((item) => normalizePoint(item?.coordenadas));
    const savedItemPoint = normalizePoint(savedItem?.coordenadas);
    if (savedItemPoint) {
      setPoint(savedItemPoint);
      const savedStreet = String(savedItem?.nombreCalle || '').trim();
      const savedHouseNumber = String(savedItem?.numeroCasa || '').trim();
      setStreet(savedStreet);
      setHouseNumber(savedHouseNumber);
      setAddressSearch([savedStreet, savedHouseNumber].filter(Boolean).join(', '));
      setGooglePlaceSelected(false);
      return;
    }
    try {
      const cached = normalizePoint(JSON.parse(localStorage.getItem('vidkar.web.comercio.last-location') || 'null'));
      if (cached) setPoint(cached);
    } catch (_error) {
      // La ubicación puede seleccionarse directamente en el mapa.
    }
  }, [cart.items, open, point]);

  React.useEffect(() => {
    if (!open || paymentMethod !== 'efectivo') return undefined;
    let active = true;
    setCountryLoading(true);
    callMeteor('property.getVariasPropertys', 'METODO_PAGO', 'REMESA')
      .then((result) => {
        if (!active) return;
        const options = parseCashCurrencies(result);
        setCashCurrencies(options);
        setCashCurrency((current) => options.some((option) => option.value === current) ? current : options[0].value);
      })
      .catch(() => {
        if (active) {
          const fallback = [{ label: 'Cuba', value: 'CUP' }];
          setCashCurrencies(fallback);
          setCashCurrency((current) => current || 'CUP');
        }
      })
      .finally(() => { if (active) setCountryLoading(false); });
    return () => { active = false; };
  }, [open, paymentMethod]);

  React.useEffect(() => {
    if (!waitingForLink || !activeOrderState.order?.link) return undefined;
    const expectedType = PAYMENT_METHODS[paymentMethod];
    if (activeOrderState.order.type !== expectedType) return undefined;
    setCheckoutLink(activeOrderState.order.link);
    setWaitingForLink(false);
    if (waitingTimerRef.current) window.clearTimeout(waitingTimerRef.current);
    return undefined;
  }, [activeOrderState.order, paymentMethod, waitingForLink]);

  React.useEffect(() => () => {
    if (waitingTimerRef.current) window.clearTimeout(waitingTimerRef.current);
  }, []);

  React.useEffect(() => {
    let appWasBackgrounded = false;

    const clearReconciliation = () => {
      if (paymentReturnTimeoutRef.current) {
        window.clearTimeout(paymentReturnTimeoutRef.current);
        paymentReturnTimeoutRef.current = null;
      }
    };

    const reconcileCart = () => {
      const paidItemIds = paymentReturnItemIdsRef.current;
      if (!paidItemIds || document.visibilityState === 'hidden') return;

      const hasPaidItemsInCart = cartItemsRef.current.some((item) => paidItemIds.has(String(item?._id)));
      if (!hasPaidItemsInCart) {
        paymentReturnItemIdsRef.current = null;
        clearReconciliation();
        return;
      }

      if (paymentReturnAttemptsRef.current >= 30) {
        paymentReturnItemIdsRef.current = null;
        clearReconciliation();
        return;
      }

      paymentReturnAttemptsRef.current += 1;
      cart.refresh();
      paymentReturnTimeoutRef.current = window.setTimeout(reconcileCart, 2000);
    };

    const handleBlur = () => {
      if (paymentReturnItemIdsRef.current) appWasBackgrounded = true;
    };

    const handleReturn = () => {
      if (!appWasBackgrounded || document.visibilityState === 'hidden') return;
      appWasBackgrounded = false;
      clearReconciliation();
      reconcileCart();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') handleBlur();
      else handleReturn();
    };

    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleReturn);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleReturn);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearReconciliation();
    };
  }, [cart.refresh]);

  const reset = React.useCallback(() => {
    setActiveStep(0);
    setPaymentMethod('');
    setCashCurrencies([]);
    setCashCurrency('');
    setCountryLoading(false);
    setPoint(null);
    setAddressSearch('');
    setGooglePlaceSelected(false);
    setStreet('');
    setHouseNumber('');
    setSavingLocation(false);
    setPreparing(false);
    setCalculatingSummary(false);
    setProcessing(false);
    setFees(null);
    setPriceSummary(null);
    setCheckoutLink('');
    setWaitingForLink(false);
    setCashOrder(null);
    setSuccess('');
    setError('');
    setRemoveTarget(null);
    setRemoving(false);
    orderRequestRef.current = '';
    if (waitingTimerRef.current) window.clearTimeout(waitingTimerRef.current);
  }, []);

  React.useEffect(() => {
    if (
      !open ||
      cart.loading ||
      cart.items.length > 0 ||
      activeStep === 0 ||
      preparing ||
      processing ||
      savingLocation
    ) {
      return;
    }

    reset();
  }, [activeStep, cart.items.length, cart.loading, open, preparing, processing, reset, savingLocation]);

  const close = () => {
    if (preparing || processing || savingLocation) return;
    reset();
    onClose();
  };

  const choosePayment = (method) => {
    setPaymentMethod(method);
    setCashCurrency(method === 'paypal' ? 'USD' : method === 'mercadopago' ? 'UYU' : '');
    setFees(null);
    setPriceSummary(null);
    setCheckoutLink('');
    setCashOrder(null);
    setSuccess('');
    setError('');
    orderRequestRef.current = '';
  };

  const handleRemoveItem = async () => {
    if (!removeTarget || removing) return;
    setRemoving(true);
    setError('');
    try {
      await cart.removeItem(removeTarget);
      setRemoveTarget(null);
    } catch (removeError) {
      setError(removeError?.reason || removeError?.message || 'No se pudo quitar el artículo del carrito.');
    } finally {
      setRemoving(false);
    }
  };

  const getSummaryValues = async (commerceFees, selectedCurrency) => {
    let subtotal = 0;
    for (const item of itemsForCheckout) {
      const quantity = Math.max(1, Number(item?.cantidad || 1));
      const value = Number(item?.cobrarUSD || 0) * quantity;
      const from = String(item?.monedaACobrar || 'CUP').toUpperCase();
      if (!value || from === selectedCurrency) {
        subtotal += value;
      } else {
        subtotal += Number(await callMeteor('moneda.convertir', value, from, selectedCurrency)) || 0;
      }
    }

    const commissionValue = Number(commerceFees?.totalFinal || 0);
    const commissionCurrency = String(commerceFees?.moneda || selectedCurrency).toUpperCase();
    const commissionTotal = commissionCurrency === selectedCurrency || !commissionValue
      ? commissionValue
      : Number(await callMeteor('moneda.convertir', commissionValue, commissionCurrency, selectedCurrency)) || 0;
    return { commissionTotal, subtotal, subtotalAndFees: subtotal + commissionTotal };
  };

  const prepareCheckout = async () => {
    if (!userId || !paymentMethod || !point || !cart.items.length) {
      setError('Faltan datos del pedido, pago o entrega para continuar.');
      return;
    }

    const key = [
      userId,
      paymentMethod,
      currency,
      cart.items.map((item) => `${item._id}:${item.cantidad}`).sort().join(','),
      point.latitude,
      point.longitude,
    ].join('|');
    if (orderRequestRef.current === key && (checkoutLink || cashOrder || preparing)) return;
    orderRequestRef.current = key;
    setPreparing(true);
    setCalculatingSummary(true);
    setError('');
    setCheckoutLink('');
    setCashOrder(null);
    setPriceSummary(null);
    setWaitingForLink(false);

    try {
      const calculatedFees = await callMeteor('comercio.calcularCostosEntrega', itemsForCheckout, currency);
      if (!calculatedFees || typeof calculatedFees !== 'object') {
        throw new Error('No se pudieron calcular los costos de entrega.');
      }
      const summary = await getSummaryValues(calculatedFees, currency);
      const totalMethod = paymentMethod === 'paypal'
        ? 'paypal.totalAPagar'
        : paymentMethod === 'mercadopago'
          ? 'mercadopago.totalAPagar'
          : 'efectivo.totalAPagar';
      const rawTotal = paymentMethod === 'efectivo'
        ? await callMeteor(totalMethod, itemsForCheckout, currency, calculatedFees)
        : await callMeteor(totalMethod, itemsForCheckout, calculatedFees, currency);
      const total = Number(rawTotal);
      if (!Number.isFinite(total) || total <= 0) {
        throw new Error('El servidor no devolvió un total válido para este pedido.');
      }
      setFees(calculatedFees);
      setPriceSummary({ ...summary, total, currency });
      setCalculatingSummary(false);

      await callMeteor('cancelarOrdenesPaypalIncompletas', userId);

      if (paymentMethod === 'paypal') {
        const created = await callMeteor(
          'creandoOrden',
          userId,
          total,
          `Compra en ${companyName}`,
          itemsForCheckout,
          calculatedFees,
          true,
        );
        const link = created?.link || created?.links?.find((item) => item?.rel === 'approve')?.href;
        if (link) setCheckoutLink(link);
        else {
          setWaitingForLink(true);
          waitingTimerRef.current = window.setTimeout(() => {
            setWaitingForLink(false);
            setError('La orden se creó, pero no llegó el enlace de PayPal. Intenta reintentar o revisa tus pedidos.');
          }, 12000);
        }
      } else if (paymentMethod === 'mercadopago') {
        const link = await callMeteor(
          'mercadopago.createOrder',
          userId,
          itemsForCheckout,
          calculatedFees,
          total,
          `Compra en ${companyName}`,
          currency,
          true,
        );
        if (typeof link !== 'string' || !/^https:\/\//i.test(link)) {
          throw new Error('MercadoPago no devolvió un enlace de pago válido.');
        }
        setCheckoutLink(link);
      } else {
        const created = await callMeteor('efectivo.createOrder', userId, itemsForCheckout, calculatedFees);
        if (!created?.success || !created?.ordenId) {
          throw new Error(created?.message || 'No se pudo crear la orden de pago en efectivo.');
        }
        setCashOrder({
          _id: created.ordenId,
          userId,
          carritos: itemsForCheckout,
          comisiones: calculatedFees,
        });
      }
    } catch (checkoutError) {
      orderRequestRef.current = '';
      setError(checkoutError?.reason || checkoutError?.message || 'No se pudo preparar la compra.');
    } finally {
      setCalculatingSummary(false);
      setPreparing(false);
    }
  };

  const handleNext = async () => {
    setError('');
    if (activeStep === 0) {
      if (!userId) setError('Inicia sesión para consultar y finalizar tu carrito.');
      else if (hasCartConflict) setError('Resuelve la compra activa de otro comercio o servicio antes de continuar.');
      else if (!cart.items.length) setError('Agrega al menos un producto para continuar.');
      else setActiveStep(1);
      return;
    }
    if (activeStep === 1) {
      if (!paymentMethod) {
        setError('Selecciona un método de pago.');
        return;
      }
      if (paymentMethod === 'efectivo' && !cashCurrency) {
        setError('Selecciona el país o la moneda en la que realizarás el pago.');
        return;
      }
      setActiveStep(2);
      return;
    }
    if (activeStep === 2) {
      const normalizedPoint = normalizePoint(point);
      if (!normalizedPoint) {
        setError('Marca una ubicación válida en el mapa o usa tu ubicación actual.');
        return;
      }
      setSavingLocation(true);
      try {
        await callMeteor('carrito.actualizarUbicacion', userId, {
          latitude: normalizedPoint.latitude,
          longitude: normalizedPoint.longitude,
          nombreCalle: street.trim(),
          numeroCasa: houseNumber.trim(),
        });
        setPoint(normalizedPoint);
        try {
          localStorage.setItem('vidkar.web.comercio.last-location', JSON.stringify(normalizedPoint));
        } catch (_error) {
          // No impedir el checkout si el navegador bloquea localStorage.
        }
        setActiveStep(3);
      } catch (locationError) {
        setError(locationError?.reason || locationError?.message || 'No se pudo guardar la ubicación de entrega.');
      } finally {
        setSavingLocation(false);
      }
      return;
    }
    if (activeStep === 3) {
      if (paymentMethod === 'efectivo' && !cashAllowed) {
        setError('Esta cuenta no tiene habilitado el pago en efectivo. Selecciona PayPal o MercadoPago.');
        return;
      }
      setActiveStep(4);
      prepareCheckout();
    }
  };

  const handleBack = () => {
    setError('');
    if (activeStep > 0 && !preparing && !processing) setActiveStep((step) => step - 1);
  };

  const handleUseMyLocation = () => {
    setError('');
    if (!navigator?.geolocation) {
      setError('Este navegador no permite obtener la ubicación. Marca el punto manualmente en el mapa.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextPoint = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        setPoint(nextPoint);
        setAddressSearch('');
        setStreet('');
        setHouseNumber('');
        setGooglePlaceSelected(false);
      },
      (locationError) => setError(
        locationError?.code === locationError.PERMISSION_DENIED
          ? 'Permiso de ubicación denegado. Marca el punto de entrega en el mapa.'
          : 'No pudimos obtener tu ubicación. Marca el punto en el mapa o ingresa las coordenadas.',
      ),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
    );
  };

  const handleAddressInputChange = (value) => {
    setAddressSearch(value);
    setStreet(value);
    if (googlePlaceSelected) {
      setPoint(null);
      setHouseNumber('');
      setGooglePlaceSelected(false);
    }
  };

  const handleGooglePlaceSelected = ({ address, houseNumber: selectedHouseNumber, point: selectedPoint, street: selectedStreet }) => {
    setAddressSearch(address);
    setPoint(selectedPoint);
    setStreet(selectedStreet);
    setHouseNumber(selectedHouseNumber);
    setGooglePlaceSelected(true);
    setError('');
  };

  const handleMapPointChange = (nextPoint) => {
    setPoint(nextPoint);
    setGooglePlaceSelected(false);
  };

  const handleCashSale = async () => {
    if (!cashOrder || processing) return;
    setProcessing(true);
    setError('');
    try {
      const saleOrder = activeOrderState.order?._id === cashOrder._id
        ? activeOrderState.order
        : cashOrder;
      await callMeteor(
        'generarVentaEfectivo',
        { producto: saleOrder, precioOficial: null, comisionesComercio: fees },
        currency,
      );
      setSuccess('Tu pedido fue registrado. Puedes consultar su avance y enviar el comprobante desde “Mis pedidos”.');
    } catch (saleError) {
      setError(saleError?.reason || saleError?.message || 'No se pudo registrar la venta.');
    } finally {
      setProcessing(false);
    }
  };

  const handleExternalPayment = () => {
    if (!checkoutLink) {
      setError('Aún no hay un enlace de pago. Reintenta la preparación de la orden.');
      return;
    }
    paymentReturnItemIdsRef.current = new Set(cart.items.map((item) => String(item._id)));
    paymentReturnAttemptsRef.current = 0;
    window.open(checkoutLink, '_blank', 'noopener,noreferrer');
  };

  const markExternalPaymentOpened = () => {
    paymentReturnItemIdsRef.current = new Set(cart.items.map((item) => String(item._id)));
    paymentReturnAttemptsRef.current = 0;
  };

  const getStepContent = () => {
    if (activeStep === 0) {
      return (
        <Box className="checkout-step-content">
          <Box className="checkout-section-heading">
            <Box className="checkout-step-icon"><ShoppingBagOutlinedIcon /></Box>
            <Box><Typography variant="h6">Revisa tu pedido</Typography><Typography color="text.secondary" variant="body2">Confirma los productos y cantidades antes de continuar.</Typography></Box>
          </Box>
          {!userId ? (
            <Paper className="preparing-card" elevation={0}>
              <Box className="checkout-step-icon"><LockRoundedIcon /></Box>
              <Typography fontWeight={750}>Inicia sesión para comprar</Typography>
              <Typography color="text.secondary" variant="body2">Tu carrito y tus pedidos se guardan en tu cuenta.</Typography>
              <Button onClick={onLogin} variant="contained">Iniciar sesión</Button>
            </Paper>
          ) : cart.loading ? (
            <Paper className="preparing-card" elevation={0}><CircularProgress size={25} /><Typography color="text.secondary">Sincronizando tu carrito…</Typography></Paper>
          ) : cart.items.length === 0 ? (
            <Paper className="preparing-card" elevation={0}>
              <Box className="checkout-step-icon"><ShoppingBagOutlinedIcon /></Box>
              <Typography fontWeight={750}>Tu carrito está vacío</Typography>
              <Typography color="text.secondary" variant="body2">Explora el catálogo y agrega los productos que quieras comprar.</Typography>
              <Button onClick={close} variant="outlined">Volver a la tienda</Button>
            </Paper>
          ) : (
            <>
              {hasCartConflict ? (
                <Alert severity="warning">
                  {cart.conflicts.foreignCommerceItems.length
                    ? 'Hay artículos de otra tienda en tu carrito. Para no mezclar empresas, finaliza o retira esa compra desde donde la agregaste.'
                    : 'Hay una compra activa de otro tipo. Finalízala o cancélala antes de continuar.'}
                </Alert>
              ) : null}
              <Stack spacing={1}>
                {cart.items.map((item) => <CheckoutLine disabled={removing} item={item} key={item._id} onRemove={(selectedItem) => setRemoveTarget(selectedItem)} />)}
              </Stack>
              <Alert className="checkout-note" severity="info">El costo de entrega se calculará al marcar la ubicación donde recibirás tu compra.</Alert>
            </>
          )}
        </Box>
      );
    }

    if (activeStep === 1) {
      return (
        <Box className="checkout-step-content">
          <Box className="checkout-section-heading">
            <Box className="checkout-step-icon"><AccountBalanceWalletOutlinedIcon /></Box>
            <Box><Typography variant="h6">Elige cómo pagar</Typography><Typography color="text.secondary" variant="body2">El servidor calculará comisiones y total en la moneda correspondiente.</Typography></Box>
          </Box>
          <Box className="payment-options">
            {[
              { value: 'paypal', label: 'PayPal', description: 'Paga de forma segura en USD.', icon: <PaymentsOutlinedIcon /> },
              { value: 'mercadopago', label: 'MercadoPago', description: 'Paga en UYU mediante MercadoPago.', icon: <CreditCardRoundedIcon /> },
              ...(cashAllowed ? [{ value: 'efectivo', label: 'Efectivo o transferencia', description: 'Sube el comprobante para validar tu pago.', icon: <AccountBalanceWalletOutlinedIcon /> }] : []),
            ].map((option) => (
              <Button
                className={paymentMethod === option.value ? 'payment-option selected' : 'payment-option'}
                key={option.value}
                onClick={() => choosePayment(option.value)}
              >
                <Box className="payment-option-icon">{option.icon}</Box>
                <Box className="payment-option-copy"><Typography fontWeight={800}>{option.label}</Typography><Typography color="text.secondary" variant="caption">{option.description}</Typography></Box>
                <span className="payment-radio" />
              </Button>
            ))}
          </Box>
          {paymentMethod === 'efectivo' ? (
            <FormControl fullWidth sx={{ mt: 2 }}>
              <InputLabel id="cash-currency-label">País y moneda</InputLabel>
              <Select
                label="País y moneda"
                labelId="cash-currency-label"
                onChange={(event) => setCashCurrency(event.target.value)}
                value={cashCurrency}
              >
                {cashCurrencies.map((option) => <MenuItem key={`${option.label}-${option.value}`} value={option.value}>{option.label} · {option.value}</MenuItem>)}
              </Select>
            </FormControl>
          ) : null}
          {paymentMethod === 'efectivo' && countryLoading ? <Box className="checkout-inline-loading"><CircularProgress size={17} /> Cargando opciones de pago…</Box> : null}
          {paymentMethod ? <Chip className="selected-payment-chip" icon={<CheckCircleOutlineRoundedIcon />} label={`${PAYMENT_LABELS[paymentMethod]} · ${currency}`} variant="outlined" /> : null}
        </Box>
      );
    }

    if (activeStep === 2) {
      return (
        <Box className="checkout-step-content">
          <Box className="checkout-section-heading">
            <Box className="checkout-step-icon"><LocationOnOutlinedIcon /></Box>
            <Box><Typography variant="h6">¿Dónde lo recibes?</Typography><Typography color="text.secondary" variant="body2">Marca el punto exacto. Se usará para calcular el envío y actualizar los artículos de tu carrito.</Typography></Box>
          </Box>
          <GoogleAddressAutocomplete
            onInputValueChange={handleAddressInputChange}
            onPlaceSelected={handleGooglePlaceSelected}
            value={addressSearch}
          />
          <MapPicker center={storeCenter} onChange={handleMapPointChange} point={point} />
          <Button className="use-location-button" onClick={handleUseMyLocation} startIcon={<LocationOnOutlinedIcon />} variant="outlined">Usar mi ubicación actual</Button>
          <Box className="delivery-address-fields">
            <TextField label="Número / apartamento" onChange={(event) => setHouseNumber(event.target.value)} value={houseNumber} />
          </Box>
        </Box>
      );
    }

    if (activeStep === 3) {
      return (
        <Box className="checkout-step-content">
          <Box className="checkout-section-heading">
            <Box className="checkout-step-icon"><CheckCircleOutlineRoundedIcon /></Box>
            <Box><Typography variant="h6">Condiciones de compra</Typography><Typography color="text.secondary" variant="body2">Revisa estos puntos antes de confirmar tu pedido.</Typography></Box>
          </Box>
          <Paper className="terms-panel" elevation={0}>
            <Chip color="primary" label={`Términos · ${PAYMENT_LABELS[paymentMethod] || 'Pago'}`} size="small" />
            <Stack divider={<Divider flexItem />} spacing={1.5} sx={{ mt: 2 }}>
              {(paymentTerms[paymentMethod] || paymentTerms.efectivo).map((term, index) => (
                <Typography key={term} variant="body2"><strong>{index + 1}.</strong> {term}</Typography>
              ))}
            </Stack>
            <Alert severity="info" sx={{ mt: 2.5 }}>
              Al seleccionar “Aceptar y revisar pedido”, confirmas que leíste estas condiciones y que los datos de entrega son correctos.
            </Alert>
          </Paper>
        </Box>
      );
    }

    return (
      <Box className="checkout-step-content">
        <Box className="checkout-section-heading">
          <Box className="checkout-step-icon"><PaymentsOutlinedIcon /></Box>
          <Box><Typography variant="h6">Resumen final</Typography><Typography color="text.secondary" variant="body2">Los importes se calculan con los métodos de pago existentes del servidor.</Typography></Box>
        </Box>
        {calculatingSummary ? (
          <Paper className="preparing-card" elevation={0}>
            <CircularProgress size={30} />
            <Typography fontWeight={750}>Calculando el total de tu pedido…</Typography>
            <Typography color="text.secondary" variant="body2">Mostraremos el resumen cuando terminen los cálculos.</Typography>
          </Paper>
        ) : null}
        {preparing && !calculatingSummary && priceSummary && !checkoutLink && !cashOrder ? (
          <Alert severity="info" sx={{ mb: 2 }}>
            Total calculado. Estamos preparando la orden de pago…
          </Alert>
        ) : null}
        {waitingForLink ? <Alert severity="info" sx={{ mb: 2 }}>Esperando el enlace seguro de PayPal…</Alert> : null}
        {priceSummary ? (
          <Paper className="checkout-total-card" elevation={0}>
            <Box className="checkout-total-heading"><Box><Typography color="text.secondary" variant="overline">DETALLE DEL PAGO</Typography><Typography fontWeight={800} variant="h6">{PAYMENT_LABELS[paymentMethod]} · {currency}</Typography></Box></Box>
            <Divider sx={{ my: 2 }} />
            <MoneyRow currency={currency} label="Subtotal de productos" value={priceSummary.subtotal} />
            <MoneyRow currency={currency} label="Entrega y comisiones de comercio" value={priceSummary.commissionTotal} />
            {(paymentMethod === 'paypal' || paymentMethod === 'mercadopago') ? (
              <MoneyRow currency={currency} label={`Comisión ${PAYMENT_LABELS[paymentMethod]}`} value={Math.max(0, priceSummary.total - priceSummary.subtotalAndFees)} />
            ) : null}
            <Divider sx={{ my: 1.5 }} />
            <MoneyRow currency={currency} label="TOTAL A PAGAR" strong value={priceSummary.total} />
            {fees?.desglosePorTienda?.length ? (
              <Box className="fee-breakdown">
                <Typography color="text.secondary" variant="caption">DETALLE DE ENTREGA</Typography>
                {fees.desglosePorTienda.map((shop) => (
                  <Box className="fee-breakdown-row" key={shop.idTienda}>
                    <Typography variant="body2">{shop.nombreTienda} · {shop.distanciaKm} km</Typography>
                    <Typography fontWeight={700} variant="body2">{formatMoney(shop.costoEntrega, shop.moneda || currency)}</Typography>
                  </Box>
                ))}
              </Box>
            ) : null}
          </Paper>
        ) : null}
        {paymentMethod === 'efectivo' && cashOrder ? (
          <Alert severity="warning" sx={{ mt: 2 }}>
            Al generar la venta, podrás consultar los datos de pago y enviar el comprobante desde “Mis pedidos”.
          </Alert>
        ) : null}
        {checkoutLink ? (
          <Alert severity="success" sx={{ mt: 2 }}>
            La orden está lista. La pasarela se abrirá en otra pestaña; al finalizar, vuelve aquí para consultar el estado en “Mis pedidos”.
          </Alert>
        ) : null}
        {success ? (
          <Alert severity="success" sx={{ mt: 2 }}>{success}</Alert>
        ) : null}
      </Box>
    );
  };

  const finalDisabled = preparing || processing || savingLocation ||
    (activeStep === 4 && !success && (paymentMethod === 'efectivo' ? !cashOrder : !checkoutLink));
  const progressPercent = ((activeStep + 1) / STEPS.length) * 100;

  return (
    <>
    <Dialog
      fullScreen={isMobile}
      fullWidth
      maxWidth="md"
      onClose={close}
      open={open}
      PaperProps={{ className: `checkout-dialog-paper${isDarkMode ? ' checkout-dark' : ''}` }}
    >
      <DialogTitle className="checkout-dialog-title">
        <Box>
          <Typography color="text.secondary" variant="overline">{`COMPRA SEGURA · ${companyName.toLocaleUpperCase('es')}`}</Typography>
          <Typography variant="h5">{activeStep === 0 ? 'Carrito de compras' : 'Finaliza tu pedido'}</Typography>
        </Box>
        <IconButton aria-label="Cerrar checkout" disabled={preparing || processing || savingLocation} onClick={close}><CloseRoundedIcon /></IconButton>
      </DialogTitle>
      <DialogContent className="checkout-dialog-content" dividers>
        <Box className="checkout-mobile-progress">
          <Box className="checkout-progress-copy"><Typography color="text.secondary" variant="caption">PASO {activeStep + 1} DE {STEPS.length}</Typography><Typography fontWeight={800} variant="body2">{STEPS[activeStep]}</Typography></Box>
          <LinearProgress value={progressPercent} variant="determinate" />
        </Box>
        <Stepper activeStep={activeStep} alternativeLabel className="checkout-stepper">
          {STEPS.map((label) => <Step key={label}><StepLabel>{label}</StepLabel></Step>)}
        </Stepper>
        {error ? <Alert onClose={() => setError('')} severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}
        {getStepContent()}
      </DialogContent>
      <DialogActions className="checkout-dialog-actions">
        {activeStep > 0 && !success ? (
          <Button disabled={preparing || processing || savingLocation} onClick={handleBack} startIcon={<ArrowBackRoundedIcon />} variant="text">Atrás</Button>
        ) : <Box sx={{ flex: 1 }} />}
        {activeStep < STEPS.length - 1 ? (
          <Button
            disabled={!userId || cart.items.length === 0 || hasCartConflict || (activeStep === 1 && !paymentMethod) || (activeStep === 2 && (!point || savingLocation)) || preparing || processing}
            onClick={handleNext}
            size="large"
            variant="contained"
          >
            {savingLocation ? <CircularProgress color="inherit" size={18} /> : activeStep === 3 ? 'Aceptar y revisar pedido' : 'Continuar'}
          </Button>
        ) : success ? (
          <Button onClick={onCompleted} size="large" variant="contained">Ver mis pedidos</Button>
        ) : paymentMethod === 'efectivo' ? (
          <Button disabled={finalDisabled} onClick={handleCashSale} size="large" variant="contained">
            {processing ? 'Registrando…' : 'Generar venta'}
          </Button>
        ) : (
          <Button disabled={finalDisabled} onClick={handleExternalPayment} size="large" variant="contained">
            {preparing ? 'Preparando…' : checkoutLink ? `Abrir ${PAYMENT_LABELS[paymentMethod]}` : 'Preparando pago…'}
          </Button>
        )}
        {activeStep === 4 && error && !preparing && !success ? (
          <Button onClick={() => { orderRequestRef.current = ''; prepareCheckout(); }} variant="outlined">Reintentar</Button>
        ) : null}
      </DialogActions>
      {activeStep === 4 && checkoutLink ? (
        <Box className="checkout-fallback-link">
          <Button component="a" href={checkoutLink} onClick={markExternalPaymentOpened} rel="noopener noreferrer" target="_blank" variant="text">Si no se abrió la pasarela, pulsa aquí</Button>
        </Box>
      ) : null}
    </Dialog>
      <Dialog onClose={() => !removing && setRemoveTarget(null)} open={Boolean(removeTarget)}>
        <DialogTitle>¿Quitar este artículo?</DialogTitle>
        <DialogContent>
          <Typography color="text.secondary">{removeTarget?.producto?.name || 'El producto'} se retirará de tu carrito.</Typography>
        </DialogContent>
        <DialogActions>
          <Button disabled={removing} onClick={() => setRemoveTarget(null)}>Conservar</Button>
          <Button color="error" disabled={removing} onClick={handleRemoveItem} variant="contained">{removing ? 'Retirando…' : 'Quitar artículo'}</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
