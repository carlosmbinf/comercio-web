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

## Contratos Meteor reutilizados

- Publicaciones existentes: `tiendas`, `productosComercio`, `carrito`, `ordenes`, `ventasRecharge`, `user` y `evidenciasVentasEfectivoRecharge`.
- Métodos existentes de COMERCIO, autenticación, pago y comprobantes: `addAlCarrito`, `eliminarElementoCarrito`, `carrito.actualizarUbicacion`, `comercio.calcularCostosEntrega`, `paypal.totalAPagar`, `mercadopago.totalAPagar`, `efectivo.totalAPagar`, `creandoOrden`, `mercadopago.createOrder`, `efectivo.createOrder`, `generarVentaEfectivo`, `cancelarOrdenesPaypalIncompletas`, `moneda.convertir`, `property.getVariasPropertys`, `property.getValor`, `findImgbyProduct`, `calculoDeComisionesPorTiendaFinanl`, `archivos.upload` y `archivos.delete`.

Las suscripciones del catálogo y del historial incluyen el ID de empresa/tiendas como filtro de cliente. Las publicaciones del backend aceptan selectores del cliente sin autorizar el ámbito de empresa; por ello esta app limita lo que consulta y muestra, pero no puede convertir ese filtro en una barrera de seguridad del servidor sin cambiar `react-download`.
