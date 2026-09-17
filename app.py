from flask import Flask, jsonify, request, render_template
from pathlib import Path
from datetime import datetime
import json
import shutil
import threading
import time

BASE_DIR = Path(__file__).resolve().parent
BOOKS_FILE = BASE_DIR / "books.json"
BACKUP_DIR = BASE_DIR / "data"
LOG_FILE = BASE_DIR / "log.txt"

app = Flask(__name__)

_lock = threading.Lock()


def ensure_storage():
    BACKUP_DIR.mkdir(exist_ok=True)
    if not BOOKS_FILE.exists():
        BOOKS_FILE.write_text("[]", encoding="utf-8")
    if not LOG_FILE.exists():
        LOG_FILE.write_text("", encoding="utf-8")


def read_books():
    ensure_storage()
    try:
        return json.loads(BOOKS_FILE.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return []


def write_books(books):
    ensure_storage()
    temp = BOOKS_FILE.with_suffix(".tmp")
    temp.write_text(json.dumps(books, indent=2, ensure_ascii=False), encoding="utf-8")
    temp.replace(BOOKS_FILE)


def log_action(action, detail=""):
    ensure_storage()
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    with LOG_FILE.open("a", encoding="utf-8") as f:
        f.write(f"{timestamp}|{action}|{detail}\n")


def create_backup():
    ensure_storage()
    stamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    target = BACKUP_DIR / f"books_{stamp}.json"
    with _lock:
        shutil.copy2(BOOKS_FILE, target)
    return target.name


def cleanup_backups():
    ensure_storage()
    backups = sorted(BACKUP_DIR.glob("books_*.json"), key=lambda p: p.stat().st_mtime, reverse=True)
    # Keep the newest 20 snapshots.
    for old in backups[20:]:
        try:
            old.unlink()
        except OSError:
            pass


def backup_worker():
    while True:
        try:
            time.sleep(300)  # 5 minutes instead of the original 5-second demo interval.
            create_backup()
            cleanup_backups()
        except Exception:
            pass


def validate_book(data):
    title = str(data.get("title", "")).strip()
    author = str(data.get("author", "")).strip()
    year = data.get("year")
    tag = str(data.get("tag", "")).strip()

    if not title or not author:
        return None, "Title and author are required."

    try:
        year = int(year)
    except (TypeError, ValueError):
        return None, "Year must be a number."

    current_year = datetime.now().year
    if year < 0 or year > current_year + 1:
        return None, f"Year must be between 0 and {current_year + 1}."

    return {"title": title, "author": author, "year": year, "tag": tag}, None


@app.get("/")
def index():
    return render_template("index.html")


@app.get("/api/books")
def api_books():
    raw_books = read_books()
    books = [dict(b, _index=i) for i, b in enumerate(raw_books)]
    query = request.args.get("q", "").strip().lower()
    tag = request.args.get("tag", "").strip().lower()

    if query:
        books = [
            b for b in books
            if query in b.get("title", "").lower()
            or query in b.get("author", "").lower()
            or query in b.get("tag", "").lower()
        ]

    if tag:
        books = [b for b in books if b.get("tag", "").lower() == tag]

    books.sort(key=lambda b: (b.get("title", "").lower(), -int(b.get("year", 0))))
    return jsonify({"books": books})


@app.get("/api/stats")
def api_stats():
    books = read_books()
    tags = {}
    for b in books:
        t = b.get("tag", "").strip() or "Untagged"
        tags[t] = tags.get(t, 0) + 1

    years = [int(b.get("year")) for b in books if str(b.get("year", "")).isdigit()]
    recent = sorted(books, key=lambda b: int(b.get("year", 0)), reverse=True)[:5]

    return jsonify({
        "total": len(books),
        "tagged": sum(1 for b in books if b.get("tag", "").strip()),
        "authors": len({b.get("author", "").strip().lower() for b in books if b.get("author", "").strip()}),
        "latestYear": max(years) if years else None,
        "tags": sorted([{"name": k, "count": v} for k, v in tags.items()], key=lambda x: (-x["count"], x["name"].lower())),
        "recent": recent,
    })


@app.get("/api/activity")
def api_activity():
    ensure_storage()
    lines = [line.strip() for line in LOG_FILE.read_text(encoding="utf-8").splitlines() if line.strip()]
    entries = []
    for line in lines[-30:][::-1]:
        parts = line.split("|", 2)
        entries.append({
            "time": parts[0] if len(parts) > 0 else "",
            "action": parts[1] if len(parts) > 1 else "activity",
            "detail": parts[2] if len(parts) > 2 else ""
        })
    return jsonify({"entries": entries})


@app.post("/api/books")
def create_book():
    data = request.get_json(silent=True) or {}
    book, error = validate_book(data)
    if error:
        return jsonify({"error": error}), 400

    books = read_books()
    books.append(book)
    write_books(books)
    log_action("add", book["title"])
    return jsonify(book), 201


@app.put("/api/books/<int:index>")
def update_book(index):
    books = read_books()
    if index < 0 or index >= len(books):
        return jsonify({"error": "Book not found."}), 404

    data = request.get_json(silent=True) or {}
    book, error = validate_book(data)
    if error:
        return jsonify({"error": error}), 400

    old_title = books[index].get("title", "")
    books[index] = book
    write_books(books)
    log_action("edit", f"{old_title} → {book['title']}")
    return jsonify(book)


@app.delete("/api/books/<int:index>")
def delete_book(index):
    books = read_books()
    if index < 0 or index >= len(books):
        return jsonify({"error": "Book not found."}), 404

    deleted = books.pop(index)
    write_books(books)
    log_action("delete", deleted.get("title", ""))
    return jsonify({"deleted": deleted})


@app.post("/api/backup")
def backup_now():
    name = create_backup()
    cleanup_backups()
    log_action("backup", name)
    return jsonify({"file": name})


@app.get("/api/backups")
def list_backups():
    ensure_storage()
    backups = sorted(BACKUP_DIR.glob("books_*.json"), key=lambda p: p.stat().st_mtime, reverse=True)
    return jsonify({
        "backups": [
            {"name": p.name, "time": datetime.fromtimestamp(p.stat().st_mtime).strftime("%Y-%m-%d %H:%M:%S")}
            for p in backups[:20]
        ]
    })


@app.post("/api/import")
def import_books():
    data = request.get_json(silent=True)
    if not isinstance(data, list):
        return jsonify({"error": "Import file must contain a JSON array of books."}), 400

    clean = []
    for item in data:
        book, error = validate_book(item if isinstance(item, dict) else {})
        if error:
            return jsonify({"error": f"Invalid book in import: {error}"}), 400
        clean.append(book)

    create_backup()
    write_books(clean)
    log_action("import", f"{len(clean)} books")
    return jsonify({"count": len(clean)})


@app.get("/api/export")
def export_books():
    return jsonify(read_books())


ensure_storage()
threading.Thread(target=backup_worker, daemon=True).start()

if __name__ == "__main__":
    app.run(debug=True)
