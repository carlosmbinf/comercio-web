const STATUS_PRESENTATIONS = {
  active: { label: 'Activa', color: 'success' },
  paused: { label: 'Pausada', color: 'warning' },
  closed: { label: 'Cerrada', color: 'default' },
  under_review: { label: 'En revisión', color: 'info' },
  pending: { label: 'Pendiente', color: 'info' },
  not_yet_active: { label: 'Pendiente de activación', color: 'info' },
  programmed: { label: 'Programada', color: 'info' },
  payment_required: { label: 'Pago pendiente', color: 'warning' },
  inactive: { label: 'Inactiva', color: 'default' },
  suspended: { label: 'Suspendida', color: 'error' },
  rejected: { label: 'Rechazada', color: 'error' },
};

export const getMercadoLibreStatusPresentation = (status) => {
  const normalized = String(status || '').trim().toLowerCase();
  if (!normalized) return { label: 'Vinculada', color: 'default' };
  if (STATUS_PRESENTATIONS[normalized]) return { ...STATUS_PRESENTATIONS[normalized] };
  return { label: 'Estado no reconocido', color: 'default' };
};

export const hasMercadoLibreListing = (metadata) => Boolean(
  metadata?.itemId ||
  metadata?.primaryItemId ||
  (Array.isArray(metadata?.itemIds) && metadata.itemIds.some(Boolean)) ||
  (Array.isArray(metadata?.saleConditions) && metadata.saleConditions.some((condition) => condition?.itemId)),
);