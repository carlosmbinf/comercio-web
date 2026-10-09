const METHODS_BY_CURRENCY = {
  CUP: ['REMESA'],
  USD: ['PAYPAL', 'TRANSFERENCIA', 'REMESA'],
  UYU: ['MERCADOPAGO', 'TRANSFERENCIA'],
};

const DEFAULT_METHOD_BY_CURRENCY = {
  CUP: 'REMESA',
  USD: 'PAYPAL',
  UYU: 'MERCADOPAGO',
};

const REMESA_CURRENCIES = ['CUP', 'USD'];
const REMESA_DELIVERY_METHODS = ['EFECTIVO', 'TRANSFERENCIA'];
const BANK_ACCOUNT_TYPES = ['CORRIENTE', 'AHORRO', 'OTRO'];
const DOCUMENT_TYPES = ['CI', 'RUT', 'PASSPORT', 'OTRO'];

const toOptions = (value, allowedValues) => {
  let entries = value;
  if (typeof value === 'string') {
    try {
      entries = JSON.parse(value || '[]');
    } catch (_error) {
      return [];
    }
  }

  if (!Array.isArray(entries)) return [];
  return [...new Set(entries.map((entry) => String(entry).trim().toUpperCase())
    .filter((entry) => allowedValues.includes(entry)))];
};

export const getDestinationMethodsForCurrency = (currency) =>
  METHODS_BY_CURRENCY[String(currency || '').toUpperCase()] || [];

export const getDefaultDestinationMethod = (currency) =>
  DEFAULT_METHOD_BY_CURRENCY[String(currency || '').toUpperCase()] || '';

export const parseRemesaOptions = (properties) => {
  const entries = Array.isArray(properties) ? properties : [];
  const read = (key, allowedValues) => {
    const property = entries.find((entry) => entry?.clave === key);
    return toOptions(property?.valor, allowedValues);
  };

  return {
    currencies: read('monedaACobrarEnCuba', REMESA_CURRENCIES),
    deliveryMethods: read('metodoPagoEnCuba', REMESA_DELIVERY_METHODS),
  };
};

export const getRemittanceCurrenciesForBalance = (balanceCurrency, options) => {
  const configured = options?.currencies || [];
  const deliveryMethods = options?.deliveryMethods || [];
  const currency = String(balanceCurrency || '').toUpperCase();

  if (currency === 'CUP') {
    return configured.includes('CUP') && deliveryMethods.length ? ['CUP'] : [];
  }

  if (currency !== 'USD') return [];
  return configured.filter((deliveryCurrency) => deliveryCurrency === 'CUP'
    ? deliveryMethods.length > 0
    : deliveryCurrency === 'USD' && deliveryMethods.includes('EFECTIVO'));
};

export const getRemittanceMethodsForCurrency = (deliveryCurrency, options) => {
  const methods = options?.deliveryMethods || [];
  if (deliveryCurrency === 'USD') return methods.includes('EFECTIVO') ? ['EFECTIVO'] : [];
  if (deliveryCurrency === 'CUP') return REMESA_DELIVERY_METHODS.filter((method) => methods.includes(method));
  return [];
};

export const validateDestinationForm = (form, remesaOptions = { currencies: [], deliveryMethods: [] }) => {
  const currency = String(form?.currency || '').toUpperCase();
  const method = String(form?.method || '').toUpperCase();

  if (!getDestinationMethodsForCurrency(currency).includes(method)) {
    return 'El método seleccionado no admite la moneda de este saldo.';
  }
  if (!String(form?.holderName || '').trim()) return 'Completa el nombre del titular o destinatario.';
  if (form.confirmOwnership !== true) return 'Confirma que eres titular o estás autorizado para usar este destino.';

  if (method === 'PAYPAL' || method === 'MERCADOPAGO') {
    return String(form.recipientIdentifier || '').trim()
      ? ''
      : 'Completa el identificador de la cuenta receptora.';
  }

  if (method === 'TRANSFERENCIA') {
    if (!String(form.bankName || '').trim()) return 'Completa el nombre del banco en Uruguay.';
    if (!BANK_ACCOUNT_TYPES.includes(form.accountType)) return 'Selecciona un tipo de cuenta válido.';
    if (!String(form.accountNumber || '').trim()) return 'Completa el número de cuenta.';
    const documentType = String(form.documentType || '');
    const documentNumber = String(form.documentNumber || '').trim();
    if (Boolean(documentType) !== Boolean(documentNumber)) {
      return 'Completa el tipo y número de documento o deja ambos vacíos.';
    }
    if (documentType && !DOCUMENT_TYPES.includes(documentType)) return 'Selecciona un tipo de documento válido.';
    return '';
  }

  const deliveryCurrency = String(form.monedaRecibirEnCuba || '').toUpperCase();
  const deliveryMethod = String(form.metodoPago || '').toUpperCase();
  const availableCurrencies = getRemittanceCurrenciesForBalance(currency, remesaOptions);
  const availableMethods = getRemittanceMethodsForCurrency(deliveryCurrency, remesaOptions);
  if (!availableCurrencies.includes(deliveryCurrency)) return 'No hay una moneda de entrega compatible habilitada para esta remesa.';
  if (!availableMethods.includes(deliveryMethod)) return 'Selecciona un método de entrega habilitado para esa moneda.';
  if (currency === 'CUP' && deliveryCurrency !== 'CUP') return 'El saldo CUP solo se entrega en CUP, sin conversión.';
  if (deliveryCurrency === 'USD' && deliveryMethod !== 'EFECTIVO') return 'La entrega en USD solo está disponible en efectivo.';
  if (deliveryMethod === 'EFECTIVO' && !String(form.direccionCuba || '').trim()) {
    return 'Completa la dirección de entrega en Cuba.';
  }
  if (deliveryMethod === 'TRANSFERENCIA' && String(form.tarjetaCUP || '').replace(/\D/g, '').length !== 16) {
    return 'La tarjeta CUP debe tener exactamente 16 dígitos.';
  }
  return '';
};

export const buildDestinationPayload = (form) => {
  let details;
  if (form.method === 'PAYPAL' || form.method === 'MERCADOPAGO') {
    details = { recipientIdentifier: form.recipientIdentifier.trim() };
  } else if (form.method === 'TRANSFERENCIA') {
    details = {
      bankName: form.bankName.trim(),
      accountType: form.accountType,
      accountNumber: form.accountNumber.trim(),
      ...(form.branch.trim() ? { branch: form.branch.trim() } : {}),
      ...(form.documentType && form.documentNumber.trim()
        ? { documentType: form.documentType, documentNumber: form.documentNumber.trim() }
        : {}),
    };
  } else {
    details = {
      monedaRecibirEnCuba: form.monedaRecibirEnCuba,
      metodoPago: form.metodoPago,
      direccionCuba: form.metodoPago === 'EFECTIVO' ? form.direccionCuba.trim() : '',
      tarjetaCUP: form.metodoPago === 'TRANSFERENCIA' ? String(form.tarjetaCUP).replace(/\D/g, '') : '',
    };
  }

  return {
    method: form.method,
    currency: form.currency,
    holderName: form.holderName.trim(),
    details,
    confirmOwnership: form.confirmOwnership === true,
  };
};