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
  folderSelect: document.getElementById("folder-select"),
  newFolder: document.getElementById("new-folder"),
  delFolder: document.getElementById("del-folder"),
  fileInput: document.getElementById("file-input"),
  filesList: document.getElementById("files-list"),
  mediaStatus: document.getElementById("media-status"),
  tickerText: document.getElementById("ticker-text"),
  saveTicker: document.getElementById("save-ticker"),
  tickerStatus: document.getElementById("ticker-status"),
  editor: document.getElementById("slide-editor"),
};

let slidesState = { sha: null, data: { config: {}, slides: [], ticker: [] } };

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

// ---------- Slides ----------
async function loadSlides() {
  try {
    const result = await api("/api/slides");
    slidesState = result;
    slidesState.data.ticker = slidesState.data.ticker || [];
    renderSlides();
    els.tickerText.value = (slidesState.data.ticker || []).join("\n");
    setStatus(els.slidesStatus, `Carregado (${slidesState.data.slides.length} slides)`, "ok");
  } catch (error) {
    setStatus(els.slidesStatus, error.message, "error");
  }
}

function renderSlides() {
  els.slidesList.innerHTML = "";
  slidesState.data.slides.forEach((slide, index) => {
    const li = document.createElement("li");
    li.className = "slide-item";
    li.dataset.index = String(index);
    li.innerHTML = `
      <span class="handle">⋮⋮</span>
      <div class="info">
        <div class="title"></div>
        <div class="meta"></div>
      </div>
      <div class="actions">
        <button data-action="edit">Editar</button>
        <button data-action="delete" class="danger">Apagar</button>
      </div>
    `;
    li.querySelector(".title").textContent = `${slide.type === "video" ? "🎬" : "🖼"} ${slide.title || "(sem título)"}`;
    li.querySelector(".meta").textContent = slide.src;
    li.querySelector('[data-action="edit"]').addEventListener("click", () => openEditor(index));
    li.querySelector('[data-action="delete"]').addEventListener("click", () => {
      if (!confirm(`Apagar slide "${slide.title}"?`)) return;
      slidesState.data.slides.splice(index, 1);
      renderSlides();
    });
    els.slidesList.appendChild(li);
  });
  if (window.Sortable) {
    Sortable.create(els.slidesList, {
      handle: ".handle",
      animation: 150,
      onEnd: (evt) => {
        const moved = slidesState.data.slides.splice(evt.oldIndex, 1)[0];
        slidesState.data.slides.splice(evt.newIndex, 0, moved);
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
  els.editor.returnValue = "cancel";
  els.editor.showModal();
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
    if (index >= 0) slidesState.data.slides[index] = updated;
    else slidesState.data.slides.push(updated);
    renderSlides();
  };
}
els.addSlide.addEventListener("click", () => openEditor(-1));

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
    els.filesList.innerHTML = "";
    res.files.forEach((f) => {
      const isImg = /\.(png|jpe?g|gif|webp)$/i.test(f.name);
      const isVid = /\.(mp4|webm|mov|m4v)$/i.test(f.name);
      const src = f.kind === "blob" ? f.url : `../${f.path}`;
      const badge = f.kind === "blob" ? '<span class="badge">📦 vídeo grande</span>' : "";

      const li = document.createElement("li");
      li.className = "file-item";
      li.innerHTML = `
        ${isImg ? `<img loading="lazy" src="${src}" />` : isVid ? `<video src="${src}" muted></video>` : '<div style="width:60px"></div>'}
        <div class="info">
          <div class="name"></div>
          <div class="meta"></div>
        </div>
        <div class="actions">
          <button data-action="use" class="primary">+ Usar nos slides</button>
          <button data-action="del" class="danger">Apagar</button>
        </div>
      `;
      li.querySelector(".name").textContent = f.name;
      li.querySelector(".meta").innerHTML = `${badge} ${formatSize(f.size)}`;

      li.querySelector('[data-action="use"]').addEventListener("click", () => {
        const slideSrc = f.kind === "blob" ? f.url : `assets/${folder}/${f.name}`;
        const baseTitle = f.name.replace(/\.[^.]+$/, "");
        slidesState.data.slides.push({
          type: isVid ? "video" : "image",
          title: baseTitle,
          subtitle: folder,
          src: slideSrc,
          transition: isVid ? "slide" : "fade",
          ...(isVid ? {} : { kenBurns: true }),
        });
        renderSlides();
        setStatus(els.mediaStatus, `'${f.name}' adicionado aos slides. Vá em 'Slides' e clique em Salvar e publicar.`, "ok");
      });

      li.querySelector('[data-action="del"]').addEventListener("click", async () => {
        if (!confirm(`Apagar ${f.name}?`)) return;
        try {
          if (f.kind === "blob") {
            await api("/api/blob-upload", { method: "DELETE", body: JSON.stringify({ url: f.url }) });
          } else {
            await api("/api/upload", { method: "DELETE", body: JSON.stringify({ path: f.path }) });
          }
          await loadFiles(folder);
          setStatus(els.mediaStatus, "Apagado ✓", "ok");
        } catch (error) {
          setStatus(els.mediaStatus, error.message, "error");
        }
      });
      els.filesList.appendChild(li);
    });
    setStatus(els.mediaStatus, `${res.files.length} arquivo(s) em ${folder}`, "ok");
  } catch (error) {
    setStatus(els.mediaStatus, error.message, "error");
  }
}

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
  for (const file of files) {
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
      setStatus(els.mediaStatus, `${file.name} publicado ✓`, "ok");
    } catch (error) {
      setStatus(els.mediaStatus, `${file.name}: ${error.message}`, "error");
    }
  }
  els.fileInput.value = "";
  await loadFiles(folder);
});

async function uploadLargeFile(folder, file) {
  const { upload } = await import("https://esm.sh/@vercel/blob@0.27.3/client");
  await upload(`${folder}/${file.name}`, file, {
    access: "public",
    handleUploadUrl: "/api/blob-upload",
    clientPayload: JSON.stringify({ folder, token: token() }),
  });
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
