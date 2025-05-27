const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const cors = require("cors");
const crypto = require("crypto");
const { Blockchain } = require("./blockchain");

const { exec } = require("child_process");

const app = express();
const PORT = 4001;

app.use(cors()); 
app.use(express.json());

const db = new sqlite3.Database("./quotes.db", sqlite3.OPEN_READWRITE);
const chain = new Blockchain(2, "./chain.json");

app.get("/quotes", (req, res) => {
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

// app.post("/quotes", (req, res) => {
//   const { platform, poster, post_id, content, post_time, tweet_url } = req.body;
//   const stmt = db.prepare(`
//     INSERT INTO quotes(platform, poster, post_id, content, post_time, tweet_url)
//     VALUES (?, ?, ?, ?, ?, ?)
//   `);
//   stmt.run(
//     platform,
//     poster,
//     post_id,
//     content,
//     post_time,
//     tweet_url,
//     function (err) {
//       if (err) return res.status(500).json({ error: err.message });
//       const recordId = this.lastID;

//       const fullData = {
//         platform,
//         poster,
//         post_id,
//         content,
//         post_time,
//         tweet_url,
//       };
//       const commitment = crypto
//         .createHash("sha256")
//         .update(JSON.stringify(fullData))
//         .digest("hex");

//       const newBlock = chain.addBlock({ recordId, commitment });
//       res.json({ recordId, commitment, block: newBlock });
//     }
//   );
// });

app.get("/chain", (req, res) => {
  res.json(chain.chain);
});

app.post("/verify", (req, res) => {
  console.log("→ /verify (hashed) called:", req.body);
  const { tweetId, content } = req.body;

  // build exactly what your python script expects
  const input = { tweetId, content };
  const inputStr = JSON.stringify(input);

  // shell out to your Sentence-BERT verifier
  exec(
    `python3 verify_quote.py '${inputStr.replace(/'/g, "\\'")}'`,
    (error, stdout, stderr) => {
      if (error) {
        console.error("Python error:", error);
        return res.status(500).json({ verified: false, error: error.message });
      }
      if (stderr) console.warn("Python stderr:", stderr);

      try {
        const result = JSON.parse(stdout);
        console.log("→ Python result:", result);
        res.json(result);
      } catch (e) {
        console.error("Invalid JSON from Python:", stdout);
        res
          .status(500)
          .json({ verified: false, error: "Bad JSON from verifier" });
      }
    }
  );
});

// And likewise for highlight‐only:
app.post("/verifyHighlighted", (req, res) => {
  console.log("→ /verifyHighlighted called:", req.body);
  const input = { highlightedText: req.body.highlightedText };
  const inputStr = JSON.stringify(input);

  exec(
    `python3 verify_quote.py '${inputStr.replace(/'/g, "\\'")}'`,
    (error, stdout, stderr) => {
      if (error) {
        console.error("Python error:", error);
        return res.status(500).json({ verified: false, error: error.message });
      }
      if (stderr) console.warn("Python stderr:", stderr);

      try {
        const result = JSON.parse(stdout);
        res.json(result);
      } catch {
        res
          .status(500)
          .json({ verified: false, error: "Bad JSON from verifier" });
      }
    }
  );
});


app.post("/verifyHighlighted", (req, res) => {
  const { highlightedText } = req.body;

  const sql = `
    SELECT
      id   AS recordId,
      platform,
      poster,
      post_id,
      content,
      post_time,
      tweet_url
    FROM quotes
    WHERE content LIKE ?
  `;
  db.all(sql, [`%${highlightedText}%`], (err, rows) => {
    if (err) {
      return res.status(500).json({ verified: false, error: err.message });
    }
    if (!rows.length) {
      return res.json({ verified: false, matches: [] });
    }

    const results = rows.map((row) => {
      const fullData = {
        platform: row.platform,
        poster: row.poster,
        post_id: row.post_id,
        content: row.content,
        post_time: row.post_time,
        tweetUrl: row.tweet_url,
      };
      const commitment = crypto
        .createHash("sha256")
        .update(JSON.stringify(fullData))
        .digest("hex");

      const found = chain.chain.find(
        (blk) => blk.data.commitment === commitment
      );
      return {
        recordId: row.recordId,
        commitment: commitment,
        blockIndex: found ? found.index : null,
      };
    });

    const matches = results.filter((r) => r.blockIndex !== null);
    res.json({
      verified: matches.length > 0,
      matches: matches,
    });
  });
});

app.listen(PORT, () => {
  console.log(`🖧 Server listening on http://localhost:${PORT}`);
});
