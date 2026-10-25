export const normalizeId = (value) => (value == null ? '' : String(value));

export const selectCompanyStores = (stores, companyUserId) => {
  const companyId = normalizeId(companyUserId);
  if (!companyId || !Array.isArray(stores)) return [];
  return stores.filter((store) => normalizeId(store?.idUser) === companyId);
};

export const resolveCompanyOwnerId = (seedStores, configuredId) => {
  const targetId = normalizeId(configuredId);
  if (!targetId || !Array.isArray(seedStores)) return '';

  const ownerMatch = seedStores.find((store) => normalizeId(store?.idUser) === targetId);
  if (ownerMatch) return targetId;

  const selectedStore = seedStores.find((store) => normalizeId(store?._id) === targetId);
  return normalizeId(selectedStore?.idUser);
};

export const selectCompanyProducts = (products, storeIds) => {
  const allowedStores = new Set((storeIds || []).map(normalizeId).filter(Boolean));
  if (!allowedStores.size || !Array.isArray(products)) return [];
  return products.filter((product) => allowedStores.has(normalizeId(product?.idTienda)));
};

export const selectStoresWithProducts = (stores, products) => {
  const populatedIds = new Set((products || []).map((product) => normalizeId(product?.idTienda)).filter(Boolean));
  return (stores || []).filter((store) => populatedIds.has(normalizeId(store?._id)));
};

export const selectCompanyCartItems = (items, storeIds) => {
  const allowedStores = new Set((storeIds || []).map(normalizeId).filter(Boolean));
  if (!allowedStores.size || !Array.isArray(items)) return [];
  return items.filter(
    (item) => item?.type === 'COMERCIO' && allowedStores.has(normalizeId(item?.idTienda)),
  );
};

export const getCartConflicts = (items, storeIds) => {
  const allowedStores = new Set((storeIds || []).map(normalizeId).filter(Boolean));
  const cart = Array.isArray(items) ? items : [];
  return {
    foreignCommerceItems: cart.filter(
      (item) => item?.type === 'COMERCIO' && !allowedStores.has(normalizeId(item?.idTienda)),
    ),
    incompatibleItems: cart.filter((item) => item?.type !== 'COMERCIO'),
  };
};

export const getCommerceItems = (sale, storeIds) => {
  const allowedStores = new Set((storeIds || []).map(normalizeId).filter(Boolean));
  const items = Array.isArray(sale?.producto?.carritos) ? sale.producto.carritos : [];
  return items.filter(
    (item) => item?.type === 'COMERCIO' && allowedStores.has(normalizeId(item?.idTienda)),
  );
};

export const FINALIZED_ORDER_STATES = new Set([
  'ENTREGADO',
  'ENTREGADA',
  'CANCELADA',
  'CANCELADO',
  'FINALIZADO',
  'FINALIZADA',
  'COMPLETADO',
  'COMPLETADA',
]);

const PAYMENT_METHOD_META = {
  EFECTIVO: { code: 'EFECTIVO', label: 'Efectivo', tone: 'green' },
  FONDO: { code: 'FONDO', label: 'Fondo / Remesa', tone: 'orange' },
  MERCADOPAGO: { code: 'MERCADOPAGO', label: 'Mercado Pago', tone: 'sky' },
  PAYPAL: { code: 'PAYPAL', label: 'PayPal', tone: 'blue' },
  TRANSFERENCIA: { code: 'TRANSFERENCIA', label: 'Transferencia', tone: 'violet' },
};

const ORDER_STATUS_META = {
  CANCELADA: { label: 'Cancelada', tone: 'red' },
  EN_RUTA: { label: 'En reparto', tone: 'blue' },
  ENTREGADO: { label: 'Entregado', tone: 'green' },
  PENDIENTE_PAGO: { label: 'Pendiente de pago', tone: 'orange' },
  PREPARANDO: { label: 'En preparación', tone: 'violet' },
};

export const getOrderStatus = (sale) => {
  const rawState = String(sale?.estado || '').trim().toUpperCase();
  if (sale?.isCancelada === true || rawState === 'CANCELADA' || rawState === 'CANCELADO') return 'CANCELADA';
  if (sale?.refundStatus === 'FULL' && rawState !== 'ENTREGADO' && rawState !== 'ENTREGADA') return 'CANCELADA';
  if (sale?.isCobrado === false) return 'PENDIENTE_PAGO';
  if (rawState === 'ENTREGADO' || rawState === 'ENTREGADA' || rawState === 'FINALIZADO' || rawState === 'FINALIZADA') return 'ENTREGADO';
  if (['CADETEENLOCAL', 'ENCAMINO', 'CADETEENDESTINO'].includes(rawState)) return 'EN_RUTA';
  return 'PREPARANDO';
};

export const isFinalizedOrder = (sale) => {
  if (!sale || typeof sale !== 'object') return false;
  const status = getOrderStatus(sale);
  if (status === 'ENTREGADO' || status === 'CANCELADA') return true;
  const rawState = String(sale?.estado || '').trim().toUpperCase();
  if (FINALIZED_ORDER_STATES.has(rawState)) return true;
  if (sale?.refundStatus === 'FULL') return true;
  return false;
};

export const partitionCommerceOrders = (orders = []) => {
  const list = Array.isArray(orders) ? orders : [];
  const activeOrders = [];
  const finalizedOrders = [];

  for (const order of list) {
    if (isFinalizedOrder(order)) {
      finalizedOrders.push(order);
    } else {
      activeOrders.push(order);
    }
  }

  return { activeOrders, finalizedOrders };
};

export const formatPaymentMethod = (sale) => {
  const rawMethod = String(sale?.metodoPago || sale?.producto?.type || '').trim().toUpperCase();
  const baseMeta = PAYMENT_METHOD_META[rawMethod] || {
    code: rawMethod || 'N/D',
    label: rawMethod ? rawMethod.charAt(0) + rawMethod.slice(1).toLowerCase() : 'No especificado',
    tone: 'neutral',
  };

  let collectionLabel = 'Pendiente de cobro';
  let collectionTone = 'orange';
  if (sale?.refundStatus === 'FULL') {
    collectionLabel = 'Reembolsado';
    collectionTone = 'orange';
  } else if (sale?.refundStatus === 'PARTIAL') {
    collectionLabel = 'Reembolso parcial';
    collectionTone = 'orange';
  } else if (sale?.isCobrado === true) {
    collectionLabel = 'Cobrado';
    collectionTone = 'green';
  } else if (sale?.isCancelada === true) {
    collectionLabel = 'Sin cobro';
    collectionTone = 'red';
  }

  return {
    ...baseMeta,
    collectionLabel,
    collectionTone,
  };
};

export const getOrdersViewState = ({ error = false, loading = false, orders = [] } = {}) => {
  const hasOrders = Array.isArray(orders) && orders.length > 0;
  if (error && !hasOrders) return 'error';
  if (loading && !hasOrders) return 'loading';
  if (hasOrders) return 'history';
  return 'empty';
};

export const formatMoney = (value, currency = 'USD') => {
  const amount = Number(value);
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  const normalizedCurrency = String(currency || 'USD').trim().toUpperCase();
  const currencyCode = /^[A-Z]{3}$/.test(normalizedCurrency) ? normalizedCurrency : 'USD';

  return `${safeAmount.toFixed(2)} ${currencyCode}`;
};

export const formatDateTime = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (!value || Number.isNaN(date.getTime())) return 'Fecha no disponible';
  return new Intl.DateTimeFormat('es-UY', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
};

export const buildOrderRowSummary = (sale, storeIds = [], stores = []) => {
  const status = getOrderStatus(sale);
  const statusMeta = ORDER_STATUS_META[status] || ORDER_STATUS_META.PREPARANDO;
  const items = getCommerceItems(sale, storeIds);
  const storeNameById = new Map(
    (Array.isArray(stores) ? stores : []).map((store) => [
      normalizeId(store?._id),
      String(store?.title || store?.name || '').trim(),
    ]),
  );

  const itemCount = items.reduce(
    (total, item) => total + Math.max(1, Number(item?.cantidad || item?.producto?.cantidad || 1)),
    0,
  );
  const firstItem = items[0] || {};
  const primaryProduct =
    firstItem?.producto?.name ||
    firstItem?.producto?.titulo ||
    firstItem?.nombre ||
    'Producto de comercio';
  const extraProductsCount = Math.max(0, items.length - 1);
  const productsSummary = items
    .map((item) => {
      const qty = Math.max(1, Number(item?.cantidad || item?.producto?.cantidad || 1));
      const name = item?.producto?.name || item?.producto?.titulo || item?.nombre || 'Producto';
      return `${qty}× ${name}`;
    })
    .join(', ');

  const storeNames = [
    ...new Set(
      items
        .map((item) => String(item?.tienda?.title || storeNameById.get(normalizeId(item?.idTienda)) || '').trim())
        .filter(Boolean),
    ),
  ];

  const subtotal = items.reduce(
    (total, item) =>
      total +
      Number(item?.cobrarUSD ?? item?.producto?.precio ?? 0) *
        Math.max(1, Number(item?.cantidad || item?.producto?.cantidad || 1)),
    0,
  );
  const currency =
    firstItem?.monedaACobrar ||
    firstItem?.producto?.monedaPrecio ||
    sale?.monedaCobrado ||
    'USD';
  const chargedAmountRaw = Number(sale?.cobrado);
  const hasChargedAmount = Number.isFinite(chargedAmountRaw) && chargedAmountRaw > 0;
  const chargedCurrency = sale?.monedaCobrado || sale?.producto?.comisiones?.moneda || currency;
  const deliveryAddress = [firstItem?.nombreCalle, firstItem?.numeroCasa].filter(Boolean).join(' · ');
  const recipientName = String(firstItem?.nombre || '').trim();
  const notes = items
    .map((item) => String(item?.comentario || item?.producto?.comentario || '').trim())
    .filter(Boolean);
  const payment = formatPaymentMethod(sale);
  const rawId = String(sale?._id || sale?.idOrder || '');

  return {
    id: rawId,
    shortId: `#${rawId.slice(-6).toUpperCase() || 'PEDIDO'}`,
    createdAt: sale?.createdAt,
    dateLabel: formatDateTime(sale?.createdAt),
    status,
    statusLabel: statusMeta.label,
    statusTone: statusMeta.tone,
    isFinalized: isFinalizedOrder(sale),
    payment,
    items,
    itemCount,
    lineCount: items.length,
    primaryProduct,
    extraProductsCount,
    productsSummary: productsSummary || primaryProduct,
    storeNames,
    storesSummary: storeNames.join(', ') || 'Comercio local',
    recipientName,
    deliveryAddress,
    notes,
    subtotal,
    currency,
    subtotalFormatted: formatMoney(subtotal, currency),
    chargedFormatted: hasChargedAmount ? formatMoney(chargedAmountRaw, chargedCurrency) : '',
    showChargedDifference:
      hasChargedAmount &&
      (String(chargedCurrency).toUpperCase() !== String(currency).toUpperCase() ||
        Math.abs(chargedAmountRaw - subtotal) >= 0.01),
    refundStatus: sale?.refundStatus || '',
    refundFormatted: sale?.refundStatus
      ? formatMoney(sale?.refundedAmount, sale?.refundCurrency || sale?.monedaCobrado || currency)
      : '',
  };
};

export const INITIAL_CATALOG_LIMIT = 8;
export const CATALOG_LIMIT_STEP = 8;
export const MAX_CATALOG_LIMIT = 120;

const escapeRegex = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const resolveCatalogSortOption = (sort = 'recommended') => {
  if (sort === 'price-asc') return { precio: 1, name: 1 };
  if (sort === 'price-desc') return { precio: -1, name: 1 };
  if (sort === 'name') return { name: 1 };
  return { createdAt: -1, name: 1 };
};

export const buildCatalogSubscriptionQuery = ({
  availability = 'all',
  categoryIds = new Map(),
  limit = INITIAL_CATALOG_LIMIT,
  maxPrice = '',
  minPrice = '',
  search = '',
  selectedCategory = 'all',
  selectedCurrency = 'all',
  selectedStore = 'all',
  sort = 'recommended',
  storeIds = [],
  uncategorizedId = '__commerce-uncategorized__',
} = {}) => {
  const allowedStores = (Array.isArray(storeIds) ? storeIds : []).map(normalizeId).filter(Boolean);
  const safeLimit = Math.min(
    MAX_CATALOG_LIMIT,
    Math.max(1, Number.isFinite(Number(limit)) ? Math.floor(Number(limit)) : INITIAL_CATALOG_LIMIT),
  );

  if (!allowedStores.length) {
    return {
      enabled: false,
      limit: safeLimit,
      options: { limit: safeLimit + 1, sort: resolveCatalogSortOption(sort) },
      selector: { _id: '__none__' },
    };
  }

  const normalizedStore = normalizeId(selectedStore);
  const selector = {
    idTienda:
      normalizedStore && normalizedStore !== 'all' && allowedStores.includes(normalizedStore)
        ? normalizedStore
        : { $in: allowedStores },
  };

  const andConditions = [];

  if (selectedCategory && selectedCategory !== 'all') {
    if (selectedCategory === uncategorizedId) {
      andConditions.push({
        $or: [{ idCategoria: { $exists: false } }, { idCategoria: null }, { idCategoria: '' }],
      });
    } else {
      const mappedSet = categoryIds instanceof Map ? categoryIds.get(selectedCategory) : null;
      const targetIds = mappedSet ? [...mappedSet].map(normalizeId).filter(Boolean) : [normalizeId(selectedCategory)];
      selector.idCategoria = targetIds.length === 1 ? targetIds[0] : { $in: targetIds };
    }
  }

  if (availability === 'made') {
    selector.productoDeElaboracion = true;
  } else if (availability === 'available') {
    andConditions.push({
      $or: [{ productoDeElaboracion: true }, { count: { $gt: 0 } }],
    });
  }

  if (selectedCurrency && selectedCurrency !== 'all') {
    selector.monedaPrecio = String(selectedCurrency).trim().toUpperCase();
  }

  const parsedMin = minPrice !== '' && minPrice !== null ? Number(minPrice) : NaN;
  const parsedMax = maxPrice !== '' && maxPrice !== null ? Number(maxPrice) : NaN;
  if (Number.isFinite(parsedMin) || Number.isFinite(parsedMax)) {
    selector.precio = {};
    if (Number.isFinite(parsedMin)) selector.precio.$gte = parsedMin;
    if (Number.isFinite(parsedMax)) selector.precio.$lte = parsedMax;
  }

  const trimmedSearch = String(search || '').trim();
  if (trimmedSearch) {
    const pattern = escapeRegex(trimmedSearch);
    andConditions.push({
      $or: [
        { name: { $regex: pattern, $options: 'i' } },
        { descripcion: { $regex: pattern, $options: 'i' } },
      ],
    });
  }

  if (andConditions.length === 1 && !selector.$or && andConditions[0].$or) {
    selector.$or = andConditions[0].$or;
  } else if (andConditions.length > 0) {
    selector.$and = andConditions;
  }

  return {
    enabled: true,
    limit: safeLimit,
    options: {
      limit: safeLimit + 1,
      sort: resolveCatalogSortOption(sort),
    },
    selector,
  };
};
