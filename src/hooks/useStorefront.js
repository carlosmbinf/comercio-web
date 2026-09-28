import { Meteor } from '../meteor/client';
import { CategoriasComercioCollection, ProductosComercioCollection, TiendasComercioCollection } from '../meteor/collections';
import { COMERCIO_EMPRESA_ID, isCompanyConfigured } from '../config';
import { resolveCompanyOwnerId, selectCompanyProducts, selectCompanyStores } from '../domain/commerce';
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

const PRODUCT_FIELDS = {
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

export function useStorefront() {
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
    const categoriesHandle = Meteor.subscribe('categoriasComercioCatalogo');
    const categories = CategoriasComercioCollection.find({}, {
      fields: { _id: 1, nombre: 1, idCategoriaHeredada: 1, visibleEnInicio: 1, ordenInicio: 1 },
    }).fetch();
    const seedStores = TiendasComercioCollection.find(seedSelector, {
      fields: STORE_FIELDS,
      sort: { title: 1 },
    }).fetch();
    const ownerId = resolveCompanyOwnerId(seedStores, COMERCIO_EMPRESA_ID) ||
      (seedHandle.ready() ? COMERCIO_EMPRESA_ID : '');
    const storeSelector = ownerId ? { idUser: ownerId } : seedSelector;
    const storesHandle = ownerId && ownerId !== COMERCIO_EMPRESA_ID
      ? Meteor.subscribe('tiendas', storeSelector, { fields: STORE_FIELDS, sort: { title: 1 } })
      : seedHandle;
    const stores = selectCompanyStores(
      TiendasComercioCollection.find(storeSelector, { fields: STORE_FIELDS, sort: { title: 1 } }).fetch(),
      ownerId,
    );
    const storeIds = stores.map((store) => String(store._id));
    const productSelector = { idTienda: { $in: storeIds } };
    const productsHandle = storeIds.length
      ? Meteor.subscribe('productosComercio', productSelector, {
          fields: PRODUCT_FIELDS,
          sort: { name: 1 },
        })
      : null;
    const products = storeIds.length && categoriesHandle.ready()
      ? getVisibleCatalogProducts(selectCompanyProducts(
          ProductosComercioCollection.find(productSelector, {
            fields: PRODUCT_FIELDS,
            sort: { name: 1 },
          }).fetch(),
          storeIds,
        ), categories)
      : [];

    return {
      categories,
      companyId: ownerId,
      loading: !categoriesHandle.ready() || !seedHandle.ready() || !storesHandle.ready() || Boolean(productsHandle && !productsHandle.ready()),
      products,
      stores,
      storeIds,
    };
  }, [COMERCIO_EMPRESA_ID]);
}
