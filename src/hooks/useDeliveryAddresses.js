import React from 'react';
import { callMeteor } from '../meteor/client';

export function useDeliveryAddresses(userId, enabled) {
  const request = React.useRef(0);
  const [attempt, setAttempt] = React.useState(0);
  const [state, setState] = React.useState({ userId: null, addresses: [], loading: true, error: '' });
  React.useEffect(() => {
    const current = ++request.current;
    if (!enabled || !userId) return undefined;
    let active = true;
    setState({ userId, addresses: [], loading: true, error: '' });
    const timer = window.setTimeout(() => {
      if (active && request.current === current) setState({ userId, addresses: [], loading: false, error: 'No se pudieron cargar tus direcciones. Puedes reintentar o ingresar una nueva.' });
    }, 20000);
    callMeteor('comercio.deliveryAddresses.list').then((result) => {
      if (!Array.isArray(result?.addresses)) throw new Error('No se pudieron cargar tus direcciones.');
      if (active && request.current === current) setState({ userId, addresses: result.addresses, loading: false, error: '' });
    }).catch((error) => {
      if (active && request.current === current) setState({ userId, addresses: [], loading: false, error: error?.reason || 'No se pudieron cargar tus direcciones. Puedes ingresar una nueva.' });
    }).finally(() => window.clearTimeout(timer));
    return () => { active = false; window.clearTimeout(timer); };
  }, [userId, enabled, attempt]);
  return {
    ...(state.userId === userId ? state : { addresses: [], loading: true, error: '' }),
    refresh: () => setAttempt((value) => value + 1),
  };
}
