const express = require("express");
const cors = require("cors");
const { exec } = require("child_process");
const { Blockchain } = require("./blockchain");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 4002;
const bc = new Blockchain();
if (typeof bc._loadPending === "function") bc._loadPending();

app.post("/verify", (req, res) => {
  console.log("Received verification request:", req.body);
  const { tweetId, content } = req.body;
  const inputStr = JSON.stringify({ tweetId, content }).replace(/'/g, "\\'");

  exec(`python3 verify_quote.py '${inputStr}'`, (error, stdout, stderr) => {
    if (error) {
      console.error("Python error:", error);
      return res.status(500).json({ verified: false, error: error.message });
    }
    if (stderr) console.warn("Python stderr:", stderr);

    try {
      const result = JSON.parse(stdout);
      return res.json(result);
    } catch (e) {
      console.error("Bad JSON from python:", stdout);
      return res
        .status(500)
        .json({ verified: false, error: "Bad JSON from verifier" });
    }
  });
});

app.post("/verifyHighlighted", (req, res) => {
  const inputStr = JSON.stringify({
    highlightedText: req.body.highlightedText,
  }).replace(/'/g, "\\'");

  exec(`python3 verify_quote.py '${inputStr}'`, (error, stdout, stderr) => {
    if (error) {
      console.error("Python error:", error);
      return res.status(500).json({ verified: false, error: error.message });
    }
    if (stderr) console.warn("Python stderr:", stderr);

    try {
      const result = JSON.parse(stdout);
      return res.json(result);
    } catch {
      return res
        .status(500)
        .json({ verified: false, error: "Bad JSON from verifier" });
    }
  });
});

app.post("/proof", (req, res) => {
  const { recordId } = req.body;

  for (let block of bc.chain) {
    const idx = block.records.findIndex((r) => r.recordId === recordId);
    if (idx >= 0) {
      const proof = block.merkleTree.getProof(idx);
      return res.json({
        blockIndex: block.index,
        merkleRoot: block.merkleRoot,
        proof,
      });
    }
  }

  res.status(404).json({ error: `recordId ${recordId} not in any block` });
});

app.get("/chain", (req, res) => res.json(bc.chain));
app.get("/pending", (req, res) => res.json(bc.pendingRecords));
app.get("/validate", (req, res) => res.json({ valid: bc.isChainValid() }));

app.listen(PORT, () => {
  console.log(`🖧 Merkle server listening on http://localhost:${PORT}`);
});
