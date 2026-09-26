import { Meteor } from '../meteor/client';
import { ProductosComercioCollection, TiendasComercioCollection } from '../meteor/collections';
import { COMERCIO_EMPRESA_ID, isCompanyConfigured } from '../config';
import { resolveCompanyOwnerId, selectCompanyProducts, selectCompanyStores } from '../domain/commerce';

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
};

export function useStorefront() {
  return Meteor.useTracker(() => {
    if (!isCompanyConfigured) {
      return {
        companyId: '',
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
    const ownerId = resolveCompanyOwnerId(seedStores, COMERCIO_EMPRESA_ID);
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
    const products = storeIds.length
      ? selectCompanyProducts(
          ProductosComercioCollection.find(productSelector, {
            fields: PRODUCT_FIELDS,
            sort: { name: 1 },
          }).fetch(),
          storeIds,
        )
      : [];

    return {
      companyId: ownerId,
      loading: !seedHandle.ready() || !storesHandle.ready() || Boolean(productsHandle && !productsHandle.ready()),
      products,
      stores,
      storeIds,
    };
  }, [COMERCIO_EMPRESA_ID]);
}
