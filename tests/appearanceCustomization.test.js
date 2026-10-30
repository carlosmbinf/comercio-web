import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeAppearance, appearanceTokens, contrastRatio } from '../src/domain/appearance.js';
import { DEFAULT_CUSTOMIZATION, normalizeCustomization, normalizePublicLink, validateCustomization } from '../src/domain/appearanceCustomization.js';

test('los ajustes pertenecen a cada tienda y conservan ceros y opciones desactivadas', () => {
  const a = normalizeAppearance({ design: { cardRadius: 0, headerSticky: false, footerLinks: [{ label: 'Ayuda', href: '/pedidos' }] } });
  const b = normalizeAppearance(null);
  assert.equal(a.design.cardRadius, 0);
  assert.equal(a.design.headerSticky, false);
  a.design.footerLinks[0].label = 'Otra etiqueta';
  assert.deepEqual(b.design, DEFAULT_CUSTOMIZATION);
  assert.deepEqual(normalizeCustomization({ cardSize: 'css:injection', cardLight: '#fff', logoSize: 999 }), DEFAULT_CUSTOMIZATION);
});

test('los fondos de tarjetas, header y footer son independientes y mantienen texto legible', () => {
  for (const mode of ['light', 'dark']) {
    for (const color of ['#ffffff', '#000000', '#ff0000', '#00ff00', '#0000ff', '#777777']) {
      const tokens = appearanceTokens({ design: { cardLight: color, cardDark: color, headerLight: color, headerDark: color, footerLight: color, footerDark: color } }, mode);
      for (const part of ['card', 'header', 'footer']) {
        assert.equal(tokens.variables[`--brand-${part}`], color);
        assert.ok(contrastRatio(tokens.variables[`--brand-${part}-text`], color) >= 4.5);
        assert.ok(contrastRatio(tokens.variables[`--brand-${part}-muted`], color) >= 4.5);
      }
    }
  }
  const small = appearanceTokens({ design: { cardSize: 'small' } });
  const large = appearanceTokens({ design: { cardSize: 'large', cardRadius: 0, cardImageRatio: 'portrait', buttonStyle: 'square' } });
  assert.notEqual(small.variables['--brand-card-width'], large.variables['--brand-card-width']);
  assert.equal(large.variables['--brand-card-radius'], '0px');
  assert.equal(large.variables['--brand-button-radius'], '4px');
  for (const color of ['#ffffff', '#000000', '#ff0000', '#00ff00', '#777777']) {
    const tokens = appearanceTokens({ design: { backgroundLight: color } });
    assert.equal(tokens.background, color);
    assert.ok(contrastRatio(tokens.text, color) >= 4.5);
    assert.ok(contrastRatio(tokens.muted, color) >= 4.5);
    assert.ok(contrastRatio(tokens.text, tokens.paper) >= 4.5);
  }
});

test('los enlaces públicos aceptan navegación, contacto y redes y descartan ejecución o redirecciones ambiguas', () => {
  for (const href of ['/pedidos', '#catalogo', 'https://example.test', 'mailto:tienda@example.test', 'tel:+12345678']) assert.equal(normalizePublicLink(href), href);
  for (const href of ['javascript:alert(1)', 'data:text/html,hi', '//example.test', 'https:example.test', '/\\example.test', 'mailto:x@example.test%0dBcc:y@example.test']) {
    assert.equal(normalizePublicLink(href), '');
    assert.throws(() => validateCustomization({ footerLinks: [{ label: 'Ir', href }] }));
  }
  const design = normalizeCustomization({ footerLinks: [{ label: 'Bueno', href: '/pedidos' }, { label: 'Malo', href: 'javascript:alert(1)' }] });
  assert.equal(design.footerLinks.length, 1);
});

test('los bloques informativos conservan orden y ubicación y validan sus botones', () => {
  const blocks = [{ title: 'La marca', body: 'Nuestra historia', buttonLabel: '', href: '', placement: 'before-products', tone: 'surface' }, { title: 'Entrega', body: 'Consulta tus pedidos', buttonLabel: 'Ver pedidos', href: '/pedidos', placement: 'after-products', tone: 'brand' }];
  assert.deepEqual(validateCustomization({ contentBlocks: blocks }).contentBlocks, blocks);
  assert.throws(() => validateCustomization({ contentBlocks: [{ ...blocks[0], href: '/pedidos' }] }));
  assert.throws(() => validateCustomization({ contentBlocks: Array(7).fill(blocks[0]) }));
  assert.equal(normalizeCustomization({ contentBlocks: [null, ...blocks] }).contentBlocks.length, 2);
});
