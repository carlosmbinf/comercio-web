const isVidkarCommerceHost = (value) => typeof value === "string"
  && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.vidkar\.com$/.test(value);

const createCommerceViteServerOptions = ({ commerceHost, host, mode, port, productionRuntime = false }) => {
  const bindHost = host || "0.0.0.0";
  if (productionRuntime && !isVidkarCommerceHost(commerceHost)) {
    throw new Error("COMERCIO_HOST debe ser el subdominio VIDKAR asignado a esta tienda.");
  }
  if (productionRuntime && bindHost !== "127.0.0.1") {
    throw new Error("El servidor Vite de producción solo puede escuchar en 127.0.0.1.");
  }

  return {
    allowedHosts: [isVidkarCommerceHost(commerceHost) ? commerceHost : "odeshop.vidkar.com"],
    cors: false,
    fs: {
      deny: [".env", ".env.*", "**/.env", "**/.env.*", "*.{crt,pem}", "**/.git/**"],
      strict: true,
    },
    headers: { "Cross-Origin-Opener-Policy": "same-origin-allow-popups" },
    hmr: productionRuntime ? false : undefined,
    host: bindHost,
    port: Number(port || 5174),
    strictPort: true,
  };
};

export { createCommerceViteServerOptions, isVidkarCommerceHost };
