// Los documentos históricos pueden vivir en producción mientras el servidor
// conectado recibe archivos nuevos en un almacenamiento local independiente.
export function getProductImageSources(value, backendUrl) {
  if (typeof value !== 'string' || !value.trim()) return [];
  const source = value.trim();
  if (source.startsWith('blob:')) return [source];

  try {
    const original = new URL(source, backendUrl || undefined);
    if (!['http:', 'https:'].includes(original.protocol)) return [];
    const sources = [original.href];
    if (/^\/cdn\/storage\/Images\//.test(original.pathname) && backendUrl) {
      const backend = new URL(backendUrl);
      if (['http:', 'https:'].includes(backend.protocol) && backend.origin !== original.origin) {
        // No trasladar tokens ni parámetros del host original a otro servidor.
        sources.push(new URL(original.pathname, backend.origin).href);
      }
    }
    return sources;
  } catch (_error) {
    return [];
  }
}