"""YAML config loader with environment variable support"""

import yaml
import os
from pathlib import Path
from typing import Dict, Any, Optional, List
import logging

logger = logging.getLogger(__name__)


class ConfigLoader:
    """Load and manage job configurations"""
    
    @staticmethod
    def load_job_config(job_name: str, config_dir: str = "scraper_jobs") -> Dict[str, Any]:
        """
        Load job configuration from YAML file
        
        Args:
            job_name: Name of the job (directory name)
            config_dir: Base directory for job configs
        
        Returns:
            Configuration dictionary
        
        Raises:
            FileNotFoundError: If config file doesn't exist
        """
        config_path = Path(config_dir) / job_name / "config.yaml"
        
        if not config_path.exists():
            raise FileNotFoundError(f"Config not found: {config_path}")
        
        with open(config_path, 'r') as f:
            config = yaml.safe_load(f) or {}
        
        # Override with environment variables
        env_prefix = f"{job_name.upper()}_"
        for key, value in os.environ.items():
            if key.startswith(env_prefix):
                config_key = key[len(env_prefix):].lower()
                # Try to parse as appropriate type
                if value.lower() in ('true', 'false'):
                    config[config_key] = value.lower() == 'true'
                elif value.isdigit():
                    config[config_key] = int(value)
                else:
                    try:
                        config[config_key] = float(value)
                    except ValueError:
                        config[config_key] = value
        
        return config
    
    @staticmethod
    def list_jobs(config_dir: str = "scraper_jobs") -> List[str]:
        """
        List available job names
        
        Args:
            config_dir: Base directory for job configs
        
        Returns:
            List of job names
        """
        jobs_dir = Path(config_dir)
        if not jobs_dir.exists():
            return []
        
        jobs = []
        for item in jobs_dir.iterdir():
            if item.is_dir() and (item / "config.yaml").exists():
                jobs.append(item.name)
        
        return sorted(jobs)
    
    @staticmethod
    def validate_config(config: Dict[str, Any]) -> tuple[bool, Optional[str]]:
        """
        Validate configuration structure
        
        Args:
            config: Configuration dictionary
        
        Returns:
            Tuple of (is_valid, error_message)
        """
        required_fields = ['name', 'url']
        
        for field in required_fields:
            if field not in config:
                return False, f"Missing required field: {field}"
        
        if 'modules' in config and not isinstance(config['modules'], list):
            return False, "modules must be a list"
        
        return True, None
