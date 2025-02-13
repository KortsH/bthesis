// server.js
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const { Blockchain } = require("./blockchain");

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

// Load tracked people from file.
const trackedPeoplePath = path.join(__dirname, "tracked_people.json");
let trackedPeople = {};
if (fs.existsSync(trackedPeoplePath)) {
  trackedPeople = JSON.parse(fs.readFileSync(trackedPeoplePath));
} else {
  console.warn("tracked_people.json not found. Using empty trackedPeople.");
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
          // Check if this tweet is already in the blockchain.
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
            console.log("Added new block from file:", newBlock);
          }
        });
      }
    } catch (err) {
      console.error("Error processing file", filePath, ":", err);
    }
  });
}

// Endpoint to simulate querying a social media post for a tracked user.
app.post("/query", (req, res) => {
  const { platform, username } = req.body;
  console.log(`Query request for ${platform}, username: ${username}`);

  const dummyPost = {
    platform: platform,
    poster: username,
    post_id: "dummy_" + Date.now(),
    content: `This is a dummy post from ${username} on ${platform}.`,
    post_time: new Date().toISOString(),
    tweetUrl: "",
  };

  const block = blockchain.addBlock(dummyPost);
  console.log("Added new block:", block);
  res.json({ success: true, block });
});

// Endpoint for verification (used by the Chrome extension).
// The extension sends { tweetId, content, poster, tweetUrl } and the server checks the blockchain.
app.post("/verify", (req, res) => {
  const { tweetId, content, poster, tweetUrl } = req.body;
  console.log("Received verification request:", {
    tweetId,
    content,
    poster,
    tweetUrl,
  });
  let verified = false;
  let storedTweetUrl = null;

  // console.log("Current blockchain (data fields):");
  // blockchain.chain.forEach((block) => console.log(block.data));

  // Simple verification: check if any block contains the same tweetId.
  for (let block of blockchain.chain) {
    if (block.data && block.data.post_id === tweetId) {
      verified = true;
      storedTweetUrl = block.data.tweetUrl || tweetUrl;
      break;
    }
  }
  console.log("Sending verification response for tweetId", tweetId, ":", {
    verified,
    tweetUrl: storedTweetUrl,
  });
  res.json({ verified, tweetUrl: storedTweetUrl });
});

// Endpoint to retrieve the tracked people.
app.get("/tracked_people", (req, res) => {
  res.json(trackedPeople);
});

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});
