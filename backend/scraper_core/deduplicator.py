"""Deduplication and change tracking utilities"""

import hashlib
import json
from typing import List, Dict, Any, Set, Optional
from pathlib import Path


class Deduplicator:
    """Generate unique IDs and detect duplicates"""
    
    @staticmethod
    def generate_id(record: Dict[str, Any], key_fields: List[str]) -> str:
        """
        Generate unique ID from key fields
        
        Args:
            record: Record dictionary
            key_fields: List of field names to use for ID generation
        
        Returns:
            MD5 hash of key fields
        """
        key_data = {k: record.get(k) for k in key_fields if k in record}
        key_str = json.dumps(key_data, sort_keys=True)
        return hashlib.md5(key_str.encode()).hexdigest()
    
    @staticmethod
    def generate_fingerprint(record: Dict[str, Any]) -> str:
        """
        Generate fingerprint for entire record
        
        Args:
            record: Record dictionary
        
        Returns:
            MD5 hash of entire record
        """
        record_str = json.dumps(record, sort_keys=True)
        return hashlib.md5(record_str.encode()).hexdigest()
    
    @staticmethod
    def deduplicate(
        records: List[Dict[str, Any]],
        key_fields: List[str]
    ) -> List[Dict[str, Any]]:
        """
        Remove duplicate records based on key fields
        
        Args:
            records: List of records
            key_fields: Fields to use for deduplication
        
        Returns:
            Deduplicated list
        """
        seen_ids: Set[str] = set()
        unique_records = []
        
        for record in records:
            record_id = Deduplicator.generate_id(record, key_fields)
            if record_id not in seen_ids:
                seen_ids.add(record_id)
                unique_records.append(record)
        
        return unique_records
