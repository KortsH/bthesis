// blockchain.js
const crypto = require("crypto");
const fs = require("fs");

class Block {
  constructor(index, timestamp, data, previousHash = "", nonce = 0) {
    this.index = index;
    this.timestamp = timestamp;
    this.data = data; // Expected keys: platform, poster, post_id, content, post_time, tweetUrl
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
  constructor(difficulty = 2, chainFilePath = "./blockchain.json") {
    this.difficulty = difficulty;
    this.chainFilePath = chainFilePath;
    this.chain = [];
    this.loadChain();
  }

  createGenesisBlock() {
    const genesisData = {
      platform: "genesis",
      poster: "genesis",
      post_id: "0",
      content: "Genesis Block",
      post_time: new Date().toISOString(),
    };
    const genesisBlock = new Block(0, Date.now(), genesisData, "0");
    genesisBlock.mineBlock(this.difficulty);
    return genesisBlock;
  }

  loadChain() {
    if (fs.existsSync(this.chainFilePath)) {
      try {
        const data = fs.readFileSync(this.chainFilePath);
        this.chain = JSON.parse(data);
      } catch (err) {
        console.error("Error loading blockchain from file:", err);
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

  addBlock(newData) {
    const previousBlock = this.getLatestBlock();
    const newBlock = new Block(
      previousBlock.index + 1,
      Date.now(),
      newData,
      previousBlock.hash
    );
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
