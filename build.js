const fs = require("fs");
const path = require("path");
const { minify: minifyJS } = require("terser");
const { minify: minifyHTML } = require("html-minifier-terser");

const ROOT = __dirname;
const DIST = path.join(ROOT, "dist");

const HTML_MINIFY_OPTIONS = {
  collapseWhitespace: true,
  removeComments: true,
  removeRedundantAttributes: true,
  removeEmptyAttributes: true,
  minifyJS: true,
  minifyCSS: true,
};

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function copyDirSync(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

async function build() {
  // 1. Clean dist/
  if (fs.existsSync(DIST)) {
    fs.rmSync(DIST, { recursive: true });
  }
  fs.mkdirSync(DIST, { recursive: true });

  const results = [];

  // 2. Collect files
  const allFiles = fs.readdirSync(ROOT);
  const htmlFiles = allFiles.filter(
    (f) => f.endsWith(".html") && f !== "template.html",
  );
  const jsFiles = allFiles.filter(
    (f) => f.endsWith(".js") && f !== "build.js",
  );

  // 3. Minify JS
  for (const file of jsFiles) {
    const src = fs.readFileSync(path.join(ROOT, file), "utf-8");
    const result = await minifyJS(src);
    const out = result.code;
    fs.writeFileSync(path.join(DIST, file), out);
    results.push({ file, original: Buffer.byteLength(src), minified: Buffer.byteLength(out) });
  }

  // 4. Minify HTML
  for (const file of htmlFiles) {
    const src = fs.readFileSync(path.join(ROOT, file), "utf-8");
    const out = await minifyHTML(src, HTML_MINIFY_OPTIONS);
    fs.writeFileSync(path.join(DIST, file), out);
    results.push({ file, original: Buffer.byteLength(src), minified: Buffer.byteLength(out) });
  }

  // 5. Copy assets/
  const assetsDir = path.join(ROOT, "assets");
  if (fs.existsSync(assetsDir)) {
    copyDirSync(assetsDir, path.join(DIST, "assets"));
    console.log("Copied assets/\n");
  }

  // 6. Print results
  console.log("Build complete:\n");
  const nameWidth = Math.max(...results.map((r) => r.file.length));
  for (const r of results) {
    const saved = (((r.original - r.minified) / r.original) * 100).toFixed(1);
    console.log(
      `  ${r.file.padEnd(nameWidth)}  ${formatSize(r.original).padStart(10)} → ${formatSize(r.minified).padStart(10)}  (−${saved}%)`,
    );
  }
}

build().catch((err) => {
  console.error("Build failed:", err);
  process.exit(1);
});
