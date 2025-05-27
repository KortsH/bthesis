// server.js
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const { Blockchain } = require("./blockchain");
const { exec } = require("child_process");

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());

// Load tracked people from file.
const trackedPeoplePath = path.join(__dirname, "tracked_people.json");
let trackedPeople = {};
if (fs.existsSync(trackedPeoplePath)) {
  trackedPeople = JSON.parse(fs.readFileSync(trackedPeoplePath));
} else {
  // console.warn("tracked_people.json not found. Using empty trackedPeople.");
}

// Initialize blockchain with persistence to blockchain.json.
const blockchainFilePath = path.join(__dirname, "blockchain.json");
const blockchain = new Blockchain(2, blockchainFilePath);

// --- On server startup: check posts folder for any new Twitter posts not yet added ---
const postsFolder = path.join(__dirname, "posts", "twitter");
if (fs.existsSync(postsFolder)) {
  const files = fs.readdirSync(postsFolder);
  files.forEach((file) => {
    const filePath = path.join(postsFolder, file);
    try {
      const postData = JSON.parse(fs.readFileSync(filePath));
      // Expect file names like "twitter_IlvesToomas_20250212-195442.json"
      const parts = file.split("_");
      let posterFromFile = "unknown";
      if (parts.length >= 2) {
        posterFromFile = parts[1];
      }
      if (postData.data && Array.isArray(postData.data)) {
        postData.data.forEach((tweet) => {
          let exists = blockchain.chain.some(
            (block) =>
              block.data &&
              block.data.post_id === tweet.id &&
              block.data.content === tweet.text &&
              block.data.poster.toLowerCase() === posterFromFile.toLowerCase()
          );
          if (!exists) {
            const newData = {
              platform: "twitter",
              poster: posterFromFile,
              post_id: tweet.id,
              content: tweet.text,
              post_time: new Date().toISOString(),
              tweetUrl:
                tweet.url ||
                `https://twitter.com/${posterFromFile}/status/${tweet.id}`,
            };
            const newBlock = blockchain.addBlock(newData);
            // console.log("Added new block from file:", newBlock);
          }
        });
      }
    } catch (err) {
      // console.error("Error processing file", filePath, ":", err);
    }
  });
}

app.post("/verify", (req, res) => {
  const { tweetId, content, poster, tweetUrl } = req.body;
  console.log("Received verification request:", {
    tweetId,
    content,
    poster,
    tweetUrl,
  });

  const input = { tweetId, content, poster, tweetUrl };
  const inputStr = JSON.stringify(input);

  exec(`python3 verify_quote.py '${inputStr}'`, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error executing python script: ${error}`);
      res.status(500).json({ verified: false, error: error.message });
      return;
    }
    if (stderr) {
      console.error(`Python stderr: ${stderr}`);
    }
    try {
      const result = JSON.parse(stdout);
      console.log("Verification result from Python:", result);
      res.json(result);
    } catch (parseErr) {
      res.status(500).json({
        verified: false,
        error: "Invalid response from verification script",
      });
    }
  });
});

// Endpoint to retrieve the tracked people.
app.get("/tracked_people", (req, res) => {
  res.json(trackedPeople);
});

// Endpoint to check the highlighted text
app.post("/verifyHighlighted", (req, res) => {
  const { highlightedText } = req.body;
  console.log("Received highlighted text:", highlightedText);
  const input = { highlightedText };
  const inputStr = JSON.stringify(input);

  exec(`python3 verify_quote.py '${inputStr}'`, (error, stdout, stderr) => {
    if (error) {
      res.status(500).json({ verified: false, error: error.message });
      return;
    }
    if (stderr) {
      console.error(`Python stderr: ${stderr}`);
    }
    try {
      const result = JSON.parse(stdout);
      res.json(result);
    } catch (parseErr) {
      res.status(500).json({
        verified: false,
        error: "Invalid response from verification script",
      });
    }
  });
});

// Endpoint to view the blockchain
app.get("/chain", (req, res) => {
  res.json(blockchain);
});


app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});
