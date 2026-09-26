import { useCallback, useState } from 'react';

import { getCartConflicts, selectCompanyCartItems } from '../domain/commerce';
import { callMeteor, Meteor } from '../meteor/client';
import { CarritoCollection } from '../meteor/collections';

const CART_GUARD_FIELDS = { _id: 1, idUser: 1, type: 1, idTienda: 1 };
const CART_FIELDS = {
  _id: 1,
  idUser: 1,
  type: 1,
  idProducto: 1,
  idTienda: 1,
  producto: 1,
  tienda: 1,
  cantidad: 1,
  cobrarUSD: 1,
  monedaACobrar: 1,
  comentario: 1,
  createdAt: 1,
  recogidaEnLocal: 1,
  coordenadas: 1,
  nombreCalle: 1,
  numeroCasa: 1,
};

export function useCommerceCart(storeIds = []) {
  const storeKey = [...(storeIds || [])].map(String).sort().join('|');
  const [refreshVersion, setRefreshVersion] = useState(0);
  const refresh = useCallback(() => setRefreshVersion((version) => version + 1), []);
  const cartState = Meteor.useTracker(() => {
    const userId = Meteor.userId();
    const allowedStoreIds = storeKey ? storeKey.split('|') : [];

    if (!userId) {
      return {
        conflicts: { foreignCommerceItems: [], incompatibleItems: [] },
        items: [],
        loading: false,
        ready: true,
        userId: null,
      };
    }

    const guardSelector = { idUser: userId };
    // El argumento final solo versiona la suscripción; la publicación lo ignora.
    // Al cambiarlo, DDP solicita un snapshot nuevo al volver de la pasarela.
    const guardHandle = Meteor.subscribe('carrito', guardSelector, { fields: CART_GUARD_FIELDS }, refreshVersion);
    const allUserItems = CarritoCollection.find(guardSelector, { fields: CART_GUARD_FIELDS }).fetch();
    const cartSelector = {
      idUser: userId,
      type: 'COMERCIO',
      idTienda: { $in: allowedStoreIds },
    };
    const cartHandle = allowedStoreIds.length
      ? Meteor.subscribe('carrito', cartSelector, { fields: CART_FIELDS }, refreshVersion)
      : null;
    const rawItems = allowedStoreIds.length
      ? CarritoCollection.find(cartSelector, {
          fields: CART_FIELDS,
          sort: { createdAt: -1 },
        }).fetch()
      : [];
    const items = selectCompanyCartItems(rawItems, allowedStoreIds);

    return {
      conflicts: getCartConflicts(allUserItems, allowedStoreIds),
      items,
      loading: !guardHandle.ready() || Boolean(cartHandle && !cartHandle.ready()),
      ready: guardHandle.ready() && Boolean(!cartHandle || cartHandle.ready()),
      userId,
    };
  }, [storeKey, refreshVersion]);

  const addProduct = useCallback(
    async (product, quantity, comment = '') => {
      if (!cartState.userId) throw new Error('Inicia sesión para agregar productos al carrito.');
      if (!cartState.ready) throw new Error('Estamos sincronizando tu carrito. Inténtalo en unos segundos.');
      if (cartState.conflicts.foreignCommerceItems.length) {
        throw new Error('Tu carrito VIDKAR tiene productos de otro comercio. Completa o retíralos desde la tienda donde los agregaste antes de comprar aquí.');
      }
      if (cartState.conflicts.incompatibleItems.length) {
        throw new Error('Tu carrito tiene una compra de otro tipo. Finalízala o cancélala antes de agregar productos de comercio.');
      }
      if (!storeKey.split('|').includes(String(product?.idTienda || ''))) {
        throw new Error('Este producto no pertenece a la empresa configurada.');
      }

      return callMeteor(
        'addAlCarrito',
        cartState.userId,
        product._id,
        Number(quantity),
        false,
        String(comment || '').trim(),
      );
    },
    [cartState, storeKey],
  );

  const removeItem = useCallback(
    async (item) => {
      if (!cartState.userId || !cartState.items.some((cartItem) => cartItem._id === item?._id)) {
        throw new Error('El artículo no pertenece al carrito de esta tienda.');
      }
      return callMeteor('eliminarElementoCarrito', item._id);
    },
    [cartState.items, cartState.userId],
  );

  const clearConflictingItems = useCallback(async () => {
    if (!cartState.userId || !cartState.ready) {
      throw new Error('Espera a que termine la sincronización del carrito e inténtalo de nuevo.');
    }
    const conflictingItems = [
      ...cartState.conflicts.foreignCommerceItems,
      ...cartState.conflicts.incompatibleItems,
    ];
    if (!conflictingItems.length) return;
    await Promise.all(conflictingItems.map((item) => callMeteor('eliminarElementoCarrito', item._id)));
  }, [cartState]);

  return { ...cartState, addProduct, removeItem, clearConflictingItems, refresh };
}
