const readEnv = (key) => String(import.meta.env[key] || '').trim();

export const METEOR_DDP_URL = readEnv('VITE_METEOR_DDP_URL');
export const METEOR_HTTP_URL = readEnv('VITE_METEOR_HTTP_URL').replace(/\/$/, '');
export const COMERCIO_EMPRESA_ID = readEnv('VITE_COMERCIO_EMPRESA_ID');
export const COMERCIO_NOMBRE = readEnv('VITE_COMERCIO_NOMBRE');
export const GOOGLE_MAPS_API_KEY = readEnv('VITE_GOOGLE_MAPS_API_KEY');

export const getCommerceDisplayName = (stores = []) => {
	const configuredName = COMERCIO_NOMBRE.trim();
	if (configuredName) return configuredName;

	const firstStore = Array.isArray(stores) ? stores[0] : null;
	return String(firstStore?.title || firstStore?.name || 'Tu comercio').trim();
};

export const isMeteorConfigured = /^wss?:\/\//i.test(METEOR_DDP_URL);
export const isCompanyConfigured = COMERCIO_EMPRESA_ID.length > 0;
