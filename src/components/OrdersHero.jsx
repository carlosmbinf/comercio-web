import React from 'react';
import { Box, Typography } from '@mui/material';
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';
import BrandImage from './BrandImage';
import '../pages/orders.css';

export default function OrdersHero({ image = '' }) {
  return (
    <Box className={`orders-hero${image ? ' has-brand-image' : ''}`}>
      <BrandImage src={image} className="brand-cover-image" />
      <Box className="orders-hero-copy">
        <Typography className="eyebrow" variant="overline">SEGUIMIENTO DE COMERCIO</Typography>
        <Typography variant="h3">Mis pedidos</Typography>
        <Typography color="text.secondary">Revisa el estado en tiempo real de tus compras activas y consulta el historial finalizado en tabla.</Typography>
      </Box>
      <Box className="orders-hero-icon"><HistoryRoundedIcon /></Box>
    </Box>
  );
}
