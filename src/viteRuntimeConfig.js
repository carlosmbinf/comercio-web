const createCommerceViteServerOptions = ({ host, mode, port, productionRuntime = false }) => {
  const bindHost = host || "0.0.0.0";
  if (productionRuntime && bindHost !== "127.0.0.1") {
    throw new Error("El servidor Vite de producción solo puede escuchar en 127.0.0.1.");
  }

  return {
    allowedHosts: true,
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

export { createCommerceViteServerOptions };
