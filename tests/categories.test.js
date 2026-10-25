import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCategoryTree, categoryIdsFor, getCatalogCategories } from '../src/domain/categories.js';

const categories = [
  { _id: 'root', nombre: 'Alimentos' },
  { _id: 'child', nombre: 'Pan', idCategoriaHeredada: 'root' },
  { _id: 'grandchild', nombre: 'Integral', idCategoriaHeredada: 'child' },
  { _id: 'new', nombre: 'Bebidas' },
  { _id: 'orphan', nombre: 'Oculta', idCategoriaHeredada: 'inactive' },
  { _id: 'orphan-child', nombre: 'Hija oculta', idCategoriaHeredada: 'orphan' },
];

test('muestra todas por defecto y el orden personal no controla la visibilidad', () => {
  const result = getCatalogCategories(categories, [{ id: 'child', visible: false }, { id: 'root', visible: true }]);
  assert.deepEqual(result.map(({ id }) => id), ['child', 'root', 'grandchild', 'new']);
  assert.equal(result[0].visible, true);
  assert.equal(result[2].visible, true);
  assert.deepEqual(getCatalogCategories(categories.slice(0, 3), []).map(({ visible }) => visible), [true, true, true]);
});

test('filtra productos solo por la categoría asignada, no por sus padres', () => {
  assert.deepEqual([...categoryIdsFor(categories, 'root')], ['root', 'child', 'grandchild']);
  assert.deepEqual([...categoryIdsFor(categories, 'child')], ['child', 'grandchild']);
  assert.deepEqual([...categoryIdsFor(categories, 'grandchild')], ['grandchild']);
});

test('construye un árbol jerárquico y mantiene orden, hijos y niveles profundos', () => {
  const flat = getCatalogCategories(categories, [{ id: 'new' }, { id: 'root' }, { id: 'child' }, { id: 'grandchild' }]);
  const tree = buildCategoryTree(flat);

  assert.deepEqual(tree.map(({ id }) => id), ['new', 'root']);
  assert.deepEqual(tree[1].children.map(({ id }) => id), ['child']);
  assert.deepEqual(tree[1].children[0].children.map(({ id }) => id), ['grandchild']);
  assert.equal(tree[1].children[0].label, 'Alimentos › Pan');
});

test('no conecta como raíz las categorías huérfanas o sin ruta válida', () => {
  const tree = buildCategoryTree(getCatalogCategories(categories, null));
  const allIds = [];
  const visit = (nodes) => nodes.forEach((node) => {
    allIds.push(node.id);
    visit(node.children);
  });
  visit(tree);

  assert.equal(allIds.includes('orphan'), false);
  assert.equal(allIds.includes('orphan-child'), false);
});
