# Aurora Bookshelf

A polished web version of the original JSON bookshelf project.

## Included functionality

- Add, edit and delete books
- Search by title, author or tag
- Alphabetical library sorting (title, then newest year)
- Tagging and tag browser
- Online book discovery through Google Books
- Dashboard statistics
- Activity log
- JSON export/import
- Manual backups
- Automatic local backups every 5 minutes, keeping the newest 20 snapshots
- Responsive dark/light visual theme
- Local file storage using `books.json`

## Run

1. Install Python 3.10+.
2. Open a terminal in this folder.
3. Install dependencies:

```bash
pip install -r requirements.txt
```

4. Start:

```bash
python app.py
```

5. Open the address shown by Flask, normally `http://127.0.0.1:5000`.

## Data files

- `books.json` — your collection
- `log.txt` — recent actions
- `data/` — automatic backup snapshots

The UI keeps the data local to your machine; Google Books is only used for online discovery.
