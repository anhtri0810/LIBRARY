let books = [];
let stats = {};
let activeView = "library";

const $ = (id) => document.getElementById(id);

async function api(url, options = {}) {
  const res = await fetch(url, {
    headers: {"Content-Type": "application/json", ...(options.headers || {})},
    ...options
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong.");
  return data;
}

function toast(message) {
  const el = $("toast");
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(window.__toast);
  window.__toast = setTimeout(() => el.classList.remove("show"), 2400);
}

function setView(view) {
  activeView = view;
  document.querySelectorAll(".nav-item").forEach(btn => btn.classList.toggle("active", btn.dataset.view === view));
  document.querySelectorAll(".view").forEach(el => el.classList.toggle("active", el.id === `view-${view}`));

  const title = {
    library: ["Library", "Overview"],
    discover: ["Discover", "Google Books"],
    tags: ["Tags", "Organize"],
    activity: ["Activity", "History"],
    backups: ["Backups", "Data safety"]
  }[view];
  $("crumbMain").textContent = title[0];
  $("crumbSub").textContent = title[1];

  $("hero").style.display = view === "library" ? "" : "none";
  $("statsGrid").style.display = view === "library" ? "" : "none";

  if (view === "tags") renderTags();
  if (view === "activity") loadActivity();
  if (view === "backups") loadBackups();
}

document.querySelectorAll(".nav-item").forEach(btn => btn.addEventListener("click", () => setView(btn.dataset.view)));
document.querySelectorAll("[data-view-jump]").forEach(btn => btn.addEventListener("click", () => setView(btn.dataset.viewJump)));
$("themeButton").addEventListener("click", () => {
  document.body.classList.toggle("light");
  localStorage.setItem("aurora_theme", document.body.classList.contains("light") ? "light" : "dark");
});

if (localStorage.getItem("aurora_theme") === "light") document.body.classList.add("light");

function bookInitial(book) {
  return (book.title || "B").trim().charAt(0).toUpperCase();
}

function renderBooks() {
  const query = $("librarySearch").value.trim().toLowerCase();
  const tag = $("tagFilter").value;
  const filtered = books.filter((b) => {
    const matchesQuery =
      !query ||
      b.title.toLowerCase().includes(query) ||
      b.author.toLowerCase().includes(query) ||
      (b.tag || "").toLowerCase().includes(query);
    const matchesTag = !tag || b.tag === tag;
    return matchesQuery && matchesTag;
  });

  $("libraryGrid").innerHTML = filtered.map((book) => {
    const index = book._index;
    return `
      <article class="book-card">
        <div class="cover">${escapeHtml(bookInitial(book))}<br><small>${escapeHtml(book.title.slice(0, 30))}</small></div>
        <div class="book-meta">${escapeHtml(String(book.year))}</div>
        <div class="book-title">${escapeHtml(book.title)}</div>
        <div class="book-author">${escapeHtml(book.author)}</div>
        <div class="book-bottom">
          ${book.tag ? `<span class="tag">${escapeHtml(book.tag)}</span>` : `<span class="tag">Untagged</span>`}
          <div class="card-actions">
            <button onclick="editBook(${index})">Edit</button>
            <button class="delete" onclick="deleteBook(${index})">Delete</button>
          </div>
        </div>
      </article>
    `;
  }).join("");

  $("emptyLibrary").classList.toggle("hidden", filtered.length > 0);
  $("libraryGrid").classList.toggle("hidden", filtered.length === 0);
}

function updateStats() {
  $("statTotal").textContent = stats.total ?? 0;
  $("statAuthors").textContent = stats.authors ?? 0;
  $("statTagged").textContent = stats.tagged ?? 0;
  $("statYear").textContent = stats.latestYear ?? "—";
  $("heroTotal").textContent = stats.total ?? 0;
  $("heroTagged").textContent = stats.tagged ?? 0;

  $("tagFilter").innerHTML = `<option value="">All tags</option>` +
    (stats.tags || []).filter(t => t.name !== "Untagged").map(t =>
      `<option value="${escapeAttr(t.name)}">${escapeHtml(t.name)} (${t.count})</option>`
    ).join("");
}

async function refresh() {
  const data = await api("/api/books");
  books = data.books || [];
  stats = await api("/api/stats");
  updateStats();
  renderBooks();
}

function openModal(index = null, preset = null) {
  $("editingIndex").value = index === null ? "" : index;
  $("modalTitle").textContent = index === null ? "Add a book" : "Edit book";
  const book = preset || (index === null ? {title:"", author:"", year:"", tag:""} : books[index]);
  $("bookTitle").value = book.title || "";
  $("bookAuthor").value = book.author || "";
  $("bookYear").value = book.year || "";
  $("bookTag").value = book.tag || "";
  $("modal").classList.remove("hidden");
  $("bookTitle").focus();
}

function closeModal() { $("modal").classList.add("hidden"); }
document.querySelectorAll("[data-close-modal]").forEach(el => el.addEventListener("click", closeModal));

$("bookForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const index = $("editingIndex").value;
  const payload = {
    title: $("bookTitle").value.trim(),
    author: $("bookAuthor").value.trim(),
    year: Number($("bookYear").value),
    tag: $("bookTag").value.trim(),
  };

  try {
    if (index === "") {
      await api("/api/books", {method:"POST", body:JSON.stringify(payload)});
      toast("Book added to your library.");
    } else {
      await api(`/api/books/${index}`, {method:"PUT", body:JSON.stringify(payload)});
      toast("Book updated.");
    }
    closeModal();
    await refresh();
  } catch (err) { toast(err.message); }
});

window.editBook = (index) => openModal(index);

window.deleteBook = async (index) => {
  const book = books[index];
  if (!book) return;
  if (!confirm(`Delete "${book.title}"?`)) return;
  try {
    await api(`/api/books/${index}`, {method:"DELETE"});
    toast("Book deleted.");
    await refresh();
  } catch (err) { toast(err.message); }
};

["addTopButton", "heroAdd", "emptyAdd"].forEach(id => $(id).addEventListener("click", () => openModal()));
$("librarySearch").addEventListener("input", renderBooks);
$("tagFilter").addEventListener("change", renderBooks);

async function renderTags() {
  const data = await api("/api/stats");
  $("tagsPanel").innerHTML = (data.tags || []).map(t => `
    <div class="tag-tile" onclick="filterByTag(${JSON.stringify(t.name)})">
      <div class="section-kicker">TAG</div>
      <b>${escapeHtml(t.name)}</b>
      <span>${t.count} book${t.count === 1 ? "" : "s"} · click to browse</span>
    </div>
  `).join("") || `<div class="discover-hint">No tags yet. Add a tag while creating or editing a book.</div>`;
}
window.filterByTag = (tag) => {
  setView("library");
  $("tagFilter").value = tag === "Untagged" ? "" : tag;
  renderBooks();
};

async function loadActivity() {
  const data = await api("/api/activity");
  $("activityPanel").innerHTML = data.entries?.map(e => `
    <div class="activity-row">
      <div><div class="activity-action">${escapeHtml(e.action)}</div><div class="activity-detail">${escapeHtml(e.detail)}</div></div>
      <div class="activity-time">${escapeHtml(e.time)}</div>
    </div>
  `).join("") || `<div class="discover-hint">No activity recorded yet.</div>`;
}

async function loadBackups() {
  const data = await api("/api/backups");
  $("backupPanel").innerHTML = data.backups?.map(b => `
    <div class="backup-row">
      <div><b>${escapeHtml(b.name)}</b></div><div class="backup-time">${escapeHtml(b.time)}</div>
    </div>
  `).join("") || `<div class="discover-hint">No backup snapshots yet.</div>`;
}

async function makeBackup() {
  try {
    await api("/api/backup", {method:"POST"});
    toast("Backup created safely.");
    if (activeView === "backups") loadBackups();
  } catch (err) { toast(err.message); }
}
$("backupButton").addEventListener("click", makeBackup);
$("backupSidebar").addEventListener("click", makeBackup);

$("exportButton").addEventListener("click", async () => {
  const data = await api("/api/export");
  const blob = new Blob([JSON.stringify(data, null, 2)], {type:"application/json"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "books.json";
  a.click();
  URL.revokeObjectURL(a.href);
  toast("Collection exported.");
});

$("importButton").addEventListener("click", () => $("importFile").click());
$("importFile").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    const result = await api("/api/import", {method:"POST", body:JSON.stringify(parsed)});
    toast(`Imported ${result.count} books.`);
    await refresh();
    await loadBackups();
  } catch (err) {
    toast(err.message);
  } finally {
    e.target.value = "";
  }
});

$("onlineSearchButton").addEventListener("click", searchOnline);
$("onlineSearch").addEventListener("keydown", (e) => { if (e.key === "Enter") searchOnline(); });

async function searchOnline() {
  const q = $("onlineSearch").value.trim();
  if (!q) return;
  $("discoverGrid").innerHTML = `<div class="discover-hint">Searching Google Books…</div>`;
  try {
    const res = await fetch(`https://www.googleapis.com/books/v1/volumes?maxResults=20&q=${encodeURIComponent(q)}`);
    const data = await res.json();
    const items = data.items || [];
    if (!items.length) {
      $("discoverGrid").innerHTML = `<div class="discover-hint">No results found. Try another title, author or topic.</div>`;
      return;
    }
    $("discoverGrid").innerHTML = items.map(item => {
      const v = item.volumeInfo || {};
      const title = v.title || "Untitled";
      const author = (v.authors || ["Unknown author"]).join(", ");
      const year = (v.publishedDate || "").slice(0,4) || "";
      const cover = v.imageLinks?.thumbnail || v.imageLinks?.smallThumbnail || "";
      const safe = JSON.stringify({title, author, year: Number(year) || "", tag:""});
      return `
        <article class="discover-card">
          ${cover ? `<img class="discover-cover" src="${escapeAttr(cover)}" alt="">` : `<div class="discover-cover"></div>`}
          <div class="discover-info">
            <h3>${escapeHtml(title)}</h3>
            <p>${escapeHtml(author)}</p>
            ${year ? `<p>Published ${escapeHtml(year)}</p>` : ""}
            <button class="primary-button discover-add" onclick='addDiscovered(${safe})'>Add to library</button>
          </div>
        </article>
      `;
    }).join("");
  } catch {
    $("discoverGrid").innerHTML = `<div class="discover-hint">Online search is unavailable right now. Check your internet connection and try again.</div>`;
  }
}

window.addDiscovered = (book) => openModal(null, book);

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));
}
function escapeAttr(value) { return escapeHtml(value); }

refresh().catch(err => toast(err.message));
