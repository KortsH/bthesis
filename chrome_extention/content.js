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
    console.log("Social Media Verifier: Detected platform:", platform);

    if (platform === "Twitter") {
      processAllTweets();
      startPollingTweets();

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
        if (e.key === "h" && e.altKey) {
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

  function startPollingTweets() {
    let delay = 1_000;
    const maxDelay = 32_000;

    (function tick() {
      console.log("Polling for new tweets...");
      processAllTweets();
      delay = Math.min(delay * 2, maxDelay);
      setTimeout(tick, delay);
    })();
  }

  function detectPlatform() {
    const host = window.location.hostname;
    if (host.includes("twitter.com") || host.includes("x.com"))
      return "Twitter";
    if (host.includes("localhost")) {
      console.log("Detected LOCALHOST environment");
      return "Twitter";
    }
    if (document.querySelector('article[role="article"] a[href*="/status/"]')) {
      console.log("Detected DEMO PAGE Twitter article structure");
      return "Twitter";
    }
    if (host.includes("bsky.app")) return "BlueSky";
    if (host.includes("truthsocial.com")) return "TruthSocial";
    return "Unknown";
  }

  function addVerificationBadge(
    postElement,
    text,
    linksInfo,
    identifiedPoster
  ) {
    if (postElement.querySelector(".custom-verification")) return;

    const badge = document.createElement("div");
    badge.className = "custom-verification";

    const textSpan = document.createElement("span");
    textSpan.className = "custom-verification-text";
    textSpan.innerText = text;
    badge.appendChild(textSpan);

    badge.appendChild(document.createElement("br"));

    if (identifiedPoster) {
      const posterSpan = document.createElement("span");
      posterSpan.className = "custom-identified-poster";
      posterSpan.innerText = `Identified Poster: ${identifiedPoster}`;
      badge.appendChild(posterSpan);
    }

    if (Array.isArray(linksInfo) && linksInfo.length > 0) {
      const list = document.createElement("ul");
      list.className = "custom-links-list";
      linksInfo.forEach((item) => {
        const li = document.createElement("li");
        const a = document.createElement("a");
        a.href = item.tweetUrl;
        a.target = "_blank";
        a.innerText = `Similarity: (${(item.similarity * 100).toFixed(
          1
        )}%)\n Post ID (and link to it): ${item.tweetId}`;
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
    console.log("Processing tweet:", articleElement);
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
          console.log("HERE Verification successful for tweet ID:", tweetId, data);
          addVerificationBadge(articleElement, "✅ Verified", data.matches, data.identifiedPoster);
        }
        articleElement.setAttribute("data-verified-checked", "true");
      })
      .catch((err) => {
        console.error("Verification error for tweet ID " + tweetId + ":", err);
        articleElement.setAttribute("data-verified-checked", "true");
      });
  }

  function processAllTweets() {
    document
      .querySelectorAll('iframe[src*="platform.twitter.com/embed/"]')
      .forEach((ifr) => {
        if (ifr.dataset.verifiedChecked) return;
        const tweetId =
          ifr.dataset.tweetId || (ifr.src.match(/[?&]id=(\d+)/) || [])[1];
        if (!tweetId) return;

        const tweetContent = ifr.contentDocument ? ifr.contentDocument.body.innerText : "";
        fetch(`http://localhost:${serverPort}/verify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tweetId, content: tweetContent }),
        })
          .then((r) => r.json())
          .then((data) => {
            if (data.verified && data.matches.length) {
              const postEl = ifr.closest("blockquote,article,div");
              postEl &&
                addVerificationBadge(postEl, "✅ Verified", data.matches);
            }
            ifr.dataset.verifiedChecked = "true";
          })
          .catch((err) => {
            console.error("verify error for", tweetId, err);
            ifr.dataset.verifiedChecked = "true";
          });
      });

    document.querySelectorAll("article").forEach((a) => processTweet(a));
  }

})();
