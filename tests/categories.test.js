import assert from 'node:assert/strict';
import test from 'node:test';
import { categoryIdsFor, getCatalogCategories } from '../src/domain/categories.js';

const categories = [
  { _id: 'root', nombre: 'Alimentos' },
  { _id: 'child', nombre: 'Pan', idCategoriaHeredada: 'root' },
  { _id: 'new', nombre: 'Bebidas' },
  { _id: 'orphan', nombre: 'Oculta', idCategoriaHeredada: 'inactive' },
  { _id: 'orphan-child', nombre: 'Hija oculta', idCategoriaHeredada: 'orphan' },
];

test('muestra todas por defecto y el orden personal no controla la visibilidad', () => {
  const result = getCatalogCategories(categories, [{ id: 'child', visible: false }, { id: 'root', visible: true }]);
  assert.deepEqual(result.map(({ id }) => id), ['child', 'root', 'new']);
  assert.equal(result[0].visible, true);
  assert.equal(result[2].visible, true);
  assert.deepEqual(getCatalogCategories(categories.slice(0, 3), []).map(({ visible }) => visible), [true, true, true]);
});

test('filtra productos solo por la categoría asignada, no por sus padres', () => {
  assert.deepEqual([...categoryIdsFor(categories, 'root')], ['root']);
  assert.deepEqual([...categoryIdsFor(categories, 'child')], ['child']);
});
