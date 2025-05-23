const express = require("express");
const fs = require("fs");
const path = require("path");
const { Blockchain } = require("./blockchain");
const cors = require("cors");


const app = express();

app.use(cors({ origin: ["http://localhost:3000", "http://localhost:3001"] }));
const PORT = 4002;

const bc = new Blockchain();
if (typeof bc._loadPending === "function") {
  bc._loadPending();
}

app.use(express.json());

app.get("/chain", (req, res) => {
  res.json(bc.chain);
});
app.get("/pending", (req, res) => {
  res.json(bc.pendingRecords);
});

app.get("/validate", (req, res) => {
  res.json({ valid: bc.isChainValid() });
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
