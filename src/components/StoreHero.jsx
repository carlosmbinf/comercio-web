import React from 'react';
import { Box, Chip, Typography } from '@mui/material';
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded';
import StorefrontRoundedIcon from '@mui/icons-material/StorefrontRounded';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import BrandImage from './BrandImage';
import { CATEGORY_SELECTION_LIMIT } from '../domain/categories';
import { INITIAL_CATALOG_LIMIT } from '../domain/commerce';

export default function StoreHero({ appearance, stores = [], storeLabel, showCategorySelections = false }) {
  const design = appearance.design;
  if (!design.heroVisible) return null;
  return <section className={`store-compact-banner hero-layout-${design.heroLayout}${appearance.cover ? ' has-brand-image' : ''}`}>
    <BrandImage src={appearance.cover} className="brand-cover-image" style={{ objectPosition: design.heroImagePosition }} />
    <Box className="store-compact-banner-main">
      <Chip className="hero-kicker" icon={<CheckCircleOutlineRoundedIcon />} label="CARGA BAJO DEMANDA · SEGUIMIENTO EN TIEMPO REAL" size="small" />
      <Typography className="store-compact-banner-title" variant="h2">{appearance.headline || (stores.length === 1 ? <>{storeLabel} <span>en tu puerta.</span></> : <>Catálogo oficial de <span>{storeLabel}</span></>)}</Typography>
      <Typography className="store-compact-banner-desc" variant="body2">{appearance.description || (stores.length === 1 ? stores[0]?.descripcion || 'Selecciona una categoría, busca un producto o carga más resultados según lo que necesites.' : 'Elige una categoría o sucursal arriba para consultar sus productos al instante sin recargar toda la tienda.')}</Typography>
    </Box>
    {design.heroShowStats ? <Box className="store-compact-kpis">
      <Box className="store-compact-kpi"><Box className="highlight-icon violet"><StorefrontRoundedIcon fontSize="small" /></Box><Box><strong>{stores.length}</strong><span>{stores.length === 1 ? 'Sucursal' : 'Sucursales'}</span></Box></Box>
      <Box className="store-compact-kpi"><Box className="highlight-icon orange"><CheckCircleOutlineRoundedIcon fontSize="small" /></Box><Box><strong>{showCategorySelections ? CATEGORY_SELECTION_LIMIT : INITIAL_CATALOG_LIMIT}</strong><span>{showCategorySelections ? 'Por categoría principal' : 'Por bloque inicial'}</span></Box></Box>
      <Box className="store-compact-kpi"><Box className="highlight-icon green"><LocalShippingOutlinedIcon fontSize="small" /></Box><Box><strong>En vivo</strong><span>Entrega rastreable</span></Box></Box>
    </Box> : null}
  </section>;
}
