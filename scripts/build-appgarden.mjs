import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const files = [
  ["/index.html", "index.html", "text/html; charset=utf-8"],
  ["/styles.css", "styles.css", "text/css; charset=utf-8"],
  ["/app.js", "app.js", "text/javascript; charset=utf-8"],
  ["/sw.js", "sw.js", "text/javascript; charset=utf-8"],
  ["/manifest.webmanifest", "manifest.webmanifest", "application/manifest+json"],
  ["/assets/apple-touch-icon.png", "assets/apple-touch-icon.png", "image/png"],
  ["/assets/icon-192.png", "assets/icon-192.png", "image/png"],
  ["/assets/icon-512.png", "assets/icon-512.png", "image/png"],
  ["/assets/icon-maskable-512.png", "assets/icon-maskable-512.png", "image/png"],
  ["/assets/rilakkuma-from-setting.png", "assets/rilakkuma-from-setting.png", "image/png"],
  ["/assets/korilakkuma-from-setting.png", "assets/korilakkuma-from-setting.png", "image/png"]
];

const assets = {};
for (const [route, source, contentType] of files) {
  assets[route] = {
    contentType,
    body: (await readFile(source)).toString("base64")
  };
}

const worker = `const ASSETS = ${JSON.stringify(assets)};

function decode(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname === "/" ? "/index.html" : url.pathname;
    const asset = ASSETS[path];
    if (!asset) return new Response("Not found", { status: 404 });
    const headers = {
      "Content-Type": asset.contentType,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": path === "/sw.js" || path === "/index.html" ? "no-cache" : "public, max-age=86400"
    };
    return new Response(decode(asset.body), { status: 200, headers });
  }
};
`;

await rm("dist", { recursive: true, force: true });
await mkdir(path.join("dist", "server"), { recursive: true });
await mkdir(path.join("dist", ".openai"), { recursive: true });
await writeFile(path.join("dist", "server", "index.js"), worker);
await copyFile(path.join(".openai", "hosting.json"), path.join("dist", ".openai", "hosting.json"));
