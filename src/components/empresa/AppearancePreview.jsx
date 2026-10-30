import React from 'react';
import { createPortal } from 'react-dom';
import { CacheProvider } from '@emotion/react';
import createCache from '@emotion/cache';
import { Box, Button, Card, CardContent, Chip, CssBaseline, Dialog, DialogContent, DialogTitle, IconButton, Paper, Stack, TextField, ThemeProvider, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import OpenInFullRoundedIcon from '@mui/icons-material/OpenInFullRounded';
import ShoppingCartRoundedIcon from '@mui/icons-material/ShoppingCartRounded';
import PersonOutlineRoundedIcon from '@mui/icons-material/PersonOutlineRounded';
import StorefrontRoundedIcon from '@mui/icons-material/StorefrontRounded';
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded';
import { appearanceRootProps, appearanceTokens, normalizeAppearance } from '../../domain/appearance';
import { buildTheme } from '../../theme';
import { StoreAnnouncement, StoreFooter, StoreHeader } from '../StoreSiteChrome';
import StoreHero from '../StoreHero';
import ProductCard from '../ProductCard';
import OrdersHero from '../OrdersHero';
import BrandImage, { BrandLogo } from '../BrandImage';
import StoreContentBlocks from '../StoreContentBlocks';

const FRAME_DOCUMENT = '<!doctype html><html lang="es"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Vista previa de tu comercio</title></head><body><div id="preview-root"></div></body></html>';

function PreviewViewport({ appearance, mode, page, density, companyName, storefront, catalog, device }) {
  const containerRef = React.useRef(null);
  const [frameDocument, setFrameDocument] = React.useState(null);
  const [availableWidth, setAvailableWidth] = React.useState(0);
  const width = device === 'mobile' ? 390 : 1200;
  const height = device === 'mobile' ? 844 : 900;
  const scale = Math.min(1, (availableWidth || width) / width);
  const theme = React.useMemo(() => buildTheme(mode, appearance), [mode, appearance]);
  const tokens = React.useMemo(() => appearanceTokens(appearance, mode), [mode, appearance]);
  const cache = React.useMemo(() => frameDocument ? createCache({ key: 'store-preview', container: frameDocument.head }) : null, [frameDocument]);
  const storesById = React.useMemo(() => new Map(storefront.stores.map((store) => [String(store._id), store])), [storefront.stores]);
  React.useEffect(() => {
    const measure = () => setAvailableWidth(containerRef.current?.clientWidth || width);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [width]);
  React.useEffect(() => {
    if (!frameDocument) return undefined;
    const copyStyles = () => {
      frameDocument.head.querySelectorAll('[data-preview-styles]').forEach((node) => node.remove());
      document.head.querySelectorAll('link[rel="stylesheet"], style:not([data-emotion])').forEach((node) => {
        const clone = node.cloneNode(true);
        clone.setAttribute('data-preview-styles', '');
        if (node.tagName === 'LINK') clone.href = node.href;
        frameDocument.head.append(clone);
      });
    };
    copyStyles();
    const observer = new MutationObserver(copyStyles);
    observer.observe(document.head, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [frameDocument]);
  const rootProps = appearanceRootProps(appearance);
  const mount = frameDocument?.getElementById('preview-root');
  React.useEffect(() => {
    if (!mount) return undefined;
    if (page !== 'footer') { frameDocument.defaultView?.scrollTo(0, 0); return undefined; }
    const scrollToFooter = () => mount.querySelector('footer')?.scrollIntoView({ block: 'end' });
    scrollToFooter();
    const observer = new ResizeObserver(scrollToFooter);
    observer.observe(mount);
    return () => observer.disconnect();
  }, [mount, page, device]);
  return <Box ref={containerRef} className="appearance-preview-viewport" style={{ height: height * scale }}>
    <iframe title={`Vista previa ${device === 'mobile' ? 'móvil' : 'de escritorio'} del comercio`} srcDoc={FRAME_DOCUMENT} sandbox="allow-same-origin" onLoad={(event) => setFrameDocument(event.currentTarget.contentDocument)} style={{ width, height, left: Math.max(0, (availableWidth - width * scale) / 2), transform: `scale(${scale})` }} />
    {mount && cache ? createPortal(<CacheProvider value={cache}><ThemeProvider theme={theme}><CssBaseline />
      <Box inert className={`app-root mode-${theme.palette.mode} appearance-site-preview`} data-preview-page={page} {...rootProps} style={{ ...tokens.variables, ...rootProps.style }}>
        <StoreAnnouncement appearance={appearance} />
        <StoreHeader appearance={appearance} storeLabel={companyName}>
          <Box className="desktop-nav"><Button className={`nav-link${page === 'store' ? ' active' : ''}`} startIcon={<StorefrontRoundedIcon />}>Tienda</Button><Button className={`nav-link${page === 'orders' ? ' active' : ''}`} startIcon={<ReceiptLongRoundedIcon />}>Mis pedidos</Button></Box>
          <Box className="header-actions"><IconButton><ShoppingCartRoundedIcon /></IconButton><Button className="profile-action" startIcon={<PersonOutlineRoundedIcon />}><span className="profile-label">Mi perfil</span></Button></Box>
        </StoreHeader>
        <Box component="main" className="page-frame site-width" sx={{ width: '100%', px: { xs: 2, sm: 3 } }}>
          {['store', 'footer'].includes(page) ? <Box className="content-stack store-page">
            <Paper className="store-subheader" elevation={0}><Box className="store-subheader-top"><Button variant="outlined">Filtros</Button><TextField className="subheader-search" size="small" fullWidth placeholder={`Buscar en ${companyName}`} /><Button>Recomendados</Button></Box><Box className="store-subheader-categories"><Chip color="primary" label="Destacados" size="small" />{storefront.stores.slice(0, 3).map((store) => <Chip key={store._id} label={store.title || store.name} size="small" variant="outlined" />)}</Box></Paper>
            <StoreHero appearance={appearance} stores={storefront.stores} storeLabel={companyName} showCategorySelections />
            <StoreContentBlocks appearance={appearance} placement="before-products" />
            <Box><Typography variant="h5" sx={{ mb: 2 }}>{appearance.design.catalogTitle || 'Descubre por categorías'}</Typography>
              {catalog.loading || storefront.loading ? <Typography color="text.secondary">Cargando productos de tu tienda…</Typography> : catalog.products.length ? <Box className={`product-grid ${density}`}>{catalog.products.map((product) => <ProductCard preview appearance={appearance} key={product._id} product={product} store={storesById.get(String(product.idTienda))} compact={density === 'compact'} />)}</Box> : <Typography color="text.secondary">Los productos visibles de tu tienda aparecerán aquí.</Typography>}
            </Box>
            <StoreContentBlocks appearance={appearance} placement="after-products" />
          </Box> : page === 'orders' ? <Stack spacing={3}><OrdersHero image={appearance.ordersCover} /><Box className="orders-metrics">{['Pedidos', 'Activos', 'En reparto', 'Entregados'].map((label) => <Paper key={label} className="order-metric" elevation={0}><Box><Typography variant="h5">0</Typography><Typography variant="caption">{label}</Typography></Box></Paper>)}</Box><Typography variant="h5">Compras activas</Typography><Typography color="text.secondary">Aquí verás el seguimiento de tus compras.</Typography></Stack> : <Box className="login-layout">
            <Box className={`login-story branded-login-story${appearance.loginImage ? ' has-brand-image' : ''}`}><BrandImage src={appearance.loginImage} className="brand-cover-image" /><BrandLogo src={appearance.logo} name={companyName} /><Typography className="login-headline" variant="h2">{appearance.loginHeadline || 'Todo lo que te gusta, en un solo lugar.'}</Typography><Typography>Accede para guardar tus compras y seguir tus pedidos en {companyName}.</Typography></Box>
            <Card className="login-card" elevation={0}><CardContent><Stack spacing={2}><Typography variant="h4">Inicia sesión</Typography><Typography color="text.secondary">Bienvenido a {companyName}</Typography><TextField label="Usuario o correo" /><TextField label="Contraseña" type="password" /><Button variant="contained">Continuar</Button></Stack></CardContent></Card>
          </Box>}
        </Box>
        <StoreFooter appearance={appearance} storeLabel={companyName} />
        <Box className="mobile-nav">{['Tienda', 'Mis pedidos', 'Perfil'].map((label) => <Button className="mobile-nav-item" key={label}><span>{label}</span></Button>)}</Box>
      </Box>
    </ThemeProvider></CacheProvider>, mount) : null}
  </Box>;
}

export default function AppearancePreview(props) {
  const [device, setDevice] = React.useState('desktop');
  const [expanded, setExpanded] = React.useState(false);
  const appearance = React.useMemo(() => normalizeAppearance(props.draft), [props.draft]);
  const previewProps = { ...props, appearance, device };
  return <>
    <Box className="appearance-preview-device-bar"><ToggleButtonGroup size="small" value={device} exclusive onChange={(_event, value) => value && setDevice(value)} aria-label="Dispositivo de la vista previa"><ToggleButton value="desktop">Escritorio</ToggleButton><ToggleButton value="mobile">Móvil</ToggleButton></ToggleButtonGroup><Button size="small" startIcon={<OpenInFullRoundedIcon />} onClick={() => setExpanded(true)}>Ampliar</Button></Box>
    <PreviewViewport {...previewProps} />
    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>Mismos componentes del sitio, con productos reales. Las compras y enlaces están desactivados en la vista previa.</Typography>
    <Dialog open={expanded} onClose={() => setExpanded(false)} maxWidth={false} fullWidth className="appearance-preview-dialog"><DialogTitle>Tu tienda · {device === 'mobile' ? 'Móvil' : 'Escritorio'}<IconButton aria-label="Cerrar vista previa ampliada" onClick={() => setExpanded(false)} sx={{ float: 'right' }}><CloseRoundedIcon /></IconButton></DialogTitle><DialogContent>{expanded ? <PreviewViewport {...previewProps} /> : null}</DialogContent></Dialog>
  </>;
}
