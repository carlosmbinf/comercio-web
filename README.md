# Tienda de comercio VIDKAR

Cliente web independiente construido con React, MUI y Vite. Se conecta al Meteor existente mediante DDP y reutiliza sus sesiones y contratos de negocio.

## Configuración

1. Instala dependencias con `npm install`.
2. Edita `.env` y configura `VITE_COMERCIO_EMPRESA_ID` con el `_id` del usuario propietario (`TiendasComercio.idUser`) o el `_id` de una tienda. Si se indica una tienda, el cliente resuelve su propietario y limita el catálogo a las tiendas de esa empresa. Mientras esté vacía la variable no se suscribe a tiendas o productos.
3. Ajusta `VITE_METEOR_DDP_URL` (WebSocket, ruta `/websocket`) y `VITE_METEOR_HTTP_URL` al servidor Meteor.
4. Para habilitar la búsqueda de direcciones, configura `VITE_GOOGLE_MAPS_API_KEY` en `.env`.
5. Arranca el cliente con `npm run dev`.

Para obtener la clave, crea o selecciona un proyecto en [Google Cloud Console](https://console.cloud.google.com/), configura facturación y habilita **Maps JavaScript API** y **Places API (New)**. Crea una clave de API y restríngela a los orígenes web usados por la tienda (`http://localhost:5174` y el dominio HTTPS de producción); en restricciones de API permite solo esas dos APIs. El valor `PEGA_AQUI_TU_CLAVE_DE_GOOGLE_MAPS` en el `.env` local es solo un marcador: reemplázalo por la clave real. La clave del navegador se incluye en el bundle, por eso debe quedar restringida; no es un secreto de servidor.

En el checkout, la dirección seleccionada completa la calle, número y punto del mapa. También se puede ajustar el marcador a mano. Las coordenadas se conservan para enviar la orden, pero no se muestran en pantalla.

### Inicio de sesión con Google

- El botón usa Google Identity Services en un popup sobre esta misma pantalla; no redirige a `www.vidkar.com`.
- El backend Meteor lee el client ID público de `Meteor.settings.google.client_id`, crea un nonce de un solo uso y verifica el ID token antes de emitir la sesión VIDKAR. No añadas un client secret ni un `VITE_GOOGLE_CLIENT_ID` al `.env`.
- En el cliente OAuth web configurado en Google Cloud, añade como **Authorized JavaScript origins** el origen exacto donde se publica esta tienda (por ejemplo, `https://comercio.tudominio.com`) y `http://localhost:5174` para desarrollo local. En este workspace remoto también se debe autorizar `https://4h5rhg54-5174.brs.devtunnels.ms`; el dominio del túnel puede cambiar. Producción debe servirse por HTTPS.
- El servidor web debe enviar `Cross-Origin-Opener-Policy: same-origin-allow-popups` para que el navegador permita el intercambio con el popup de Google. Vite lo aplica en `dev` y `preview`; replica este header en el hosting de producción.
- `LOGIN_WITH_GOOGLE` puede deshabilitar este método igual que en el sitio principal. El mismo ID token solo se acepta para los client IDs permitidos por `settings.google.client_id` y `settings.google.validClientIds` en Meteor.

El `.env` local no se versiona. Para producción usa `wss://` y HTTPS.

## Modo empresa

- La opción aparece únicamente cuando inicia sesión la cuenta propietaria resuelta desde `VITE_COMERCIO_EMPRESA_ID`. Entrar directamente a `/empresa` aplica el mismo control.
- Para operar, esa cuenta debe tener rol `EMPRESA`, aceptar los términos si corresponde y no estar bloqueada. La web no exige `modoEmpresa=true`: ese flag sigue controlando la navegación de la app móvil, no el acceso al panel web. El servidor vuelve a validar identidad, rol, términos, estado y propiedad; la visibilidad de la opción no es la autorización.
- El panel incluye preparación de pedidos, productos, tiendas/sucursales y categorías. La ubicación es obligatoria al crear o editar una tienda según el schema actual.
- Para gestión se usan publicaciones privadas que filtran y proyectan en el servidor: `comercio.tiendasEmpresa`, `comercio.productosEmpresa` y `comercio.pedidosPreparacion`. Las ventas compartidas entre tiendas conservan la transición global de la app; las órdenes con artículos de otros tipos no se pueden avanzar desde este panel.
- La tienda pública conserva las publicaciones `tiendas` y `productosComercio` porque su catálogo debe ser visible para compradores. Las publicaciones históricas genéricas, en particular `ventasRecharge`, todavía aceptan selectores amplios y requieren un endurecimiento transversal separado; el nuevo panel no las usa para su cola operativa.

## Contratos Meteor reutilizados

- Publicaciones de escaparate/compra: `tiendas`, `productosComercio`, `carrito`, `ordenes`, `ventasRecharge`, `user` y `evidenciasVentasEfectivoRecharge`. Para el panel de empresa se usan además `comercio.tiendasEmpresa`, `comercio.productosEmpresa` y `comercio.pedidosPreparacion`.
- Métodos reutilizados de COMERCIO, modo empresa, autenticación, pago y comprobantes: `users.aceptarTerminosEmpresa`, `users.toggleModoEmpresa`, `addEmpresa`, `tiendas.update`, `removeTienda`, `addProducto`, `comercio.editProducto`, `removeProducto`, `comercio.uploadProductImage`, `comercio.deleteProductImage`, `comercio.pedidos.avanzar`, `comercio.pedidos.desasignarCadete`, `comercio.categorias.crear`, `comercio.categorias.actualizar`, `addAlCarrito`, `eliminarElementoCarrito`, `carrito.actualizarUbicacion`, `comercio.calcularCostosEntrega`, `paypal.totalAPagar`, `mercadopago.totalAPagar`, `efectivo.totalAPagar`, `creandoOrden`, `mercadopago.createOrder`, `efectivo.createOrder`, `generarVentaEfectivo`, `cancelarOrdenesPaypalIncompletas`, `moneda.convertir`, `property.getVariasPropertys`, `property.getValor`, `findImgbyProduct`, `calculoDeComisionesPorTiendaFinanl`, `archivos.upload` y `archivos.delete`.

El escaparate limita el catálogo al comercio configurado para presentar una única tienda empresarial. Ese filtro público no otorga permisos de gestión: las escrituras y publicaciones privadas del panel vuelven a validar ownership en Meteor.
