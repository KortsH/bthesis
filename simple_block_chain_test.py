import hashlib
import json
import time
import unittest
from typing import List, Dict

# =======================================================
# Simulated API Data: Tracked Social Media Users & Posts
# =======================================================
tracked_users = {
    "twitter": {
        "alice": [
            {"post_id": "001", "content": "Hello world!", "post_time": "2025-01-01T10:00:00Z"},
            {"post_id": "002", "content": "Blockchain is awesome!", "post_time": "2025-01-02T11:00:00Z"}
        ],
        "bob": [
            {"post_id": "003", "content": "Python for the win.", "post_time": "2025-01-03T12:00:00Z"}
        ]
    },
    "facebook": {
        "charlie": [
            {"post_id": "101", "content": "Enjoying the sunshine.", "post_time": "2025-01-04T13:00:00Z"}
        ]
    }
}

def verify_social_media_post(platform: str, poster: str, post_id: str, content: str, post_time: str) -> bool:
    """
    Simulate verifying a social media post by checking our tracked_users dictionary.
    In a real implementation, you would query the platform's API.
    """
    platform_data = tracked_users.get(platform.lower())
    if not platform_data:
        print(f"[Verification] Platform '{platform}' not recognized.")
        return False
    user_posts = platform_data.get(poster.lower())
    if not user_posts:
        print(f"[Verification] User '{poster}' not found on {platform}.")
        return False
    for post in user_posts:
        if post["post_id"] == post_id and post["content"] == content and post["post_time"] == post_time:
            return True
    print(f"[Verification] Post ID '{post_id}' for user '{poster}' on {platform} could not be verified.")
    return False

# =======================================================
# Blockchain Implementation
# =======================================================
class Block:
    def __init__(self, index: int, timestamp: float, data: Dict, previous_hash: str, nonce: int = 0):
        self.index = index
        self.timestamp = timestamp
        self.data = data  # Data now holds social media post details.
        self.previous_hash = previous_hash
        self.nonce = nonce
        self.hash = self.compute_hash()

    def compute_hash(self) -> str:
        """
        Compute the SHA-256 hash of the block's content.
        """
        block_content = {
            "index": self.index,
            "timestamp": self.timestamp,
            "data": self.data,
            "previous_hash": self.previous_hash,
            "nonce": self.nonce
        }
        block_string = json.dumps(block_content, sort_keys=True).encode()
        return hashlib.sha256(block_string).hexdigest()

    def mine(self, difficulty: int):
        """
        Simple Proof-of-Work: find a nonce such that the hash starts with a given number of zeros.
        """
        prefix = '0' * difficulty
        while not self.hash.startswith(prefix):
            self.nonce += 1
            self.hash = self.compute_hash()
        print(f"Block mined: Index {self.index}, Nonce {self.nonce}, Hash {self.hash}")

class Blockchain:
    def __init__(self, difficulty: int = 2):
        self.chain: List[Block] = []
        self.difficulty = difficulty
        self.create_genesis_block()

    def create_genesis_block(self):
        """
        Create the genesis block with dummy data.
        """
        genesis_data = {
            "platform": "genesis",
            "poster": "genesis",
            "post_id": "0",
            "content": "Genesis Block",
            "post_time": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        }
        genesis_block = Block(index=0, timestamp=time.time(), data=genesis_data, previous_hash="0")
        genesis_block.mine(self.difficulty)
        self.chain.append(genesis_block)

    def add_block(self, data: Dict) -> bool:
        """
        Create a new block with the provided social media post data and add it to the chain after verifying it.
        Expected data keys: platform, poster, post_id, content, post_time.
        """
        if not verify_social_media_post(
            platform=data.get("platform", ""),
            poster=data.get("poster", ""),
            post_id=data.get("post_id", ""),
            content=data.get("content", ""),
            post_time=data.get("post_time", "")
        ):
            print("[Add Block] Verification failed. Block not added.")
            return False

        previous_block = self.chain[-1]
        new_block = Block(
            index=previous_block.index + 1,
            timestamp=time.time(),
            data=data,
            previous_hash=previous_block.hash
        )
        new_block.mine(self.difficulty)
        self.chain.append(new_block)
        return True

    def is_chain_valid(self) -> bool:
        """
        Verify the integrity of the blockchain by ensuring each block's hash is correct and that the blocks are properly linked.
        """
        for i in range(1, len(self.chain)):
            current = self.chain[i]
            previous = self.chain[i - 1]
            if current.hash != current.compute_hash():
                print(f"Invalid hash at block {current.index}")
                return False
            if current.previous_hash != previous.hash:
                print(f"Invalid previous hash link at block {current.index}")
                return False
        return True

# =======================================================
# Interactive CLI for Real-Time Adding to the Blockchain
# =======================================================
def run_interactive_mode():
    print("Starting Social Media Blockchain...")
    blockchain = Blockchain(difficulty=2)  # Using a lower difficulty for demonstration purposes
    while True:
        print("\nMenu:")
        print("1. Add new social media post to blockchain")
        print("2. Display blockchain")
        print("3. Verify blockchain integrity")
        print("4. Exit")
        choice = input("Enter your choice: ").strip()
        if choice == "1":
            print("\nEnter the social media post details:")
            platform = input("Platform (e.g., twitter, facebook): ").strip()
            poster = input("Poster (username): ").strip()
            post_id = input("Post ID: ").strip()
            content = input("Content: ").strip()
            post_time = input("Post time (ISO format, e.g., 2025-01-01T10:00:00Z): ").strip()
            data = {
                "platform": platform,
                "poster": poster,
                "post_id": post_id,
                "content": content,
                "post_time": post_time
            }
            if blockchain.add_block(data):
                print("Block added successfully!")
            else:
                print("Block addition failed due to verification error.")
        elif choice == "2":
            print("\nCurrent Blockchain:")
            for block in blockchain.chain:
                print(f"Index: {block.index}, Hash: {block.hash}, Data: {block.data}")
        elif choice == "3":
            if blockchain.is_chain_valid():
                print("Blockchain is valid.")
            else:
                print("Blockchain is invalid!")
        elif choice == "4":
            print("Exiting...")
            break
        else:
            print("Invalid choice. Please try again.")

# =======================================================
# Unit Tests for the Social Media Blockchain
# =======================================================
class TestSocialMediaBlockchain(unittest.TestCase):
    def setUp(self):
        self.blockchain = Blockchain(difficulty=1)  # Lower difficulty speeds up testing
        # Add a valid block using data from our simulated tracked_users
        valid_data = {
            "platform": "twitter",
            "poster": "alice",
            "post_id": "001",
            "content": "Hello world!",
            "post_time": "2025-01-01T10:00:00Z"
        }
        self.valid_block_added = self.blockchain.add_block(valid_data)

    def test_valid_block_added(self):
        self.assertTrue(self.valid_block_added)
        self.assertEqual(len(self.blockchain.chain), 2)

    def test_invalid_block_rejected(self):
        # Create a block with invalid data (non-existent post)
        invalid_data = {
            "platform": "twitter",
            "poster": "alice",
            "post_id": "999",  # This post ID does not exist in tracked_users
            "content": "Fake post",
            "post_time": "2025-01-01T10:00:00Z"
        }
        result = self.blockchain.add_block(invalid_data)
        self.assertFalse(result)

    def test_chain_validity(self):
        self.assertTrue(self.blockchain.is_chain_valid())
        # Tamper with a block to test invalidation
        self.blockchain.chain[1].data["content"] = "Tampered content"
        self.assertFalse(self.blockchain.is_chain_valid())

# =======================================================
# Main entry point: run tests or interactive mode
# =======================================================
if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1 and sys.argv[1] == "test":
        print("=== Running Unit Tests ===")
        unittest.main(argv=['first-arg-is-ignored'], exit=False)
    else:
        run_interactive_mode()
