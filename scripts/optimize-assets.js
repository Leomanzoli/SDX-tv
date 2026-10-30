#!/usr/bin/env node
// Otimiza assets/** para exibição em TV: redimensiona imagens para ≤1920px, converte PNG opaco
// em JPEG, renomeia tudo para slug ASCII e reescreve os `src` em data/slides.json e app.js.
// Uso: node scripts/optimize-assets.js [--dry-run]

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const ROOT = path.resolve(__dirname, "..");
const ASSETS_DIR = path.join(ROOT, "assets");
const SLIDES_JSON = path.join(ROOT, "data", "slides.json");
const APP_JS = path.join(ROOT, "app.js");

const MAX_EDGE = 1920;
const JPEG_QUALITY = 82;
const IMAGE_EXT = /\.(png|jpe?g|webp)$/i;
const RENAME_ONLY_EXT = /\.(gif|mp4|webm|mov|m4v|ogv)$/i;

const dryRun = process.argv.includes("--dry-run");

function slugifyFilename(name) {
  const dot = name.lastIndexOf(".");
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
  const slug =
    base
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "arquivo";
  return ext ? `${slug}.${ext}` : slug;
}

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.isFile() && entry.name !== ".gitkeep") out.push(full);
  }
  return out;
}

function uniqueTarget(source, desired, taken) {
  const dir = path.dirname(source);
  let candidate = desired;
  let n = 2;
  const collides = (name) => {
    const abs = path.join(dir, name);
    return taken.has(abs) || (abs !== source && fs.existsSync(abs));
  };
  while (collides(candidate)) {
    const dot = desired.lastIndexOf(".");
    candidate = dot > 0 ? `${desired.slice(0, dot)}-${n}${desired.slice(dot)}` : `${desired}-${n}`;
    n += 1;
  }
  taken.add(path.join(dir, candidate));
  return candidate;
}

async function optimizeImage(file) {
  const input = fs.readFileSync(file);
  const image = sharp(input, { failOn: "none" });
  const meta = await image.metadata();
  const width = meta.width || 0;
  const height = meta.height || 0;
  const needsResize = Math.max(width, height) > MAX_EDGE;

  const isPng = /\.png$/i.test(file);
  const hasAlpha = isPng && meta.hasAlpha && (await hasRealTransparency(image));
  const outExt = hasAlpha ? ".png" : ".jpg";

  let pipeline = sharp(input, { failOn: "none" }).rotate();
  if (needsResize) pipeline = pipeline.resize({ width: MAX_EDGE, height: MAX_EDGE, fit: "inside", withoutEnlargement: true });
  pipeline = hasAlpha
    ? pipeline.png({ compressionLevel: 9, palette: true, quality: 90 })
    : pipeline.flatten({ background: "#02030c" }).jpeg({ quality: JPEG_QUALITY, mozjpeg: true, progressive: false });

  let output = await pipeline.toBuffer();
  const currentExt = path.extname(file).toLowerCase().replace(/^\.jpeg$/, ".jpg");
  const extChanged = currentExt !== outExt;
  // Se não encolheu nem mudou formato/dimensão, mantém os bytes originais.
  if (!needsResize && !extChanged && output.length >= input.length) output = input;

  return { output, outExt, before: { width, height, bytes: input.length }, after: { bytes: output.length, resized: needsResize } };
}

async function hasRealTransparency(image) {
  const { data, info } = await image.clone().ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const step = Math.max(1, Math.floor(Math.sqrt((info.width * info.height) / 40000)));
  for (let y = 0; y < info.height; y += step) {
    for (let x = 0; x < info.width; x += step) {
      if (data[(y * info.width + x) * 4 + 3] < 250) return true;
    }
  }
  return false;
}

function rewriteReferences(mapping) {
  const toRel = (abs) => path.relative(ROOT, abs).split(path.sep).join("/");

  const slidesRaw = fs.readFileSync(SLIDES_JSON, "utf8");
  const slides = JSON.parse(slidesRaw);
  let changedSlides = 0;
  for (const slide of slides.slides || []) {
    if (typeof slide.src !== "string") continue;
    const decoded = safeDecode(slide.src).replace(/^\.?\//, "");
    const hit = mapping.get(decoded) || mapping.get(decoded.normalize("NFC")) || mapping.get(decoded.normalize("NFD"));
    if (hit && hit !== slide.src) {
      slide.src = hit;
      changedSlides += 1;
    }
  }

  let appJs = fs.readFileSync(APP_JS, "utf8");
  let changedApp = 0;
  for (const [oldRel, newRel] of mapping) {
    if (oldRel === newRel) continue;
    const beforeLen = appJs.length;
    appJs = appJs.split(oldRel).join(newRel);
    // Listas de fallback referenciam só o nome do arquivo dentro de uma pasta fixa.
    const oldName = path.posix.basename(oldRel);
    const newName = path.posix.basename(newRel);
    if (oldName !== newName) appJs = appJs.split(`"${oldName}"`).join(`"${newName}"`);
    if (appJs.length !== beforeLen || appJs.includes(newRel)) changedApp += 1;
  }

  if (!dryRun) {
    fs.writeFileSync(SLIDES_JSON, JSON.stringify(slides, null, 2) + "\n");
    fs.writeFileSync(APP_JS, appJs);
  }
  return { changedSlides, changedApp, toRel };
}

function safeDecode(value) {
  try {
    return decodeURI(value);
  } catch {
    return value;
  }
}

async function main() {
  const files = walk(ASSETS_DIR);
  const mapping = new Map();
  const taken = new Set();
  let totalBefore = 0;
  let totalAfter = 0;
  const report = [];

  for (const file of files) {
    const dir = path.dirname(file);
    const name = path.basename(file);
    const rel = path.relative(ROOT, file).split(path.sep).join("/");

    if (IMAGE_EXT.test(name)) {
      const result = await optimizeImage(file);
      const slug = slugifyFilename(name).replace(/\.[^.]+$/, result.outExt);
      const target = uniqueTarget(file, slug, taken);
      const targetAbs = path.join(dir, target);
      totalBefore += result.before.bytes;
      totalAfter += result.after.bytes;
      report.push(`${rel} ${result.before.width}x${result.before.height} ${kb(result.before.bytes)} -> ${target} ${kb(result.after.bytes)}${result.after.resized ? " (resized)" : ""}`);
      if (!dryRun) {
        if (targetAbs !== file) fs.unlinkSync(file);
        fs.writeFileSync(targetAbs, result.output);
      }
      mapping.set(rel, path.relative(ROOT, targetAbs).split(path.sep).join("/"));
      continue;
    }

    if (RENAME_ONLY_EXT.test(name)) {
      const slug = slugifyFilename(name);
      const target = uniqueTarget(file, slug, taken);
      const targetAbs = path.join(dir, target);
      if (targetAbs !== file) {
        report.push(`${rel} -> ${target} (rename)`);
        if (!dryRun) fs.renameSync(file, targetAbs);
      }
      mapping.set(rel, path.relative(ROOT, targetAbs).split(path.sep).join("/"));
      continue;
    }

    mapping.set(rel, rel);
  }

  const { changedSlides, changedApp } = rewriteReferences(mapping);

  console.log(report.join("\n"));
  console.log(`\nImagens: ${kb(totalBefore)} -> ${kb(totalAfter)} (${Math.round((1 - totalAfter / Math.max(1, totalBefore)) * 100)}% menor)`);
  console.log(`slides.json: ${changedSlides} src atualizados | app.js: ${changedApp} referências atualizadas`);
  if (dryRun) console.log("(dry-run: nada foi gravado)");
}

function kb(bytes) {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(2)}MB` : `${Math.round(bytes / 1024)}KB`;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
