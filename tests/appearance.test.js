import assert from 'node:assert/strict';
import test from 'node:test';
import { APPEARANCE_PRESETS, DEFAULT_APPEARANCE, appearanceTokens, contrastRatio, mixColor, normalizeAppearance } from '../src/domain/appearance.js';

test('una tienda sin configuración conserva valores seguros y no admite URLs o SVG', () => {
  assert.deepEqual(normalizeAppearance(null), DEFAULT_APPEARANCE);
  const settings = normalizeAppearance({ primary: 'red; display:none', logo: 'javascript:alert(1)', cover: 'https://other.test/image.png', loginImage: 'data:image/svg+xml;base64,PHN2Zy8+', ordersCover: 'https://other.test/orders.png', extra: 'private' });
  assert.deepEqual(settings, DEFAULT_APPEARANCE);
});

test('la portada de pedidos es opcional e independiente de la portada del catálogo', () => {
  const cover = 'data:image/webp;base64,YWJjZA==';
  const ordersCover = 'data:image/webp;base64,ZWZnaA==';
  assert.equal(normalizeAppearance({ cover }).ordersCover, '');
  const settings = normalizeAppearance({ cover, ordersCover });
  assert.equal(settings.cover, cover);
  assert.equal(settings.ordersCover, ordersCover);
  assert.equal(normalizeAppearance({ ...settings, ordersCover: '' }).cover, cover);
  assert.equal(normalizeAppearance({ ...settings, ordersCover: '' }).ordersCover, '');
});

test('paletas y colores extremos mantienen contraste AA en claro y oscuro', () => {
  const colors = ['#000000', '#ffffff', '#ffff00', '#00ff00', '#0000ff', '#777777', '#ff00ff', '#01ffff'];
  const appearances = [
    ...APPEARANCE_PRESETS,
    ...colors.flatMap((primary) => colors.map((background) => ({ primary, secondary: primary, background }))),
  ];
  for (const mode of ['light', 'dark']) {
    for (const settings of appearances) {
      const tokens = appearanceTokens(settings, mode);
      for (const surface of [tokens.background, tokens.paper]) {
        for (const color of [tokens.primary, tokens.secondary, tokens.text, tokens.muted]) {
          assert.ok(contrastRatio(color, surface) >= 4.5, `${mode}: ${color} sobre ${surface}`);
        }
      }
      assert.ok(contrastRatio(tokens.primary, tokens.onPrimary) >= 4.5);
      assert.ok(contrastRatio(tokens.secondary, tokens.onSecondary) >= 4.5);
      assert.ok(contrastRatio(tokens.hero, '#ffffff') >= 4.5);
      assert.ok(contrastRatio(tokens.heroEnd, '#ffffff') >= 4.5);
      assert.ok(contrastRatio(tokens.heroEnd, mixColor('#ffffff', tokens.heroEnd, 0.22)) >= 4.5);
    }
  }
});

test('la identidad de una empresa no modifica defaults ni configuraciones de otras tiendas', () => {
  const a = normalizeAppearance({ primary: '#123456', headline: 'Mi tienda' });
  const b = normalizeAppearance({ primary: '#654321', headline: 'Otra tienda' });
  a.headline = 'Editada';
  assert.equal(b.headline, 'Otra tienda');
  assert.equal(DEFAULT_APPEARANCE.headline, '');
  assert.notEqual(appearanceTokens(a).primary, appearanceTokens(b).primary);
});
