const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const cors = require("cors");
const crypto = require("crypto");
const { Blockchain } = require("./blockchain");

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors({ origin: ["http://localhost:3000", "http://localhost:3001"] }));
app.use(express.json());

const db = new sqlite3.Database("./quotes.db", sqlite3.OPEN_READWRITE);
const chain = new Blockchain(2, "./chain.json");

app.get("/api/quotes", (req, res) => {
  let sql = `
    SELECT id, platform, poster, post_id, content, post_time, tweet_url
    FROM quotes
  `;
  const params = [];
  if (req.query.search) {
    sql += " WHERE content LIKE ?";
    params.push(`%${req.query.search}%`);
  }
  if (req.query.author) {
    sql += params.length ? " AND poster=?" : " WHERE poster=?";
    params.push(req.query.author);
  }
  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post("/api/quotes", (req, res) => {
  const { platform, poster, post_id, content, post_time, tweet_url } = req.body;
  const stmt = db.prepare(`
    INSERT INTO quotes(platform, poster, post_id, content, post_time, tweet_url)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    platform,
    poster,
    post_id,
    content,
    post_time,
    tweet_url,
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      const recordId = this.lastID;

      const fullData = {
        platform,
        poster,
        post_id,
        content,
        post_time,
        tweet_url,
      };
      const commitment = crypto
        .createHash("sha256")
        .update(JSON.stringify(fullData))
        .digest("hex");

      const newBlock = chain.addBlock({ recordId, commitment });
      res.json({ recordId, commitment, block: newBlock });
    }
  );
});

app.get("/api/quotes/:id/proof", (req, res) => {
  const recordId = parseInt(req.params.id, 10);
  const proof = chain.chain.find((b) => b.data.recordId === recordId);
  if (!proof) {
    return res.status(404).json({ error: "No on-chain proof for that ID" });
  }
  db.get("SELECT * FROM quotes WHERE id = ?", [recordId], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: "No such row in DB" });
    res.json({ record: row, proof });
  });
});

app.get("/api/chain", (req, res) => {
  res.json(chain.chain);
});

app.listen(PORT, () => {
  console.log(`🖧 Server listening on http://localhost:${PORT}`);
});
