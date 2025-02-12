#!/usr/bin/env python3
import hashlib
import json
import time
import unittest
from typing import List

# ========================
# Blockchain Implementation
# ========================

class Block:
    def __init__(self, index: int, timestamp: float, data: str, previous_hash: str, nonce: int = 0):
        self.index = index
        self.timestamp = timestamp
        self.data = data
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
        assert difficulty >= 0, "Difficulty must be non-negative"
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
        Manually construct the genesis block.
        """
        genesis_block = Block(index=0, timestamp=time.time(), data="Genesis Block", previous_hash="0")
        genesis_block.mine(self.difficulty)
        self.chain.append(genesis_block)
    
    def add_block(self, data: str):
        """
        Create a new block with the provided data and add it to the chain after mining.
        """
        previous_block = self.chain[-1]
        new_block = Block(
            index=previous_block.index + 1,
            timestamp=time.time(),
            data=data,
            previous_hash=previous_block.hash
        )
        new_block.mine(self.difficulty)
        self.chain.append(new_block)
    
    def is_chain_valid(self) -> bool:
        """
        Verify the integrity of the blockchain by ensuring each block's hash is correct and matches the previous block.
        """
        for i in range(1, len(self.chain)):
            current = self.chain[i]
            previous = self.chain[i - 1]
            # Recompute the hash and compare
            if current.hash != current.compute_hash():
                print(f"Invalid hash at block {current.index}")
                return False
            if current.previous_hash != previous.hash:
                print(f"Invalid previous hash link at block {current.index}")
                return False
        return True

# ========================
# Testing Skeleton using unittest
# ========================

class TestBlockchain(unittest.TestCase):
    
    def setUp(self):
        # Initialize blockchain with a low difficulty for faster tests
        self.blockchain = Blockchain(difficulty=2)
    
    def test_genesis_block(self):
        self.assertEqual(len(self.blockchain.chain), 1)
        self.assertEqual(self.blockchain.chain[0].data, "Genesis Block")
    
    def test_add_block_and_validity(self):
        self.blockchain.add_block("Test Block 1")
        self.blockchain.add_block("Test Block 2")
        self.assertEqual(len(self.blockchain.chain), 3)
        self.assertTrue(self.blockchain.is_chain_valid())
    
    def test_chain_tampering(self):
        self.blockchain.add_block("Test Block")
        # Tamper with the block's data
        self.blockchain.chain[1].data = "Tampered Data"
        self.assertFalse(self.blockchain.is_chain_valid())

# ========================
# Main Function for Manual Testing
# ========================

def main():
    print("=== Running Manual Blockchain Demo ===")
    blockchain = Blockchain(difficulty=3)
    blockchain.add_block("Block 1 Data")
    blockchain.add_block("Block 2 Data")
    
    print("\nBlockchain:")
    for block in blockchain.chain:
        print(f"Index: {block.index}, Hash: {block.hash}, Data: {block.data}")
    
    print("\nChain valid?", blockchain.is_chain_valid())

if __name__ == "__main__":
    # Run manual demo:
    main()
    
    # Optionally, run the unit tests:
    print("\n=== Running Unit Tests ===")
    unittest.main(argv=['first-arg-is-ignored'], exit=False)
