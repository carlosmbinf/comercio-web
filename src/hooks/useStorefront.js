import { Meteor } from '../meteor/client';
import { CategoriasComercioCollection, ProductosComercioCollection, TiendasComercioCollection } from '../meteor/collections';
import { COMERCIO_EMPRESA_ID, isCompanyConfigured } from '../config';
import {
  INITIAL_CATALOG_LIMIT,
  buildCatalogSubscriptionQuery,
  resolveCompanyOwnerId,
  selectCompanyProducts,
  selectCompanyStores,
} from '../domain/commerce';
import { getVisibleCatalogProducts } from '../domain/categories';

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

export const PRODUCT_FIELDS = {
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
      ? Meteor.subscribe('categoriasComercioCatalogo', ownerId)
      : { ready: () => !subscribeCategories || !ownerId };
    const categories = ownerId
      ? CategoriasComercioCollection.find({ creadaPor: ownerId }, {
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
              { idTienda: { $in: storeIds } },
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
  availability = 'all',
  categories = [],
  categoryIds = new Map(),
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

    if (!query.enabled) {
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
