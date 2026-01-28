"""Change detection and tracking"""

import json
from typing import List, Dict, Any, Optional
from pathlib import Path
from scraper_core.deduplicator import Deduplicator


class ChangeDetector:
    """Detect changes between current and previous scrape runs"""
    
    def __init__(self, snapshot_dir: str = "snapshots"):
        """
        Initialize change detector
        
        Args:
            snapshot_dir: Directory to store snapshots
        """
        self.snapshot_dir = Path(snapshot_dir)
        self.snapshot_dir.mkdir(exist_ok=True)
    
    def save_snapshot(
        self,
        job_id: str,
        data: Dict[str, Any],
        key_fields: Optional[Dict[str, List[str]]] = None
    ) -> Path:
        """
        Save current run as snapshot
        
        Args:
            job_id: Job identifier
            data: Scrape result data
            key_fields: Key fields per data type for ID generation
        
        Returns:
            Path to saved snapshot
        """
        import time
        timestamp = int(time.time())
        snapshot_path = self.snapshot_dir / f"{job_id}_{timestamp}.json"
        
        # Generate IDs for records
        snapshot_data = {
            "timestamp": timestamp,
            "job_id": job_id,
            "data": data,
            "record_ids": {},
        }
        
        if key_fields:
            for data_type, fields in key_fields.items():
                if data_type in data and isinstance(data[data_type], list):
                    snapshot_data["record_ids"][data_type] = [
                        Deduplicator.generate_id(record, fields)
                        for record in data[data_type]
                    ]
        
        with open(snapshot_path, 'w') as f:
            json.dump(snapshot_data, f, indent=2)
        
        return snapshot_path
    
    def load_latest_snapshot(self, job_id: str) -> Optional[Dict[str, Any]]:
        """
        Load most recent snapshot for a job
        
        Args:
            job_id: Job identifier
        
        Returns:
            Snapshot data or None if not found
        """
        snapshots = list(self.snapshot_dir.glob(f"{job_id}_*.json"))
        if not snapshots:
            return None
        
        latest = max(snapshots, key=lambda p: p.stat().st_mtime)
        with open(latest, 'r') as f:
            return json.load(f)
    
    def detect_changes(
        self,
        current: Dict[str, Any],
        previous: Optional[Dict[str, Any]],
        key_fields: Optional[Dict[str, List[str]]] = None
    ) -> Dict[str, Any]:
        """
        Detect new, updated, and removed records
        
        Args:
            current: Current scrape result
            previous: Previous snapshot data
            key_fields: Key fields per data type
        
        Returns:
            Dictionary with 'new', 'updated', 'removed' for each data type
        """
        if not previous:
            return {
                "new": current,
                "updated": {},
                "removed": {},
            }
        
        changes = {
            "new": {},
            "updated": {},
            "removed": {},
        }
        
        if not key_fields:
            key_fields = {
                "products": ["title", "url"],
                "images": ["url"],
                "assets": ["url"],
            }
        
        previous_data = previous.get("data", {})
        previous_ids = previous.get("record_ids", {})
        
        for data_type in ["products", "images", "assets"]:
            if data_type not in current:
                continue
            
            current_records = current[data_type]
            previous_records = previous_data.get(data_type, [])
            
            if data_type not in key_fields:
                continue
            
            fields = key_fields[data_type]
            
            # Generate IDs for current records
            current_ids = {
                Deduplicator.generate_id(r, fields): r
                for r in current_records
            }
            
            # Get previous IDs
            prev_ids_set = set(previous_ids.get(data_type, []))
            if not prev_ids_set:
                # Fallback: generate IDs from previous records
                prev_ids_set = {
                    Deduplicator.generate_id(r, fields)
                    for r in previous_records
                }
            
            current_ids_set = set(current_ids.keys())
            
            # New records
            new_ids = current_ids_set - prev_ids_set
            changes["new"][data_type] = [current_ids[id] for id in new_ids]
            
            # Removed records
            removed_ids = prev_ids_set - current_ids_set
            changes["removed"][data_type] = list(removed_ids)
            
            # Updated records (same ID but different content)
            common_ids = current_ids_set & prev_ids_set
            updated = []
            for record_id in common_ids:
                current_record = current_ids[record_id]
                # Find previous record
                prev_record = next(
                    (r for r in previous_records
                     if Deduplicator.generate_id(r, fields) == record_id),
                    None
                )
                if prev_record:
                    # Compare fingerprints
                    current_fp = Deduplicator.generate_fingerprint(current_record)
                    prev_fp = Deduplicator.generate_fingerprint(prev_record)
                    if current_fp != prev_fp:
                        updated.append({
                            "id": record_id,
                            "previous": prev_record,
                            "current": current_record,
                        })
            changes["updated"][data_type] = updated
        
        return changes
