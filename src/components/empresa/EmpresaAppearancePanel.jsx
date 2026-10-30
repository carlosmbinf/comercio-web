import React from 'react';
import { Alert, Box, Button, Card, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import PaletteRoundedIcon from '@mui/icons-material/PaletteRounded';
import AddPhotoAlternateOutlinedIcon from '@mui/icons-material/AddPhotoAlternateOutlined';
import RestartAltRoundedIcon from '@mui/icons-material/RestartAltRounded';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import { getCommerceDisplayName } from '../../config';
import { APPEARANCE_PRESETS, DEFAULT_APPEARANCE, normalizeAppearance } from '../../domain/appearance';
import { prepareAppearanceImage } from '../../domain/appearanceImage';
import { ensureEmpresaMethodSuccess } from '../../domain/empresa';
import { callMeteor } from '../../meteor/client';
import { validateCustomization } from '../../domain/appearanceCustomization';
import AppearanceCustomizationControls from './AppearanceCustomizationControls';
import AppearancePreview from './AppearancePreview';
import { useCatalogProducts, useStorefront } from '../../hooks/useStorefront';
import BrandImage from '../BrandImage';
import { useStoreBranding } from '../StoreBranding';

const IMAGE_SLOTS = [
  { key: 'logo', title: 'Logo de la tienda', hint: 'Formato cuadrado · recomendado 400 × 400 px. Aparece en el menú y el login.' },
  { key: 'cover', title: 'Portada del catálogo', hint: 'Formato horizontal · recomendado 1600 × 700 px. Presenta tu tienda en la página principal.' },
  { key: 'loginImage', title: 'Imagen de bienvenida', hint: 'Recomendado 1200 × 1400 px. Acompaña el acceso a la cuenta.' },
  { key: 'backgroundImage', title: 'Fondo de la página', hint: 'Imagen de ambiente para el fondo del sitio. Se aplica un velo suave para conservar la lectura.' },
  { key: 'headerImage', title: 'Fondo de la cabecera', hint: 'Formato horizontal. Personaliza el área de la marca y la navegación.' },
  { key: 'footerImage', title: 'Fondo del footer', hint: 'Formato horizontal. Aparece detrás del texto y los enlaces del pie de página.' },
  { key: 'ordersCover', title: 'Portada de Mis pedidos', hint: 'Formato horizontal · recomendado 1600 × 500 px. Aparece detrás del título de Mis pedidos.' },
];

export default function EmpresaAppearancePanel({ storefront, notify }) {
  const branding = useStoreBranding();
  const [draft, setDraft] = React.useState(() => normalizeAppearance(branding.appearance));
  const [baseline, setBaseline] = React.useState(() => JSON.stringify(normalizeAppearance(branding.appearance)));
  const [initialized, setInitialized] = React.useState(branding.ready);
  const [previewMode, setPreviewMode] = React.useState('light');
  const [previewPage, setPreviewPage] = React.useState('store');
  const [busy, setBusy] = React.useState(false);
  const [uploading, setUploading] = React.useState('');
  const [error, setError] = React.useState('');
  const [restoreOpen, setRestoreOpen] = React.useState(false);
  const imageInputs = React.useRef({});
  const dirty = JSON.stringify(draft) !== baseline;
  const companyName = getCommerceDisplayName(storefront.stores);
  const previewStorefront = useStorefront();
  const catalog = useCatalogProducts({
    enabled: ['store', 'footer'].includes(previewPage) && !previewStorefront.loading,
    categories: previewStorefront.categories,
    limit: 6,
    storeIds: previewStorefront.storeIds,
  });
  const customizationError = React.useMemo(() => {
    try { validateCustomization(draft.design); return ''; }
    catch (validationError) { return validationError.message; }
  }, [draft.design]);
  const invalidColor = ['primary', 'secondary', 'background'].some((key) => !/^#[\da-f]{6}$/i.test(draft[key]));

  React.useEffect(() => {
    if (branding.ready && !initialized) {
      const next = normalizeAppearance(branding.appearance);
      setDraft(next);
      setBaseline(JSON.stringify(next));
      setInitialized(true);
    }
  }, [branding.ready, branding.appearance, initialized]);

  React.useEffect(() => {
    if (!dirty) return undefined;
    const warn = (event) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const update = (key, value) => { setError(''); setDraft((current) => ({ ...current, [key]: value })); };
  const upload = async (event, key) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setError('');
    setUploading(key);
    try { update(key, await prepareAppearanceImage(file, key)); }
    catch (uploadError) { setError(uploadError.message || 'No se pudo preparar la imagen.'); }
    finally { setUploading(''); }
  };
  const save = async () => {
    if (!branding.ready || busy || uploading || invalidColor || customizationError) return;
    setBusy(true);
    setError('');
    try {
      const result = ensureEmpresaMethodSuccess(await callMeteor('comercio.webAppearance.save', draft));
      if (result?.success !== true || !result.settings) throw new Error('No se pudo confirmar el guardado.');
      const saved = normalizeAppearance(result.settings);
      setDraft(saved);
      setBaseline(JSON.stringify(saved));
      notify?.('Apariencia publicada. Tus visitantes ya pueden ver los cambios.');
    } catch (saveError) {
      setError(saveError.reason || saveError.message || 'No se pudo guardar la apariencia. Tus cambios siguen en la vista previa.');
    } finally { setBusy(false); }
  };

  if (!branding.ready) {
    return branding.error
      ? <Alert severity="error" action={<Button onClick={branding.retry}>Reintentar</Button>}>{branding.error}</Alert>
      : <Box className="appearance-loading"><CircularProgress size={24} /><Typography>Cargando la identidad de tu tienda…</Typography></Box>;
  }

  return (
    <Box className="appearance-editor">
      <Box className="appearance-heading">
        <Box>
          <Typography className="eyebrow" variant="overline">EL ESTILO DE TU MARCA</Typography>
          <Typography variant="h4">Una tienda que se siente tuya</Typography>
          <Typography color="text.secondary" sx={{ mt: 1 }}>Dale una estructura propia: fondos, tarjetas, tipografía, cabecera, portada y enlaces. Cada cambio se refleja en la vista previa antes de publicarlo.</Typography>
        </Box>
        <Chip color={dirty ? 'warning' : 'success'} variant="outlined" label={dirty ? 'Cambios sin publicar' : 'Todo guardado'} />
      </Box>

      <Box className="appearance-workspace">
        <Stack spacing={2.5} component="fieldset" disabled={busy || Boolean(uploading)} className="appearance-controls">
          <Card className="appearance-section" elevation={0}>
            <Box className="appearance-section-title"><PaletteRoundedIcon color="primary" /><Typography variant="h6">01 · Tu paleta</Typography></Box>
            <Typography color="text.secondary" variant="body2">Colores de marca para botones y detalles. Más abajo puedes elegir fondos independientes para cada parte del sitio.</Typography>
            <Box className="appearance-presets">
              {APPEARANCE_PRESETS.map((preset) => {
                const selected = ['primary', 'secondary', 'background'].every((key) => draft[key].toLowerCase() === preset[key]);
                return <button aria-pressed={selected} className="appearance-preset" disabled={busy || Boolean(uploading)} key={preset.name} onClick={() => setDraft((current) => ({ ...current, primary: preset.primary, secondary: preset.secondary, background: preset.background }))} type="button">
                  <span className="appearance-preset-swatches">{[preset.primary, preset.secondary, preset.background].map((color) => <i key={color} style={{ background: color }} />)}</span>
                  <span>{preset.name}</span>{selected ? <CheckRoundedIcon fontSize="small" /> : null}
                </button>;
              })}
            </Box>
            <Box className="appearance-colors">
              {[['primary', 'Color principal'], ['secondary', 'Color secundario'], ['background', 'Base de fondo automática']].map(([key, label]) => (
                <Box className="appearance-color" key={key}>
                  <input aria-label={`Elegir color ${label.toLowerCase()}`} disabled={busy || Boolean(uploading)} onChange={(event) => update(key, event.target.value)} type="color" value={/^#[\da-f]{6}$/i.test(draft[key]) ? draft[key] : DEFAULT_APPEARANCE[key]} />
                  <TextField error={!/^#[\da-f]{6}$/i.test(draft[key])} fullWidth label={label} onChange={(event) => update(key, event.target.value)} size="small" value={draft[key]} slotProps={{ htmlInput: { maxLength: 7, spellCheck: false } }} />
                </Box>
              ))}
            </Box>
            <Typography color="text.secondary" variant="caption">Ajustamos el contraste de botones y textos automáticamente. El fondo se aplica como un tono suave en cada modo.</Typography>
          </Card>

          <AppearanceCustomizationControls design={draft.design} onChange={(value) => update('design', value)} disabled={busy || Boolean(uploading)} />

          <Card className="appearance-section" elevation={0}>
            <Typography variant="h6">09 · Imágenes que cuentan tu historia</Typography>
            <Typography color="text.secondary" sx={{ mt: 0.75, mb: 2 }} variant="body2">JPG, PNG o WebP, sin límite fijo de tamaño o resolución. Las optimizamos antes de publicar.</Typography>
            <Stack spacing={2}>
              {IMAGE_SLOTS.map(({ key, title, hint }) => <Box className="appearance-image-field" key={key}>
                <Box className={`appearance-image-thumb ${key === 'logo' ? 'is-logo' : ''}`}>
                  <BrandImage src={draft[key]} alt={title} fallback={<AddPhotoAlternateOutlinedIcon color="disabled" />} />
                </Box>
                <Box className="appearance-image-copy">
                  <Typography fontWeight={700} variant="body2">{title}</Typography>
                  <Typography color="text.secondary" variant="caption">{hint}</Typography>
                  <Box className="appearance-image-actions">
                    <Button type="button" disabled={busy || Boolean(uploading)} onClick={() => imageInputs.current[key]?.click()} size="small" startIcon={uploading === key ? <CircularProgress size={14} /> : <AddPhotoAlternateOutlinedIcon />}>
                      {uploading === key ? 'Preparando…' : draft[key] ? 'Cambiar imagen' : 'Subir imagen'}
                    </Button>
                    <input ref={(node) => { imageInputs.current[key] = node; }} accept="image/jpeg,image/png,image/webp" aria-label={`Subir ${title.toLowerCase()}`} disabled={busy || Boolean(uploading)} hidden onChange={(event) => upload(event, key)} type="file" />
                    {draft[key] ? <Button color="inherit" disabled={busy || Boolean(uploading)} onClick={() => update(key, '')} size="small">Quitar</Button> : null}
                  </Box>
                </Box>
              </Box>)}
            </Stack>
          </Card>

          <Card className="appearance-section" elevation={0}>
            <Typography variant="h6">10 · La voz de tu tienda</Typography>
            <Stack spacing={2} sx={{ mt: 2 }}>
              <TextField fullWidth label="Título del catálogo" onChange={(event) => update('headline', event.target.value)} placeholder={`${companyName}, en tu puerta.`} value={draft.headline} helperText={`${draft.headline.length}/90 · Vacío: texto original`} slotProps={{ htmlInput: { maxLength: 90 } }} />
              <TextField fullWidth label="Descripción de bienvenida" minRows={2} multiline onChange={(event) => update('description', event.target.value)} value={draft.description} helperText={`${draft.description.length}/240`} slotProps={{ htmlInput: { maxLength: 240 } }} />
              <TextField fullWidth label="Título del login" onChange={(event) => update('loginHeadline', event.target.value)} placeholder="Todo lo que te gusta, en un solo lugar." value={draft.loginHeadline} helperText={`${draft.loginHeadline.length}/90 · Vacío: texto original`} slotProps={{ htmlInput: { maxLength: 90 } }} />
            </Stack>
          </Card>
        </Stack>

        <Box className="appearance-preview-column">
          <Box className="appearance-preview-heading">
            <Box><Typography variant="h6">Vista previa</Typography><Typography color="text.secondary" variant="caption">Solo tú ves los cambios hasta publicarlos.</Typography></Box>
            <ToggleButtonGroup exclusive onChange={(_event, value) => value && setPreviewMode(value)} size="small" value={previewMode} aria-label="Modo de la vista previa">
              <ToggleButton value="light">Claro</ToggleButton><ToggleButton value="dark">Oscuro</ToggleButton>
            </ToggleButtonGroup>
          </Box>
          <ToggleButtonGroup exclusive fullWidth onChange={(_event, value) => value && setPreviewPage(value)} size="small" value={previewPage} aria-label="Pantalla de la vista previa" sx={{ mb: 2 }}>
            <ToggleButton value="store">Tienda</ToggleButton><ToggleButton value="login">Login</ToggleButton><ToggleButton value="orders">Pedidos</ToggleButton><ToggleButton value="footer">Footer</ToggleButton>
          </ToggleButtonGroup>
          <AppearancePreview draft={draft} mode={previewMode} page={previewPage} density={draft.design.defaultView} companyName={draft.design.siteName || companyName} storefront={previewStorefront} catalog={catalog} />
          <Alert severity="info" sx={{ mt: 2 }}>Los colores se adaptan al modo claro y oscuro. Las imágenes llevan un velo para mantener el texto legible.</Alert>
        </Box>
      </Box>

      {customizationError ? <Alert severity="warning">{customizationError}</Alert> : null}
      {error ? <Alert severity="error">{error}</Alert> : null}
      <Box className="appearance-save-bar">
        <Button color="inherit" disabled={busy || Boolean(uploading)} onClick={() => setRestoreOpen(true)} startIcon={<RestartAltRoundedIcon />}>Restaurar diseño original</Button>
        <Box className="appearance-save-actions">
          <Button disabled={!dirty || busy || Boolean(uploading)} onClick={() => { setDraft(JSON.parse(baseline)); setError(''); }}>Descartar</Button>
          <Button disabled={!dirty || busy || Boolean(uploading) || invalidColor || Boolean(customizationError)} onClick={save} startIcon={busy ? <CircularProgress color="inherit" size={18} /> : <SaveOutlinedIcon />} variant="contained">{busy ? 'Publicando…' : 'Publicar apariencia'}</Button>
        </Box>
      </Box>
      <Dialog open={restoreOpen} onClose={() => setRestoreOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Restaurar el diseño original</DialogTitle>
        <DialogContent>Se quitarán los colores, imágenes, enlaces y ajustes personalizados de la vista previa. Publica después para aplicar el cambio a tu tienda.</DialogContent>
        <DialogActions><Button onClick={() => setRestoreOpen(false)}>Cancelar</Button><Button onClick={() => { setDraft({ ...DEFAULT_APPEARANCE }); setError(''); setRestoreOpen(false); }}>Restaurar</Button></DialogActions>
      </Dialog>
    </Box>
  );
}
