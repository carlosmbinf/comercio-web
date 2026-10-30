# Tienda de comercio VIDKAR

Cliente web independiente construido con React, MUI y Vite. Se conecta al Meteor existente mediante DDP y reutiliza sus sesiones y contratos de negocio.

## Direcciones guardadas en el checkout

En el paso **Entrega**, cada comprador puede seleccionar una dirección de su cuenta o crear una nueva mediante la búsqueda, el mapa o su ubicación actual. Puede guardarla con un nombre, marcarla como predeterminada o eliminar una dirección guardada con confirmación. La primera guardada es predeterminada; el checkout la preselecciona si el carrito todavía no tiene una entrega configurada. Continuar confirma la selección para el pedido.

La libreta persiste hasta 20 direcciones por cuenta en Meteor (`COMERCIO_deliveryAddresses`), compartida entre tiendas y MCP, sin publicaciones públicas. Usa los métodos `comercio.deliveryAddresses.list`, `.save`, `.use`, `.setDefault` y `.remove`, que siempre toman el usuario de la sesión. Aplicar copia dirección y punto al carrito; borrar una dirección guardada no cambia pedidos anteriores. El punto reciente del navegador queda separado por cuenta.

Requiere actualizar el backend Meteor y `comercio-web`; el MCP anuncia herramientas para listar, guardar y seleccionar direcciones con su autorización correspondiente. Las direcciones nuevas conservan el requisito de punto confirmado. No se migran automáticamente ubicaciones históricas a la libreta.

## Configuración

1. Instala dependencias con `npm install`.
2. Edita `.env` y configura `VITE_COMERCIO_EMPRESA_ID` con el `_id` del usuario propietario (`TiendasComercio.idUser`) o el `_id` de una tienda. Si se indica una tienda, el cliente resuelve su propietario y limita el catálogo a las tiendas de esa empresa. Mientras esté vacía la variable no se suscribe a tiendas o productos.
3. Ajusta `VITE_METEOR_DDP_URL` (WebSocket, ruta `/websocket`) y `VITE_METEOR_HTTP_URL` al servidor Meteor.
4. Para habilitar la búsqueda de direcciones, configura `VITE_GOOGLE_MAPS_API_KEY` en `.env`.
5. Arranca el cliente con `npm run dev`.

### Producción con PM2

El aprovisionador genera un `.env` por tienda con nombre PM2 y puerto propios, instala también las dependencias de desarrollo (Vite) y arranca `ecosystem.config.cjs`. PM2 sirve mediante Vite sin generar `dist`: transforma los módulos al solicitarlos, escucha solo en `127.0.0.1`, desactiva HMR y acepta cualquier hostname. Nginx se encarga del dominio, HTTPS y de limitar la exposición pública del servicio. El aprovisionamiento selecciona un puerto libre del rango configurado.

Este modo evita la compilación inicial, a cambio de más trabajo de CPU por solicitud que servir assets precompilados. Para compilar estáticamente de forma manual siguen disponibles `npm run build` y `npm run start:production`; el aprovisionamiento automatizado no usa esa ruta.

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

## Apariencia de cada comercio

La cuenta propietaria encuentra **Modo empresa → Apariencia**. Los ajustes se publican para todos los visitantes y se comparten entre las sucursales de esa empresa:

- Fondos independientes de página, paneles, tarjetas, header y footer para claro y oscuro; patrones e imágenes de fondo. Los fondos explícitos de página, tarjetas, header y footer conservan el color elegido y adaptan el texto para mantener lectura. Los paneles se armonizan con el contraste general.
- Tarjetas pequeñas, medianas o grandes, vista inicial compacta o amplia, esquinas, separación, sombras, proporción y encuadre de fotografías. Nombre de sucursal y disponibilidad opcionales, y texto del botón de compra editable. El visitante conserva el selector de densidad del catálogo.
- Cinco familias tipográficas, forma de botones, ancho de página y espaciado. Las estructuras Catálogo, Boutique y Cercana combinan ajustes que luego se pueden modificar individualmente.
- Nombre público del sitio, logo y tamaño, frase de marca, tres distribuciones de header, cabecera fija opcional, anuncio superior y hasta seis enlaces propios de navegación. El logo también identifica la pestaña del navegador.
- Portada clásica, centrada o con imagen separada; altura, encuadre, intensidad del velo, visibilidad e indicadores. Altura independiente de Mis pedidos y login dividido o centrado.
- Footer compacto, centrado o en columnas, con visibilidad propia, logo, título y descripción opcionales, copyright y hasta doce enlaces ordenables, con opción de abrir otra pestaña.
- Hasta seis bloques informativos ordenables, antes o después de los productos, con título, texto, estilo y botón opcional para presentar la marca, entregas o servicios.
- Logo, portadas de catálogo y pedidos, bienvenida del login e imágenes de fondo para página, header y footer.

La vista previa se actualiza mientras se edita y reutiliza los componentes de cabecera, portada, tarjetas, bloques y footer del sitio. Un marco aislado permite ver los tamaños reales de escritorio y móvil, ampliar la vista y revisar tienda, login, pedidos o footer con sus media queries. Los productos proceden del catálogo público de la propia empresa. Las compras y los enlaces están desactivados dentro de la vista previa. Los borradores se conservan al alternar pestañas del panel; descartar y restaurar requieren publicar para cambiar la tienda visible.

Los colores de texto y botones se ajustan para mantener contraste AA; la base automática conserva su adaptación por modo. Las imágenes aceptan JPG, PNG o WebP sin un límite fijo de tamaño o resolución de origen. El navegador y el servidor reducen dimensiones y calidad progresivamente, y convierten a WebP antes de persistir; cada imagen guardada ocupa como máximo 250 KB y no conserva metadatos. Reemplazarla o quitarla no deja archivos huérfanos.

Se guardan en `COMERCIO_webAppearance`, con un documento por cuenta propietaria, compartido por sus sucursales y consumido únicamente por este cliente. `comercio.webAppearance` publica solo `settings`; `comercio.webAppearance.save(settings)` obtiene el destinatario de la sesión y exige rol EMPRESA, términos aceptados y cuenta no bloqueada. `settings.design` contiene opciones explícitas, rangos y textos limitados; no acepta un ID de otra empresa, CSS o HTML libre ni URLs de imágenes. Los enlaces admiten HTTP/HTTPS, rutas internas, mailto y tel; se rechazan esquemas ejecutables, credenciales en URLs y direcciones ambiguas.

Los clientes anteriores que omiten `design` o las imágenes nuevas conservan esos datos al guardar. El editor nuevo envía el diseño completo: restaurar y publicar lo restablece explícitamente. La autorización y la colección siguen siendo las existentes; no se modifica la apariencia de la app móvil ni del cliente web legacy.

Para habilitarlo deben actualizarse el backend Meteor (`server/comercioAppearance`) y este cliente. Si no hay una personalización guardada, se usa la identidad predeterminada. Si no puede cargarse la configuración, el escaparate conserva ese diseño y el editor ofrece reintentar sin permitir sobrescribir datos que todavía no se leyeron.

Validación enfocada: `npm test` y `npm run build` en este proyecto; `node --test tests/comercioAppearance.test.mjs` en `react-download`.

## Contratos Meteor reutilizados

### Sincronización con Mercado Libre

- El catálogo se importa en el backend Meteor, no en el VPS que sirve la tienda. El escaneo muestra publicaciones encontradas; el contador de procesadas aumenta durante la importación.
- El scan reutiliza el último `scroll_id` recibido. Dos páginas consecutivas sin IDs nuevos detienen la lectura con `mercadolibre-scan-stalled`, en lugar de repetir solicitudes hasta recibir un rechazo. Una página no vacía sin cursor tampoco se considera un catálogo completo.
- **Pausar sincronización** solicita `comercio.mercadoLibre.pausarCatalogo(jobId)`: pasa a `pausing` y luego a `paused` al terminar la petición o lote en curso. No desconecta la cuenta ni detiene la sincronización de ventas/stock. Conserva los productos importados; iniciar otra sincronización crea un job y cursor nuevos y vuelve a leer el catálogo (no retoma un cursor posiblemente vencido).
- Un 403 genérico después de páginas válidas se informa como `mercadolibre-scan-access-denied`, sin atribuirlo automáticamente a permisos faltantes ni reintentarlo. No hay evidencia de un límite de 4.000 publicaciones; scan es el mecanismo documentado para superar las 1.000 de paginación tradicional.
- `comercio.mercadoLibre.estadoSincronizacion` contrasta el job con su evento de cola. Si el evento terminó con error o fue ignorado, recupera el estado persistido para no dejar el botón bloqueado. Los fallos transitorios mantienen la espera de reintento; un 403 es terminal y no se reintenta automáticamente.
- La web muestra los errores al consultar el progreso, conserva el último estado conocido y permite **Actualizar estado**. Un indicador de integración habilitada no es una comprobación de permisos para todas las APIs.
- Un 403 al listar publicaciones puede coexistir con OAuth exitoso, categorías consultables u otras operaciones válidas: cada recurso puede requerir permisos distintos. Revisa en DevCenter permisos funcionales de publicaciones, scopes autorizados, estado de la aplicación/cuenta y, si existe una lista de IP permitidas, la IP de salida del servidor Meteor. Si cambias permisos, vuelve a autorizar la cuenta.
- No uses otra cuenta, tokens públicos ni endpoints alternativos para eludir un 403. No compartas access tokens, refresh tokens ni respuestas remotas sin sanitizar.
- Despliega los cambios del backend `react-download` y del cliente `comercio-web`; actualizar solo el frontend no repara el estado de la cola ni los permisos externos. Tras desplegar, **Actualizar estado** recupera trabajos terminales antiguos sin volver a importar.

Referencias oficiales: [error 403](https://developers.mercadolibre.com.ar/es_ar/error-403), [publicaciones y búsquedas](https://developers.mercadolibre.com.mx/en_us/items-and-searches) y [límites de paginación y extracción](https://global-selling.mercadolibre.com/devsite/en_us/manage-automations/limits-on-pagination-and-bulk-extraction-in-searches).

- Publicaciones de escaparate/compra: `tiendas`, `productosComercio`, `carrito`, `ordenes`, `ventasRecharge`, `user` y `evidenciasVentasEfectivoRecharge`. Para el panel de empresa se usan además `comercio.tiendasEmpresa`, `comercio.productosEmpresa` y `comercio.pedidosPreparacion`.
- Métodos reutilizados de COMERCIO, modo empresa, autenticación, pago y comprobantes: `users.aceptarTerminosEmpresa`, `users.toggleModoEmpresa`, `addEmpresa`, `tiendas.update`, `removeTienda`, `addProducto`, `comercio.editProducto`, `removeProducto`, `comercio.uploadProductImage`, `comercio.deleteProductImage`, `comercio.pedidos.avanzar`, `comercio.pedidos.desasignarCadete`, `comercio.categorias.crear`, `comercio.categorias.actualizar`, `addAlCarrito`, `eliminarElementoCarrito`, `carrito.actualizarUbicacion`, `comercio.calcularCostosEntrega`, `paypal.totalAPagar`, `mercadopago.totalAPagar`, `efectivo.totalAPagar`, `creandoOrden`, `mercadopago.createOrder`, `efectivo.createOrder`, `generarVentaEfectivo`, `cancelarOrdenesPaypalIncompletas`, `moneda.convertir`, `property.getVariasPropertys`, `property.getValor`, `findImgbyProduct`, `calculoDeComisionesPorTiendaFinanl`, `archivos.upload` y `archivos.delete`.

El escaparate limita el catálogo al comercio configurado para presentar una única tienda empresarial. Ese filtro público no otorga permisos de gestión: las escrituras y publicaciones privadas del panel vuelven a validar ownership en Meteor.
