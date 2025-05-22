const fs = require("fs");
const sqlite3 = require("sqlite3").verbose();
const crypto = require("crypto");
const { Blockchain } = require("./blockchain");

async function main() {
  const rawChain = JSON.parse(fs.readFileSync("./rawChain.json", "utf8"));

  const db = new sqlite3.Database("./quotes.db", sqlite3.OPEN_READWRITE);
  const chain = new Blockchain(2, "./chain.json");

  const getRow = (sql, params) =>
    new Promise((resolve, reject) =>
      db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)))
    );

  const runInsert = (sql, params) =>
    new Promise((resolve, reject) =>
      db.run(sql, params, function (err) {
        if (err) return reject(err);
        resolve(this.lastID);
      })
    );

  for (let i = 1; i < rawChain.length; i++) {
    const block = rawChain[i];
    const { platform, poster, post_id, content, post_time, tweetUrl } =
      block.data;

    const fullData = {
      platform,
      poster,
      post_id,
      content,
      post_time,
      tweet_url: tweetUrl,
    };

    let row = await getRow("SELECT id FROM quotes WHERE post_id = ?", [
      post_id,
    ]);

    let recordId;
    if (row) {
      console.log(
        `↪️  Skipping insert; post_id=${post_id} already at id=${row.id}`
      );
      recordId = row.id;
    } else {
      recordId = await runInsert(
        `INSERT INTO quotes 
          (platform, poster, post_id, content, post_time, tweet_url)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [platform, poster, post_id, content, post_time, tweetUrl]
      );
      console.log(`➕ Inserted post_id=${post_id} as id=${recordId}`);
    }

    const commitment = crypto
      .createHash("sha256")
      .update(JSON.stringify(fullData))
      .digest("hex");

    chain.addBlock({ recordId, commitment });
    console.log(`✅ Committed record ${recordId} → ${commitment}`);
  }

  db.close();
  console.log(
    `\n\n\n Done! Hashed chain now has ${chain.chain.length} blocks (including genesis).`
  );
}

main().catch((err) => {
  console.error("Seeder error:", err);
  process.exit(1);
});
