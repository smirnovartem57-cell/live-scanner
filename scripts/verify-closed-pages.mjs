import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const workflow = readFileSync(join(root, ".github", "workflows", "pages.yml"), "utf8");
const closedDir = join(root, "public-closed");
const forbidden = [
  "dist-react",
  "data/mock-data",
  "src/react",
  "app.js",
  "sw.js",
  "manifest.webmanifest"
];

if (!workflow.includes("path: public-closed")) {
  fail("GitHub Pages must publish only public-closed.");
}

for (const item of forbidden) {
  if (workflow.includes(item)) {
    fail(`GitHub Pages workflow references forbidden public asset: ${item}`);
  }
}

for (const file of listFiles(closedDir)) {
  const content = readFileSync(file, "utf8");
  for (const item of forbidden) {
    if (content.includes(item)) {
      fail(`Closed public page references forbidden asset ${item} in ${file}`);
    }
  }
}

console.log("Closed Pages guard passed.");

function listFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return listFiles(path);
    if (!statSync(path).isFile()) return [];
    return [path];
  });
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
