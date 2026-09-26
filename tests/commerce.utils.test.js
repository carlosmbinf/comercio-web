import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getCartConflicts,
  getCommerceItems,
  getOrderStatus,
  formatMoney,
  resolveCompanyOwnerId,
  selectCompanyCartItems,
  selectCompanyProducts,
  selectCompanyStores,
} from '../src/domain/commerce.js';

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

test('usa el formato estándar con dos decimales y el código de moneda al final', () => {
  assert.equal(formatMoney(250, 'CUP'), '250.00 CUP');
  assert.equal(formatMoney(250, 'UYU'), '250.00 UYU');
  assert.equal(formatMoney(250, 'USD'), '250.00 USD');
  assert.equal(formatMoney(150, 'cup'), '150.00 CUP');
  assert.equal(formatMoney('inválido', 'USD'), '0.00 USD');
});
