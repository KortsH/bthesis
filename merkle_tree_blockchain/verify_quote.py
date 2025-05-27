import sys
import os
import json
import re
import sqlite3
from sentence_transformers import SentenceTransformer, util

BASE_DIR     = os.path.dirname(os.path.abspath(__file__))
DB_PATH      = os.path.join(BASE_DIR, "quotes.db")
TRACKED_PATH = os.path.join(BASE_DIR, "tracked_people.json")

with open(TRACKED_PATH, "r", encoding="utf-8") as f:
    tracked_map = json.load(f).get("twitter", {})

conn  = sqlite3.connect(DB_PATH, check_same_thread=False)
model = SentenceTransformer("all-MiniLM-L6-v2")

def clean_text(text: str) -> str:
    text = text.replace("✅ Verified", "")
    lines = text.splitlines()
    return "\n".join(line for line in lines if not re.fullmatch(r"\s*\d+\s*", line)).strip()

def extract_quote_info(content: str):
    text = clean_text(content)
    for canonical, aliases in tracked_map.items():
        for alias in aliases:
            if alias.lower() in text.lower():
                pat = re.compile(re.escape(alias), re.IGNORECASE)
                remainder = pat.sub("", text, count=1).strip()
                quoted = re.sub(r'^(?:said\s+(?:that\s+)?[:]?[\s]*)', 
                                "", remainder, flags=re.IGNORECASE)
                return {"quotedPoster": canonical, "quotedText": quoted}
    return None



def verify_quote(input_data):
    content = input_data.get("content") or input_data.get("highlightedText", "")
    tweetId = input_data.get("tweetId")

    result = {
        "tweetId": tweetId,
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
    cur.execute("""
        SELECT post_id, content, tweet_url
            FROM quotes
        WHERE lower(poster)=?
    """, (poster.lower(),))
    rows = cur.fetchall()
    if not rows:
        result["error"] = f"No original tweets for poster '{poster}'."
        return result

    candidates = [
        {"post_id": r[0], "content": r[1], "tweetUrl": r[2]}
        for r in rows
    ]
    texts = [c["content"] for c in candidates]

    cand_emb = model.encode(texts, convert_to_tensor=True)
    quote_emb = model.encode(quote_info["quotedText"], convert_to_tensor=True)
    sims     = util.cos_sim(cand_emb, quote_emb).squeeze(1).cpu().tolist()

    SIM_THRESHOLD = 0.70
    for idx, score in enumerate(sims):
        if score >= SIM_THRESHOLD:
            matches = result.setdefault("matches", [])
            matches.append({
                "tweetId":    candidates[idx]["post_id"],
                "similarity": score,
                "tweetUrl":   candidates[idx]["tweetUrl"],
                "content":    candidates[idx]["content"]
            })

    if result["matches"] and result["matches"][0]["similarity"] >= 0.75:
        result["verified"] = True

    return result


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No input provided"}))
        sys.exit(1)

    try:
        data = json.loads(sys.argv[1])
    except Exception as e:
        print(json.dumps({"error": "Invalid JSON", "exception": str(e)}))
        sys.exit(1)

    output = verify_quote(data)
    print(json.dumps(output))


if __name__ == "__main__":
    main()
