import React from 'react';
import { Accordion, AccordionDetails, AccordionSummary, Box, Button, FormControlLabel, IconButton, MenuItem, Slider, Stack, Switch, TextField, Typography } from '@mui/material';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import ArrowUpwardRoundedIcon from '@mui/icons-material/ArrowUpwardRounded';
import ArrowDownwardRoundedIcon from '@mui/icons-material/ArrowDownwardRounded';
import { CUSTOM_RANGES, normalizePublicLink } from '../../domain/appearanceCustomization';

const OPTIONS = {
  font: [['inter', 'Contemporánea'], ['system', 'Sistema'], ['serif', 'Editorial'], ['rounded', 'Amable'], ['mono', 'Técnica']],
  cardSize: [['small', 'Pequeñas'], ['medium', 'Medianas'], ['large', 'Grandes']],
  cardShadow: [['none', 'Sin sombra'], ['soft', 'Suave'], ['raised', 'Marcada']],
  cardImageFit: [['cover', 'Llenar y recortar'], ['contain', 'Mostrar imagen completa']],
  cardImageRatio: [['landscape', 'Horizontal'], ['square', 'Cuadrada'], ['portrait', 'Vertical']],
  buttonStyle: [['pill', 'Píldora'], ['rounded', 'Redondeados'], ['square', 'Rectos']],
  contentWidth: [['wide', 'Panorámica'], ['standard', 'Estándar'], ['narrow', 'Concentrada']],
  sectionSpacing: [['compact', 'Compacta'], ['balanced', 'Equilibrada'], ['airy', 'Espaciosa']],
  backgroundPattern: [['glow', 'Luz de marca'], ['none', 'Liso'], ['dots', 'Puntos'], ['grid', 'Cuadrícula']],
  headerLayout: [['classic', 'En una fila'], ['centered', 'Marca centrada'], ['stacked', 'Marca sobre el menú']],
  heroLayout: [['classic', 'Clásica'], ['centered', 'Centrada'], ['split', 'Imagen y texto separados']],
  heroImagePosition: [['center', 'Centro'], ['top', 'Arriba'], ['bottom', 'Abajo']],
  footerLayout: [['compact', 'Compacto'], ['columns', 'En columnas'], ['centered', 'Centrado']],
  defaultView: [['compact', 'Compacta'], ['comfortable', 'Amplia']],
  loginLayout: [['split', 'Historia y formulario'], ['centered', 'Formulario centrado']],
};
const STYLE_PRESETS = [
  { name: 'Catálogo', values: { font: 'inter', cardSize: 'small', cardRadius: 12, cardImageRatio: 'landscape', headerLayout: 'classic', heroLayout: 'classic', footerLayout: 'compact', contentWidth: 'wide', sectionSpacing: 'compact' } },
  { name: 'Boutique', values: { font: 'serif', cardSize: 'large', cardRadius: 4, cardImageRatio: 'portrait', headerLayout: 'centered', heroLayout: 'split', footerLayout: 'columns', contentWidth: 'standard', sectionSpacing: 'airy' } },
  { name: 'Cercana', values: { font: 'rounded', cardSize: 'medium', cardRadius: 28, cardImageRatio: 'square', headerLayout: 'stacked', heroLayout: 'centered', footerLayout: 'centered', contentWidth: 'standard', sectionSpacing: 'balanced' } },
];

export default function AppearanceCustomizationControls({ design, onChange, disabled }) {
  const change = (key, value) => onChange({ ...design, [key]: value });
  const changeBlock = (index, key, value) => change('contentBlocks', design.contentBlocks.map((block, position) => position === index ? { ...block, [key]: value } : block));
  const select = (key, label) => <TextField key={key} select fullWidth label={label} size="small" value={design[key]} onChange={(event) => change(key, event.target.value)}>{OPTIONS[key].map(([value, title]) => <MenuItem value={value} key={value}>{title}</MenuItem>)}</TextField>;
  const toggle = (key, label) => <FormControlLabel key={key} control={<Switch checked={design[key]} onChange={(event) => change(key, event.target.checked)} />} label={label} />;
  const text = (key, label, maxLength, multiline = false) => <TextField fullWidth key={key} label={label} size="small" value={design[key]} onChange={(event) => change(key, event.target.value)} multiline={multiline} minRows={multiline ? 2 : undefined} slotProps={{ htmlInput: { maxLength } }} helperText={`${design[key].length}/${maxLength} · Vacío: valor original`} />;
  const slider = (key, label, suffix = 'px') => <Box key={key}><Typography variant="body2" id={`appearance-${key}`}>{label} <strong>{design[key]} {suffix}</strong></Typography><Slider disabled={disabled} aria-labelledby={`appearance-${key}`} min={CUSTOM_RANGES[key][0]} max={CUSTOM_RANGES[key][1]} value={design[key]} onChange={(_event, value) => change(key, value)} valueLabelDisplay="auto" /></Box>;
  const section = (title, children, expanded = false) => <Accordion defaultExpanded={expanded} disableGutters elevation={0} className="appearance-customization-section"><AccordionSummary expandIcon={<ExpandMoreRoundedIcon />}><Typography fontWeight={750}>{title}</Typography></AccordionSummary><AccordionDetails><Stack spacing={2}>{children}</Stack></AccordionDetails></Accordion>;
  const links = (key, title, limit) => <Stack spacing={1.5}>
    <Typography variant="subtitle2">{title}</Typography>
    {design[key].map((link, index) => <Box className="appearance-link-editor" key={index}>
      <TextField label="Texto del enlace" fullWidth size="small" value={link.label} onChange={(event) => change(key, design[key].map((item, position) => position === index ? { ...item, label: event.target.value } : item))} slotProps={{ htmlInput: { maxLength: 60 } }} />
      <TextField label="Dirección del enlace" placeholder="https://…, /pedidos, mailto:… o tel:…" fullWidth size="small" value={link.href} error={Boolean(link.href) && !normalizePublicLink(link.href)} helperText={link.href && !normalizePublicLink(link.href) ? 'Usa una dirección web, una ruta de tu tienda, mailto: o tel:.' : undefined} onChange={(event) => change(key, design[key].map((item, position) => position === index ? { ...item, href: event.target.value } : item))} slotProps={{ htmlInput: { maxLength: 600 } }} />
      <Box className="appearance-link-actions"><FormControlLabel control={<Switch size="small" checked={link.newTab} onChange={(event) => change(key, design[key].map((item, position) => position === index ? { ...item, newTab: event.target.checked } : item))} />} label="Nueva pestaña" />
        {[-1, 1].map((direction) => <IconButton key={direction} size="small" aria-label={`${direction < 0 ? 'Subir' : 'Bajar'} enlace ${index + 1}`} disabled={disabled || index + direction < 0 || index + direction >= design[key].length} onClick={() => { const next = [...design[key]]; [next[index], next[index + direction]] = [next[index + direction], next[index]]; change(key, next); }}>{direction < 0 ? <ArrowUpwardRoundedIcon fontSize="small" /> : <ArrowDownwardRoundedIcon fontSize="small" />}</IconButton>)}
        <IconButton aria-label={`Quitar enlace ${index + 1}`} color="error" size="small" onClick={() => change(key, design[key].filter((_item, position) => position !== index))}><DeleteOutlineRoundedIcon fontSize="small" /></IconButton>
      </Box>
    </Box>)}
    <Button disabled={disabled || design[key].length >= limit} startIcon={<AddRoundedIcon />} onClick={() => change(key, [...design[key], { label: '', href: '', newTab: false }])}>Añadir enlace ({design[key].length}/{limit})</Button>
  </Stack>;
  return <Box className="appearance-customization-controls">
    {section('02 · Estructura y personalidad', <>
      <Typography variant="body2" color="text.secondary">Elige una estructura para empezar y ajusta cada detalle.</Typography>
      <Box className="appearance-style-presets">{STYLE_PRESETS.map((preset) => <Button key={preset.name} variant="outlined" onClick={() => onChange({ ...design, ...preset.values })}>{preset.name}</Button>)}</Box>
      {select('font', 'Familia tipográfica')}{select('buttonStyle', 'Forma de los botones')}{select('contentWidth', 'Ancho del contenido')}{select('sectionSpacing', 'Separación entre secciones')}{select('backgroundPattern', 'Patrón de fondo')}{select('loginLayout', 'Distribución del login')}
    </>)}
    {section('03 · Fondos independientes', <>
      <Typography variant="body2" color="text.secondary">Define cada superficie para los modos claro y oscuro. Automático recupera la combinación de tu paleta. Ajustamos la lectura de textos según el fondo.</Typography>
      {['Light', 'Dark'].map((mode) => <Stack spacing={1.5} key={mode}><Typography variant="subtitle2">Modo {mode === 'Light' ? 'claro' : 'oscuro'}</Typography>{[['background', 'Fondo de la página'], ['surface', 'Paneles y formularios'], ['card', 'Tarjetas de productos'], ['header', 'Cabecera'], ['footer', 'Pie de página']].map(([prefix, label]) => { const key = `${prefix}${mode}`; return <Box className="appearance-color" key={key}><input type="color" aria-label={`${label}, modo ${mode === 'Light' ? 'claro' : 'oscuro'}`} disabled={disabled} value={/^#[\da-f]{6}$/i.test(design[key]) ? design[key] : mode === 'Light' ? '#ffffff' : '#15151e'} onChange={(event) => change(key, event.target.value)} /><TextField size="small" fullWidth label={label} placeholder="Automático" value={design[key]} error={Boolean(design[key]) && !/^#[\da-f]{6}$/i.test(design[key])} onChange={(event) => change(key, event.target.value)} slotProps={{ htmlInput: { maxLength: 7 } }} /><Button size="small" disabled={!design[key]} onClick={() => change(key, '')}>Auto</Button></Box>; })}</Stack>)}
    </>)}
    {section('04 · Tarjetas del catálogo', <>{select('cardSize', 'Tamaño de las tarjetas')}{select('defaultView', 'Vista inicial del catálogo')}{slider('cardRadius', 'Esquinas')}{slider('cardGap', 'Espacio entre tarjetas')}{select('cardShadow', 'Profundidad')}{select('cardImageRatio', 'Proporción de las imágenes')}{select('cardImageFit', 'Ajuste de las fotografías')}{toggle('showStoreName', 'Mostrar nombre de la sucursal')}{toggle('showStock', 'Mostrar disponibilidad')}{text('productButtonLabel', 'Texto del botón de compra', 24)}{text('catalogTitle', 'Título de la sección de productos', 90)}</>)}
    {section('05 · Cabecera y anuncio', <>{text('siteName', 'Nombre público del sitio', 90)}{select('headerLayout', 'Distribución de la cabecera')}{slider('logoSize', 'Tamaño del logo')}{toggle('headerSticky', 'Mantener cabecera al desplazarse')}{toggle('headerShowCaption', 'Mostrar frase bajo el nombre')}{text('headerCaption', 'Frase de la marca', 90)}{text('announcementText', 'Anuncio superior', 140)}{text('announcementUrl', 'Enlace del anuncio', 600)}{links('headerLinks', 'Enlaces de la cabecera', 6)}</>)}
    {section('06 · Portada y pedidos', <>{toggle('heroVisible', 'Mostrar portada del catálogo')}{select('heroLayout', 'Distribución de la portada')}{slider('heroHeight', 'Altura de la portada')}{select('heroImagePosition', 'Encuadre de la fotografía')}{slider('heroOverlay', 'Oscurecer la fotografía', '%')}{toggle('heroShowStats', 'Mostrar indicadores de la tienda')}{slider('ordersHeroHeight', 'Altura de Mis pedidos')}</>)}
    {section('07 · Footer y enlaces', <>{toggle('footerVisible', 'Mostrar footer')}{toggle('footerShowTitle', 'Mostrar título del footer')}{toggle('footerShowDescription', 'Mostrar descripción del footer')}{select('footerLayout', 'Distribución del footer')}{toggle('footerShowLogo', 'Mostrar logo en el footer')}{text('footerTitle', 'Título del footer', 90)}{text('footerText', 'Descripción del footer', 300, true)}{text('footerCopyright', 'Texto legal o copyright', 160)}{links('footerLinks', 'Enlaces del footer', 12)}</>)}
    {section('08 · Bloques informativos', <>
      <Typography variant="body2" color="text.secondary">Presenta tu marca, explica cómo comprar o destaca servicios. Puedes ordenar los bloques y colocarlos antes o después de los productos.</Typography>
      {design.contentBlocks.map((block, index) => <Stack key={index} spacing={1.5} className="appearance-link-editor">
        <TextField label={`Título del bloque ${index + 1}`} size="small" fullWidth value={block.title} onChange={(event) => changeBlock(index, 'title', event.target.value)} slotProps={{ htmlInput: { maxLength: 90 } }} />
        <TextField label="Contenido del bloque" size="small" fullWidth multiline minRows={3} value={block.body} onChange={(event) => changeBlock(index, 'body', event.target.value)} slotProps={{ htmlInput: { maxLength: 500 } }} />
        <TextField label="Ubicación del bloque" select size="small" fullWidth value={block.placement} onChange={(event) => changeBlock(index, 'placement', event.target.value)}><MenuItem value="before-products">Antes del catálogo</MenuItem><MenuItem value="after-products">Después del catálogo</MenuItem></TextField>
        <TextField label="Estilo del bloque" select size="small" fullWidth value={block.tone} onChange={(event) => changeBlock(index, 'tone', event.target.value)}><MenuItem value="surface">Panel</MenuItem><MenuItem value="brand">Color de marca</MenuItem><MenuItem value="outline">Solo borde</MenuItem></TextField>
        <TextField label="Texto del botón del bloque" size="small" fullWidth value={block.buttonLabel} onChange={(event) => changeBlock(index, 'buttonLabel', event.target.value)} slotProps={{ htmlInput: { maxLength: 30 } }} />
        <TextField label="Enlace del bloque" size="small" fullWidth value={block.href} onChange={(event) => changeBlock(index, 'href', event.target.value)} slotProps={{ htmlInput: { maxLength: 600 } }} helperText="El botón y su enlace son opcionales; completa ambos para mostrarlos." />
        <Box className="appearance-link-actions">{[-1, 1].map((direction) => <IconButton key={direction} size="small" aria-label={`${direction < 0 ? 'Subir' : 'Bajar'} bloque ${index + 1}`} disabled={disabled || index + direction < 0 || index + direction >= design.contentBlocks.length} onClick={() => { const next = [...design.contentBlocks]; [next[index], next[index + direction]] = [next[index + direction], next[index]]; change('contentBlocks', next); }}>{direction < 0 ? <ArrowUpwardRoundedIcon fontSize="small" /> : <ArrowDownwardRoundedIcon fontSize="small" />}</IconButton>)}<Button color="error" onClick={() => change('contentBlocks', design.contentBlocks.filter((_block, position) => position !== index))}>Quitar bloque</Button></Box>
      </Stack>)}
      <Button disabled={disabled || design.contentBlocks.length >= 6} startIcon={<AddRoundedIcon />} onClick={() => change('contentBlocks', [...design.contentBlocks, { title: '', body: '', buttonLabel: '', href: '', placement: 'before-products', tone: 'surface' }])}>Añadir bloque ({design.contentBlocks.length}/6)</Button>
    </>)}
  </Box>;
}
