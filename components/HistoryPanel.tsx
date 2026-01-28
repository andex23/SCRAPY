'use client';

import { useState, useEffect } from 'react';
import { ScrapeHistoryItem, getHistory, deleteHistoryItem, clearHistory } from '@/lib/history';
import { ScrapeResult } from '@/types';

interface HistoryPanelProps {
  onLoadHistory: (url: string, modules: string[], result: ScrapeResult) => void;
  onClose: () => void;
}

export default function HistoryPanel({ onLoadHistory, onClose }: HistoryPanelProps) {
  const [history, setHistory] = useState<ScrapeHistoryItem[]>([]);

  useEffect(() => {
    setHistory(getHistory());
  }, []);

  const handleLoad = (item: ScrapeHistoryItem) => {
    onLoadHistory(item.url, item.modules, item.result);
    onClose();
  };

  const handleDelete = (id: string) => {
    deleteHistoryItem(id);
    setHistory(getHistory());
  };

  const handleClear = () => {
    if (confirm('Clear all history?')) {
      clearHistory();
      setHistory([]);
    }
  };

  if (history.length === 0) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-background border border-border rounded p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg text-foreground">history</h3>
            <button
              onClick={onClose}
              className="text-accent hover:text-foreground"
            >
              ×
            </button>
          </div>
          <p className="text-sm text-accent/60 text-center py-8">no history yet</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background border border-border rounded p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg text-foreground">history ({history.length})</h3>
          <div className="flex gap-2">
            <button
              onClick={handleClear}
              className="text-xs text-accent/60 hover:text-error underline"
            >
              clear all
            </button>
            <button
              onClick={onClose}
              className="text-accent hover:text-foreground"
            >
              ×
            </button>
          </div>
        </div>

        <div className="space-y-2">
          {history.map((item) => {
            const date = new Date(item.timestamp);
            const hasData = Object.keys(item.result).some(
              (key) => {
                const value = item.result[key as keyof ScrapeResult];
                return Array.isArray(value) ? value.length > 0 : (value && Object.keys(value).length > 0);
              }
            );

            return (
              <div
                key={item.id}
                className="border border-border rounded p-3 hover:bg-hover/30 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-accent hover:text-foreground underline truncate block"
                    >
                      {item.url}
                    </a>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-accent/50">
                        {date.toLocaleString()}
                      </span>
                      <span className="text-xs text-accent/50">
                        • {item.modules.join(', ')}
                      </span>
                      {hasData && (
                        <span className="text-xs text-accent/50">• data found</span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleLoad(item)}
                      className="px-3 py-1 text-xs bg-accent hover:bg-foreground text-background rounded"
                    >
                      load
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="px-3 py-1 text-xs border border-border hover:bg-hover rounded"
                    >
                      delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
