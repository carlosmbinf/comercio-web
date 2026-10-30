import React from 'react';
import { Meteor } from '../meteor/client';
import { CategoriasComercioCollection, ProductosComercioCollection, SeleccionesCatalogoCollection, TiendasComercioCollection } from '../meteor/collections';
import { COMERCIO_EMPRESA_ID, isCompanyConfigured } from '../config';
import {
  INITIAL_CATALOG_LIMIT,
  buildCatalogSubscriptionQuery,
  resolveCompanyOwnerId,
  selectCompanyProducts,
  selectCompanyStores,
} from '../domain/commerce';
import { getCategorySelectionProducts, getVisibleCatalogProducts } from '../domain/categories';

const STORE_FIELDS = {
  _id: 1,
  idUser: 1,
  title: 1,
  name: 1,
  descripcion: 1,
  pinColor: 1,
  coordenadas: 1,
  cordenadas: 1,
  ubicacion: 1,
};

// useTracker reinicia su cálculo al cambiar una dependencia por referencia.
const EMPTY_CATEGORIES = [];
const EMPTY_CATEGORY_IDS = new Map();

export const PRODUCT_FIELDS = {
  'mercadoLibre.status': 1,
  _id: 1,
  idTienda: 1,
  name: 1,
  descripcion: 1,
  precio: 1,
  monedaPrecio: 1,
  count: 1,
  productoDeElaboracion: 1,
  createdAt: 1,
  categoria: 1,
  category: 1,
  idCategoria: 1,
};

export function useStorefront({ subscribeCategories = true } = {}) {
  return Meteor.useTracker(() => {
    if (!isCompanyConfigured) {
      return {
        companyId: '',
        categories: [],
        loading: false,
        products: [],
        stores: [],
        storeIds: [],
      };
    }

    const seedSelector = {
      $or: [
        { idUser: COMERCIO_EMPRESA_ID },
        { _id: COMERCIO_EMPRESA_ID },
      ],
    };
    const seedHandle = Meteor.subscribe('tiendas', seedSelector, {
      fields: STORE_FIELDS,
      sort: { title: 1 },
    });
    const seedStores = TiendasComercioCollection.find(seedSelector, {
      fields: STORE_FIELDS,
      sort: { title: 1 },
    }).fetch();
    const ownerId = resolveCompanyOwnerId(seedStores, COMERCIO_EMPRESA_ID) ||
      (seedHandle.ready() ? COMERCIO_EMPRESA_ID : '');
    const categoriesHandle = subscribeCategories && ownerId
      // El árbol es compartido: creadaPor identifica al autor, no a las tiendas que lo usan.
      ? Meteor.subscribe('categoriasComercioCatalogo')
      : { ready: () => !subscribeCategories || !ownerId };
    const categories = ownerId
      ? CategoriasComercioCollection.find({ activa: { $ne: false } }, {
          fields: { _id: 1, creadaPor: 1, nombre: 1, idCategoriaHeredada: 1, visibleEnInicio: 1, ordenInicio: 1 },
        }).fetch()
      : [];
    const storeSelector = ownerId ? { idUser: ownerId } : seedSelector;
    const storesHandle = ownerId && ownerId !== COMERCIO_EMPRESA_ID
      ? Meteor.subscribe('tiendas', storeSelector, { fields: STORE_FIELDS, sort: { title: 1 } })
      : seedHandle;
    const stores = selectCompanyStores(
      TiendasComercioCollection.find(storeSelector, { fields: STORE_FIELDS, sort: { title: 1 } }).fetch(),
      ownerId,
    );
    const storeIds = stores.map((store) => String(store._id));
    const cachedProducts = storeIds.length
      ? getVisibleCatalogProducts(
          selectCompanyProducts(
            ProductosComercioCollection.find(
              { idTienda: { $in: storeIds }, 'mercadoLibre.status': { $ne: 'paused' } },
              { fields: PRODUCT_FIELDS, sort: { name: 1 } },
            ).fetch(),
            storeIds,
          ),
          categories,
        )
      : [];

    return {
      categories,
      companyId: ownerId,
      loading: !categoriesHandle.ready() || !seedHandle.ready() || !storesHandle.ready(),
      products: cachedProducts,
      stores,
      storeIds,
    };
  }, [COMERCIO_EMPRESA_ID, subscribeCategories]);
}

export function useCatalogProducts({
  enabled = true,
  availability = 'all',
  categories = EMPTY_CATEGORIES,
  categoryIds = EMPTY_CATEGORY_IDS,
  limit = INITIAL_CATALOG_LIMIT,
  maxPrice = '',
  minPrice = '',
  search = '',
  selectedCategory = 'all',
  selectedCurrency = 'all',
  selectedStore = 'all',
  sort = 'recommended',
  storeIds = [],
  uncategorizedId = '__commerce-uncategorized__',
} = {}) {
  const storeKey = [...(storeIds || [])].map(String).sort().join('|');

  return Meteor.useTracker(() => {
    const ids = storeKey ? storeKey.split('|') : [];
    const query = buildCatalogSubscriptionQuery({
      availability,
      categoryIds,
      limit,
      maxPrice,
      minPrice,
      search,
      selectedCategory,
      selectedCurrency,
      selectedStore,
      sort,
      storeIds: ids,
      uncategorizedId,
    });

    if (!enabled || !query.enabled) {
      return {
        hasMore: false,
        loading: false,
        products: [],
        ready: true,
      };
    }

    const handle = Meteor.subscribe('productosComercio', query.selector, {
      ...query.options,
      fields: PRODUCT_FIELDS,
    });

    const fetched = getVisibleCatalogProducts(
      selectCompanyProducts(
        ProductosComercioCollection.find(query.selector, {
          fields: PRODUCT_FIELDS,
          limit: query.limit + 1,
          sort: query.options.sort,
        }).fetch(),
        ids,
      ),
      categories,
    );

    return {
      hasMore: fetched.length > query.limit,
      loading: !handle.ready(),
      products: fetched.slice(0, query.limit),
      ready: handle.ready(),
    };
  }, [
    enabled,
    availability,
    categories,
    categoryIds,
    limit,
    maxPrice,
    minPrice,
    search,
    selectedCategory,
    selectedCurrency,
    selectedStore,
    sort,
    storeKey,
    uncategorizedId,
  ]);
}

export function useCategorySelection({ enabled, ownerId, rootId, selectionKey, categories, storeIds }) {
  const [failure, setFailure] = React.useState(null);
  const storeKey = (storeIds || []).map(String).sort().join('|');
  const state = Meteor.useTracker(() => {
    if (!enabled || !ownerId || !storeKey) return { products: [], loading: false };
    const handle = Meteor.subscribe('comercio.productosSeleccionCategoria', ownerId, rootId, selectionKey);
    const selection = SeleccionesCatalogoCollection.findOne(selectionKey);
    const productIds = selection?.productIds || [];
    const products = ProductosComercioCollection.find({
      'mercadoLibre.status': { $ne: 'paused' },
      _id: { $in: productIds },
      idTienda: { $in: storeKey.split('|') },
    }, { fields: PRODUCT_FIELDS }).fetch();
    return {
      products: getCategorySelectionProducts(getVisibleCatalogProducts(products, categories), productIds),
      loading: !handle.ready(),
    };
  }, [enabled, ownerId, rootId, selectionKey, categories, storeKey]);
  // This client does not forward nosub errors to onError; bound the loading state.
  React.useEffect(() => {
    if (!enabled || !state.loading) return undefined;
    const timer = window.setTimeout(() => {
      setFailure({ key: selectionKey, message: 'No se pudo cargar esta selección. Comprueba la conexión e inténtalo de nuevo.' });
    }, 20000);
    return () => window.clearTimeout(timer);
  }, [enabled, state.loading, selectionKey]);
  return { ...state, error: state.loading && failure?.key === selectionKey ? failure.message : '' };
}
