import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createCommerceStaticServer } from "./staticServer.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDirectory = path.join(projectRoot, "dist");
const host = process.env.HOST || "127.0.0.1";
const port = Number(process.env.PORT || 5174);

if (!existsSync(path.join(distDirectory, "index.html"))) {
  throw new Error("No existe dist/index.html. Ejecuta npm run build antes de iniciar producción.");
}
if (!Number.isInteger(port) || port < 1024 || port > 65535) {
  throw new Error("PORT debe ser un puerto válido entre 1024 y 65535.");
}

const server = createCommerceStaticServer(distDirectory);
server.listen(port, host, () => {
  console.log(`VIDKAR Comercio sirviendo dist en ${host}:${port}`);
});
