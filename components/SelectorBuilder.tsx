'use client';

import { useState } from 'react';
import { SelectorConfig } from '@/lib/selectors';
import { validateSelector, suggestSelectors } from '@/lib/selectors';

interface SelectorBuilderProps {
  fields: string[];
  onSave: (selectors: Record<string, string[]>) => void;
  initialSelectors?: Record<string, string[]>;
}

export default function SelectorBuilder({ fields, onSave, initialSelectors = {} }: SelectorBuilderProps) {
  const [selectors, setSelectors] = useState<Record<string, string[]>>(
    initialSelectors || fields.reduce((acc, field) => ({ ...acc, [field]: [''] }), {})
  );
  const [testingField, setTestingField] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ found: boolean; count: number } | null>(null);

  const handleSelectorChange = (field: string, index: number, value: string) => {
    const newSelectors = { ...selectors };
    if (!newSelectors[field]) {
      newSelectors[field] = [''];
    }
    newSelectors[field][index] = value;
    setSelectors(newSelectors);
  };

  const addFallback = (field: string) => {
    const newSelectors = { ...selectors };
    if (!newSelectors[field]) {
      newSelectors[field] = [''];
    }
    newSelectors[field].push('');
    setSelectors(newSelectors);
  };

  const removeSelector = (field: string, index: number) => {
    const newSelectors = { ...selectors };
    if (newSelectors[field]) {
      newSelectors[field] = newSelectors[field].filter((_, i) => i !== index);
      if (newSelectors[field].length === 0) {
        newSelectors[field] = [''];
      }
    }
    setSelectors(newSelectors);
  };

  const handleTest = async (field: string, selector: string) => {
    if (!selector.trim()) return;

    const validation = validateSelector(selector);
    if (!validation.valid) {
      setTestResult({ found: false, count: 0 });
      return;
    }

    // In a real implementation, this would fetch the page and test the selector
    // For now, we'll just show a placeholder
    setTestingField(field);
    setTestResult({ found: true, count: 1 }); // Placeholder
  };

  const handleGetSuggestions = async (field: string) => {
    // In a real implementation, this would fetch the page HTML and suggest selectors
    // For now, we'll use common defaults
    const suggestions = suggestSelectors('', field);
    if (suggestions.length > 0) {
      const newSelectors = { ...selectors };
      newSelectors[field] = [suggestions[0]];
      setSelectors(newSelectors);
    }
  };

  const handleSave = () => {
    const cleaned: Record<string, string[]> = {};
    Object.entries(selectors).forEach(([field, values]) => {
      const nonEmpty = values.filter(v => v.trim() !== '');
      if (nonEmpty.length > 0) {
        cleaned[field] = nonEmpty;
      }
    });
    onSave(cleaned);
  };

  return (
    <div className="border border-border rounded p-4 mb-6 bg-hover/30">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm text-accent/70">custom selectors</h4>
        <button
          onClick={handleSave}
          className="px-4 py-2 bg-accent hover:bg-foreground text-background rounded text-sm"
        >
          save selectors
        </button>
      </div>

      <div className="space-y-4">
        {fields.map((field) => (
          <div key={field} className="border border-border rounded p-3">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-accent/70 font-semibold">{field}</label>
              <button
                onClick={() => handleGetSuggestions(field)}
                className="text-xs text-accent/60 hover:text-foreground underline"
              >
                get suggestions
              </button>
            </div>
            <div className="space-y-2">
              {selectors[field]?.map((selector, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={selector}
                    onChange={(e) => handleSelectorChange(field, index, e.target.value)}
                    placeholder={`CSS selector for ${field}`}
                    className="flex-1 px-2 py-1 text-xs border border-border bg-background rounded font-mono"
                  />
                  <button
                    onClick={() => handleTest(field, selector)}
                    className="px-2 py-1 text-xs border border-border hover:bg-hover rounded"
                    disabled={!selector.trim()}
                  >
                    test
                  </button>
                  {selectors[field]!.length > 1 && (
                    <button
                      onClick={() => removeSelector(field, index)}
                      className="px-2 py-1 text-xs text-error hover:underline"
                    >
                      remove
                    </button>
                  )}
                  {index === selectors[field]!.length - 1 && (
                    <span className="text-xs text-accent/50">(primary)</span>
                  )}
                </div>
              ))}
              {selectors[field] && selectors[field].length > 0 && (
                <button
                  onClick={() => addFallback(field)}
                  className="text-xs text-accent/60 hover:text-foreground underline"
                >
                  + add fallback selector
                </button>
              )}
              {testingField === field && testResult && (
                <div className="text-xs mt-1">
                  {testResult.found ? (
                    <span className="text-green-600">✓ Found {testResult.count} element(s)</span>
                  ) : (
                    <span className="text-red-600">✗ Not found</span>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 p-3 bg-accent/10 rounded">
        <p className="text-xs text-accent/60">
          <strong>Tip:</strong> Use CSS selectors like <code className="bg-hover px-1 rounded">.product-title</code> or <code className="bg-hover px-1 rounded">#price</code>.
          Add fallback selectors if the first one doesn't work.
        </p>
      </div>
    </div>
  );
}
