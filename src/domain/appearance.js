export const DEFAULT_APPEARANCE = {
  primary: '#6d45d8', secondary: '#f97316', background: '#f7f7f9',
  logo: '', cover: '', loginImage: '', ordersCover: '', headline: '', description: '', loginHeadline: '',
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
  for (const key of ['logo', 'cover', 'loginImage', 'ordersCover']) {
    if (!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(result[key])) result[key] = '';
  }
  return result;
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
  const target = luminance(surface) > 0.4 ? '#000000' : '#ffffff';
  let next = color;
  for (let step = 0; step <= 100 && contrastRatio(next, surface) < minimum; step += 1) {
    next = mixColor(color, target, step / 100);
  }
  return next;
}

export function appearanceTokens(settings, mode = 'light') {
  const appearance = normalizeAppearance(settings);
  const dark = mode === 'dark';
  let background = appearance.background;
  const target = dark ? '#0c0c12' : '#ffffff';
  for (let step = 0; step <= 100 && (dark ? luminance(background) > 0.02 : luminance(background) < 0.88); step += 1) {
    background = mixColor(appearance.background, target, step / 100);
  }
  const paper = dark ? mixColor(background, '#ffffff', 0.045) : '#ffffff';
  const primary = readableColor(readableColor(appearance.primary, paper), background);
  const secondary = readableColor(readableColor(appearance.secondary, paper), background);
  const onPrimary = contrastRatio(primary, '#ffffff') >= contrastRatio(primary, '#000000') ? '#ffffff' : '#000000';
  const onSecondary = contrastRatio(secondary, '#ffffff') >= contrastRatio(secondary, '#000000') ? '#ffffff' : '#000000';
  const text = dark ? '#f7f5fc' : '#201d27';
  const muted = dark ? '#bcb8c6' : '#6f6b78';
  const soft = mixColor(paper, primary, dark ? 0.12 : 0.055);
  const hero = mixColor(appearance.primary, '#080a12', 0.75);
  const heroEnd = readableColor(mixColor(appearance.primary, '#080a12', 0.4), '#ffffff', 9);
  return {
    primary, secondary, onPrimary, onSecondary, background, paper, text, muted, soft, hero, heroEnd,
    variables: {
      '--accent': primary,
      '--accent-soft': mixColor(paper, primary, dark ? 0.16 : 0.09),
      '--brand-primary': primary,
      '--brand-on-primary': onPrimary,
      '--brand-secondary': secondary,
      '--brand-on-secondary': onSecondary,
      '--brand-hero': hero,
      '--brand-hero-end': heroEnd,
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
