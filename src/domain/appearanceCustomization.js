// Contrato de personalización exclusivo de comercio-web; validado también en Meteor.
export const CUSTOM_COLOR_KEYS = ['backgroundLight', 'backgroundDark', 'surfaceLight', 'surfaceDark', 'cardLight', 'cardDark', 'headerLight', 'headerDark', 'footerLight', 'footerDark'];
export const CUSTOM_OPTIONS = {
  font: ['inter', 'system', 'serif', 'rounded', 'mono'],
  cardSize: ['small', 'medium', 'large'], cardShadow: ['none', 'soft', 'raised'],
  cardImageFit: ['cover', 'contain'], cardImageRatio: ['landscape', 'square', 'portrait'],
  buttonStyle: ['pill', 'rounded', 'square'], contentWidth: ['wide', 'standard', 'narrow'],
  sectionSpacing: ['compact', 'balanced', 'airy'], backgroundPattern: ['glow', 'none', 'dots', 'grid'],
  headerLayout: ['classic', 'centered', 'stacked'], heroLayout: ['classic', 'centered', 'split'],
  heroImagePosition: ['center', 'top', 'bottom'], footerLayout: ['compact', 'columns', 'centered'],
  defaultView: ['compact', 'comfortable'], loginLayout: ['split', 'centered'],
};
export const CUSTOM_RANGES = { cardRadius: [0, 32], cardGap: [8, 32], heroHeight: [180, 520], heroOverlay: [55, 90], ordersHeroHeight: [200, 480], logoSize: [32, 72] };
export const CUSTOM_TEXT_LIMITS = { siteName: 90, headerCaption: 90, footerTitle: 90, footerText: 300, footerCopyright: 160, announcementText: 140, announcementUrl: 600, catalogTitle: 90, productButtonLabel: 24 };
const BOOLEAN_KEYS = ['headerSticky', 'headerShowCaption', 'heroVisible', 'heroShowStats', 'footerShowLogo', 'footerVisible', 'footerShowTitle', 'footerShowDescription', 'showStoreName', 'showStock'];
export const DEFAULT_CUSTOMIZATION = Object.freeze({
  ...Object.fromEntries(CUSTOM_COLOR_KEYS.map((key) => [key, ''])),
  font: 'inter', cardSize: 'small', cardRadius: 16, cardGap: 12, cardShadow: 'soft', cardImageFit: 'cover', cardImageRatio: 'landscape',
  buttonStyle: 'pill', contentWidth: 'wide', sectionSpacing: 'balanced', backgroundPattern: 'glow',
  siteName: '', headerLayout: 'classic', headerSticky: true, headerShowCaption: true, headerCaption: '', logoSize: 44,
  heroLayout: 'classic', heroVisible: true, heroShowStats: true, heroHeight: 300, heroOverlay: 72, heroImagePosition: 'center', ordersHeroHeight: 280,
  footerVisible: true, footerShowTitle: true, footerShowDescription: true, footerLayout: 'compact', footerTitle: '', footerText: '', footerCopyright: '', footerShowLogo: false,
  announcementText: '', announcementUrl: '', catalogTitle: '', productButtonLabel: '',
  defaultView: 'compact', showStoreName: true, showStock: true, loginLayout: 'split',
  headerLinks: Object.freeze([]), footerLinks: Object.freeze([]),
  contentBlocks: Object.freeze([]),
});

export function normalizePublicLink(value) {
  if (typeof value !== 'string') return '';
  const href = value.trim();
  if (!href || href.length > 600 || /[\s\\\u0000-\u001f\u007f]/.test(href) || /%0[ad]/i.test(href)) return '';
  if (href.startsWith('/') && !href.startsWith('//')) return href;
  if (/^#[a-z][\w:.-]*$/i.test(href)) return href;
  try {
    const url = new URL(href);
    if (['http:', 'https:'].includes(url.protocol) && !/^https?:\/\//i.test(href)) return '';
    return ['http:', 'https:', 'mailto:', 'tel:'].includes(url.protocol) && !url.username && !url.password && url.pathname ? href : '';
  } catch (_error) { return ''; }
}

export function normalizeCustomization(input) {
  const result = { ...DEFAULT_CUSTOMIZATION, headerLinks: [], footerLinks: [], contentBlocks: [] };
  for (const key of CUSTOM_COLOR_KEYS) if (/^#[\da-f]{6}$/i.test(input?.[key] || '')) result[key] = input[key];
  for (const [key, values] of Object.entries(CUSTOM_OPTIONS)) if (values.includes(input?.[key])) result[key] = input[key];
  for (const [key, [min, max]] of Object.entries(CUSTOM_RANGES)) if (Number.isInteger(input?.[key]) && input[key] >= min && input[key] <= max) result[key] = input[key];
  for (const key of BOOLEAN_KEYS) if (typeof input?.[key] === 'boolean') result[key] = input[key];
  for (const [key, max] of Object.entries(CUSTOM_TEXT_LIMITS)) if (typeof input?.[key] === 'string') result[key] = input[key].trim().slice(0, max);
  result.announcementUrl = normalizePublicLink(result.announcementUrl);
  for (const [key, max] of [['headerLinks', 6], ['footerLinks', 12]]) {
    result[key] = (Array.isArray(input?.[key]) ? input[key] : []).slice(0, max)
      .filter((link) => typeof link?.label === 'string' && link.label.trim() && normalizePublicLink(link.href))
      .map((link) => ({ label: link.label.trim().slice(0, 60), href: normalizePublicLink(link.href), newTab: link.newTab === true }));
  }
  result.contentBlocks = (Array.isArray(input?.contentBlocks) ? input.contentBlocks : []).slice(0, 6)
    .filter((block) => typeof block?.title === 'string' && block.title.trim())
    .map((block) => ({ title: block.title.trim().slice(0, 90), body: typeof block.body === 'string' ? block.body.trim().slice(0, 500) : '', buttonLabel: typeof block.buttonLabel === 'string' ? block.buttonLabel.trim().slice(0, 30) : '', href: normalizePublicLink(block.href), placement: block.placement === 'after-products' ? 'after-products' : 'before-products', tone: ['surface', 'brand', 'outline'].includes(block.tone) ? block.tone : 'surface' }));
  return result;
}

export function validateCustomization(input, fail = (message) => { throw new Error(message); }) {
  if (!input || typeof input !== 'object' || Array.isArray(input) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(input)) ||
      Object.keys(input).some((key) => !Object.hasOwn(DEFAULT_CUSTOMIZATION, key))) return fail('La personalización no es válida.');
  for (const [key, value] of Object.entries(input)) {
    if (CUSTOM_COLOR_KEYS.includes(key) && (typeof value !== 'string' || (value && !/^#[\da-f]{6}$/i.test(value)))) return fail('Utiliza colores hexadecimales de seis dígitos.');
    if (CUSTOM_OPTIONS[key] && !CUSTOM_OPTIONS[key].includes(value)) return fail('Una opción de diseño no es válida.');
    if (CUSTOM_RANGES[key] && (!Number.isInteger(value) || value < CUSTOM_RANGES[key][0] || value > CUSTOM_RANGES[key][1])) return fail('Un tamaño está fuera del rango permitido.');
    if (BOOLEAN_KEYS.includes(key) && typeof value !== 'boolean') return fail('Una opción de visibilidad no es válida.');
    if (CUSTOM_TEXT_LIMITS[key] && (typeof value !== 'string' || value.length > CUSTOM_TEXT_LIMITS[key])) return fail('Un texto supera el tamaño permitido.');
    if (key === 'announcementUrl' && value && !normalizePublicLink(value)) return fail('El enlace del anuncio no es válido.');
    if (['headerLinks', 'footerLinks'].includes(key)) {
      if (!Array.isArray(value) || value.length > (key === 'headerLinks' ? 6 : 12)) return fail('Hay demasiados enlaces.');
      for (const link of value) {
        if (!link || typeof link !== 'object' || Array.isArray(link) ||
            Object.keys(link).some((field) => !['label', 'href', 'newTab'].includes(field)) ||
            typeof link.label !== 'string' || !link.label.trim() || link.label.length > 60 ||
            !normalizePublicLink(link.href) || (link.newTab !== undefined && typeof link.newTab !== 'boolean')) {
          return fail('Revisa el título y la dirección de los enlaces.');
        }
      }
    }
    if (key === 'contentBlocks') {
      if (!Array.isArray(value) || value.length > 6) return fail('Puedes añadir hasta seis bloques informativos.');
      for (const block of value) {
        if (!block || typeof block !== 'object' || Array.isArray(block) ||
            Object.keys(block).some((field) => !['title', 'body', 'buttonLabel', 'href', 'placement', 'tone'].includes(field)) ||
            typeof block.title !== 'string' || !block.title.trim() || block.title.length > 90 ||
            typeof block.body !== 'string' || block.body.length > 500 ||
            typeof block.buttonLabel !== 'string' || block.buttonLabel.length > 30 ||
            typeof block.href !== 'string' || (block.href && !normalizePublicLink(block.href)) ||
            !['before-products', 'after-products'].includes(block.placement) ||
            !['surface', 'brand', 'outline'].includes(block.tone) ||
            (Boolean(block.href) !== Boolean(block.buttonLabel.trim()))) {
          return fail('Revisa el título, texto y enlace de los bloques informativos.');
        }
      }
    }
  }
  return normalizeCustomization(input);
}
