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

export const getOrderStatus = (sale) => {
  if (sale?.isCancelada === true) return 'CANCELADA';
  if (sale?.isCobrado === false) return 'PENDIENTE_PAGO';
  if (sale?.estado === 'ENTREGADO') return 'ENTREGADO';
  if (['CADETEENLOCAL', 'ENCAMINO', 'CADETEENDESTINO'].includes(sale?.estado)) return 'EN_RUTA';
  return 'PREPARANDO';
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
