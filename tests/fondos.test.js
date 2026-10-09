import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildDestinationPayload,
  getDefaultDestinationMethod,
  getDestinationMethodsForCurrency,
  getRemittanceCurrenciesForBalance,
  getRemittanceMethodsForCurrency,
  parseRemesaOptions,
  validateDestinationForm,
} from '../src/domain/fondos.js';

const remesaOptions = {
  currencies: ['CUP', 'USD'],
  deliveryMethods: ['EFECTIVO', 'TRANSFERENCIA'],
};

const formBase = {
  accountNumber: '', accountType: 'CORRIENTE', bankName: '', branch: '', confirmOwnership: true,
  currency: 'CUP', direccionCuba: 'Calle 12, La Habana', documentNumber: '', documentType: '',
  holderName: 'Titular de prueba', method: 'REMESA', metodoPago: 'EFECTIVO',
  monedaRecibirEnCuba: 'CUP', recipientIdentifier: '', tarjetaCUP: '',
};

test('limita los métodos de cobro según la moneda y conserva defaults válidos', () => {
  assert.deepEqual(getDestinationMethodsForCurrency('CUP'), ['REMESA']);
  assert.deepEqual(getDestinationMethodsForCurrency('USD'), ['PAYPAL', 'TRANSFERENCIA', 'REMESA']);
  assert.deepEqual(getDestinationMethodsForCurrency('UYU'), ['MERCADOPAGO', 'TRANSFERENCIA']);
  assert.equal(getDefaultDestinationMethod('CUP'), 'REMESA');
  assert.equal(getDefaultDestinationMethod('UYU'), 'MERCADOPAGO');
});

test('normaliza opciones activas de REMESA y restringe CUP a entrega CUP', () => {
  const parsed = parseRemesaOptions([
    { clave: 'monedaACobrarEnCuba', valor: '["cup", "USD", "EUR"]' },
    { clave: 'metodoPagoEnCuba', valor: '["efectivo", "transferencia", "OTRO"]' },
  ]);
  assert.deepEqual(parsed, remesaOptions);
  assert.deepEqual(getRemittanceCurrenciesForBalance('CUP', parsed), ['CUP']);
  assert.deepEqual(getRemittanceCurrenciesForBalance('USD', parsed), ['CUP', 'USD']);
  assert.deepEqual(getRemittanceCurrenciesForBalance('UYU', parsed), []);
  assert.deepEqual(getRemittanceMethodsForCurrency('USD', parsed), ['EFECTIVO']);
  assert.deepEqual(getRemittanceMethodsForCurrency('CUP', parsed), ['EFECTIVO', 'TRANSFERENCIA']);
});

test('valida y construye FONDO/CUP sin conversión y con el importe en CUP', () => {
  assert.equal(validateDestinationForm(formBase, remesaOptions), '');
  assert.deepEqual(buildDestinationPayload(formBase), {
    method: 'REMESA',
    currency: 'CUP',
    holderName: 'Titular de prueba',
    details: {
      monedaRecibirEnCuba: 'CUP',
      metodoPago: 'EFECTIVO',
      direccionCuba: 'Calle 12, La Habana',
      tarjetaCUP: '',
    },
    confirmOwnership: true,
  });
  assert.match(validateDestinationForm({ ...formBase, monedaRecibirEnCuba: 'USD' }, remesaOptions), /no hay una moneda|solo se entrega en CUP/i);
});

test('exige dirección para efectivo y tarjeta de 16 dígitos para transferencia CUP', () => {
  assert.match(validateDestinationForm({ ...formBase, direccionCuba: '' }, remesaOptions), /dirección/i);
  const transfer = { ...formBase, metodoPago: 'TRANSFERENCIA', direccionCuba: '', tarjetaCUP: '1234 5678 9012 3456' };
  assert.equal(validateDestinationForm(transfer, remesaOptions), '');
  assert.equal(buildDestinationPayload(transfer).details.tarjetaCUP, '1234567890123456');
  assert.match(validateDestinationForm({ ...transfer, tarjetaCUP: '123456' }, remesaOptions), /16 dígitos/i);
});

test('rechaza métodos incompatibles, destinos incompletos y falta de confirmación', () => {
  assert.match(validateDestinationForm({ ...formBase, currency: 'CUP', method: 'PAYPAL' }, remesaOptions), /no admite la moneda/i);
  assert.match(validateDestinationForm({ ...formBase, confirmOwnership: false }, remesaOptions), /Confirma/i);
  assert.match(validateDestinationForm({ ...formBase, currency: 'USD', method: 'PAYPAL', recipientIdentifier: '' }, remesaOptions), /identificador/i);
  assert.match(validateDestinationForm({
    ...formBase, currency: 'UYU', method: 'TRANSFERENCIA', bankName: 'Banco', accountNumber: '',
  }, remesaOptions), /número de cuenta/i);
});