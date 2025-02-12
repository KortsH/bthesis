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
  alert("Social Media Verifier: You are on " + platform + "!");

  function addVerificationBadge(postElement, text) {
    if (postElement.querySelector(".custom-verification")) return;
    const badge = document.createElement("span");
    badge.innerText = text;
    badge.className = "custom-verification";
    postElement.appendChild(badge);
  }

  function extractTweetId(articleElement) {
    const link = articleElement.querySelector('a[href*="/status/"]');
    if (link && link.href) {
      // Example href: "https://twitter.com/username/status/1887211663809782107"
      const regex = /\/status\/(\d+)/;
      const match = link.href.match(regex);
      if (match && match[1]) {
        return match[1];
      }
    }
    return null;
  }

  function processTweet(articleElement) {
    // Check if this element was already processed.
    if (articleElement.getAttribute("data-verified-checked") === "true") return;

    const tweetId = extractTweetId(articleElement);
    if (!tweetId) return;
    console.log("Found tweet ID:", tweetId);

    const tweetContent = articleElement.innerText;
    console.log("Sending request for tweet ID:", tweetId);

    fetch("http://localhost:3000/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tweetId: tweetId, content: tweetContent }),
    })
      .then((response) => {
        console.log("Received response for tweet ID:", tweetId);
        return response.json();
      })
      .then((data) => {
        console.log("Backend response for tweet ID " + tweetId + ":", data);
        if (data.verified) {
          addVerificationBadge(articleElement, "✅ Verified");
          alert(
            "Social Media Verifier: Found verified tweet with ID " + tweetId
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

})();
