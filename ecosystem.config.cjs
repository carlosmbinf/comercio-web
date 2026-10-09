const path = require("node:path");
const dotenv = require("dotenv");

dotenv.config({ path: path.join(__dirname, ".env"), override: true });

const port = Number(process.env.PORT || 5174);
if (!Number.isInteger(port) || port < 1024 || port > 65535) {
  throw new Error("PORT debe ser un puerto válido entre 1024 y 65535.");
}

module.exports = {
  apps: [
    {
      name: process.env.PM2_APP_NAME || "vidkar-comercio-web",
      script: path.join(__dirname, "node_modules/vite/bin/vite.js"),
      args: ["--host", process.env.HOST || "127.0.0.1", "--port", String(port), "--strictPort", "--mode", "production"],
      cwd: __dirname,
      interpreter: process.execPath,
      autorestart: true,
      max_memory_restart: "512M",
      env: {
        HOST: process.env.HOST || "127.0.0.1",
        NODE_ENV: "production",
        PORT: String(port),
        VIDKAR_PM2_RUNTIME: "1",
      },
    },
  ],
};