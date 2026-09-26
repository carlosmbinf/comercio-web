import React from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import { CircleMarker, MapContainer, Polyline, TileLayer, useMap } from 'react-leaflet';

import { Meteor } from '../meteor/client';
import { TiendasComercioCollection } from '../meteor/collections';

const STORE_FIELDS = { _id: 1, title: 1, name: 1, coordenadas: 1, cordenadas: 1, ubicacion: 1 };
const CADETE_FIELDS = { _id: 1, username: 1, cordenadas: 1, coordenadas: 1 };

const resolvePoint = (value) => {
  if (!value || typeof value !== 'object') return null;
  const latitude = Number(value.latitude ?? value.latitud ?? value.lat);
  const longitude = Number(value.longitude ?? value.longitud ?? value.lng);
  return Number.isFinite(latitude) && Number.isFinite(longitude) ? [latitude, longitude] : null;
};

function FitPoints({ points }) {
  const map = useMap();
  React.useEffect(() => {
    if (!points.length) return;
    if (points.length === 1) {
      map.setView(points[0], 14);
      return;
    }
    map.fitBounds(points, { padding: [35, 35], maxZoom: 15 });
  }, [map, points]);
  return null;
}

export default function TrackMap({ cadeteId, item }) {
  const storeId = item?.idTienda || item?.producto?.idTienda;
  const { ready, store, cadete } = Meteor.useTracker(() => {
    const storeHandle = storeId
      ? Meteor.subscribe('tiendas', { _id: storeId }, { fields: STORE_FIELDS })
      : null;
    const userHandle = cadeteId
      ? Meteor.subscribe('user', { _id: cadeteId }, { fields: CADETE_FIELDS })
      : null;
    return {
      ready: Boolean((!storeHandle || storeHandle.ready()) && (!userHandle || userHandle.ready())),
      store: storeId ? TiendasComercioCollection.findOne({ _id: storeId }, { fields: STORE_FIELDS }) : null,
      cadete: cadeteId ? Meteor.users.findOne({ _id: cadeteId }, { fields: CADETE_FIELDS }) : null,
    };
  }, [cadeteId, storeId]);

  if (!ready) {
    return <Box className="tracking-map-state"><CircularProgress size={22} /><Typography color="text.secondary" variant="body2">Cargando seguimiento…</Typography></Box>;
  }

  const storePoint = resolvePoint(store?.ubicacion || store?.coordenadas || store?.cordenadas);
  const cadetePoint = resolvePoint(cadete?.cordenadas || cadete?.coordenadas);
  const destinationPoint = resolvePoint(item?.coordenadas);
  const points = [storePoint, cadetePoint, destinationPoint].filter(Boolean);

  if (!points.length) {
    return <Box className="tracking-map-state"><Typography fontWeight={750}>Ubicación aún no disponible</Typography><Typography color="text.secondary" variant="body2">El mapa aparecerá cuando el pedido tenga coordenadas activas.</Typography></Box>;
  }

  return (
    <Box className="tracking-map-wrap">
      <MapContainer center={points[0]} className="tracking-map" scrollWheelZoom={false} zoom={13}>
        <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <FitPoints points={points} />
        {storePoint ? <CircleMarker center={storePoint} pathOptions={{ color: '#fff', fillColor: '#7549df', fillOpacity: 1, weight: 3 }} radius={9} /> : null}
        {cadetePoint ? <CircleMarker center={cadetePoint} pathOptions={{ color: '#fff', fillColor: '#159957', fillOpacity: 1, weight: 3 }} radius={9} /> : null}
        {destinationPoint ? <CircleMarker center={destinationPoint} pathOptions={{ color: '#fff', fillColor: '#f97316', fillOpacity: 1, weight: 3 }} radius={9} /> : null}
        {points.length > 1 ? <Polyline pathOptions={{ color: '#7549df', opacity: 0.8, weight: 4, dashArray: '8 8' }} positions={points} /> : null}
      </MapContainer>
      <Box className="tracking-map-legend">
        {storePoint ? <span><i className="legend-store" /> {store?.title || store?.name || 'Tienda'}</span> : null}
        {cadetePoint ? <span><i className="legend-courier" /> Cadete</span> : null}
        {destinationPoint ? <span><i className="legend-destination" /> Entrega</span> : null}
      </Box>
    </Box>
  );
}
