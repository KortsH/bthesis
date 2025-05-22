// index.js
const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 4000;

app.use(
  cors({
    origin: ["http://localhost:3000", "http://localhost:3001"],
  })
);

app.use(express.json());

const db = new sqlite3.Database("./quotes.db", sqlite3.OPEN_READONLY);

app.get("/api/quotes", (req, res) => {
  let sql = `
    SELECT
      id,
      platform,
      poster,
      post_id,
      content,
      post_time,
      tweet_url
    FROM quotes
  `;
  const params = [];

  if (req.query.search) {
    sql += " WHERE content LIKE ?";
    params.push(`%${req.query.search}%`);
  }

  if (req.query.author) {
    sql += params.length ? " AND poster = ?" : " WHERE poster = ?";
    params.push(req.query.author);
  }

  db.all(sql, params, (err, rows) => {
    if (err) {
      console.error("DB error:", err.message);
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

app.listen(PORT, () => {
  console.log(`Quotes API listening on http://localhost:${PORT}`);
});
