(function () {
  if (window.__socialVerifierInitialized) return;
  window.__socialVerifierInitialized = true;

  function detectPlatform() {
    const host = window.location.hostname;
    if (host.includes("twitter.com") || host.includes("x.com")) {
      return "Twitter";
    } else if (host.includes("bsky.app")) {
      return "BlueSky";
    } else if (host.includes("truthsocial.com")) {
      return "TruthSocial";
    }
    return "Unknown";
  }

  const platform = detectPlatform();
  console.log("Social Media Verifier: Detected platform: " + platform);

  function addVerificationBadge(postElement, text, linksInfo) {
    if (postElement.querySelector(".custom-verification")) return;
    const badge = document.createElement("span");
    badge.innerText = text;
    badge.className = "custom-verification";
    if (linksInfo && Array.isArray(linksInfo) && linksInfo.length > 0) {
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
    if (link && link.href) {
      const regex = /\/status\/(\d+)/;
      const match = link.href.match(regex);
      if (match && match[1]) {
        return match[1];
      }
    }
    return null;
  }

  function processTweet(articleElement) {
    if (articleElement.getAttribute("data-verified-checked") === "true") return;
    const tweetId = extractTweetId(articleElement);
    if (!tweetId) return;
    console.log("Found tweet ID:", tweetId);
    const tweetContent = articleElement.innerText;
    console.log("Sending request for tweet ID:", tweetId);
    fetch("http://localhost:3000/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tweetId, content: tweetContent }),
    })
      .then((response) => {
        console.log("Received response for tweet ID:", tweetId);
        return response.json();
      })
      .then((data) => {
        console.log("Backend response for tweet ID " + tweetId + ":", data);
        if (data.verified && data.matches && data.matches.length > 0) {
          addVerificationBadge(articleElement, "✅ Verified", data.matches);
          console.log(
            "Social Media Verifier: Quote verified for tweet ID " + tweetId
          );
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
      console.log("Keydown event:", e);
      if (e.key === "H" && e.altKey) {
        const rawHighlightedText = window.getSelection().toString().trim();
        const highlightedText = rawHighlightedText
          .replace(/✅\s*Verified[\s\S]*/g, "")
          .trim();
        console.log("Detected keybind. Highlighted text:", highlightedText);
        if (highlightedText) {
          fetch("http://localhost:3000/verifyHighlighted", {
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
              alert("Error sending highlighted text: " + err);
            });
        } else {
          console.log("No text highlighted.");
          alert("No text highlighted.");
        }
      }
    },
    true
  );
})();
