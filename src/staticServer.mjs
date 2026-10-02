import { createReadStream, promises as fs } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";

const MIME_TYPES = Object.freeze({
  ".avif": "image/avif",
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
});

const resolveInsideRoot = (rootDirectory, pathname) => {
  let decodedPath;
  try {
    decodedPath = decodeURIComponent(pathname);
  } catch (_error) {
    return null;
  }

  const safePath = decodedPath.replace(/\\/g, "/");
  const resolvedPath = path.resolve(rootDirectory, `.${safePath}`);
  const relativePath = path.relative(rootDirectory, resolvedPath);
  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) return null;
  return resolvedPath;
};

const sendNotFound = (response) => {
  response.writeHead(404, { "Cache-Control": "no-store", "Content-Type": "text/plain; charset=utf-8" });
  response.end("Not found");
};

export const createCommerceStaticServer = (distDirectory) => {
  const rootDirectory = path.resolve(distDirectory);

  return createServer(async (request, response) => {
    response.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
    response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    response.setHeader("X-Content-Type-Options", "nosniff");

    if (request.method !== "GET" && request.method !== "HEAD") {
      response.writeHead(405, { Allow: "GET, HEAD", "Cache-Control": "no-store" });
      response.end();
      return;
    }

    let pathname;
    const rawPathname = String(request.url || "/").split("?")[0];
    try {
      const decodedRawPathname = decodeURIComponent(rawPathname).replace(/\\/g, "/");
      const rawSegments = decodedRawPathname.split("/").filter(Boolean);
      if (!rawPathname.startsWith("/") || rawSegments.some((segment) => segment === "." || segment === ".." || segment.startsWith("."))) {
        sendNotFound(response);
        return;
      }
      pathname = new URL(request.url || "/", "http://localhost").pathname;
    } catch (_error) {
      sendNotFound(response);
      return;
    }

    let requestedPath = resolveInsideRoot(rootDirectory, pathname);
    if (!requestedPath) {
      sendNotFound(response);
      return;
    }

    let fileInfo;
    try {
      fileInfo = await fs.stat(requestedPath);
      if (fileInfo.isDirectory()) {
        requestedPath = path.join(requestedPath, "index.html");
        fileInfo = await fs.stat(requestedPath);
      }
    } catch (_error) {
      fileInfo = null;
    }

    if (!fileInfo?.isFile()) {
      const isAssetRequest = Boolean(path.extname(pathname)) || pathname.startsWith("/assets/");
      if (isAssetRequest) {
        sendNotFound(response);
        return;
      }

      requestedPath = path.join(rootDirectory, "index.html");
      try {
        fileInfo = await fs.stat(requestedPath);
      } catch (_error) {
        response.writeHead(503, { "Cache-Control": "no-store", "Content-Type": "text/plain; charset=utf-8" });
        response.end("Commerce site has not been built");
        return;
      }
    }

    const extension = path.extname(requestedPath).toLowerCase();
    const isHtml = extension === ".html";
    response.writeHead(200, {
      "Cache-Control": isHtml ? "no-cache" : "public, max-age=31536000, immutable",
      "Content-Length": fileInfo.size,
      "Content-Type": MIME_TYPES[extension] || "application/octet-stream",
    });

    if (request.method === "HEAD") {
      response.end();
      return;
    }

    const stream = createReadStream(requestedPath);
    stream.on("error", () => {
      if (response.headersSent) response.destroy();
      else sendNotFound(response);
    });
    stream.pipe(response);
  });
};
