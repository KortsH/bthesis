#!/usr/bin/env python3
import sys
import json
import os
import re
from sentence_transformers import SentenceTransformer, util

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
BLOCKCHAIN_PATH = os.path.join(BASE_DIR, "blockchain.json")
TRACKED_PEOPLE_PATH = os.path.join(BASE_DIR, "tracked_people.json")

def load_json(filename):
    with open(filename, "r", encoding="utf-8") as f:
        return json.load(f)

blockchain = load_json(BLOCKCHAIN_PATH)
tracked_people = load_json(TRACKED_PEOPLE_PATH)

model = SentenceTransformer('all-MiniLM-L6-v2')

def clean_text(text):
    text = text.replace("✅ Verified", "")
    lines = text.split("\n")
    cleaned = "\n".join(line for line in lines if not re.fullmatch(r'\s*\d+\s*', line))
    return cleaned.strip()

def extract_quote_info(content):
    content_clean = clean_text(content)
    tracked_twitter = tracked_people.get("twitter", {})

    for canonical, aliases in tracked_twitter.items():
        for alias in aliases:
            if alias.lower() in content_clean.lower():
                pattern = re.compile(re.escape(alias), re.IGNORECASE)
                quoted_text = pattern.sub("", content_clean, count=1).strip()
                quoted_text = re.sub(r'^(?:said\s+(?:that\s+)?[:]?[\s]*)', "", quoted_text, flags=re.IGNORECASE)
                return {"quotedPoster": canonical, "quotedText": quoted_text}
    return None

def verify_quote(input_data):
    tweetId = input_data.get("tweetId")
    content = input_data.get("content") or input_data.get("highlightedText", "")
    
    result = {
        "tweetId": tweetId,
        "verified": False,
        "matches": []  # Each match: {tweetId, similarity, tweetUrl, content}
    }
    
    quote_info = extract_quote_info(content)
    if not quote_info:
        result["error"] = "No tracked quote found in content."
        return result

    result["extractedQuoteInfo"] = quote_info
    identified_poster = quote_info.get("quotedPoster")
    if not identified_poster:
        result["error"] = "Could not identify quoted poster."
        return result
    result["identifiedPoster"] = identified_poster

    candidates = []
    for block in blockchain:
        data = block.get("data", {})
        if (data.get("platform", "").lower() == "twitter" and 
            data.get("poster", "").lower() == identified_poster.lower()):
            candidates.append(data)
    if not candidates:
        result["error"] = f"No original tweets found for poster {identified_poster} in blockchain."
        return result

    original_texts = [cand.get("content", "") for cand in candidates]
    candidate_embeddings = model.encode(original_texts, convert_to_tensor=True)
    
    quote_embedding = model.encode(quote_info["quotedText"], convert_to_tensor=True)
    
    cosine_scores = util.cos_sim(candidate_embeddings, quote_embedding).squeeze(1)
    cosine_scores = cosine_scores.cpu().tolist()  # Convert to list of floats.
    
    SIM_THRESHOLD = 0.70  # Only consider matches with similarity >= 0.70.
    matches = []
    for idx, score in enumerate(cosine_scores):
        if score >= SIM_THRESHOLD:
            matches.append({
                "tweetId": candidates[idx].get("post_id"),
                "similarity": score,
                "tweetUrl": candidates[idx].get("tweetUrl"),
                "content": candidates[idx].get("content")
            })
    
    if matches:
        matches.sort(key=lambda x: x["similarity"], reverse=True)
        result["matches"] = matches
        if matches[0]["similarity"] >= 0.75:
            result["verified"] = True
    return result

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No input provided"}))
        sys.exit(1)
    try:
        input_str = sys.argv[1]
        input_data = json.loads(input_str)
    except Exception as e:
        print(json.dumps({"error": "Invalid input JSON", "exception": str(e)}))
        sys.exit(1)
    result = verify_quote(input_data)
    print(json.dumps(result))

if __name__ == "__main__":
    main()
