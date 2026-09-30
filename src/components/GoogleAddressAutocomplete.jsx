import React from 'react';
import { importLibrary, setOptions } from '@googlemaps/js-api-loader';
import { Autocomplete, Box, CircularProgress, InputAdornment, TextField, Typography } from '@mui/material';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';

import { GOOGLE_MAPS_API_KEY } from '../config';

const hasGoogleMapsApiKey = /^AIza[0-9A-Za-z_-]{20,}$/.test(GOOGLE_MAPS_API_KEY);
let placesLibraryPromise = null;

function loadPlacesLibrary() {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Google Maps requiere un navegador.'));
  }

  if (typeof window.google?.maps?.importLibrary === 'function') {
    return window.google.maps.importLibrary('places');
  }

  if (!placesLibraryPromise) {
    setOptions({ key: GOOGLE_MAPS_API_KEY, language: 'es', v: 'weekly' });
    placesLibraryPromise = importLibrary('places').catch((error) => {
      placesLibraryPromise = null;
      throw error;
    });
  }

  return placesLibraryPromise;
}

const getPredictionText = (prediction) => (
  prediction?.text?.toString?.() || prediction?.text?.text || ''
);

const getPlaceComponent = (components, type) => components?.find((component) => component.types?.includes(type));

export default function GoogleAddressAutocomplete({ onInputValueChange, onPlaceSelected, value }) {
  const [placesLibrary, setPlacesLibrary] = React.useState(null);
  const [placesError, setPlacesError] = React.useState('');
  const [lookupError, setLookupError] = React.useState('');
  const [options, setOptionsState] = React.useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = React.useState(false);
  const requestIdRef = React.useRef(0);
  const sessionTokenRef = React.useRef(null);
  const selectedAddressRef = React.useRef('');

  React.useEffect(() => {
    if (!hasGoogleMapsApiKey) return undefined;
    let active = true;

    loadPlacesLibrary()
      .then((library) => {
        if (active) setPlacesLibrary(library);
      })
      .catch(() => {
        if (active) setPlacesError('No se pudo cargar Google Places. Revisa que Maps JavaScript API y Places API (New) estén habilitadas.');
      });

    return () => {
      active = false;
    };
  }, []);

  React.useEffect(() => {
    const query = String(value || '').trim();
    if (query && query === selectedAddressRef.current) {
      selectedAddressRef.current = '';
      setOptionsState([]);
      setLoadingSuggestions(false);
      return undefined;
    }

    if (!placesLibrary || query.length < 3) {
      setOptionsState([]);
      setLoadingSuggestions(false);
      return undefined;
    }

    const requestId = ++requestIdRef.current;
    const timeoutId = window.setTimeout(async () => {
      setLoadingSuggestions(true);
      setLookupError('');

      try {
        if (!sessionTokenRef.current) {
          sessionTokenRef.current = new placesLibrary.AutocompleteSessionToken();
        }

        const result = await placesLibrary.AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input: query,
          sessionToken: sessionTokenRef.current,
        });
        if (requestIdRef.current !== requestId) return;
        setOptionsState((result?.suggestions || [])
          .map((suggestion) => suggestion.placePrediction)
          .filter(Boolean));
      } catch (_error) {
        if (requestIdRef.current === requestId) {
          setOptionsState([]);
          setLookupError('No se pudieron cargar sugerencias. Puedes elegir el punto directamente en el mapa.');
        }
      } finally {
        if (requestIdRef.current === requestId) setLoadingSuggestions(false);
      }
    }, 300);

    return () => {
      window.clearTimeout(timeoutId);
      requestIdRef.current += 1;
    };
  }, [placesLibrary, value]);

  const handleInputChange = (_event, nextValue, reason) => {
    if (reason === 'input') {
      selectedAddressRef.current = '';
      onInputValueChange(nextValue);
      setLookupError('');
    } else if (reason === 'clear') {
      sessionTokenRef.current = null;
      selectedAddressRef.current = '';
      onInputValueChange('');
      setLookupError('');
    }
  };

  const handleSelect = async (_event, prediction) => {
    if (!prediction || !placesLibrary) return;

    setLookupError('');
    setLoadingSuggestions(true);
    try {
      const place = prediction.toPlace();
      await place.fetchFields({ fields: ['addressComponents', 'formattedAddress', 'location'] });

      const latitude = typeof place.location?.lat === 'function'
        ? place.location.lat()
        : Number(place.location?.lat);
      const longitude = typeof place.location?.lng === 'function'
        ? place.location.lng()
        : Number(place.location?.lng);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        throw new Error('La dirección no tiene una ubicación precisa.');
      }

      const addressComponents = place.addressComponents || [];
      const route = getPlaceComponent(addressComponents, 'route');
      const streetNumber = getPlaceComponent(addressComponents, 'street_number');
      const apartment = getPlaceComponent(addressComponents, 'subpremise');
      const formattedAddress = place.formattedAddress || getPredictionText(prediction);
      const houseNumber = [streetNumber?.longText || streetNumber?.shortText, apartment?.longText || apartment?.shortText]
        .filter(Boolean)
        .join(', ');

      selectedAddressRef.current = formattedAddress;
      sessionTokenRef.current = null;
      setOptionsState([]);
      onPlaceSelected({
        address: formattedAddress,
        houseNumber,
        point: { latitude, longitude },
        street: route?.longText || route?.shortText || formattedAddress,
      });
    } catch (_error) {
      setLookupError('No se pudo ubicar esa dirección. Prueba otra sugerencia o marca el punto en el mapa.');
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const helperText = !hasGoogleMapsApiKey
    ? 'La búsqueda de direcciones no está disponible ahora; también puedes seleccionar el punto en el mapa.'
    : placesError || lookupError || (placesLibrary
      ? 'Escribe al menos 3 letras y elige una sugerencia para ubicarla en el mapa.'
      : 'Conectando con Google Places…');

  return (
    <Autocomplete
      className="checkout-address-autocomplete"
      disablePortal
      filterOptions={(items) => items}
      getOptionLabel={getPredictionText}
      inputValue={value}
      loading={loadingSuggestions || (hasGoogleMapsApiKey && !placesLibrary && !placesError)}
      loadingText="Buscando direcciones…"
      noOptionsText={String(value || '').trim().length < 3 ? 'Escribe al menos 3 letras' : 'No hay direcciones coincidentes'}
      onChange={handleSelect}
      onInputChange={handleInputChange}
      options={hasGoogleMapsApiKey ? options : []}
      value={null}
      renderOption={(props, prediction) => {
        const mainText = prediction.structuredFormat?.mainText?.text || getPredictionText(prediction);
        const secondaryText = prediction.structuredFormat?.secondaryText?.text;

        return (
          <li {...props} key={prediction.placeId || getPredictionText(prediction)}>
            <Box sx={{ minWidth: 0, py: 0.25 }}>
              <Typography noWrap variant="body2">{mainText}</Typography>
              {secondaryText ? <Typography color="text.secondary" noWrap variant="caption">{secondaryText}</Typography> : null}
            </Box>
          </li>
        );
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          fullWidth
          helperText={helperText}
          label="Buscar dirección"
          placeholder="Escribe calle, número o lugar"
          InputProps={{
            ...params.InputProps,
            startAdornment: (
              <>
                <InputAdornment position="start"><SearchRoundedIcon fontSize="small" /></InputAdornment>
                {params.InputProps.startAdornment}
              </>
            ),
            endAdornment: (
              <>
                {loadingSuggestions ? <CircularProgress color="inherit" size={18} /> : null}
                {params.InputProps.endAdornment}
              </>
            ),
          }}
        />
      )}
    />
  );
}
