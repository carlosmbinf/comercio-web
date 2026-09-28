import assert from 'node:assert/strict';
import test from 'node:test';

import {
  canManageEmpresaFromWeb,
  ensureEmpresaMethodSuccess,
  getEmpresaAccessState,
  getNextPreparationStatus,
  isConfiguredCommerceOwner,
} from '../src/domain/empresa.js';

const owner = {
  _id: 'commerce-owner',
  empresaTerminosCondicionesAcepted: true,
  modoEmpresa: true,
  profile: { roleComercio: ['EMPRESA'] },
};

test('el panel solo reconoce al usuario propietario configurado', () => {
  assert.equal(isConfiguredCommerceOwner(owner, 'commerce-owner'), true);
  assert.equal(isConfiguredCommerceOwner({ ...owner, _id: 'another-user' }, 'commerce-owner'), false);
  assert.equal(isConfiguredCommerceOwner(owner, ''), false);
});

test('la web permite gestionar al propietario aunque el modo móvil esté apagado', () => {
  assert.equal(canManageEmpresaFromWeb({ ...owner, modoEmpresa: false }, 'commerce-owner'), true);
  assert.equal(canManageEmpresaFromWeb({ ...owner, modoEmpresa: false, empresaBloqueada: true }, 'commerce-owner'), false);
  assert.equal(canManageEmpresaFromWeb({ ...owner, modoEmpresa: false, empresaTerminosCondicionesAcepted: false }, 'commerce-owner'), false);
  assert.equal(canManageEmpresaFromWeb({ ...owner, modoEmpresa: false, profile: {} }, 'commerce-owner'), false);
  assert.equal(canManageEmpresaFromWeb({ ...owner, _id: 'another-user' }, 'commerce-owner'), false);
});

test('clasifica acceso y bloqueo antes de mostrar las operaciones del comercio', () => {
  assert.equal(getEmpresaAccessState(owner, 'commerce-owner'), 'active');
  assert.equal(getEmpresaAccessState({ ...owner, modoEmpresa: false }, 'commerce-owner'), 'active');
  assert.equal(getEmpresaAccessState({ ...owner, modoEmpresa: false, empresaTerminosCondicionesAcepted: false, permiteEmpresa: true }, 'commerce-owner'), 'terms');
  assert.equal(getEmpresaAccessState({ ...owner, empresaBloqueada: true }, 'commerce-owner'), 'blocked');
  assert.equal(getEmpresaAccessState({ ...owner, _id: 'another-user' }, 'commerce-owner'), 'not-owner');
  assert.equal(getEmpresaAccessState({ ...owner, profile: {} }, 'commerce-owner'), 'not-enabled');
});

test('mantiene las dos transiciones de preparación que utiliza la app', () => {
  assert.equal(getNextPreparationStatus('PENDIENTE'), 'PREPARANDO');
  assert.equal(getNextPreparationStatus('PREPARANDO'), 'PREPARACION_LISTO');
  assert.equal(getNextPreparationStatus('PREPARACION_LISTO'), '');
});

test('detecta resultados de métodos Meteor que devuelven errores sin lanzarlos', () => {
  assert.deepEqual(ensureEmpresaMethodSuccess({ success: true }), { success: true });
  assert.throws(() => ensureEmpresaMethodSuccess({ success: false, reason: 'Denegado' }), /Denegado/);
  assert.throws(() => ensureEmpresaMethodSuccess({ error: 'Fallo' }), /Fallo/);
});