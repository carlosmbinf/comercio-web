import { Mongo } from '@meteorrn/core';

export const TiendasComercioCollection = new Mongo.Collection('COMERCIO_tiendas');
export const WebAppearanceCollection = new Mongo.Collection('COMERCIO_webAppearance');
export const ProductosComercioCollection = new Mongo.Collection('COMERCIO_productos');
export const CategoriasComercioCollection = new Mongo.Collection('COMERCIO_categorias');
export const SeleccionesCatalogoCollection = new Mongo.Collection('COMERCIO_seleccionesCatalogo');
export const ConfigCollection = new Mongo.Collection('config');
export const CarritoCollection = new Mongo.Collection('carrito_Recharge');
export const OrdenesCollection = new Mongo.Collection('ordenes_Recharge');
export const VentasRechargeCollection = new Mongo.Collection('ventas_Recharge');
export const EvidenciasVentasEfectivoCollection = new Mongo.Collection('evidenciasVentasEfectivo');
