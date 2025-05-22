const crypto = require("crypto");
const fs = require("fs");

class Block {
  constructor(index, timestamp, data, previousHash = "", nonce = 0) {
    this.index = index;
    this.timestamp = timestamp;
    this.data = data; // e.g. { recordId, commitment }
    this.previousHash = previousHash;
    this.nonce = nonce;
    this.hash = this.computeHash();
  }

  computeHash() {
    const blockContent = JSON.stringify({
      index: this.index,
      timestamp: this.timestamp,
      data: this.data,
      previousHash: this.previousHash,
      nonce: this.nonce,
    });
    return crypto.createHash("sha256").update(blockContent).digest("hex");
  }

  mineBlock(difficulty) {
    const target = Array(difficulty + 1).join("0");
    while (this.hash.substring(0, difficulty) !== target) {
      this.nonce++;
      this.hash = this.computeHash();
    }
    console.log(`Block mined (index ${this.index}): ${this.hash}`);
  }
}

class Blockchain {
  constructor(difficulty = 2, chainFilePath = "./chain.json") {
    this.difficulty = difficulty;
    this.chainFilePath = chainFilePath;
    this.chain = [];
    this.loadChain();
  }

  createGenesisBlock() {
    const genesisBlock = new Block(0, Date.now(), { info: "genesis" }, "0");
    genesisBlock.mineBlock(this.difficulty);
    return genesisBlock;
  }

  loadChain() {
    if (fs.existsSync(this.chainFilePath)) {
      try {
        this.chain = JSON.parse(fs.readFileSync(this.chainFilePath));
      } catch {
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

  addBlock(data) {
    const prev = this.getLatestBlock();
    const newBlock = new Block(prev.index + 1, Date.now(), data, prev.hash);
    newBlock.mineBlock(this.difficulty);
    this.chain.push(newBlock);
    this.saveChain();
    return newBlock;
  }

  isChainValid() {
    for (let i = 1; i < this.chain.length; i++) {
      const current = this.chain[i];
      const previous = this.chain[i - 1];
      const recalculatedHash = crypto
        .createHash("sha256")
        .update(
          JSON.stringify({
            index: current.index,
            timestamp: current.timestamp,
            data: current.data,
            previousHash: current.previousHash,
            nonce: current.nonce,
          })
        )
        .digest("hex");
      if (current.hash !== recalculatedHash) {
        return false;
      }
      if (current.previousHash !== previous.hash) {
        return false;
      }
    }
    return true;
  }
}

module.exports = { Block, Blockchain };
