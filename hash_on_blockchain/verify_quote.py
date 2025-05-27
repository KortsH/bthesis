import sys
import json
import os
import re
import sqlite3
from sentence_transformers import SentenceTransformer, util

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "quotes.db")
TRACKED_PATH = os.path.join(BASE_DIR, "tracked_people.json")

with open(TRACKED_PATH, "r", encoding="utf-8") as f:
    tracked_people = json.load(f).get("twitter", {})

conn  = sqlite3.connect(DB_PATH, check_same_thread=False)
model = SentenceTransformer("all-MiniLM-L6-v2")

def clean_text(text: str) -> str:
    text = text.replace("✅ Verified", "")
    lines = text.split("\n")
    cleaned = "\n".join(line for line in lines if not re.fullmatch(r"\s*\d+\s*", line))
    return cleaned.strip()

def extract_quote_info(content: str):
    content_clean = clean_text(content)
    for canonical, aliases in tracked_people.items():
        for alias in aliases:
            if alias.lower() in content_clean.lower():
                pat = re.compile(re.escape(alias), re.IGNORECASE)
                quoted = pat.sub("", content_clean, count=1).strip()
                quoted = re.sub(
                    r'^(?:said\s+(?:that\s+)?[:]?[\s]*)',
                    "",
                    quoted,
                    flags=re.IGNORECASE
                ).strip()
                return {"quotedPoster": canonical, "quotedText": quoted}
    return None

def verify_quote(input_data):
    content = input_data.get("content") or input_data.get("highlightedText", "")
    tweet_id = input_data.get("tweetId")
    result = {
        "tweetId": tweet_id,
        "verified": False,
        "matches": []
    }

    quote_info = extract_quote_info(content)
    if not quote_info:
        result["error"] = "No tracked quote found in content."
        return result

    result["extractedQuoteInfo"] = quote_info
    poster = quote_info["quotedPoster"]
    result["identifiedPoster"] = poster

    cur = conn.cursor()
    cur.execute(
        "SELECT post_id, content, tweet_url FROM quotes WHERE lower(poster)=?",
        (poster.lower(),)
    )
    rows = cur.fetchall()
    if not rows:
        result["error"] = f"No original tweets found in DB for poster '{poster}'."
        return result

    candidates = [
        {"post_id": r[0], "content": r[1], "tweetUrl": r[2]} for r in rows
    ]

    texts = [c["content"] for c in candidates]
    embs  = model.encode(texts, convert_to_tensor=True)
    q_emb = model.encode(quote_info["quotedText"], convert_to_tensor=True)

    scores = util.cos_sim(embs, q_emb).squeeze(1).cpu().tolist()

    THRESH = 0.70
    for idx, sim in enumerate(scores):
        if sim >= THRESH:
            result["matches"].append({
                "tweetId":    candidates[idx]["post_id"],
                "similarity": sim,
                "tweetUrl":   candidates[idx]["tweetUrl"],
                "content":    candidates[idx]["content"]
            })

    if result["matches"] and result["matches"][0]["similarity"] >= 0.75:
        result["verified"] = True

    return result

def main():
    if len(sys.argv) != 2:
        print(json.dumps({"error": "Expected one JSON argument"}))
        sys.exit(1)

    try:
        input_data = json.loads(sys.argv[1])
    except Exception as e:
        print(json.dumps({"error": "Invalid input JSON", "exception": str(e)}))
        sys.exit(1)

    out = verify_quote(input_data)
    print(json.dumps(out))


if __name__ == "__main__":
    main()
