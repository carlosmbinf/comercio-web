import React from 'react';
import { Alert, Box, Button, Chip, CircularProgress, IconButton, Stack, Typography } from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import StarOutlineRoundedIcon from '@mui/icons-material/StarOutlineRounded';

export default function DeliveryAddressChooser({ addresses, disabled, error, loading, onDefault, onNew, onRemove, onRetry, onSelect, selectedId }) {
  return (
    <Box className="delivery-address-book">
      <Typography fontWeight={750} variant="subtitle2">Tus direcciones</Typography>
      {loading ? <Box className="checkout-inline-loading" role="status"><CircularProgress size={17} /> Cargando direcciones…</Box> : null}
      {error ? <Alert severity="warning" action={<Button color="inherit" disabled={disabled} onClick={onRetry} size="small">Reintentar</Button>}>{error}</Alert> : null}
      {!loading && !error && addresses.length === 0 ? <Typography color="text.secondary" variant="body2">Todavía no tienes direcciones guardadas. Puedes guardar la que ingreses para tu próxima compra.</Typography> : null}
      <Stack spacing={1}>
        {addresses.map((address) => (
          <Box className={`delivery-saved-address${address.id === selectedId ? ' selected' : ''}`} key={address.id}>
            <Button aria-pressed={address.id === selectedId} className="delivery-address-select" disabled={disabled} onClick={() => onSelect(address)}>
              <CheckCircleOutlineRoundedIcon color={address.id === selectedId ? 'primary' : 'disabled'} />
              <Box className="delivery-address-copy">
                <Typography component="span" fontWeight={750} variant="body2">{address.label}</Typography>
                <Typography color="text.secondary" component="span" variant="caption">{[address.street, address.houseNumber].filter(Boolean).join(' · ')}</Typography>
                {address.isDefault ? <Chip label="Predeterminada" size="small" variant="outlined" /> : null}
              </Box>
            </Button>
            <Box className="delivery-address-actions">
              {!address.isDefault ? <IconButton aria-label={`Marcar ${address.label} como predeterminada`} disabled={disabled} onClick={() => onDefault(address)} size="small"><StarOutlineRoundedIcon fontSize="small" /></IconButton> : null}
              <IconButton aria-label={`Eliminar dirección ${address.label}`} disabled={disabled} onClick={() => onRemove(address)} size="small"><DeleteOutlineRoundedIcon fontSize="small" /></IconButton>
            </Box>
          </Box>
        ))}
      </Stack>
      <Button disabled={disabled} onClick={onNew} startIcon={<AddRoundedIcon />} variant={selectedId ? 'outlined' : 'contained'}>Usar una dirección nueva</Button>
    </Box>
  );
}
