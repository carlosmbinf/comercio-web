import React from 'react';
import { Box, Typography } from '@mui/material';
import { CircleMarker, MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet';

function PickLocation({ onPick }) {
  useMapEvents({
    click(event) {
      onPick({ latitude: event.latlng.lat, longitude: event.latlng.lng });
    },
  });
  return null;
}

function Recenter({ point }) {
  const map = useMap();
  React.useEffect(() => {
    if (point) map.setView([point.latitude, point.longitude], Math.max(map.getZoom(), 14));
  }, [map, point?.latitude, point?.longitude]);
  return null;
}

const validPoint = (point) =>
  point && Number.isFinite(Number(point.latitude)) && Number.isFinite(Number(point.longitude));

export default function MapPicker({ center, onChange, point }) {
  const initialPoint = validPoint(point)
    ? point
    : validPoint(center)
      ? center
      : { latitude: 23.1136, longitude: -82.3666 };
  const displayedPoint = validPoint(point) ? point : null;

  return (
    <Box className="checkout-map-wrap">
      <MapContainer
        center={[initialPoint.latitude, initialPoint.longitude]}
        className="checkout-map"
        scrollWheelZoom={false}
        zoom={validPoint(point) ? 14 : 12}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <PickLocation onPick={onChange} />
        {displayedPoint ? <CircleMarker center={[displayedPoint.latitude, displayedPoint.longitude]} pathOptions={{ color: '#fff', fillColor: '#7549df', fillOpacity: 1, weight: 4 }} radius={11} /> : null}
        {validPoint(point) ? <Recenter point={point} /> : null}
      </MapContainer>
      <Box className="map-hint">
        <span className={displayedPoint ? 'map-pin-dot active' : 'map-pin-dot'} />
        <Typography color="text.secondary" variant="caption">
          {displayedPoint
            ? 'Punto exacto seleccionado · puedes ajustarlo tocando el mapa.'
            : 'Toca el mapa para marcar el lugar de entrega.'}
        </Typography>
      </Box>
    </Box>
  );
}
