import assert from 'node:assert/strict';
import test from 'node:test';
import { prepareAppearanceImage } from '../src/domain/appearanceImage.js';

function browserEncoder(t, { width = 1983, height = 793, alpha = 255, encode }) {
  const originals = ['document', 'createImageBitmap'].map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]);
  const state = { closed: false, formats: [] };
  const canvas = {
    width: 0, height: 0,
    getContext: () => ({ clearRect() {}, drawImage() {}, getImageData: () => ({ data: new Uint8ClampedArray([20, 30, 40, alpha]) }) }),
    toDataURL(format, quality) { state.formats.push(format); return encode(format, quality, this); },
  };
  globalThis.document = { createElement: () => canvas };
  globalThis.createImageBitmap = async () => ({ width, height, close() { state.closed = true; } });
  t.after(() => originals.forEach(([key, descriptor]) => {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else delete globalThis[key];
  }));
  return state;
}

test('acepta el PNG generado cuando el navegador no puede codificar WebP', async (t) => {
  const png = 'data:image/png;base64,YWJjZA==';
  const state = browserEncoder(t, { encode: () => png });
  assert.equal(await prepareAppearanceImage({ type: 'image/png', size: 12000000 }, 'footerImage'), png);
  assert.equal(state.closed, true);
});

test('comprime una imagen opaca como JPEG si el PNG alternativo supera el presupuesto', async (t) => {
  const jpeg = 'data:image/jpeg;base64,YWJjZA==';
  browserEncoder(t, { encode: (format) => format === 'image/jpeg' ? jpeg : `data:image/png;base64,${'A'.repeat(340000)}` });
  assert.equal(await prepareAppearanceImage({ type: 'image/png' }, 'footerImage'), jpeg);
});

test('reduce un PNG transparente sin aplanar su transparencia a JPEG', async (t) => {
  const png = 'data:image/png;base64,YWJjZA==';
  const state = browserEncoder(t, { alpha: 0, encode: (_format, _quality, canvas) => canvas.width <= 1024 ? png : `data:image/png;base64,${'A'.repeat(340000)}` });
  assert.equal(await prepareAppearanceImage({ type: 'image/png' }, 'footerImage'), png);
  assert.ok(!state.formats.includes('image/jpeg'));
});

test('admite también imágenes menores que el tamaño mínimo de reducción', async (t) => {
  const webp = 'data:image/webp;base64,YWJjZA==';
  browserEncoder(t, { width: 32, height: 16, encode: () => webp });
  assert.equal(await prepareAppearanceImage({ type: 'image/webp' }, 'logo'), webp);
});
