import { DEFAULT_CUSTOMIZATION, normalizeCustomization } from './appearanceCustomization.js';

export const DEFAULT_APPEARANCE = {
  primary: '#6d45d8', secondary: '#f97316', background: '#f7f7f9',
  logo: '', cover: '', loginImage: '', ordersCover: '', headline: '', description: '', loginHeadline: '',
  backgroundImage: '', headerImage: '', footerImage: '', design: DEFAULT_CUSTOMIZATION,
};

export const APPEARANCE_PRESETS = [
  { name: 'Esencia', primary: '#6d45d8', secondary: '#f97316', background: '#f7f7f9' },
  { name: 'Botánica', primary: '#24634b', secondary: '#ad632c', background: '#f0f4ef' },
  { name: 'Océano', primary: '#175b9a', secondary: '#c45b39', background: '#eff5fa' },
  { name: 'Terracota', primary: '#a34535', secondary: '#8b6925', background: '#faf1eb' },
  { name: 'Atelier', primary: '#34363e', secondary: '#a67c38', background: '#f4f1eb' },
];

export function normalizeAppearance(settings) {
  const result = { ...DEFAULT_APPEARANCE };
  for (const key of Object.keys(result)) {
    if (typeof settings?.[key] === 'string' && settings[key]) result[key] = settings[key];
  }
  for (const key of ['primary', 'secondary', 'background']) {
    if (!/^#[\da-f]{6}$/i.test(result[key])) result[key] = DEFAULT_APPEARANCE[key];
  }
  for (const key of ['logo', 'cover', 'loginImage', 'ordersCover', 'backgroundImage', 'headerImage', 'footerImage']) {
    if (!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(result[key])) result[key] = '';
  }
  result.design = normalizeCustomization(settings?.design);
  return result;
}

export function appearanceRootProps(appearance) {
  return {
    'data-pattern': appearance.design.backgroundPattern,
    'data-card-size': appearance.design.cardSize,
    'data-footer-visible': appearance.design.footerVisible,
    'data-login-layout': appearance.design.loginLayout,
    'data-background-image': Boolean(appearance.backgroundImage),
    style: { '--brand-page-image': appearance.backgroundImage ? `url("${appearance.backgroundImage}")` : 'none' },
  };
}

const rgb = (hex) => [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16));
export const mixColor = (color, target, amount) => `#${rgb(color).map((value, index) =>
  Math.round(value * (1 - amount) + rgb(target)[index] * amount).toString(16).padStart(2, '0')).join('')}`;
const luminance = (hex) => rgb(hex).map((value) => {
  const channel = value / 255;
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);

export const contrastRatio = (a, b) => (Math.max(luminance(a), luminance(b)) + 0.05) /
  (Math.min(luminance(a), luminance(b)) + 0.05);

export function readableColor(color, surface, minimum = 4.5) {
  const target = contrastRatio('#000000', surface) >= contrastRatio('#ffffff', surface) ? '#000000' : '#ffffff';
  let next = color;
  for (let step = 0; step <= 100 && contrastRatio(next, surface) < minimum; step += 1) {
    next = mixColor(color, target, step / 100);
  }
  return next;
}

export function appearanceTokens(settings, mode = 'light') {
  const appearance = normalizeAppearance(settings);
  const design = appearance.design;
  const customBackground = design[mode === 'dark' ? 'backgroundDark' : 'backgroundLight'];
  const chosenBackground = customBackground || appearance.background;
  const dark = customBackground ? contrastRatio('#ffffff', chosenBackground) > contrastRatio('#000000', chosenBackground) : mode === 'dark';
  let text = dark ? '#f7f5fc' : '#201d27';
  let muted = dark ? '#bcb8c6' : '#6f6b78';
  let background = chosenBackground;
  const target = dark ? '#0c0c12' : '#ffffff';
  if (customBackground) {
    text = readableColor(text, background);
    muted = readableColor(muted, background);
  } else {
    for (let step = 0; step <= 100 && ((dark ? luminance(background) >= luminance(muted) : luminance(background) <= luminance(muted)) || contrastRatio(background, muted) < (dark ? 5.5 : 4.5)); step += 1) {
      background = mixColor(chosenBackground, target, step / 100);
    }
  }
  const safeSurface = (color) => {
    let surface = color;
    for (let step = 0; step <= 100 && (contrastRatio(surface, muted) < 4.5 || (dark ? luminance(surface) >= luminance(muted) : luminance(surface) <= luminance(muted))); step += 1) {
      surface = mixColor(color, target, step / 100);
    }
    return surface;
  };
  const paper = safeSurface(design[mode === 'dark' ? 'surfaceDark' : 'surfaceLight'] || (dark ? mixColor(background, '#ffffff', 0.045) : '#ffffff'));
  const primary = readableColor(readableColor(appearance.primary, paper), background);
  const secondary = readableColor(readableColor(appearance.secondary, paper), background);
  const onPrimary = contrastRatio(primary, '#ffffff') >= contrastRatio(primary, '#000000') ? '#ffffff' : '#000000';
  const onSecondary = contrastRatio(secondary, '#ffffff') >= contrastRatio(secondary, '#000000') ? '#ffffff' : '#000000';
  const soft = mixColor(paper, primary, dark ? 0.12 : 0.055);
  const header = appearance.headerImage ? '#15151e' : design[mode === 'dark' ? 'headerDark' : 'headerLight'] || safeSurface(mixColor(paper, primary, dark ? 0.2 : 0.1));
  const footer = appearance.footerImage ? '#15151e' : design[mode === 'dark' ? 'footerDark' : 'footerLight'] || safeSurface(mixColor(paper, secondary, dark ? 0.17 : 0.08));
  const card = design[mode === 'dark' ? 'cardDark' : 'cardLight'] || paper;
  const ink = (surface) => contrastRatio('#201d27', surface) >= 4.5 ? '#201d27' : (contrastRatio('#ffffff', surface) >= 4.5 ? '#ffffff' : '#000000');
  const cardText = ink(card);
  const headerText = ink(header);
  const footerText = ink(footer);
  const fonts = { inter: 'Inter, ui-sans-serif, system-ui, sans-serif', system: 'system-ui, sans-serif', serif: 'Georgia, Cambria, serif', rounded: '"Trebuchet MS", Verdana, sans-serif', mono: 'ui-monospace, "SFMono-Regular", Consolas, monospace' };
  const fontFamily = fonts[design.font];
  const cardWidth = { small: 195, medium: 238, large: 300 }[design.cardSize];
  const mediaRatio = { landscape: 0.61, square: 1, portrait: 1.25 }[design.cardImageRatio];
  const shadow = { none: 'none', soft: '0 5px 16px #100a1810', raised: '0 12px 30px #100a182e' }[design.cardShadow];
  const hero = mixColor(appearance.primary, '#080a12', 0.75);
  const heroEnd = readableColor(mixColor(appearance.primary, '#080a12', 0.4), '#ffffff', 9);
  return {
    primary, secondary, onPrimary, onSecondary, background, paper, text, muted, soft, hero, heroEnd, fontFamily, dark,
    variables: {
      '--accent': primary,
      '--accent-soft': mixColor(paper, primary, dark ? 0.16 : 0.09),
      '--brand-primary': primary,
      '--brand-on-primary': onPrimary,
      '--brand-secondary': secondary,
      '--brand-on-secondary': onSecondary,
      '--brand-hero': hero,
      '--brand-hero-end': heroEnd,
      '--brand-header': header,
      '--brand-footer': footer,
      '--brand-header-text': headerText,
      '--brand-header-muted': readableColor(muted, header),
      '--brand-header-accent': readableColor(appearance.primary, header),
      '--brand-footer-text': footerText,
      '--brand-footer-muted': readableColor(muted, footer),
      '--brand-card': card,
      '--brand-card-text': cardText,
      '--brand-card-muted': readableColor(muted, card),
      '--brand-card-accent': readableColor(appearance.primary, card),
      '--brand-card-green': readableColor('#16803d', card),
      '--brand-card-orange': readableColor('#b45309', card),
      '--brand-card-violet': readableColor('#6d28d9', card),
      '--brand-font': fontFamily,
      '--brand-card-width': `${cardWidth}px`,
      '--brand-image-aspect': String(1 / mediaRatio),
      '--brand-card-radius': `${design.cardRadius}px`,
      '--brand-card-gap': `${design.cardGap}px`,
      '--brand-card-shadow': shadow,
      '--brand-card-hover-shadow': design.cardShadow === 'none' ? 'none' : '0 14px 32px #100a1830',
      '--brand-image-fit': design.cardImageFit,
      '--brand-button-radius': `${{ pill: 999, rounded: 12, square: 4 }[design.buttonStyle]}px`,
      '--brand-content-width': `${{ wide: 1536, standard: 1200, narrow: 980 }[design.contentWidth]}px`,
      '--brand-section-gap': `${{ compact: 16, balanced: 28, airy: 44 }[design.sectionSpacing]}px`,
      '--brand-hero-height': `${design.heroHeight}px`,
      '--brand-orders-height': `${design.ordersHeroHeight}px`,
      '--brand-hero-overlay': design.heroOverlay / 100,
      '--brand-logo-size': `${design.logoSize}px`,
      '--brand-highlight': mixColor(appearance.secondary, '#ffffff', 0.7),
      '--mui-palette-background-default': background,
      '--mui-palette-background-paper': paper,
      '--mui-palette-text-primary': text,
      '--mui-palette-text-secondary': muted,
      '--surface-glass': `${paper}ed`,
      '--surface-soft': soft,
      '--line-soft': dark ? '#ffffff1a' : '#23193217',
      '--muted': muted,
    },
  };
}
