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
    lines = text.split("\n")
    cleaned = "\n".join(line for line in lines if not re.fullmatch(r'\s*\d+\s*', line))
    return cleaned.strip()

def extract_quote_info(content):
    content = clean_text(content)
    lines = [line.strip() for line in content.split("\n") if line.strip()]
    # Pattern 1: e.g. "Name: "quote text"" or "Name said: "quote text""
    pattern1 = re.compile(r'^([\w\s]+?)(?::| said(?: that)?[:]?)\s*"(.+)"$', re.IGNORECASE)
    for line in lines:
        match = pattern1.match(line)
        if match and len(match.groups()) == 2:
            return {
                "quotedPoster": match.group(1).strip(),
                "quotedText": match.group(2).strip()
            }

    pattern2 = re.compile(r'^(.+)[-–]\s*([\w\s]+)$')
    for line in lines:
        match = pattern2.match(line)
        if match and len(match.groups()) == 2:
            return {
                "quotedPoster": match.group(2).strip(),
                "quotedText": match.group(1).strip()
            }
    return None

def identify_tracked_twitter(quotedPoster, tracked_twitter):
    quoted_lower = quotedPoster.lower()
    for canonical, aliases in tracked_twitter.items():
        for alias in aliases:
            if alias.lower() in quoted_lower:
                return canonical
    return None



def verify_quote(input_data):
    tweetId = input_data.get("tweetId")
    content = input_data.get("content", "")
    # poster = input_data.get("poster")
    # tweetUrl = input_data.get("tweetUrl")
    
    result = {
        "tweetId": tweetId,
        "verified": False,
        "matches": []  # Each match: {tweetId, similarity, tweetUrl, content}
    }
    
    quote_info = extract_quote_info(content)
    if not quote_info:
        result["error"] = "No quote pattern detected in content."
        return result
    
    tracked_twitter = tracked_people.get("twitter", {})
    identified_poster = identify_tracked_twitter(quote_info["quotedPoster"], tracked_twitter)
    if not identified_poster:
        result["error"] = f"Quoted poster '{quote_info['quotedPoster']}' not found in tracked people."
        return result
    result["identifiedPoster"] = identified_poster
    
    matches = []
    for block in blockchain:
        data = block.get("data", {})
        if (data.get("platform", "").lower() == "twitter" and 
            data.get("poster", "").lower() == identified_poster.lower()):
            original_text = data.get("content", "")
            emb_orig = model.encode(original_text, convert_to_tensor=True)
            emb_quote = model.encode(quote_info["quotedText"], convert_to_tensor=True)
            similarity = util.pytorch_cos_sim(emb_orig, emb_quote).item()
            if similarity >= 0.70: 
                matches.append({
                    "tweetId": data.get("post_id"),
                    "similarity": similarity,
                    "tweetUrl": data.get("tweetUrl"),
                    "content": data.get("content")
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
