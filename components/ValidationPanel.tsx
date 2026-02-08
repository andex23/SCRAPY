'use client';

import { ScrapeResult } from '@/types';
import { validateScrapeResult, ValidationResult } from '@/lib/validation';
import { useState } from 'react';

interface ValidationPanelProps {
  results: ScrapeResult;
  onExport: () => void;
}

export default function ValidationPanel({ results, onExport }: ValidationPanelProps) {
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  const handleValidate = () => {
    const result = validateScrapeResult(results);
    setValidation(result);
    setShowDetails(true);
  };

  if (!showDetails && !validation) {
    return (
      <button
        onClick={handleValidate}
        className="px-4 py-2 text-sm border border-border bg-hover/30 hover:bg-hover rounded transition-colors"
      >
        validate & preview
      </button>
    );
  }

  const val = validation || validateScrapeResult(results);

  return (
    <div className="border border-border rounded p-4 mb-6 bg-hover/30">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h4 className="text-sm text-accent/70">validation</h4>
          {val.isValid ? (
            <span className="text-xs px-2 py-1 bg-green-500/20 text-green-700 rounded">valid</span>
          ) : (
            <span className="text-xs px-2 py-1 bg-red-500/20 text-red-700 rounded">errors</span>
          )}
        </div>
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="text-accent hover:text-foreground"
        >
          {showDetails ? '−' : '+'}
        </button>
      </div>

      {showDetails && (
        <div className="space-y-4">
          {/* Stats */}
          <div>
            <h5 className="text-xs text-accent/50 mb-2">statistics</h5>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>Images: {val.stats.images}</div>
              <div>Videos: {val.stats.videos}</div>
              <div>Products: {val.stats.products}</div>
              <div>Assets: {val.stats.assets}</div>
              <div>Crawl URLs: {val.stats.crawl}</div>
              <div>Emails: {val.stats.contacts.emails}</div>
              <div>Phones: {val.stats.contacts.phones}</div>
              <div>Socials: {val.stats.contacts.socials}</div>
              <div>Headings: {val.stats.text.headings}</div>
              <div>Paragraphs: {val.stats.text.paragraphs}</div>
            </div>
          </div>

          {/* Warnings */}
          {val.warnings.length > 0 && (
            <div>
              <h5 className="text-xs text-accent/50 mb-2">warnings</h5>
              <ul className="space-y-1">
                {val.warnings.map((warning, idx) => (
                  <li key={idx} className="text-xs text-yellow-600">⚠ {warning}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Errors */}
          {val.errors.length > 0 && (
            <div>
              <h5 className="text-xs text-accent/50 mb-2">errors</h5>
              <ul className="space-y-1">
                {val.errors.map((error, idx) => (
                  <li key={idx} className="text-xs text-red-600">✗ {error}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Export Button */}
          <button
            onClick={onExport}
            className="w-full px-4 py-2 bg-accent hover:bg-foreground text-background rounded transition-colors text-sm"
          >
            export data
          </button>
        </div>
      )}
    </div>
  );
}
