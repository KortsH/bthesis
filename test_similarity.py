#!/usr/bin/env python3
import json
import os
import re
from sentence_transformers import SentenceTransformer, util

# Load a pre‑trained Sentence‑BERT model.
model = SentenceTransformer('all-MiniLM-L6-v2')

# Helper function to load a JSON file.
def load_json(filename):
    with open(filename, "r", encoding="utf-8") as f:
        return json.load(f)

# Define file paths (adjust as needed)
TEST_INPUTS_PATH = os.path.join(os.getcwd(), "testing_inputs.json")
BLOCKCHAIN_PATH = os.path.join(os.getcwd(), "blockchain.json")
TRACKED_PEOPLE_PATH = os.path.join(os.getcwd(), "tracked_people.json")

# Load the testing inputs, blockchain, and tracked people.
testing_inputs = load_json(TEST_INPUTS_PATH)
blockchain = load_json(BLOCKCHAIN_PATH)
tracked_people = load_json(TRACKED_PEOPLE_PATH)

# --- Quote Extraction ---
# This function attempts to extract quote information from the text.
def extract_quote_info(content):
    content = content.strip()
    # Split content into nonempty lines.
    lines = [line.strip() for line in content.split("\n") if line.strip()]
    # Pattern 1: Look for "Name:" or "Name said:" followed by the quote.
    pattern1 = re.compile(r'^([\w\s]+?)(?::| said(?: that)?[:]?)\s*(.+)$', re.IGNORECASE)
    for line in lines:
        match = pattern1.match(line)
        if match and len(match.groups()) == 2:
            return {
                "quotedPoster": match.group(1).strip(),
                "quotedText": match.group(2).strip()
            }
    # Pattern 2: Look for a line ending with a hyphen and a name (e.g. "quote - Name")
    pattern2 = re.compile(r'(.+)[-–]\s*([\w\s]+)$')
    for line in lines:
        match = pattern2.match(line)
        if match and len(match.groups()) == 2:
            return {
                "quotedPoster": match.group(2).strip(),
                "quotedText": match.group(1).strip()
            }
    return None

# --- Identify Tracked Twitter Account ---
# Given the extracted quotedPoster string, check against our tracked people.
# We assume tracked_people["twitter"] is an object mapping canonical handle to list of alternatives.
def identify_tracked_twitter(quotedPoster, tracked_twitter):
    quotedPoster_lower = quotedPoster.lower()
    for canonical, alternatives in tracked_twitter.items():
        for alt in alternatives:
            if alt.lower() in quotedPoster_lower:
                return canonical
    return None

# --- Settings ---
SIMILARITY_THRESHOLD = 0.75  # Adjust threshold as needed

print("=== Testing Quote Verification with Sentence‑BERT ===\n")
for test in testing_inputs:
    tweet_id = test.get("id", "unknown")
    tweet_text = test.get("text", "")
    print(f"\nTesting tweet ID: {tweet_id}")
    print("Tweet text:")
    print(tweet_text)
    
    # Attempt to extract quote info.
    quote_info = extract_quote_info(tweet_text)
    if not quote_info:
        print("→ No quote pattern detected in text.")
        continue
    print("Extracted quote info:")
    print(quote_info)
    
    # For Twitter, use the tracked_people.twitter object.
    # (It should be an object mapping canonical handle to a list of alternative names.)
    tracked_twitter = tracked_people.get("twitter", {})
    identified_poster = identify_tracked_twitter(quote_info["quotedPoster"], tracked_twitter)
    if not identified_poster:
        print(f"→ Quoted poster '{quote_info['quotedPoster']}' not found in tracked people.")
        continue
    print(f"Identified quoted poster as: {identified_poster}")
    
    best_similarity = 0.0
    best_match = None
    # Search the blockchain for original tweets from the identified poster.
    for block in blockchain:
        data = block.get("data", {})
        if (data.get("platform", "").lower() == "twitter" and 
            data.get("poster", "").lower() == identified_poster.lower()):
            original_text = data.get("content", "")
            # Compute cosine similarity between the original tweet's content and the extracted quote text.
            emb_orig = model.encode(original_text, convert_to_tensor=True)
            emb_quote = model.encode(quote_info["quotedText"], convert_to_tensor=True)
            similarity = util.pytorch_cos_sim(emb_orig, emb_quote).item()
            print(f"Similarity with original tweet (ID {data.get('post_id')}): {similarity:.4f}")
            if similarity > best_similarity:
                best_similarity = similarity
                best_match = data
    if best_similarity >= SIMILARITY_THRESHOLD and best_match:
        print(f"→ Quote verified! Best similarity: {best_similarity:.4f}")
        print("Matching original tweet from blockchain:")
        print(f"  Poster: {best_match.get('poster')}")
        print(f"  Tweet ID: {best_match.get('post_id')}")
        print(f"  Content: {best_match.get('content')}")
        print(f"  URL: {best_match.get('tweetUrl')}")
    else:
        print(f"→ Best similarity {best_similarity:.4f} is below threshold {SIMILARITY_THRESHOLD}. Quote not verified.")
