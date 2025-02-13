#!/usr/bin/env python3
"""
Social Media Query CLI

This script queries posts from:
  1. X (Twitter) – using the Twitter API v2
  2. Blue Sky – using the atproto Python package
  3. Truth Social – using the Truthbrush CLI
  4. Facebook – using the Facebook Graph API
  5. Threads – (placeholder; no official API yet)
  6. Exit

The queried posts are saved as JSON files in platform‐specific subdirectories under a “posts” folder.
"""

from dotenv import load_dotenv
load_dotenv()

import os
import json
import time
import requests
import subprocess

# Import atproto for Blue Sky queries.
try:
    import atproto
except ImportError:
    print("The 'atproto' package is not installed. Install it via 'pip install atproto'")
    exit(1)

# ------------------------------
# Setup directory structure for saving posts.
# ------------------------------
BASE_POSTS_DIR = os.path.join(os.getcwd(), "posts")
PLATFORM_FOLDERS = {
    "twitter": os.path.join(BASE_POSTS_DIR, "twitter"),
    "blue_sky": os.path.join(BASE_POSTS_DIR, "blue_sky"),
    "truth_social": os.path.join(BASE_POSTS_DIR, "truth_social"),
    "facebook": os.path.join(BASE_POSTS_DIR, "facebook"),
    "threads": os.path.join(BASE_POSTS_DIR, "threads"),
}
for folder in PLATFORM_FOLDERS.values():
    os.makedirs(folder, exist_ok=True)

# ------------------------------
# Helper Function: Parse NDJSON
# ------------------------------
def parse_ndjson(output: str) -> list:
    posts = []
    for line in output.strip().splitlines():
        if line.strip():
            try:
                obj = json.loads(line)
                posts.append(obj)
            except json.JSONDecodeError as e:
                print("Error decoding line:", line, e)
    return posts

# ------------------------------
# X (Twitter) Query Functions
# ------------------------------
def query_x_posts(username: str) -> dict:
    bearer_token = os.getenv("TWITTER_AUTH_BEARER_TOKEN")
    if not bearer_token:
        print("Error: TWITTER_AUTH_BEARER_TOKEN environment variable not set.")
        return {}
    headers = {"Authorization": f"Bearer {bearer_token}"}

    url_user = f"https://api.twitter.com/2/users/by/username/{username}"
    user_resp = requests.get(url_user, headers=headers)
    if user_resp.status_code != 200:
        print("Error retrieving user data:", user_resp.text)
        return {}
    user_data = user_resp.json().get("data", {})
    user_id = user_data.get("id")
    if not user_id:
        print("User ID not found.")
        return {}

    url_tweets = f"https://api.twitter.com/2/users/{user_id}/tweets"
    tweets_resp = requests.get(url_tweets, headers=headers)
    if tweets_resp.status_code != 200:
        print("Error retrieving tweets:", tweets_resp.text)
        return {}
    return tweets_resp.json()

# ------------------------------
# Blue Sky Query Functions
# ------------------------------
def query_bluesky_posts(handle: str) -> dict:
    """
    Query posts from a Blue Sky user.
    Resolves the handle to a DID and then lists recent posts.
    """
    try:
        client = atproto.Client()  # No login required for public read endpoints.
        actor = None
        try:
            actor = client.com.atproto.identity.resolveHandle({"handle": handle})
        except Exception as e:
            print("resolveHandle failed, trying resolve_handle:", e)
            actor = client.com.atproto.identity.resolve_handle({"handle": handle})
        if not actor or "did" not in actor:
            print("Unable to resolve Blue Sky handle for:", handle)
            return {}
        did = actor["did"]
        records = client.com.atproto.repo.listRecords({
            "repo": did,
            "collection": "app.bsky.feed.post",
            "limit": 10
        })
        return records
    except Exception as e:
        print("Error querying Blue Sky posts:", e)
        return {}

# ------------------------------
# Truth Social Query Functions
# ------------------------------
def query_truthsocial_posts(handle: str) -> dict:
    """
    Query posts from Truth Social for the given handle.
    Calls the Truthbrush CLI and parses its output.
    """
    try:
        result = subprocess.run(["truthbrush", "statuses", handle],
                                capture_output=True, text=True)
        if result.returncode != 0:
            print("Error querying Truth Social posts:", result.stderr)
            return {}
        raw_output = result.stdout
        if raw_output.lstrip().startswith("<!DOCTYPE html>"):
            print("Received HTML response (likely rate-limited or access denied) from Truth Social.")
            return {}
        try:
            parsed = json.loads(raw_output)
        except json.JSONDecodeError:
            parsed = parse_ndjson(raw_output)
        if isinstance(parsed, list):
            return {"posts": parsed}
        else:
            return parsed
    except Exception as e:
        print("Error executing truthbrush command:", e)
        return {}

# ------------------------------
# Facebook Query Functions
# ------------------------------
def query_facebook_posts(page_id: str) -> dict:
    fb_token = os.getenv("FACEBOOK_ACCESS_TOKEN")
    if not fb_token:
        print("Error: FACEBOOK_ACCESS_TOKEN environment variable not set.")
        return {}
    url = f"https://graph.facebook.com/v11.0/{page_id}/posts?access_token={fb_token}"
    resp = requests.get(url)
    if resp.status_code != 200:
        print("Error retrieving Facebook posts:", resp.text)
        return {}
    return resp.json()

# ------------------------------
# Threads Query Functions (Placeholder)
# ------------------------------
def query_threads_posts(username: str) -> dict:
    print("Threads API is not yet implemented.")
    return {}

# ------------------------------
# Helper: Save Posts to File (in platform-specific folder)
# ------------------------------
def save_posts_to_file(platform: str, handle: str, posts: dict):
    timestamp = time.strftime("%Y%m%d-%H%M%S")
    folder = PLATFORM_FOLDERS.get(platform.lower(), BASE_POSTS_DIR)
    filename = os.path.join(folder, f"{handle}_{timestamp}.json")
    try:
        with open(filename, "w") as outfile:
            json.dump(posts, outfile, indent=2)
        print(f"Posts saved to file: {filename}")
    except Exception as e:
        print("Error saving posts to file:", e)

# ------------------------------
# CLI Menu (Continuous Loop)
# ------------------------------
def main():
    while True:
        print("\nSocial Media Query CLI")
        print("=======================")
        print("Select a platform to query posts:")
        print("1. X (Twitter)")
        print("2. Blue Sky")
        print("3. Truth Social")
        print("4. Facebook")
        print("5. Threads")
        print("6. Exit")
        choice = input("Enter choice (1/2/3/4/5/6): ").strip()

        if choice == "1":
            username = input("Enter the X username (without @): ").strip()
            print(f"\nQuerying X posts for '{username}'...")
            posts = query_x_posts(username)
            if posts:
                print("Posts from X:")
                print(json.dumps(posts, indent=2))
            save_posts_to_file("twitter", username, posts)
        elif choice == "2":
            handle = input("Enter the Blue Sky handle (e.g., user.bsky.social): ").strip()
            print(f"\nQuerying Blue Sky posts for '{handle}'...")
            posts = query_bluesky_posts(handle)
            if posts:
                print("Posts from Blue Sky:")
                print(json.dumps(posts, indent=2))
            save_posts_to_file("blue_sky", handle, posts)
        elif choice == "3":
            handle = input("Enter the Truth Social handle: ").strip()
            print(f"\nQuerying Truth Social posts for '{handle}'...")
            posts = query_truthsocial_posts(handle)
            print("Posts from Truth Social:")
            print(json.dumps(posts, indent=2))
            save_posts_to_file("truth_social", handle, posts)
        elif choice == "4":
            page_id = input("Enter the Facebook page ID (or username): ").strip()
            print(f"\nQuerying Facebook posts for '{page_id}'...")
            posts = query_facebook_posts(page_id)
            if posts:
                print("Posts from Facebook:")
                print(json.dumps(posts, indent=2))
            save_posts_to_file("facebook", page_id, posts)
        elif choice == "5":
            username = input("Enter the Threads username: ").strip()
            print(f"\nQuerying Threads posts for '{username}'...")
            posts = query_threads_posts(username)
            if posts:
                print("Posts from Threads:")
                print(json.dumps(posts, indent=2))
            save_posts_to_file("threads", username, posts)
        elif choice == "6":
            print("Exiting...")
            break
        else:
            print("Invalid choice. Please select a valid option.")

if __name__ == "__main__":
    main()
