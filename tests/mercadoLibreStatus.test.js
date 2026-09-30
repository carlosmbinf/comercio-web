import assert from 'node:assert/strict';
import test from 'node:test';

import { getMercadoLibreStatusPresentation, hasMercadoLibreListing } from '../src/domain/mercadoLibreStatus.js';

test('traduce los estados conocidos de Mercado Libre a etiquetas comprensibles', () => {
  assert.deepEqual(getMercadoLibreStatusPresentation('active'), { label: 'Activa', color: 'success' });
  assert.deepEqual(getMercadoLibreStatusPresentation('under_review'), { label: 'En revisión', color: 'info' });
  assert.deepEqual(getMercadoLibreStatusPresentation('payment_required'), { label: 'Pago pendiente', color: 'warning' });
  assert.deepEqual(getMercadoLibreStatusPresentation('closed'), { label: 'Cerrada', color: 'default' });
  assert.deepEqual(getMercadoLibreStatusPresentation('FUTURE_STATUS'), { label: 'Estado no reconocido', color: 'default' });
  assert.deepEqual(getMercadoLibreStatusPresentation(''), { label: 'Vinculada', color: 'default' });
});

test('detecta una publicación vinculada aunque el identificador esté en metadatos de condiciones', () => {
  assert.equal(hasMercadoLibreListing({ itemId: 'MLU1' }), true);
  assert.equal(hasMercadoLibreListing({ itemIds: ['MLU2'] }), true);
  assert.equal(hasMercadoLibreListing({ saleConditions: [{ itemId: 'MLU3' }] }), true);
  assert.equal(hasMercadoLibreListing({}), false);
});