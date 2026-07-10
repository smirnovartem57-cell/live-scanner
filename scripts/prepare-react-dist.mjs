import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const dist = join(root, "dist-react");

const entries = [
  ["data", "data"],
  ["icons", "icons"],
  ["manifest.webmanifest", "manifest.webmanifest"],
  ["sw.js", "sw.js"]
];

for (const [from, to] of entries) {
  const source = join(root, from);
  const target = join(dist, to);

  if (!existsSync(source)) {
    throw new Error(`Missing required asset: ${from}`);
  }

  mkdirSync(dirname(target), { recursive: true });
  cpSync(source, target, { recursive: true });
}
