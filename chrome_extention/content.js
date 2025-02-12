(function () {
  if (window.__socialVerifierInitialized) return;
  window.__socialVerifierInitialized = true;

  const verifiedPosts = [
    "1887211663809782107",
  ];

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

  // // Function to extract a tweet ID from an article element.
  // function extractTweetId(articleElement) {
  //   // Look for an anchor element whose href contains "/status/"
  //   const link = articleElement.querySelector('a[href*="/status/"]');
  //   if (link && link.href) {
  //     // For example: "https://twitter.com/username/status/1887211663809782107"
  //     const regex = /\/status\/(\d+)/;
  //     const match = link.href.match(regex);
  //     if (match && match[1]) {
  //       return match[1];
  //     }
  //   }
  //   return null;
  // }

  // Function to process a single tweet element.
  function processTweet(articleElement) {
    // const tweetId = extractTweetId(articleElement);
    // if (tweetId) {
      console.log("Found tweet ID:", tweetId);
      if (verifiedPosts.includes(tweetId)) {
        addVerificationBadge(articleElement, "✅ Verified");
        alert("Social Media Verifier: Found verified tweet with ID " + tweetId);
      }
    // }
  }

  function processAllTweets() {
    const tweets = document.querySelectorAll("article");
    tweets.forEach((article) => {
      processTweet(article);
    });
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
