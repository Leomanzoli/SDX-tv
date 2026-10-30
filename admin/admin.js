const TOKEN_KEY = "sdxtv-admin-token";
const USER_KEY = "sdxtv-admin-user";

const els = {
  loginView: document.getElementById("login-view"),
  appView: document.getElementById("app-view"),
  loginForm: document.getElementById("login-form"),
  loginError: document.getElementById("login-error"),
  userLabel: document.getElementById("user-label"),
  logoutBtn: document.getElementById("logout"),
  tabs: document.querySelectorAll(".topbar nav button"),
  panes: document.querySelectorAll("main .tab"),
  slidesList: document.getElementById("slides-list"),
  slidesStatus: document.getElementById("slides-status"),
  addSlide: document.getElementById("add-slide"),
  saveSlides: document.getElementById("save-slides"),
  layoutList: document.getElementById("layout-list"),
  layoutGrid: document.getElementById("layout-grid"),
  bulkBar: document.getElementById("bulk-bar"),
  bulkCount: document.getElementById("bulk-count"),
  bulkPos: document.getElementById("bulk-pos"),
  folderSelect: document.getElementById("folder-select"),
  newFolder: document.getElementById("new-folder"),
  delFolder: document.getElementById("del-folder"),
  fileInput: document.getElementById("file-input"),
  filesList: document.getElementById("files-list"),
  mediaStatus: document.getElementById("media-status"),
  mediaLayoutList: document.getElementById("media-layout-list"),
  mediaLayoutGrid: document.getElementById("media-layout-grid"),
  mediaBulkBar: document.getElementById("media-bulk-bar"),
  mediaBulkCount: document.getElementById("media-bulk-count"),
  previewDialog: document.getElementById("preview-dialog"),
  previewIframe: document.getElementById("preview-iframe"),
  previewCaption: document.getElementById("preview-caption"),
  previewClose: document.getElementById("preview-close"),
  tickerText: document.getElementById("ticker-text"),
  saveTicker: document.getElementById("save-ticker"),
  tickerStatus: document.getElementById("ticker-status"),
  editor: document.getElementById("slide-editor"),
};

let slidesState = { sha: null, data: { config: {}, slides: [], ticker: [] } };
const LAYOUT_KEY = "sdxtv-slides-layout";
const MEDIA_LAYOUT_KEY = "sdxtv-media-layout";
let slidesLayout = localStorage.getItem(LAYOUT_KEY) === "list" ? "list" : "grid";
let mediaLayout = localStorage.getItem(MEDIA_LAYOUT_KEY) === "list" ? "list" : "grid";
let selectedIndexes = new Set();
let lastClickedIndex = null;
let slidesSortable = null;
let mediaFiles = [];
let mediaFolder = "";
let selectedMedia = new Set();
let lastClickedMedia = null;

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|avif)$/i;
const VIDEO_EXT = /\.(mp4|webm|mov|m4v)$/i;
const MAX_IMAGE_EDGE = 1920;
const JPEG_QUALITY = 0.82;

// Nome seguro para URL e para a TV: sem acentos, espaços ou parênteses.
function slugifyFilename(name) {
  const dot = name.lastIndexOf(".");
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
  const slug = base
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "arquivo";
  return ext ? `${slug}.${ext}` : slug;
}

function validateSlideSrc(type, src) {
  if (!src) return "Informe o arquivo.";
  const isUrl = /^https?:\/\//i.test(src);
  if (!isUrl && !/^assets\//.test(src)) return "O caminho deve começar com assets/ ou https://";
  if (/^[a-z]:\\/i.test(src) || src.includes("\\")) return "Caminho do Windows não funciona na TV. Envie o arquivo na aba Mídia.";
  if (type === "video" && !VIDEO_EXT.test(src)) return "Vídeo precisa terminar em .mp4, .webm, .mov ou .m4v";
  if (type === "image" && !IMAGE_EXT.test(src)) return "Imagem precisa terminar em .png, .jpg, .jpeg, .gif ou .webp";
  return "";
}

// ---------- Pré-visualização ----------
// Abre a própria SDX-tv em modo ?preview= dentro de um iframe 1920x1080 reduzido.
function openPreview(slide) {
  if (!slide || !slide.src) return;
  const params = new URLSearchParams({
    preview: slide.src,
    type: slide.type || (VIDEO_EXT.test(slide.src) ? "video" : "image"),
    title: slide.title || "",
    subtitle: slide.subtitle || "",
  });
  if (slide.kenBurns) params.set("kenburns", "1");
  if (slide.transition) params.set("transition", slide.transition);
  els.previewCaption.textContent = `${slide.title || ""} · ${slide.src}`;
  els.previewIframe.src = `/?${params.toString()}`;
  els.previewDialog.showModal();
  fitPreview();
}

function fitPreview() {
  const frame = els.previewIframe.parentElement;
  const scale = frame.clientWidth / 1920;
  els.previewIframe.style.transform = `scale(${scale})`;
}

function closePreview() {
  els.previewDialog.close();
  els.previewIframe.src = "about:blank";
}

els.previewClose.addEventListener("click", closePreview);
els.previewDialog.addEventListener("close", () => { els.previewIframe.src = "about:blank"; });
els.previewDialog.addEventListener("click", (e) => { if (e.target === els.previewDialog) closePreview(); });
window.addEventListener("resize", () => { if (els.previewDialog.open) fitPreview(); });

function slideFromFile(file, folder) {
  const isVid = VIDEO_EXT.test(file.name);
  return {
    type: isVid ? "video" : "image",
    title: file.name.replace(/\.[^.]+$/, ""),
    subtitle: folder,
    src: file.kind === "r2" ? file.url : encodeURI(`assets/${folder}/${file.name}`),
    transition: isVid ? "slide" : "fade",
    ...(isVid ? {} : { kenBurns: true }),
  };
}

function token() { return localStorage.getItem(TOKEN_KEY); }
function authHeader() { return { Authorization: `Bearer ${token()}` }; }

async function api(path, opts = {}) {
  const res = await fetch(path, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...authHeader(),
      ...(opts.headers || {}),
    },
  });
  if (res.status === 401) {
    logout();
    throw new Error("Sessão expirada. Faça login novamente.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Erro ${res.status}`);
  return data;
}

function setStatus(el, text, type = "") {
  el.textContent = text;
  el.style.color = type === "error" ? "#ff7b72" : type === "ok" ? "#56d364" : "#8b949e";
}

// ---------- Auth ----------
els.loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  els.loginError.hidden = true;
  const fd = new FormData(els.loginForm);
  try {
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: fd.get("username"), password: fd.get("password") }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Falha no login");
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(USER_KEY, data.user.username);
    showApp();
  } catch (error) {
    els.loginError.textContent = error.message;
    els.loginError.hidden = false;
  }
});

function logout() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  els.appView.hidden = true;
  els.loginView.hidden = false;
}
els.logoutBtn.addEventListener("click", logout);

async function showApp() {
  els.loginView.hidden = true;
  els.appView.hidden = false;
  els.userLabel.textContent = localStorage.getItem(USER_KEY) || "";
  await Promise.all([loadSlides(), loadFolders()]);
}

// ---------- Tabs ----------
els.tabs.forEach((btn) => {
  btn.addEventListener("click", () => {
    els.tabs.forEach((b) => b.classList.toggle("active", b === btn));
    const target = btn.dataset.tab;
    els.panes.forEach((p) => p.classList.toggle("active", p.id === `tab-${target}`));
  });
});

function moveSlide(from, to) {
  const slides = slidesState.data.slides;
  if (from < 0 || from >= slides.length) return;
  to = Math.max(0, Math.min(slides.length - 1, to));
  if (from === to) return;
  const [item] = slides.splice(from, 1);
  slides.splice(to, 0, item);
}

function moveMany(indices, target) {
  const slides = slidesState.data.slides;
  const sorted = [...indices].sort((a, b) => a - b);
  const items = sorted.map((i) => slides[i]);
  for (let i = sorted.length - 1; i >= 0; i--) slides.splice(sorted[i], 1);
  const adjusted = Math.max(0, Math.min(slides.length, target));
  slides.splice(adjusted, 0, ...items);
  selectedIndexes = new Set(items.map((_, i) => adjusted + i));
}

function clearSelection() {
  selectedIndexes.clear();
  lastClickedIndex = null;
}

function applyLayout() {
  els.slidesList.classList.toggle("media-list--grid", slidesLayout === "grid");
  els.layoutList.classList.toggle("active", slidesLayout === "list");
  els.layoutGrid.classList.toggle("active", slidesLayout === "grid");
}

function applyMediaLayout() {
  els.filesList.classList.toggle("media-list--grid", mediaLayout === "grid");
  els.mediaLayoutList.classList.toggle("active", mediaLayout === "list");
  els.mediaLayoutGrid.classList.toggle("active", mediaLayout === "grid");
}

function updateBulkBar() {
  const n = selectedIndexes.size;
  els.bulkBar.hidden = n === 0;
  els.bulkCount.textContent = n > 0 ? `${n} selecionado${n > 1 ? "s" : ""}` : "";
  if (els.bulkPos) els.bulkPos.max = String(slidesState.data.slides.length);
}

function toggleSelect(index, event) {
  if (event && event.shiftKey && lastClickedIndex !== null) {
    const [a, b] = [lastClickedIndex, index].sort((x, y) => x - y);
    for (let i = a; i <= b; i++) selectedIndexes.add(i);
  } else {
    if (selectedIndexes.has(index)) selectedIndexes.delete(index);
    else selectedIndexes.add(index);
    lastClickedIndex = index;
  }
}

// ---------- Slides ----------
async function loadSlides() {
  try {
    const result = await api("/api/slides");
    slidesState = result;
    slidesState.data.ticker = slidesState.data.ticker || [];
    clearSelection();
    renderSlides();
    els.tickerText.value = (slidesState.data.ticker || []).join("\n");
    setStatus(els.slidesStatus, `Carregado (${slidesState.data.slides.length} slides)`, "ok");
  } catch (error) {
    setStatus(els.slidesStatus, error.message, "error");
  }
}

function renderSlides() {
  els.slidesList.innerHTML = "";
  applyLayout();
  const total = slidesState.data.slides.length;
  slidesState.data.slides.forEach((slide, index) => {
    const li = document.createElement("li");
    li.className = "slide-item";
    li.dataset.index = String(index);
    if (selectedIndexes.has(index)) li.classList.add("selected");
    const isVid = slide.type === "video";
    const src = slide.src && /^https?:\/\//i.test(slide.src) ? slide.src : `/${slide.src || ""}`;
    const thumb = !slide.src
      ? '<div class="thumb empty"></div>'
      : isVid
        ? `<video class="thumb" src="${src}" muted preload="metadata"></video>`
        : `<img class="thumb" loading="lazy" src="${src}" />`;
    li.innerHTML = `
      <div class="row-top">
        <input type="checkbox" class="select" ${selectedIndexes.has(index) ? "checked" : ""} title="Selecionar" />
        <input type="number" class="pos-input" min="1" max="${total}" value="${index + 1}" title="Posição" />
        <span class="handle" title="Arrastar">⋮⋮</span>
      </div>
      ${thumb}
      <div class="info">
        <div class="title"></div>
        <div class="meta"></div>
      </div>
      <div class="actions">
        <button data-action="preview" title="Ver como fica na TV">▶ Ver</button>
        <button data-action="edit">Editar</button>
        <button data-action="delete" class="danger">Apagar</button>
      </div>
    `;
    li.querySelector(".title").textContent = `${slide.type === "video" ? "🎬" : "🖼"} ${slide.title || "(sem título)"}`;
    li.querySelector(".meta").textContent = slide.src;
    const checkbox = li.querySelector(".select");
    checkbox.addEventListener("click", (e) => e.stopPropagation());
    checkbox.addEventListener("change", (e) => {
      toggleSelect(index, e);
      renderSlides();
      updateBulkBar();
    });
    const posInput = li.querySelector(".pos-input");
    posInput.addEventListener("click", (e) => e.stopPropagation());
    let posCommitted = false;
    const commitPos = () => {
      if (posCommitted) return;
      const n = parseInt(posInput.value, 10);
      if (!Number.isFinite(n) || n < 1 || n > total) {
        posInput.value = String(index + 1);
        return;
      }
      const target = n - 1;
      if (target === index) return;
      posCommitted = true;
      moveSlide(index, target);
      clearSelection();
      renderSlides();
      updateBulkBar();
    };
    posInput.addEventListener("change", commitPos);
    posInput.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); posInput.blur(); } });
    li.querySelector('[data-action="preview"]').addEventListener("click", () => openPreview(slide));
    li.querySelector('[data-action="edit"]').addEventListener("click", () => openEditor(index));
    li.querySelector('[data-action="delete"]').addEventListener("click", () => {
      if (!confirm(`Apagar slide "${slide.title}"?`)) return;
      slidesState.data.slides.splice(index, 1);
      clearSelection();
      renderSlides();
      updateBulkBar();
    });
    els.slidesList.appendChild(li);
  });
  updateBulkBar();
  if (window.Sortable) {
    if (slidesSortable) slidesSortable.destroy();
    slidesSortable = Sortable.create(els.slidesList, {
      handle: ".handle",
      animation: 150,
      onEnd: (evt) => {
        if (evt.oldIndex === evt.newIndex) return;
        moveSlide(evt.oldIndex, evt.newIndex);
        clearSelection();
        renderSlides();
      },
    });
  }
}

function openEditor(index) {
  const slide = index >= 0 ? slidesState.data.slides[index] : { type: "image", title: "", subtitle: "", src: "", transition: "fade", kenBurns: true };
  const form = els.editor.querySelector("form");
  form.type.value = slide.type;
  form.title.value = slide.title || "";
  form.subtitle.value = slide.subtitle || "";
  form.src.value = slide.src || "";
  form.transition.value = slide.transition || "fade";
  form.kenBurns.checked = !!slide.kenBurns;
  const total = slidesState.data.slides.length;
  const currentPos = index >= 0 ? index + 1 : total + 1;
  if (form.position) {
    form.position.value = String(currentPos);
    form.position.max = String(index >= 0 ? total : total + 1);
    form.position.min = "1";
  }
  els.editor.returnValue = "cancel";
  els.editor.showModal();
  form.onsubmit = (event) => {
    if (event.submitter?.value !== "save") return;
    const message = validateSlideSrc(form.type.value, form.src.value.trim());
    if (message) {
      event.preventDefault();
      form.src.setCustomValidity(message);
      form.src.reportValidity();
      form.src.oninput = () => form.src.setCustomValidity("");
    }
  };
  els.editor.onclose = () => {
    if (els.editor.returnValue !== "save") return;
    const updated = {
      type: form.type.value,
      title: form.title.value.trim(),
      subtitle: form.subtitle.value.trim(),
      src: form.src.value.trim(),
      transition: form.transition.value,
    };
    if (updated.type === "image" && form.kenBurns.checked) updated.kenBurns = true;
    let newIndex;
    if (index >= 0) {
      slidesState.data.slides[index] = updated;
      newIndex = index;
    } else {
      slidesState.data.slides.push(updated);
      newIndex = slidesState.data.slides.length - 1;
    }
    const desired = parseInt(form.position?.value, 10);
    if (Number.isFinite(desired)) {
      const target = Math.max(1, Math.min(slidesState.data.slides.length, desired)) - 1;
      moveSlide(newIndex, target);
    }
    clearSelection();
    renderSlides();
  };
}
els.addSlide.addEventListener("click", () => openEditor(-1));

els.layoutList.addEventListener("click", () => {
  slidesLayout = "list";
  localStorage.setItem(LAYOUT_KEY, "list");
  applyLayout();
});
els.layoutGrid.addEventListener("click", () => {
  slidesLayout = "grid";
  localStorage.setItem(LAYOUT_KEY, "grid");
  applyLayout();
});

els.bulkBar.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-bulk]");
  if (!btn) return;
  const action = btn.dataset.bulk;
  const indices = [...selectedIndexes].sort((a, b) => a - b);
  if (indices.length === 0) return;
  const total = slidesState.data.slides.length;
  if (action === "clear") { clearSelection(); renderSlides(); return; }
  if (action === "preview") { openPreview(slidesState.data.slides[indices[0]]); return; }
  if (action === "delete") {
    if (!confirm(`Apagar ${indices.length} slide(s)?`)) return;
    for (let i = indices.length - 1; i >= 0; i--) slidesState.data.slides.splice(indices[i], 1);
    clearSelection(); renderSlides(); return;
  }
  let target;
  if (action === "top") target = 0;
  else if (action === "bottom") target = total - indices.length;
  else if (action === "up") target = Math.max(0, indices[0] - 1);
  else if (action === "down") target = Math.min(total - indices.length, indices[0] + 1);
  else if (action === "move-to") {
    const n = parseInt(els.bulkPos.value, 10);
    if (!Number.isFinite(n) || n < 1 || n > total) return;
    target = Math.min(total - indices.length, n - 1);
  } else return;
  moveMany(indices, target);
  renderSlides();
});

els.saveSlides.addEventListener("click", async () => {
  setStatus(els.slidesStatus, "Publicando...", "");
  try {
    const result = await api("/api/slides", {
      method: "PUT",
      body: JSON.stringify({ sha: slidesState.sha, data: slidesState.data }),
    });
    slidesState.sha = result.sha;
    setStatus(els.slidesStatus, `Publicado ✓ (commit ${result.commit.slice(0, 7)})`, "ok");
  } catch (error) {
    setStatus(els.slidesStatus, error.message, "error");
  }
});

// ---------- Pastas & Mídia ----------
async function loadFolders() {
  try {
    const res = await api("/api/folder");
    els.folderSelect.innerHTML = res.folders.map((f) => `<option value="${f}">${f}</option>`).join("");
    if (res.folders.length > 0) await loadFiles(res.folders[0]);
  } catch (error) {
    setStatus(els.mediaStatus, error.message, "error");
  }
}

async function loadFiles(folder) {
  try {
    const res = await api(`/api/files?folder=${encodeURIComponent(folder)}`);
    mediaFolder = folder;
    mediaFiles = res.files;
    selectedMedia.clear();
    lastClickedMedia = null;
    renderFiles();
    setStatus(els.mediaStatus, `${res.files.length} arquivo(s) em ${folder}`, "ok");
  } catch (error) {
    setStatus(els.mediaStatus, error.message, "error");
  }
}

function fileSrc(f) {
  return f.kind === "r2" ? f.url : `/${encodeURI(f.path)}`;
}

function renderFiles() {
  els.filesList.innerHTML = "";
  applyMediaLayout();
  mediaFiles.forEach((f, index) => {
    const isImg = IMAGE_EXT.test(f.name);
    const isVid = VIDEO_EXT.test(f.name);
    const src = fileSrc(f);
    const badge = f.kind === "r2" ? '<span class="badge">📦 vídeo grande</span>' : "";
    const thumb = isImg
      ? `<img class="thumb" loading="lazy" src="${src}" />`
      : isVid
        ? `<video class="thumb" src="${src}" muted preload="metadata"></video>`
        : '<div class="thumb empty"></div>';

    const li = document.createElement("li");
    li.className = "file-item";
    li.dataset.index = String(index);
    if (selectedMedia.has(index)) li.classList.add("selected");
    li.innerHTML = `
      <div class="row-top">
        <input type="checkbox" class="select" ${selectedMedia.has(index) ? "checked" : ""} title="Selecionar" />
      </div>
      ${thumb}
      <div class="info">
        <div class="name"></div>
        <div class="meta"></div>
      </div>
      <div class="actions">
        <button data-action="preview" title="Ver como fica na TV">▶ Ver</button>
        <button data-action="use" class="primary">+ Usar nos slides</button>
        <button data-action="del" class="danger">Apagar</button>
      </div>
    `;
    li.querySelector(".name").textContent = f.name;
    li.querySelector(".meta").innerHTML = `${badge} ${formatSize(f.size)}`;

    const checkbox = li.querySelector(".select");
    checkbox.addEventListener("click", (e) => e.stopPropagation());
    checkbox.addEventListener("change", (e) => {
      toggleMediaSelect(index, e);
      renderFiles();
    });
    li.querySelector('[data-action="preview"]').addEventListener("click", () => openPreview(slideFromFile(f, mediaFolder)));
    li.querySelector('[data-action="use"]').addEventListener("click", () => {
      slidesState.data.slides.push(slideFromFile(f, mediaFolder));
      renderSlides();
      setStatus(els.mediaStatus, `'${f.name}' adicionado aos slides. Vá em 'Slides' e clique em Salvar e publicar.`, "ok");
    });
    li.querySelector('[data-action="del"]').addEventListener("click", async () => {
      if (!confirm(`Apagar ${f.name}?`)) return;
      await deleteMediaFiles([f]);
    });
    els.filesList.appendChild(li);
  });
  updateMediaBulkBar();
}

function toggleMediaSelect(index, event) {
  if (event && event.shiftKey && lastClickedMedia !== null) {
    const [a, b] = [lastClickedMedia, index].sort((x, y) => x - y);
    for (let i = a; i <= b; i++) selectedMedia.add(i);
  } else {
    if (selectedMedia.has(index)) selectedMedia.delete(index);
    else selectedMedia.add(index);
    lastClickedMedia = index;
  }
}

function updateMediaBulkBar() {
  const n = selectedMedia.size;
  els.mediaBulkBar.hidden = n === 0;
  els.mediaBulkCount.textContent = n > 0 ? `${n} selecionado${n > 1 ? "s" : ""}` : "";
}

async function deleteMediaFile(f) {
  if (f.kind === "r2") {
    await api("/api/r2-presign", { method: "DELETE", body: JSON.stringify({ key: f.key }) });
  } else {
    await api("/api/upload", { method: "DELETE", body: JSON.stringify({ path: f.path }) });
  }
}

function slidesReferencing(files) {
  const srcs = new Set(files.map((f) => slideFromFile(f, mediaFolder).src));
  return slidesState.data.slides
    .map((slide, index) => ({ slide, index }))
    .filter(({ slide }) => {
      if (!slide.src) return false;
      const normalized = /^https?:\/\//i.test(slide.src) ? slide.src : encodeURI(decodeURIComponentSafe(slide.src));
      return srcs.has(normalized);
    });
}

function decodeURIComponentSafe(value) {
  try { return decodeURI(value); } catch { return value; }
}

// Apaga em sequência (um commit por arquivo); avisa quando slides apontam para os arquivos.
async function deleteMediaFiles(files) {
  const refs = slidesReferencing(files);
  if (refs.length > 0) {
    const ok = confirm(
      `${refs.length} slide(s) usam esse(s) arquivo(s) e ficarão quebrados na TV.\n\nRemover também esses slides da lista? (precisa depois 'Salvar e publicar' em Slides)`
    );
    if (ok) {
      const indices = refs.map((r) => r.index).sort((a, b) => b - a);
      for (const i of indices) slidesState.data.slides.splice(i, 1);
      clearSelection();
      renderSlides();
    }
  }
  const failures = [];
  for (let i = 0; i < files.length; i++) {
    setStatus(els.mediaStatus, `Apagando ${i + 1}/${files.length}: ${files[i].name}...`, "");
    try {
      await deleteMediaFile(files[i]);
    } catch (error) {
      failures.push(`${files[i].name}: ${error.message}`);
    }
  }
  await loadFiles(mediaFolder);
  if (failures.length > 0) setStatus(els.mediaStatus, `Falhas: ${failures.join(" | ")}`, "error");
  else setStatus(els.mediaStatus, `${files.length} arquivo(s) apagado(s) ✓`, "ok");
}

els.mediaBulkBar.addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-media-bulk]");
  if (!btn) return;
  const action = btn.dataset.mediaBulk;
  if (action === "all") {
    mediaFiles.forEach((_, i) => selectedMedia.add(i));
    renderFiles();
    return;
  }
  const files = [...selectedMedia].sort((a, b) => a - b).map((i) => mediaFiles[i]).filter(Boolean);
  if (action === "clear") { selectedMedia.clear(); lastClickedMedia = null; renderFiles(); return; }
  if (files.length === 0) return;
  if (action === "use") {
    files.forEach((f) => slidesState.data.slides.push(slideFromFile(f, mediaFolder)));
    renderSlides();
    selectedMedia.clear();
    renderFiles();
    setStatus(els.mediaStatus, `${files.length} arquivo(s) adicionado(s) aos slides. Vá em 'Slides' e clique em Salvar e publicar.`, "ok");
    return;
  }
  if (action === "delete") {
    if (!confirm(`Apagar ${files.length} arquivo(s) de '${mediaFolder}'? Esta ação não pode ser desfeita.`)) return;
    await deleteMediaFiles(files);
  }
});

els.mediaLayoutList.addEventListener("click", () => {
  mediaLayout = "list";
  localStorage.setItem(MEDIA_LAYOUT_KEY, "list");
  applyMediaLayout();
});
els.mediaLayoutGrid.addEventListener("click", () => {
  mediaLayout = "grid";
  localStorage.setItem(MEDIA_LAYOUT_KEY, "grid");
  applyMediaLayout();
});

function formatSize(bytes) {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

els.folderSelect.addEventListener("change", (e) => loadFiles(e.target.value));

els.newFolder.addEventListener("click", async () => {
  const name = prompt("Nome da nova pasta:");
  if (!name) return;
  try {
    await api("/api/folder", { method: "POST", body: JSON.stringify({ folder: name }) });
    await loadFolders();
    setStatus(els.mediaStatus, `Pasta '${name}' criada ✓`, "ok");
  } catch (error) {
    setStatus(els.mediaStatus, error.message, "error");
  }
});

els.delFolder.addEventListener("click", async () => {
  const folder = els.folderSelect.value;
  if (!folder) return;
  if (!confirm(`Apagar a pasta '${folder}' e todo seu conteúdo? Esta ação não pode ser desfeita.`)) return;
  try {
    await api("/api/folder", { method: "DELETE", body: JSON.stringify({ folder }) });
    await loadFolders();
    setStatus(els.mediaStatus, `Pasta '${folder}' apagada ✓`, "ok");
  } catch (error) {
    setStatus(els.mediaStatus, error.message, "error");
  }
});

const SMALL_FILE_LIMIT = 3.5 * 1024 * 1024; // ate 3.5 MB vai para o repo via Vercel function

els.fileInput.addEventListener("change", async (e) => {
  const folder = els.folderSelect.value;
  if (!folder) {
    setStatus(els.mediaStatus, "Selecione uma pasta primeiro", "error");
    return;
  }
  const files = [...e.target.files];
  const uploaded = [];
  for (const original of files) {
    let file = original;
    let note = "";
    try {
      if (IMAGE_EXT.test(original.name) && !/\.gif$/i.test(original.name)) {
        setStatus(els.mediaStatus, `Otimizando ${original.name}...`, "");
        const optimized = await optimizeImage(original);
        if (optimized && optimized.size < original.size) {
          file = optimized;
          note = ` (${formatSize(original.size)} → ${formatSize(file.size)})`;
        }
      }
    } catch (error) {
      console.warn("Falha ao otimizar imagem, enviando original", error);
    }
    const mb = (file.size / 1024 / 1024).toFixed(1);
    setStatus(els.mediaStatus, `Enviando ${file.name} (${mb} MB)...`, "");
    try {
      if (file.size <= SMALL_FILE_LIMIT) {
        const base64 = await fileToBase64(file);
        await api("/api/upload", {
          method: "POST",
          body: JSON.stringify({ folder, filename: file.name, contentBase64: base64 }),
        });
      } else {
        await uploadLargeFile(folder, file);
      }
      setStatus(els.mediaStatus, `${file.name} publicado ✓${note}`, "ok");
      uploaded.push(file.name);
    } catch (error) {
      setStatus(els.mediaStatus, `${file.name}: ${error.message}`, "error");
    }
  }
  els.fileInput.value = "";
  await loadFiles(folder);
  offerPreviewAfterUpload(uploaded);
});

// O nome publicado pode diferir do enviado (slug no servidor); casa pelo slug.
function offerPreviewAfterUpload(names) {
  if (names.length === 0) return;
  const wanted = new Set(names.map((n) => slugifyFilename(n)));
  const matches = mediaFiles.filter((f) => wanted.has(slugifyFilename(f.name)));
  if (matches.length === 0) return;
  setStatus(els.mediaStatus, `${names.length} arquivo(s) publicado(s) ✓ `, "ok");
  const btn = document.createElement("button");
  btn.type = "button";
  btn.textContent = matches.length > 1 ? `▶ Visualizar último (${matches[matches.length - 1].name})` : "▶ Visualizar na TV";
  btn.style.marginLeft = "8px";
  btn.addEventListener("click", () => openPreview(slideFromFile(matches[matches.length - 1], mediaFolder)));
  els.mediaStatus.appendChild(btn);
}

// Reduz para no máximo 1920px no maior lado e exporta JPEG (PNG só se houver transparência).
async function optimizeImage(file) {
  const bitmap = await loadImageBitmap(file);
  const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(bitmap, 0, 0, width, height);
  if (typeof bitmap.close === "function") bitmap.close();

  const hasAlpha = /\.png$/i.test(file.name) && canvasHasTransparency(ctx, width, height);
  const mime = hasAlpha ? "image/png" : "image/jpeg";
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, mime, JPEG_QUALITY));
  if (!blob) return null;

  const newName = slugifyFilename(file.name).replace(/\.[^.]+$/, hasAlpha ? ".png" : ".jpg");
  return new File([blob], newName, { type: mime, lastModified: Date.now() });
}

function loadImageBitmap(file) {
  if (typeof createImageBitmap === "function") return createImageBitmap(file);
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Imagem inválida")); };
    img.src = url;
  });
}

function canvasHasTransparency(ctx, width, height) {
  const step = Math.max(1, Math.floor(Math.sqrt((width * height) / 20000)));
  const data = ctx.getImageData(0, 0, width, height).data;
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      if (data[(y * width + x) * 4 + 3] < 250) return true;
    }
  }
  return false;
}

async function uploadLargeFile(folder, file) {
  const presign = await api("/api/r2-presign", {
    method: "POST",
    body: JSON.stringify({ folder, filename: slugifyFilename(file.name), contentType: file.type }),
  });
  const uploadRes = await fetch(presign.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type || "application/octet-stream" },
    body: file,
  });
  if (!uploadRes.ok) {
    const text = await uploadRes.text();
    throw new Error(`R2 ${uploadRes.status}: ${text.slice(0, 200)}`);
  }
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      const base64 = String(result).split(",")[1] || "";
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ---------- Ticker ----------
els.saveTicker.addEventListener("click", async () => {
  const lines = els.tickerText.value.split("\n").map((s) => s.trim()).filter(Boolean);
  slidesState.data.ticker = lines;
  setStatus(els.tickerStatus, "Publicando...", "");
  try {
    const result = await api("/api/slides", {
      method: "PUT",
      body: JSON.stringify({ sha: slidesState.sha, data: slidesState.data }),
    });
    slidesState.sha = result.sha;
    setStatus(els.tickerStatus, `Publicado ✓ (commit ${result.commit.slice(0, 7)})`, "ok");
  } catch (error) {
    setStatus(els.tickerStatus, error.message, "error");
  }
});

// ---------- Boot ----------
if (token()) showApp();
