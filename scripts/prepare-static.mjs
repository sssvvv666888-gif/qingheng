import { cp, mkdir } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const publicDir = path.join(root, "public");
await mkdir(publicDir, { recursive: true });

for (const name of ["index.html", "styles.css", "app.js", "sw.js", "manifest.webmanifest", "assets"]) {
  await cp(path.join(root, name), path.join(publicDir, name), { recursive: true, force: true });
}
