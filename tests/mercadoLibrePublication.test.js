import assert from 'node:assert/strict';
import test from 'node:test';

import { buildMercadoLibrePublication, validateMercadoLibrePublicationAttributes } from '../src/domain/mercadoLibrePublication.js';

test('activar la publicación envía la intención junto con los datos del producto', () => {
  const publication = {
    categoryId: 'MLU123',
    condition: 'new',
    title: 'Producto Marca Modelo Capacidad',
    userProductId: '',
    attributes: [{ id: 'BRAND', valueName: 'VIDKAR' }],
  };

  assert.deepEqual(buildMercadoLibrePublication(true, publication), { ...publication, publish: true });
  assert.equal(publication.publish, undefined);
});

test('desactivar la publicación guarda solo en VIDKAR', () => {
  assert.equal(buildMercadoLibrePublication(false, { categoryId: 'MLU123' }), null);
});

test('avisa los requisitos para un mouse MLU1714 sin GTIN ni motivo real', () => {
  const attributes = [
    { id: 'BRAND', name: 'Marca', required: true },
    { id: 'MODEL', name: 'Modelo', newRequired: true },
    { id: 'GTIN', name: 'Código universal', conditionalRequired: true },
    { id: 'EMPTY_GTIN_REASON', values: [{ id: 'no_code', name: 'El producto no tiene código registrado' }] },
  ];
  const values = { BRAND: { valueName: 'Logitech' }, MODEL: { valueName: 'G502 Lightspeed' } };
  assert.match(validateMercadoLibrePublicationAttributes(attributes, {}, 'new'), /Marca/);
  assert.match(validateMercadoLibrePublicationAttributes(attributes, { BRAND: values.BRAND }, 'new'), /Modelo/);
  assert.match(validateMercadoLibrePublicationAttributes(attributes, values, 'new'), /GTIN real o un motivo/);
  assert.equal(validateMercadoLibrePublicationAttributes(attributes, { ...values, GTIN: { valueName: '4006381333931' } }, 'new'), '');
  assert.equal(validateMercadoLibrePublicationAttributes(attributes, { ...values, EMPTY_GTIN_REASON: { valueId: 'no_code', valueName: 'El producto no tiene código registrado' } }, 'new'), '');
  assert.match(validateMercadoLibrePublicationAttributes(attributes, { ...values, GTIN: { valueName: '4006381333932' } }, 'new'), /verificador/);
  assert.match(validateMercadoLibrePublicationAttributes(attributes, { ...values, GTIN: { valueName: 'SKU123' } }, 'new'), /código real/);
  assert.match(validateMercadoLibrePublicationAttributes(attributes, { ...values, EMPTY_GTIN_REASON: { valueId: 'falso', valueName: 'Sin código' } }, 'new'), /ofrecido/);
  assert.match(validateMercadoLibrePublicationAttributes(attributes, {
    ...values, GTIN: { valueName: '4006381333931' }, EMPTY_GTIN_REASON: { valueId: 'no_code' },
  }, 'new'), /no ambos/);
  assert.match(validateMercadoLibrePublicationAttributes(attributes.filter((attribute) => attribute.id !== 'EMPTY_GTIN_REASON'), values, 'new'), /no ofrece un motivo/);
});

test('un GTIN no necesita motivo aunque la categoría señale ambos como obligatorios', () => {
  assert.equal(validateMercadoLibrePublicationAttributes([
    { id: 'GTIN', required: true },
    { id: 'EMPTY_GTIN_REASON', required: true, values: [{ id: '1', name: 'No registrado' }] },
  ], { GTIN: { valueName: '4006381333931' } }, 'new'), '');
});
