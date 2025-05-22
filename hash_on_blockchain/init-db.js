const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database("./quotes.db");

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS quotes (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      platform   TEXT    NOT NULL,
      poster     TEXT    NOT NULL,
      post_id    TEXT    NOT NULL,
      content    TEXT    NOT NULL,
      post_time  TEXT    NOT NULL,
      tweet_url  TEXT
    )
  `);

  const stmt = db.prepare(`
    INSERT INTO quotes (platform, poster, post_id, content, post_time, tweet_url)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    "twitter",
    "IlvesToomas",
    "1889067788808974404",
    "@chenweihua @ianbremmer @saadmohseni Has nothing to do with the price of electricity, only synchronisation of current frequency.\n\nBut regardless, in the Baltic States, we don't whore.",
    "2025-02-13T14:41:58.536Z",
    "https://twitter.com/IlvesToomas/status/1889067788808974404"
  );
  stmt.run(
    "twitter",
    "elonmusk",
    "1889733204191379930",
    "Federal judges who repeatedly abuse their authority to obstruct the will of the people via their elected representatives should be impeached.",
    "2025-02-13T14:41:58.603Z",
    "https://twitter.com/elonmusk/status/1889733204191379930"
 
  );
  stmt.finalize();
});

db.close(() => {
  console.log("Initialized quotes.db with schema and sample data.");
});
