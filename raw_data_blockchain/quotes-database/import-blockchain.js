const sqlite3 = require("sqlite3").verbose();
const fs = require("fs");

const raw = fs.readFileSync("./blockchain.json", "utf8");
const chain = JSON.parse(raw);

const dbFile = "./quotes.db";
const db = new sqlite3.Database(dbFile);

db.serialize(() => {
  db.run("DROP TABLE IF EXISTS quotes");
  db.run(`
    CREATE TABLE quotes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      platform TEXT NOT NULL,
      poster TEXT NOT NULL,
      post_id TEXT NOT NULL,
      content TEXT NOT NULL,
      post_time TEXT NOT NULL,
      tweet_url TEXT
    )
  `);

  const stmt = db.prepare(
    `INSERT INTO quotes (platform, poster, post_id, content, post_time, tweet_url)
     VALUES (?, ?, ?, ?, ?, ?)`
  );

  chain.forEach((block) => {
    const { platform, poster, post_id, content, post_time, tweetUrl } =
      block.data;
    stmt.run(platform, poster, post_id, content, post_time, tweetUrl || null);
  });

  stmt.finalize(() => {
    console.log(`Imported ${chain.length} records into 'quotes' table.`);
    db.close();
  });
});
