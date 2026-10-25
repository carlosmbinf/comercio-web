import test from 'node:test';
import assert from 'node:assert/strict';

import {
  INITIAL_CATALOG_LIMIT,
  buildCatalogSubscriptionQuery,
  buildOrderRowSummary,
  formatMoney,
  formatPaymentMethod,
  getCartConflicts,
  getCommerceItems,
  getOrdersViewState,
  getOrderStatus,
  isFinalizedOrder,
  partitionCommerceOrders,
  resolveCompanyOwnerId,
  selectCompanyCartItems,
  selectCompanyProducts,
  selectCompanyStores,
  selectStoresWithProducts,
} from '../src/domain/commerce.js';
import { UNCATEGORIZED_CATEGORY_ID, categoryIdsFor, getCatalogCategories, getPopulatedCategoryRows, getVisibleCatalogProducts } from '../src/domain/categories.js';

const stores = [
  { _id: 'store-a', idUser: 'company-a' },
  { _id: 'store-b', idUser: 'company-a' },
  { _id: 'store-c', idUser: 'company-b' },
];

test('limita las tiendas al usuario propietario configurado', () => {
  assert.deepEqual(selectCompanyStores(stores, 'company-a'), stores.slice(0, 2));
  assert.deepEqual(selectCompanyStores(stores, ''), []);
});

test('resuelve el propietario si la configuración contiene el ID de una tienda', () => {
  assert.equal(resolveCompanyOwnerId([stores[0]], 'store-a'), 'company-a');
  assert.equal(resolveCompanyOwnerId(stores, 'company-a'), 'company-a');
  assert.equal(resolveCompanyOwnerId(stores, 'missing'), '');
});

test('limita productos y carrito a las tiendas de la empresa', () => {
  const products = [
    { _id: 'p-a', idTienda: 'store-a' },
    { _id: 'p-c', idTienda: 'store-c' },
  ];
  const cart = [
    { _id: 'cart-a', type: 'COMERCIO', idTienda: 'store-a' },
    { _id: 'cart-c', type: 'COMERCIO', idTienda: 'store-c' },
  ];

  assert.deepEqual(selectCompanyProducts(products, ['store-a']), [products[0]]);
  assert.deepEqual(selectCompanyCartItems(cart, ['store-a']), [cart[0]]);
});

test('el escaparate omite tiendas sin productos visibles sin alterar sus IDs para compras', () => {
  const companyStores = selectCompanyStores(stores, 'company-a');
  const storeIds = companyStores.map((store) => store._id);
  const products = [{ _id: 'visible', idTienda: 'store-a' }, { _id: 'hidden', idTienda: 'store-b', idCategoria: 'off' }];
  const visibleProducts = getVisibleCatalogProducts(products, [{ _id: 'off', nombre: 'Oculta', visibleEnInicio: false }]);

  assert.deepEqual(selectStoresWithProducts(companyStores, visibleProducts), [stores[0]]);
  assert.deepEqual(storeIds, ['store-a', 'store-b']);
  assert.deepEqual(selectStoresWithProducts(companyStores, []), []);
});

test('detecta carrito de otra empresa y compras incompatibles antes del checkout', () => {
  const conflicts = getCartConflicts([
    { _id: 'mine', type: 'COMERCIO', idTienda: 'store-a' },
    { _id: 'foreign', type: 'COMERCIO', idTienda: 'store-c' },
    { _id: 'other-type', type: 'RECARGA', idTienda: null },
  ], ['store-a']);

  assert.deepEqual(conflicts.foreignCommerceItems.map((item) => item._id), ['foreign']);
  assert.deepEqual(conflicts.incompatibleItems.map((item) => item._id), ['other-type']);
});

test('filtra detalles de una venta y clasifica estados de compra', () => {
  const sale = {
    estado: 'ENCAMINO',
    producto: { carritos: [
      { type: 'COMERCIO', idTienda: 'store-a' },
      { type: 'COMERCIO', idTienda: 'store-c' },
      { type: 'RECARGA' },
    ] },
  };

  assert.equal(getCommerceItems(sale, ['store-a']).length, 1);
  assert.equal(getOrderStatus(sale), 'EN_RUTA');
  assert.equal(getOrderStatus({ isCancelada: true }), 'CANCELADA');
  assert.equal(getOrderStatus({ isCobrado: false }), 'PENDIENTE_PAGO');
});

test('separa pedidos activos en tarjetas y finalizados en tabla con resumen completo', () => {
  const activePending = { _id: 'act-1', estado: 'PENDIENTE', isCobrado: false, isCancelada: false, metodoPago: 'EFECTIVO' };
  const activeRoute = { _id: 'act-2', estado: 'ENCAMINO', isCobrado: true, isCancelada: false, metodoPago: 'PAYPAL' };
  const delivered = {
    _id: 'fin-1',
    estado: 'ENTREGADO',
    isCobrado: true,
    isCancelada: false,
    metodoPago: 'MERCADOPAGO',
    cobrado: 36.76,
    monedaCobrado: 'UYU',
    producto: {
      carritos: [
        {
          type: 'COMERCIO',
          idTienda: 'store-a',
          cantidad: 2,
          cobrarUSD: 150,
          monedaACobrar: 'CUP',
          nombre: 'Carlos Medina',
          nombreCalle: 'Colorado',
          numeroCasa: '2319',
          producto: { name: 'Pizza cubana', precio: 150, monedaPrecio: 'CUP' },
        },
      ],
    },
  };
  const cancelled = { _id: 'fin-2', estado: 'PENDIENTE_ENTREGA', isCobrado: false, isCancelada: true, metodoPago: 'EFECTIVO' };
  const refundedFull = { _id: 'fin-3', estado: 'PREPARANDO', isCobrado: true, isCancelada: false, refundStatus: 'FULL', metodoPago: 'PAYPAL' };

  assert.equal(isFinalizedOrder(activePending), false);
  assert.equal(isFinalizedOrder(activeRoute), false);
  assert.equal(isFinalizedOrder(delivered), true);
  assert.equal(isFinalizedOrder(cancelled), true);
  assert.equal(isFinalizedOrder(refundedFull), true);

  const partitioned = partitionCommerceOrders([activePending, delivered, activeRoute, cancelled, refundedFull]);
  assert.deepEqual(partitioned.activeOrders.map((order) => order._id), ['act-1', 'act-2']);
  assert.deepEqual(partitioned.finalizedOrders.map((order) => order._id), ['fin-1', 'fin-2', 'fin-3']);

  const paymentMeta = formatPaymentMethod(delivered);
  assert.equal(paymentMeta.code, 'MERCADOPAGO');
  assert.equal(paymentMeta.label, 'Mercado Pago');
  assert.equal(paymentMeta.collectionLabel, 'Cobrado');

  const summary = buildOrderRowSummary(delivered, ['store-a'], [{ _id: 'store-a', title: 'Pizzería la cubana' }]);
  assert.equal(summary.shortId, '#FIN-1');
  assert.equal(summary.status, 'ENTREGADO');
  assert.equal(summary.itemCount, 2);
  assert.equal(summary.primaryProduct, 'Pizza cubana');
  assert.equal(summary.storesSummary, 'Pizzería la cubana');
  assert.equal(summary.deliveryAddress, 'Colorado · 2319');
  assert.equal(summary.subtotalFormatted, '300.00 CUP');
  assert.equal(summary.chargedFormatted, '36.76 UYU');
  assert.equal(summary.showChargedDifference, true);
});

test('distingue carga, fallo y estado vacío del historial de pedidos', () => {
  assert.equal(getOrdersViewState({ loading: true, orders: [] }), 'loading');
  assert.equal(getOrdersViewState({ loading: false, orders: [] }), 'empty');
  assert.equal(getOrdersViewState({ error: true, loading: false, orders: [] }), 'error');
  assert.equal(getOrdersViewState({ error: true, loading: true, orders: [{ _id: 'cached' }] }), 'history');
  assert.equal(getOrdersViewState({ loading: false, orders: [{ _id: 'sale' }] }), 'history');
});

test('usa el formato estándar con dos decimales y el código de moneda al final', () => {
  assert.equal(formatMoney(250, 'CUP'), '250.00 CUP');
  assert.equal(formatMoney(250, 'UYU'), '250.00 UYU');
  assert.equal(formatMoney(250, 'USD'), '250.00 USD');
  assert.equal(formatMoney(150, 'cup'), '150.00 CUP');
  assert.equal(formatMoney('inválido', 'USD'), '0.00 USD');
});

test('muestra cada producto solo en su categoría exacta y oculta las categorías padre vacías', () => {
  const tree = [
    { _id: 'electrodomesticos', nombre: 'Electrodomésticos' },
    { _id: 'componentes', nombre: 'Componentes PC', idCategoriaHeredada: 'electrodomesticos' },
    { _id: 'mouses', nombre: 'Mouses', idCategoriaHeredada: 'componentes' },
  ];
  const categories = getCatalogCategories(tree, null).filter((category) => category.visible);
  const ids = new Map(categories.map((category) => [category.id, categoryIdsFor(tree, category.id)]));
  const product = { _id: 'g502', idCategoria: 'mouses' };

  assert.deepEqual(getPopulatedCategoryRows(categories, ids, [product]).map((category) => category.id), ['mouses']);
  assert.equal(getPopulatedCategoryRows(categories, ids, [product])[0].label, 'Electrodomésticos › Componentes PC › Mouses');
  assert.deepEqual(getPopulatedCategoryRows(categories, ids, [product])[0].items, [product]);
  assert.deepEqual(getPopulatedCategoryRows(categories, ids, []), []);
  const uncategorized = { _id: 'p2' };
  assert.deepEqual(getPopulatedCategoryRows(categories, ids, [uncategorized]).map((category) => category.id), [UNCATEGORIZED_CATEGORY_ID]);
  assert.deepEqual(getPopulatedCategoryRows(categories, ids, [uncategorized])[0].items, [uncategorized]);
  assert.deepEqual(getPopulatedCategoryRows(categories, ids, [product, uncategorized]).map((category) => category.id), ['mouses', UNCATEGORIZED_CATEGORY_ID]);
});

test('muestra la categoría del producto solo en el escaparate de su tienda', () => {
  const tree = [{ _id: 'comida', nombre: 'Comida' }];
  const categories = getCatalogCategories(tree, null);
  const ids = new Map(categories.map((category) => [category.id, categoryIdsFor(tree, category.id)]));
  const product = { _id: 'cochino-frito', idTienda: 'store-c', idCategoria: 'comida' };

  const ownProducts = selectCompanyProducts([product], ['store-c']);
  assert.deepEqual(getPopulatedCategoryRows(categories, ids, ownProducts).map((category) => category.label), ['Comida']);

  const otherProducts = selectCompanyProducts([product], ['store-a']);
  assert.deepEqual(getPopulatedCategoryRows(categories, ids, otherProducts), []);
});

test('el orden personal no modifica visibilidad global ni muestra productos de ramas ocultas en tiendas', () => {
  const tree = [
    { _id: 'a', nombre: 'Principal', ordenInicio: 1, visibleEnInicio: false },
    { _id: 'b', nombre: 'Hija', idCategoriaHeredada: 'a', ordenInicio: 0 },
    { _id: 'c', nombre: 'Visible', ordenInicio: 2 },
  ];
  const categories = getCatalogCategories(tree, [{ id: 'b', visible: true }, { id: 'c', visible: false }]);
  assert.deepEqual(categories.map(({ id, visible }) => [id, visible]), [
    ['b', false], ['c', true], ['a', false],
  ]);
  assert.deepEqual(getCatalogCategories(tree, null).map(({ id }) => id), ['b', 'a', 'c']);
  assert.deepEqual(getVisibleCatalogProducts([
    { idCategoria: 'a' }, { idCategoria: 'b' }, { idCategoria: 'c' }, {}, { idCategoria: 'unknown' },
  ], tree).map((product) => product.idCategoria || ''), ['c', '']);
});

test('construye consultas de catálogo paginadas y acotadas bajo demanda', () => {
  const initial = buildCatalogSubscriptionQuery({
    storeIds: ['store-a', 'store-b'],
  });
  assert.equal(initial.enabled, true);
  assert.equal(initial.limit, INITIAL_CATALOG_LIMIT);
  assert.equal(initial.options.limit, INITIAL_CATALOG_LIMIT + 1);
  assert.deepEqual(initial.selector, { idTienda: { $in: ['store-a', 'store-b'] } });

  const scoped = buildCatalogSubscriptionQuery({
    availability: 'available',
    categoryIds: new Map([['comida', new Set(['comida'])]]),
    limit: 16,
    maxPrice: '300',
    minPrice: '50',
    search: 'pizza',
    selectedCategory: 'comida',
    selectedCurrency: 'cup',
    selectedStore: 'store-a',
    sort: 'price-asc',
    storeIds: ['store-a', 'store-b'],
  });

  assert.equal(scoped.limit, 16);
  assert.equal(scoped.options.limit, 17);
  assert.deepEqual(scoped.options.sort, { precio: 1, name: 1 });
  assert.equal(scoped.selector.idTienda, 'store-a');
  assert.equal(scoped.selector.idCategoria, 'comida');
  assert.equal(scoped.selector.monedaPrecio, 'CUP');
  assert.deepEqual(scoped.selector.precio, { $gte: 50, $lte: 300 });
  assert.equal(Array.isArray(scoped.selector.$and), true);
  assert.equal(scoped.selector.$and.length, 2);
});
