'use client';

import { useState } from 'react';
import { AuthConfig } from '@/types';

interface AuthPanelProps {
  authConfig: AuthConfig;
  onChange: (config: AuthConfig) => void;
}

export default function AuthPanel({ authConfig, onChange }: AuthPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [localConfig, setLocalConfig] = useState<AuthConfig>(authConfig);

  const handleSave = () => {
    onChange(localConfig);
    setIsOpen(false);
  };

  const handleReset = () => {
    setLocalConfig({});
    onChange({});
  };

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="px-4 py-2 text-sm border border-border bg-hover/30 hover:bg-hover rounded transition-colors"
      >
        auth settings
      </button>
    );
  }

  return (
    <div className="border border-border rounded p-4 mb-4 bg-hover/30">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm text-accent/70">authentication</h4>
        <button
          onClick={() => setIsOpen(false)}
          className="text-accent hover:text-foreground"
        >
          ×
        </button>
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-xs text-accent/50 mb-1 block">API Key</label>
          <input
            type="text"
            value={localConfig.apiKey || ''}
            onChange={(e) => setLocalConfig({ ...localConfig, apiKey: e.target.value })}
            placeholder="your-api-key"
            className="w-full px-3 py-2 text-sm border border-border bg-background rounded"
          />
        </div>

        <div>
          <label className="text-xs text-accent/50 mb-1 block">API Key Header Name</label>
          <input
            type="text"
            value={localConfig.apiKeyHeader || ''}
            onChange={(e) => setLocalConfig({ ...localConfig, apiKeyHeader: e.target.value })}
            placeholder="X-API-Key"
            className="w-full px-3 py-2 text-sm border border-border bg-background rounded"
          />
        </div>

        <div>
          <label className="text-xs text-accent/50 mb-1 block">Cookies (semicolon-separated)</label>
          <textarea
            value={localConfig.cookies || ''}
            onChange={(e) => setLocalConfig({ ...localConfig, cookies: e.target.value })}
            placeholder="session=abc123; token=xyz789"
            rows={2}
            className="w-full px-3 py-2 text-sm border border-border bg-background rounded font-mono"
          />
        </div>

        <div>
          <label className="text-xs text-accent/50 mb-1 block">Custom Headers (JSON)</label>
          <textarea
            value={localConfig.headers ? JSON.stringify(localConfig.headers, null, 2) : ''}
            onChange={(e) => {
              try {
                const headers = e.target.value ? JSON.parse(e.target.value) : undefined;
                setLocalConfig({ ...localConfig, headers });
              } catch {
                // Invalid JSON, keep as is
              }
            }}
            placeholder='{"Authorization": "Bearer token"}'
            rows={3}
            className="w-full px-3 py-2 text-sm border border-border bg-background rounded font-mono"
          />
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleSave}
            className="flex-1 px-4 py-2 bg-accent hover:bg-foreground text-background rounded text-sm"
          >
            save
          </button>
          <button
            onClick={handleReset}
            className="px-4 py-2 border border-border hover:bg-hover rounded text-sm"
          >
            clear
          </button>
        </div>
      </div>
    </div>
  );
}
