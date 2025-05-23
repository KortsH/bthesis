const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

class MerkleTree {
  constructor(leaves) {
    this.leaves = leaves.map((data) => MerkleTree.hash(data));
    this.layers = [this.leaves];
    this.buildTree();
  }

  static hash(data) {
    return crypto
      .createHash("sha256")
      .update(typeof data === "string" ? data : JSON.stringify(data))
      .digest("hex");
  }

  buildTree() {
    let current = this.leaves;
    while (current.length > 1) {
      const next = [];
      for (let i = 0; i < current.length; i += 2) {
        const left = current[i];
        const right = i + 1 < current.length ? current[i + 1] : left;
        next.push(MerkleTree.hash(left + right));
      }
      this.layers.push(next);
      current = next;
    }
  }

  get root() {
    const last = this.layers[this.layers.length - 1];
    return last.length > 0 ? last[0] : null;
  }

  getProof(leafIndex) {
    if (leafIndex < 0 || leafIndex >= this.leaves.length) return null;
    const proof = [];
    for (let i = 0; i < this.layers.length - 1; i++) {
      const layer = this.layers[i];
      const isRightNode = leafIndex % 2;
      const pairIndex = isRightNode ? leafIndex - 1 : leafIndex + 1;
      const sibling = layer[pairIndex] || layer[leafIndex];
      proof.push({ position: isRightNode ? "left" : "right", data: sibling });
      leafIndex = Math.floor(leafIndex / 2);
    }
    return proof;
  }
}

class Block {
  constructor(index, timestamp, records, previousHash = "", nonce = 0) {
    this.index = index;
    this.timestamp = timestamp;
    this.records = records;
    this.previousHash = previousHash;
    this.nonce = nonce;

    this.merkleTree = new MerkleTree(records.map((r) => r.commitment));
    this.merkleRoot = this.merkleTree.root;

    this.hash = this.computeHash();
  }

  computeHash() {
    const header = {
      index: this.index,
      timestamp: this.timestamp,
      merkleRoot: this.merkleRoot,
      previousHash: this.previousHash,
      nonce: this.nonce,
    };
    return crypto
      .createHash("sha256")
      .update(JSON.stringify(header))
      .digest("hex");
  }

  mineBlock(difficulty) {
    const target = "0".repeat(difficulty);
    while (this.hash.substring(0, difficulty) !== target) {
      this.nonce++;
      this.hash = this.computeHash();
    }
    console.log(`Block mined (idx ${this.index}): ${this.hash}`);
  }
}

const PENDING_PATH = path.resolve("./pending.json");

class Blockchain {
  constructor(
    difficulty = 2,
    chainFilePath = "./chain.json",
    maxRecordsPerBlock = 16
  ) {
    this.difficulty = difficulty;
    this.chainFilePath = path.resolve(chainFilePath);
    this.maxRecordsPerBlock = maxRecordsPerBlock;

    this.chain = [];
    this.pendingRecords = [];

    this.loadChain();
  }

  createGenesisBlock() {
    const genesis = new Block(0, Date.now(), [], "0");
    genesis.mineBlock(this.difficulty);
    return genesis;
  }

  _loadPending() {
    if (fs.existsSync(PENDING_PATH)) {
      try {
        this.pendingRecords = JSON.parse(fs.readFileSync(PENDING_PATH));
      } catch (err) {
        console.warn("Could not parse pending.json, resetting buffer:", err);
        this.pendingRecords = [];
        fs.unlinkSync(PENDING_PATH);
      }
    }
  }

  _persistPending() {
    fs.writeFileSync(
      PENDING_PATH,
      JSON.stringify(this.pendingRecords, null, 2)
    );
  }

  loadChain() {
    if (fs.existsSync(this.chainFilePath)) {
      try {
        const raw = fs.readFileSync(this.chainFilePath);
        const parsed = JSON.parse(raw);
        this.chain = parsed.map((b) => {
          const block = new Block(
            b.index,
            b.timestamp,
            b.records,
            b.previousHash,
            b.nonce
          );
          block.hash = b.hash;
          block.merkleRoot = b.merkleRoot;
          block.merkleTree = new MerkleTree(
            block.records.map((r) => r.commitment)
          );
          return block;
        });
      } catch (err) {
        console.error("Failed to load chain, recreating genesis:", err);
        this.chain = [this.createGenesisBlock()];
        this.saveChain();
      }
    } else {
      this.chain = [this.createGenesisBlock()];
      this.saveChain();
    }
  }

  saveChain() {
    fs.writeFileSync(this.chainFilePath, JSON.stringify(this.chain, null, 2));
  }

  getLatestBlock() {
    return this.chain[this.chain.length - 1];
  }

  savePending(filePath = PENDING_PATH) {
    fs.writeFileSync(
      path.resolve(filePath),
      JSON.stringify(this.pendingRecords, null, 2)
    );
  }

  addRecord(record) {
    this.pendingRecords.push(record);
    this._persistPending();
    this.savePending();
    if (this.pendingRecords.length >= this.maxRecordsPerBlock) {
      return this._minePendingBlock();
    }
    return null;
  }

  flushPending() {
    if (this.pendingRecords.length === 0) return null;
    return this._minePendingBlock();
  }

  _minePendingBlock() {
    const toMine = this.pendingRecords.splice(0, this.maxRecordsPerBlock);
    const prev = this.getLatestBlock();
    const block = new Block(prev.index + 1, Date.now(), toMine, prev.hash);
    block.mineBlock(this.difficulty);
    this.chain.push(block);
    this.saveChain();
    this._persistPending();
    return block;
  }

  isChainValid() {
    for (let i = 1; i < this.chain.length; i++) {
      const curr = this.chain[i];
      const prev = this.chain[i - 1];

      if (curr.previousHash !== prev.hash) return false;

      const merkleCheck = new MerkleTree(curr.records.map((r) => r.commitment))
        .root;
      if (curr.merkleRoot !== merkleCheck) return false;

      if (curr.hash !== curr.computeHash()) return false;
    }
    return true;
  }
}

module.exports = { MerkleTree, Block, Blockchain };
