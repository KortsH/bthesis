const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database("./quotes.db");

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS quotes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      text TEXT NOT NULL,
      author TEXT NOT NULL
    )
  `);

  const stmt = db.prepare("INSERT INTO quotes (text, author) VALUES (?, ?)");
  stmt.run("To be, or not to be, that is the question.", "William Shakespeare");
  stmt.run("I think, therefore I am.", "René Descartes");
  stmt.finalize();
});

db.close();
console.log("Initialized quotes.db with sample data.");
