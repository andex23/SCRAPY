'use client';

import { useState } from 'react';
import { validateSelector } from '@/lib/selectors';

interface SelectorTesterProps {
  url: string;
  onTest: (selector: string) => Promise<{ found: boolean; count: number; sample?: string }>;
}

export default function SelectorTester({ url, onTest }: SelectorTesterProps) {
  const [selector, setSelector] = useState('');
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ found: boolean; count: number; sample?: string } | null>(null);

  const handleTest = async () => {
    if (!selector.trim()) return;

    const validation = validateSelector(selector);
    if (!validation.valid) {
      setResult({ found: false, count: 0 });
      return;
    }

    setTesting(true);
    try {
      const testResult = await onTest(selector);
      setResult(testResult);
    } catch (error) {
      setResult({ found: false, count: 0 });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="border border-border rounded p-4 mb-4 bg-hover/30">
      <h4 className="text-sm text-accent/70 mb-3">test selector</h4>
      <div className="space-y-2">
        <div className="flex gap-2">
          <input
            type="text"
            value={selector}
            onChange={(e) => setSelector(e.target.value)}
            placeholder="Enter CSS selector (e.g., .product-title)"
            className="flex-1 px-3 py-2 text-sm border border-border bg-background rounded font-mono"
            onKeyDown={(e) => e.key === 'Enter' && handleTest()}
          />
          <button
            onClick={handleTest}
            disabled={testing || !selector.trim()}
            className="px-4 py-2 bg-accent hover:bg-foreground text-background rounded text-sm disabled:opacity-50"
          >
            {testing ? 'testing...' : 'test'}
          </button>
        </div>
        {result && (
          <div className={`text-sm p-2 rounded ${
            result.found ? 'bg-green-500/20 text-green-700' : 'bg-red-500/20 text-red-700'
          }`}>
            {result.found ? (
              <div>
                ✓ Found <strong>{result.count}</strong> element(s)
                {result.sample && (
                  <div className="mt-1 text-xs opacity-75">
                    Sample: {result.sample.substring(0, 100)}...
                  </div>
                )}
              </div>
            ) : (
              <div>✗ Selector not found on page</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
