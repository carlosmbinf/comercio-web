import React from 'react';
import { Alert, Box, Button, Card, CardContent, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Paper, TextField, Typography } from '@mui/material';
import AddBusinessRoundedIcon from '@mui/icons-material/AddBusinessRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined';
import StorefrontRoundedIcon from '@mui/icons-material/StorefrontRounded';

import GoogleAddressAutocomplete from '../GoogleAddressAutocomplete';
import MapPicker from '../MapPicker';
import { ensureEmpresaMethodSuccess } from '../../domain/empresa';
import { callMeteor, Meteor } from '../../meteor/client';
import { TiendasComercioCollection } from '../../meteor/collections';

const STORE_FIELDS = {
  _id: 1,
  coordenadas: 1,
  cordenadas: 1,
  createdAt: 1,
  descripcion: 1,
  idUser: 1,
  pinColor: 1,
  title: 1,
};

const normalizePoint = (value) => {
  const latitude = Number(value?.latitude ?? value?.latitud);
  const longitude = Number(value?.longitude ?? value?.longitud);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
};

function StoreDialog({ onClose, onSave, open, saving, store }) {
  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [address, setAddress] = React.useState('');
  const [location, setLocation] = React.useState(null);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    if (!open) return;
    setTitle(store?.title || '');
    setDescription(store?.descripcion || '');
    setLocation(normalizePoint(store?.coordenadas || store?.cordenadas));
    setAddress('');
    setError('');
  }, [open, store]);

  const submit = async (event) => {
    event.preventDefault();
    const normalizedTitle = title.replace(/\s+/g, ' ').trim();
    const normalizedDescription = description.replace(/\s+/g, ' ').trim();

    if (normalizedTitle.length < 3) {
      setError('El nombre debe tener al menos 3 caracteres.');
      return;
    }
    if (normalizedDescription.length < 10) {
      setError('La descripción debe tener al menos 10 caracteres.');
      return;
    }
    if (!location) {
      setError('Selecciona la ubicación de la tienda en el mapa antes de guardarla.');
      return;
    }

    setError('');
    try {
      await onSave({ descripcion: normalizedDescription, coordenadas: location, title: normalizedTitle });
    } catch (saveError) {
      setError(saveError?.reason || saveError?.message || 'No se pudo guardar la tienda.');
    }
  };

  return (
    <Dialog fullWidth maxWidth="md" onClose={saving ? undefined : onClose} open={open}>
      <DialogTitle>{store ? 'Editar tienda' : 'Crear tienda'}</DialogTitle>
      <Box component="form" onSubmit={submit}>
        <DialogContent className="empresa-store-dialog-content">
          {error ? <Alert severity="error">{error}</Alert> : null}
          <TextField autoFocus fullWidth label="Nombre de la tienda" onChange={(event) => setTitle(event.target.value)} value={title} />
          <TextField fullWidth label="Descripción" multiline minRows={3} onChange={(event) => setDescription(event.target.value)} value={description} />
          <Paper className="empresa-location-panel" elevation={0}>
            <Box>
              <Typography fontWeight={700} variant="subtitle2">Ubicación de la tienda</Typography>
              <Typography color="text.secondary" variant="body2">Busca una dirección o marca el punto directamente en el mapa.</Typography>
            </Box>
            <GoogleAddressAutocomplete
              onInputValueChange={setAddress}
              onPlaceSelected={(place) => {
                setAddress(place.address || '');
                setLocation(place.point || null);
              }}
              value={address}
            />
            <MapPicker center={location} emptyHint="Toca el mapa para marcar la ubicación de esta tienda." onChange={setLocation} point={location} />
            {location ? (
              <Typography color="text.secondary" variant="caption">
                Coordenadas guardadas: {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}
              </Typography>
            ) : (
              <Typography color="text.secondary" variant="caption">Todavía no hay una ubicación guardada.</Typography>
            )}
          </Paper>
        </DialogContent>
        <DialogActions>
          <Button disabled={saving} onClick={onClose}>Cancelar</Button>
          <Button disabled={saving} startIcon={saving ? <CircularProgress color="inherit" size={16} /> : null} type="submit" variant="contained">
            {saving ? 'Guardando…' : store ? 'Guardar cambios' : 'Crear tienda'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}

export default function EmpresaStoresPanel({ notify, storefront, user }) {
  const storeState = Meteor.useTracker(() => {
    if (!user?._id) return { ready: false, stores: [] };
    const handle = Meteor.subscribe('comercio.tiendasEmpresa');
    return {
      ready: handle.ready(),
      stores: handle.ready()
        ? TiendasComercioCollection.find({ idUser: user._id }, { fields: STORE_FIELDS, sort: { createdAt: -1, title: 1 } }).fetch()
        : [],
    };
  }, [user?._id]);
  const stores = storeState.stores;
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingStore, setEditingStore] = React.useState(null);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');

  const openCreate = () => {
    setEditingStore(null);
    setDialogOpen(true);
  };

  const openEdit = (store) => {
    setEditingStore(store);
    setDialogOpen(true);
  };

  const saveStore = async (updates) => {
    setSaving(true);
    setError('');
    try {
      if (editingStore?._id) {
        ensureEmpresaMethodSuccess(await callMeteor('tiendas.update', {
          tiendaId: editingStore._id,
          updates,
        }));
      } else {
        ensureEmpresaMethodSuccess(await callMeteor('addEmpresa', {
          ...updates,
          idUser: user._id,
          pinColor: '#6d45d8',
        }));
      }

      setDialogOpen(false);
      notify?.(editingStore ? 'Tienda actualizada.' : 'Tienda creada.');
    } catch (saveError) {
      throw saveError;
    } finally {
      setSaving(false);
    }
  };

  const deleteStore = async (store) => {
    if (!window.confirm(`¿Eliminar “${store.title || 'esta tienda'}”? También se eliminarán sus productos. Esta acción no se puede deshacer.`)) return;

    setError('');
    try {
      ensureEmpresaMethodSuccess(await callMeteor('removeTienda', store._id));
      notify?.('Tienda eliminada.');
    } catch (deleteError) {
      setError(deleteError?.reason || deleteError?.message || 'No se pudo eliminar la tienda.');
    }
  };

  return (
    <Box className="content-stack empresa-panel">
      <Box className="empresa-panel-heading">
        <Box>
          <Typography variant="h4">Tus tiendas</Typography>
          <Typography color="text.secondary" variant="body2">Administra las sucursales pertenecientes a esta cuenta.</Typography>
        </Box>
        <Button onClick={openCreate} startIcon={<AddBusinessRoundedIcon />} variant="contained">Nueva tienda</Button>
      </Box>

      {error ? <Alert onClose={() => setError('')} severity="error">{error}</Alert> : null}
      {!storeState.ready ? (
        <Paper className="empresa-loading-inline" elevation={0}><CircularProgress size={22} /><Typography color="text.secondary">Cargando tus tiendas…</Typography></Paper>
      ) : !stores.length ? (
        <Paper className="empresa-empty" elevation={0}>
          <StorefrontRoundedIcon color="primary" fontSize="large" />
          <Typography variant="h6">Crea la primera tienda</Typography>
          <Typography color="text.secondary" variant="body2">Registra una sucursal para comenzar a publicar productos y recibir pedidos.</Typography>
          <Button onClick={openCreate} startIcon={<AddBusinessRoundedIcon />} variant="contained">Crear tienda</Button>
        </Paper>
      ) : (
        <Box className="empresa-store-grid">
          {stores.map((store) => {
            const point = normalizePoint(store.coordenadas || store.cordenadas);
            const productCount = storefront.products.filter((product) => String(product.idTienda) === String(store._id)).length;

            return (
              <Card className="empresa-store-card" elevation={0} key={store._id}>
                <CardContent>
                  <Box className="empresa-store-card-heading">
                    <Box className="empresa-store-icon"><StorefrontRoundedIcon /></Box>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography fontWeight={750} noWrap variant="h6">{store.title || store.name || 'Tienda'}</Typography>
                      <Typography color="text.secondary" variant="body2">{productCount} productos visibles en la vitrina</Typography>
                    </Box>
                    <IconButton aria-label={`Editar ${store.title || 'tienda'}`} onClick={() => openEdit(store)}><EditOutlinedIcon /></IconButton>
                    <IconButton aria-label={`Eliminar ${store.title || 'tienda'}`} color="error" onClick={() => deleteStore(store)}><DeleteOutlineRoundedIcon /></IconButton>
                  </Box>
                  <Typography className="empresa-store-description" color="text.secondary" variant="body2">
                    {store.descripcion || 'Sin descripción.'}
                  </Typography>
                  <Box className="empresa-store-location">
                    <LocationOnOutlinedIcon color={point ? 'success' : 'disabled'} fontSize="small" />
                    <Typography color="text.secondary" variant="caption">
                      {point ? `${point.latitude.toFixed(4)}, ${point.longitude.toFixed(4)}` : 'Ubicación pendiente'}
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            );
          })}
        </Box>
      )}

      <StoreDialog
        onClose={() => !saving && setDialogOpen(false)}
        onSave={saveStore}
        open={dialogOpen}
        saving={saving}
        store={editingStore}
      />
    </Box>
  );
}