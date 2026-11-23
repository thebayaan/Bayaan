"""Rewrites a words DB: words.id becomes the INTEGER PRIMARY KEY, rows in id order. The rows do not change."""
import sqlite3, sys
src, dst = sys.argv[1], sys.argv[2]
SCHEMA = ("CREATE TABLE words (id INTEGER PRIMARY KEY, location TEXT, surah INTEGER, "
          "ayah INTEGER, word INTEGER, text TEXT)")
old = sqlite3.connect(f"file:{src}?mode=ro", uri=True)
rows = old.execute("SELECT id, location, surah, ayah, word, text FROM words ORDER BY id").fetchall()
objs = old.execute("SELECT type, name FROM sqlite_master").fetchall()
old.close()
assert objs == [("table", "words")], objs
new = sqlite3.connect(dst)
new.execute("PRAGMA page_size = 4096")
new.execute(SCHEMA)
new.executemany("INSERT INTO words (id, location, surah, ayah, word, text) VALUES (?, ?, ?, ?, ?, ?)", rows)
new.commit()
new.execute("VACUUM")
back = new.execute("SELECT id, location, surah, ayah, word, text FROM words ORDER BY id").fetchall()
new.close()
assert back == rows, "rows differ"
print(f"{len(rows)} rows, same content")
