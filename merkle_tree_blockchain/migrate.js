const fs = require("fs");
const crypto = require("crypto");
const path = require("path");
const { Blockchain } = require("./blockchain");

const QUOTES_API = "http://localhost:4001/quotes";
const NEW_CHAIN_PATH = path.resolve(__dirname, "chain.json");
const PENDING_PATH = path.resolve(__dirname, "pending.json");

const DIFFICULTY = 2;
const MAX_RECORDS = 16;

async function migrate() {
  console.log("Fetching all quotes from API...");
  const res = await fetch(QUOTES_API);
  if (!res.ok) {
    console.error(`Failed to fetch quotes: ${res.status} ${res.statusText}`);
    process.exit(1);
  }
  const quotes = await res.json();
  console.log(`Retrieved ${quotes.length} quotes.`);

  const bc = new Blockchain(DIFFICULTY, NEW_CHAIN_PATH, MAX_RECORDS);
  bc.chain = [bc.createGenesisBlock()];

  console.log("Building commitment records...");
  const records = quotes.map((q) => {
    const data = {
      platform: q.platform,
      poster: q.poster,
      post_id: q.post_id,
      content: q.content,
      post_time: q.post_time,
      tweet_url: q.tweet_url,
    };
    const commitment = crypto
      .createHash("sha256")
      .update(JSON.stringify(data))
      .digest("hex");
    return { recordId: String(q.post_id), commitment };
  });

  console.log("⛓️  Adding records to blockchain...");
  for (const rec of records) {
    const mined = bc.addRecord(rec);
    if (mined) {
      console.log(
        `Mined block #${mined.index} (${mined.records.length} records)`
      );
    }
  }

  console.log(`${bc.pendingRecords.length} records remain pending.`);

  bc.saveChain();
  bc.savePending();
  console.log(`Migration complete!
  New chain written to ${NEW_CHAIN_PATH}
  Pending buffer written to ${PENDING_PATH} (${bc.pendingRecords.length} records)`);
}

migrate().catch((err) => {
  console.error("Migration error:", err);
  process.exit(1);
});
