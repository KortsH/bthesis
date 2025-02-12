const express = require("express");
const cors = require("cors");
const app = express();
const port = 3000;

app.use(cors());

app.use(express.json());

const targetTweetId = "1887211663809782107";

app.post("/verify", (req, res) => {
  const { tweetId, content } = req.body;
  console.log("Received verification request:", tweetId, content);

  let verified = false;
  if (tweetId === targetTweetId) {
    verified = true;
  }

  console.log("Sending verification response for tweetId", tweetId, ":", {
    verified,
  });
  res.json({ verified });
});

app.listen(port, () => {
  console.log(`Verification server listening at http://localhost:${port}`);
});
