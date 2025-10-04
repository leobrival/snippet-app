import Database from "@tauri-apps/plugin-sql";
import type { Snippet } from "./types";

let db: Database | null = null;

export async function initDB() {
  if (db) return db;

  db = await Database.load("sqlite:snippets.db");

  await db.execute(`
    CREATE TABLE IF NOT EXISTS snippets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      keyword TEXT NOT NULL,
      name TEXT NOT NULL,
      text TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  return db;
}

export async function getSnippets(): Promise<Snippet[]> {
  const database = await initDB();
  const result = await database.select<Snippet[]>(
    "SELECT * FROM snippets ORDER BY updated_at DESC"
  );
  return result.map(s => ({ ...s, active: Boolean(s.active) }));
}

export async function createSnippet(snippet: Omit<Snippet, "id" | "created_at" | "updated_at">): Promise<void> {
  const database = await initDB();
  await database.execute(
    "INSERT INTO snippets (keyword, name, text, active) VALUES (?, ?, ?, ?)",
    [snippet.keyword, snippet.name, snippet.text, snippet.active ? 1 : 0]
  );
}

export async function updateSnippet(id: number, snippet: Partial<Snippet>): Promise<void> {
  const database = await initDB();
  const fields: string[] = [];
  const values: any[] = [];

  if (snippet.keyword !== undefined) {
    fields.push("keyword = ?");
    values.push(snippet.keyword);
  }
  if (snippet.name !== undefined) {
    fields.push("name = ?");
    values.push(snippet.name);
  }
  if (snippet.text !== undefined) {
    fields.push("text = ?");
    values.push(snippet.text);
  }
  if (snippet.active !== undefined) {
    fields.push("active = ?");
    values.push(snippet.active ? 1 : 0);
  }

  fields.push("updated_at = CURRENT_TIMESTAMP");
  values.push(id);

  await database.execute(
    `UPDATE snippets SET ${fields.join(", ")} WHERE id = ?`,
    values
  );
}

export async function deleteSnippet(id: number): Promise<void> {
  const database = await initDB();
  await database.execute("DELETE FROM snippets WHERE id = ?", [id]);
}
