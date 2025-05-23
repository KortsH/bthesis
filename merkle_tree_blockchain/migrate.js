
const fs = require("fs");
const crypto = require("crypto");
const path = require("path");
const { Blockchain } = require("./blockchain");

const oldChainPath = path.resolve(__dirname, "rawChain.json");
if (!fs.existsSync(oldChainPath)) {
  console.error(`⚠️  Cannot find ${oldChainPath}`);
  process.exit(1);
}
const oldChain = JSON.parse(fs.readFileSync(oldChainPath, "utf8"));

const records = oldChain.slice(1).map((block) => {
  const d = block.data;
  const recordId = d.post_id;
  const commitment = crypto
    .createHash("sha256")
    .update(JSON.stringify(d))
    .digest("hex");
  return { recordId, commitment };
});

const newChainFile = path.resolve(__dirname, "chain.json");
const bc = new Blockchain(
  2, 
  newChainFile, 
  16
);

bc.chain = [bc.createGenesisBlock()];

for (const rec of records) {
  const mined = bc.addRecord(rec);
  if (mined) {
    console.log(`Mined block #${mined.index} (16 records)`);
  }
}

console.log("pendingRecords", bc.pendingRecords.length);
bc.savePending();

const originalPersist = bc._persistPending;
bc._persistPending = () => {};

const last = bc.flushPending();
if (last) {
  console.log(
    `🔃  Flushed final block #${last.index} (${last.records.length} records)`
  );
}

bc._persistPending = originalPersist;

bc.saveChain();

bc.saveChain();
console.log(`Migration complete – new chain written to ${newChainFile}`);
