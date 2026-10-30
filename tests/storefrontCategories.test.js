import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { compileFunction } from 'node:vm';
import test from 'node:test';
import { getVisibleCatalogProducts, getCategorySelectionProducts } from '../src/domain/categories.js';
import { buildCatalogSubscriptionQuery, INITIAL_CATALOG_LIMIT, resolveCompanyOwnerId, selectCompanyProducts, selectCompanyStores } from '../src/domain/commerce.js';

const source = readFileSync(new URL('../src/hooks/useStorefront.js', import.meta.url), 'utf8')
  .replace(/^import[\s\S]*?\sfrom\s+['"][^'"]+['"];\s*/gm, '').replace(/^export /gm, '');
const ownerId = 'fixture-company';
const categoryRows = [
  { _id: 'shared-root', creadaPor: 'another-company', nombre: 'Computación', activa: true },
  { _id: 'shared-leaf', creadaPor: 'another-company', nombre: 'Mouses', idCategoriaHeredada: 'shared-root', activa: true },
  { _id: 'hidden', creadaPor: 'another-company', nombre: 'Oculta', visibleEnInicio: false, activa: true },
  { _id: 'inactive', creadaPor: 'another-company', nombre: 'Inactiva', activa: false },
];
const products = [
  { _id: 'active-product', idTienda: 'own-store', idCategoria: 'shared-leaf', count: 4, mercadoLibre: { status: 'active' } },
  { _id: 'other-store-product', idTienda: 'other-store', idCategoria: 'shared-leaf', count: 4 },
  { _id: 'hidden-product', idTienda: 'own-store', idCategoria: 'hidden', count: 4 },
  { _id: 'inactive-product', idTienda: 'own-store', idCategoria: 'inactive', count: 4 },
];
const matches = (row, selector) => Object.entries(selector).every(([key, value]) => {
  if (key === '$or') return value.some((entry) => matches(row, entry));
  const actual = key.split('.').reduce((entry, part) => entry?.[part], row);
  if (value && typeof value === 'object') {
    if ('$ne' in value) return actual !== value.$ne;
    if ('$in' in value) return value.$in.includes(actual);
  }
  return actual === value;
});
const collection = (rows) => ({ find: (selector) => ({ fetch: () => rows.filter((row) => matches(row, selector)) }) });

test('un producto activo de una tienda propia sigue visible con una ruta de categorías creada por otra cuenta', () => {
  let publishedCategories = [];
  const dependencies = {
    React: {},
    Meteor: { useTracker: (fn) => fn(), subscribe: (name, requestedOwner) => {
      if (name === 'categoriasComercioCatalogo') publishedCategories = categoryRows.filter((row) => row.activa !== false && (!requestedOwner || row.creadaPor === requestedOwner));
      return { ready: () => true };
    } },
    CategoriasComercioCollection: { find: (selector) => ({ fetch: () => publishedCategories.filter((row) => matches(row, selector)) }) },
    ProductosComercioCollection: collection(products),
    SeleccionesCatalogoCollection: {},
    TiendasComercioCollection: collection([{ _id: 'own-store', idUser: ownerId, title: 'Tienda de prueba' }]),
    COMERCIO_EMPRESA_ID: ownerId,
    isCompanyConfigured: true,
    INITIAL_CATALOG_LIMIT, buildCatalogSubscriptionQuery, resolveCompanyOwnerId, selectCompanyProducts, selectCompanyStores,
    getCategorySelectionProducts, getVisibleCatalogProducts,
  };
  const { useStorefront, useCatalogProducts } = compileFunction(`${source}\nreturn { useStorefront, useCatalogProducts };`, Object.keys(dependencies))(...Object.values(dependencies));
  const storefront = useStorefront();
  assert.equal(storefront.loading, false);
  assert.deepEqual(storefront.products.map(({ _id }) => _id), ['active-product']);
  assert.deepEqual(storefront.categories.map(({ _id }) => _id), ['shared-root', 'shared-leaf', 'hidden']);
  const catalog = useCatalogProducts({ storeIds: storefront.storeIds, categories: storefront.categories, selectedStore: 'own-store' });
  assert.deepEqual(catalog.products.map(({ _id }) => _id), ['active-product']);
});
