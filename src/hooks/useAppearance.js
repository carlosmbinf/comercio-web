import React from 'react';
import { Meteor } from '../meteor/client';
import { WebAppearanceCollection } from '../meteor/collections';
import { normalizeAppearance } from '../domain/appearance';

export function useAppearance(ownerId) {
  const [attempt, setAttempt] = React.useState(0);
  const [timeoutKey, setTimeoutKey] = React.useState('');
  const key = `${ownerId}:${attempt}`;
  const state = Meteor.useTracker(() => {
    if (!ownerId) return { ready: false, settings: null };
    const handle = Meteor.subscribe('comercio.webAppearance', ownerId);
    return { ready: handle.ready(), settings: WebAppearanceCollection.findOne(ownerId)?.settings || null };
  }, [ownerId, attempt]);

  React.useEffect(() => {
    if (!ownerId || state.ready) return undefined;
    const timer = window.setTimeout(() => setTimeoutKey(key), 20000);
    return () => window.clearTimeout(timer);
  }, [ownerId, key, state.ready]);

  return {
    appearance: React.useMemo(() => normalizeAppearance(state.settings), [state.settings]),
    ready: state.ready,
    error: !state.ready && timeoutKey === key ? 'No se pudo cargar la apariencia de la tienda. Inténtalo de nuevo.' : '',
    retry: () => setAttempt((value) => value + 1),
  };
}
