// Optimización local: no se transmite el archivo original ni sus metadatos.
export async function prepareAppearanceImage(file, slot) {
  if (!file || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error('Selecciona una imagen JPG, PNG o WebP.');
  }
  if (file.size > 8 * 1024 * 1024) throw new Error('La imagen debe pesar menos de 8 MB.');
  const bitmap = await createImageBitmap(file);
  try {
    if (bitmap.width * bitmap.height > 16000000) throw new Error('La imagen debe tener como máximo 16 megapíxeles.');
    const maxSize = slot === 'logo' ? 400 : 1600;
    const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('No se pudo preparar la imagen en este navegador.');
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.85, 0.7, 0.5]) {
      const data = canvas.toDataURL('image/webp', quality);
      if (data.length <= 330000) return data;
    }
    throw new Error('La imagen sigue siendo demasiado grande. Prueba con una de menor resolución.');
  } finally {
    bitmap.close();
  }
}
