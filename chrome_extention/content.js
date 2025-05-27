(function () {
  if (window.__socialVerifierInitialized) return;
  window.__socialVerifierInitialized = true;

  const portMap = {
    raw: 3001,
    hashed: 4001,
    merkle: 4002,
  };

  let serverPort = 3001;

  chrome.storage.sync.get("mode", (data) => {
    const mode = data.mode || "raw";
    serverPort = portMap[mode] || 3001;
    console.log("Selected blockchain mode:", mode, "| Using port:", serverPort);
    initVerifier();
  });

  function initVerifier() {
    const platform = detectPlatform();
    // console.log("Social Media Verifier: Detected platform:", platform);

    if (platform === "Twitter") {
      processAllTweets();
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              if (node.matches("article")) {
                processTweet(node);
              } else {
                const articles = node.querySelectorAll("article");
                articles.forEach((article) => processTweet(article));
              }
            }
          });
        });
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }

    document.addEventListener(
      "keydown",
      function (e) {
        if (e.key === "H" && e.altKey) {
          const rawHighlightedText = window.getSelection().toString().trim();
          const highlightedText = rawHighlightedText
            .replace(/✅\s*Verified[\s\S]*/g, "")
            .trim();
          if (highlightedText) {
            fetch(`http://localhost:${serverPort}/verifyHighlighted`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ highlightedText }),
            })
              .then((response) => response.json())
              .then((data) => {
                console.log("Server response for highlighted text:", data);
                alert("Verification result:\n" + JSON.stringify(data, null, 2));
              })
              .catch((err) => {
                console.error("Error sending highlighted text:", err);
                alert("Error: " + err);
              });
          } else {
            alert("No text highlighted.");
          }
        }
      },
      true
    );
  }

  function detectPlatform() {
    const host = window.location.hostname;
    if (host.includes("twitter.com") || host.includes("x.com"))
      return "Twitter";
    if (host.includes("bsky.app")) return "BlueSky";
    if (host.includes("truthsocial.com")) return "TruthSocial";
    return "Unknown";
  }

  function addVerificationBadge(postElement, text, linksInfo) {
    if (postElement.querySelector(".custom-verification")) return;
    const badge = document.createElement("span");
    badge.innerText = text;
    badge.className = "custom-verification";

    if (Array.isArray(linksInfo) && linksInfo.length > 0) {
      const list = document.createElement("ul");
      linksInfo.forEach((item) => {
        const li = document.createElement("li");
        const a = document.createElement("a");
        a.href = item.tweetUrl;
        a.target = "_blank";
        a.innerText = `${item.tweetId} (${(item.similarity * 100).toFixed(
          1
        )}%)`;
        li.appendChild(a);
        list.appendChild(li);
      });
      badge.appendChild(list);
    }

    postElement.appendChild(badge);
  }

  function extractTweetId(articleElement) {
    const link = articleElement.querySelector('a[href*="/status/"]');
    const match = link?.href?.match(/\/status\/(\d+)/);
    return match ? match[1] : null;
  }

  function processTweet(articleElement) {
    if (articleElement.getAttribute("data-verified-checked") === "true") return;
    const tweetId = extractTweetId(articleElement);
    if (!tweetId) return;

    const tweetContent = articleElement.innerText;

    fetch(`http://localhost:${serverPort}/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tweetId, content: tweetContent }),
    })
      .then((response) => response.json())
      .then((data) => {
        if (
          data.verified &&
          Array.isArray(data.matches) &&
          data.matches.length > 0
        ) {
          addVerificationBadge(articleElement, "✅ Verified", data.matches);
        }
        articleElement.setAttribute("data-verified-checked", "true");
      })
      .catch((err) => {
        console.error("Verification error for tweet ID " + tweetId + ":", err);
        articleElement.setAttribute("data-verified-checked", "true");
      });
  }

  function processAllTweets() {
    const tweets = document.querySelectorAll("article");
    tweets.forEach((article) => processTweet(article));
  }
})();
