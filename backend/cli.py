"""CLI runner for scraping jobs"""

import click
import asyncio
import sys
import logging
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from scraper_core.fetcher import Fetcher, FetchConfig
from scraper_core.extractor import (
    ProductExtractor, ContactExtractor, ImageExtractor, TextExtractor, AssetExtractor
)
from scraper_core.normalizer import Normalizer
from scraper_core.validator import Validator
from scraper_core.output import OutputWriter
from scraper_core.logger import setup_logger
from scraper_core.compliance import ComplianceChecker
from config.loader import ConfigLoader


@click.group()
def cli():
    """Scraper CLI"""
    pass


@cli.command()
@click.argument('job_name')
@click.option('--output-dir', default='./output', help='Output directory')
@click.option('--dry-run', is_flag=True, help='Validate without executing')
@click.option('--resume', is_flag=True, help='Resume from last success')
def run(job_name: str, output_dir: str, dry_run: bool, resume: bool):
    """Run a scraping job"""
    try:
        config = ConfigLoader.load_job_config(job_name)
        
        if dry_run:
            is_valid, error = ConfigLoader.validate_config(config)
            if is_valid:
                click.echo(f"✓ Config valid for {job_name}")
            else:
                click.echo(f"✗ Config invalid: {error}")
                sys.exit(1)
            return
        
        # Setup logger
        logger = setup_logger(job_name)
        logger.info(f"Starting job: {job_name}")
        
        # Setup output directory
        output_path = Path(output_dir)
        output_path.mkdir(exist_ok=True)
        
        # Run job
        asyncio.run(execute_job(config, job_name, output_path, logger, resume))
        
        click.echo(f"✓ Job completed: {job_name}")
    
    except FileNotFoundError as e:
        click.echo(f"✗ Error: {e}", err=True)
        sys.exit(1)
    except Exception as e:
        click.echo(f"✗ Error: {e}", err=True)
        sys.exit(1)


@cli.command()
def list_jobs():
    """List available jobs"""
    jobs = ConfigLoader.list_jobs()
    if jobs:
        click.echo("Available jobs:")
        for job in jobs:
            click.echo(f"  - {job}")
    else:
        click.echo("No jobs found")


@cli.command()
@click.argument('job_name')
def validate(job_name: str):
    """Validate job configuration"""
    try:
        config = ConfigLoader.load_job_config(job_name)
        is_valid, error = ConfigLoader.validate_config(config)
        
        if is_valid:
            click.echo(f"✓ Config valid for {job_name}")
        else:
            click.echo(f"✗ Config invalid: {error}")
            sys.exit(1)
    except FileNotFoundError as e:
        click.echo(f"✗ Error: {e}", err=True)
        sys.exit(1)


async def execute_job(
    config: dict,
    job_name: str,
    output_path: Path,
    logger: logging.Logger,
    resume: bool
):
    """Execute a scraping job"""
    url = config.get('url')
    modules = config.get('modules', [])
    
    if not url:
        raise ValueError("URL not specified in config")
    
    # Compliance check
    compliance = ComplianceChecker(enforce=config.get('compliance', {}).get('enforce', False))
    await compliance.check_robots_txt(url)
    
    # Prepare fetch config
    fetch_config = FetchConfig(url=url)
    
    result = {}
    
    async with Fetcher(headless=True) as fetcher:
        page = await fetcher.fetch(fetch_config)
        
        # Extract based on modules
        for module in modules:
            try:
                logger.info(f"Extracting {module}...")
                
                if module == 'products':
                    extractor = ProductExtractor()
                    products = await extractor.extract(page, url)
                    normalizer = Normalizer()
                    result['products'] = [normalizer.normalize_product(p) for p in products]
                
                elif module == 'images':
                    extractor = ImageExtractor()
                    result['images'] = await extractor.extract(page, url)
                
                elif module == 'contacts':
                    extractor = ContactExtractor()
                    contacts_list = await extractor.extract(page, url)
                    if contacts_list:
                        result['contacts'] = contacts_list[0]
                
                elif module == 'text':
                    extractor = TextExtractor()
                    text_list = await extractor.extract(page, url)
                    if text_list:
                        result['text'] = text_list[0]
                
                elif module == 'assets':
                    extractor = AssetExtractor()
                    result['assets'] = await extractor.extract(page, url)
                
                logger.info(f"Extracted {module}: {len(result.get(module, []))} items")
            
            except Exception as e:
                logger.error(f"Error extracting {module}: {e}")
        
        await page.close()
    
    # Validate
    validator = Validator()
    try:
        validated = validator.validate_result(result)
        result = validated
    except ValueError as e:
        logger.warning(f"Validation warnings: {e}")
    
    # Write output
    output_format = config.get('output', {}).get('format', 'json')
    filename = OutputWriter.generate_filename(job_name, output_format)
    file_path = output_path / filename
    
    if output_format == 'csv':
        OutputWriter.write_csv(result, file_path, job_name, format_type='standard')
    elif output_format == 'shopify':
        OutputWriter.write_csv(result, file_path, job_name, format_type='shopify')
    else:
        OutputWriter.write_json(result, file_path, job_name, source_url=url)
    
    logger.info(f"Output written to: {file_path}")
    click.echo(f"Output: {file_path}")


if __name__ == '__main__':
    cli()
