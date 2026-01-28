'use client';

import { useState } from 'react';

export interface FilterRule {
  id: string;
  field: string;
  operator: 'contains' | 'not_contains' | 'equals' | 'greater_than' | 'less_than' | 'has' | 'not_has';
  value: string;
  logic?: 'AND' | 'OR';
}

interface FilterBuilderProps {
  fields: string[];
  onApply: (rules: FilterRule[]) => void;
  onReset: () => void;
}

export default function FilterBuilder({ fields, onApply, onReset }: FilterBuilderProps) {
  const [rules, setRules] = useState<FilterRule[]>([]);

  const addRule = () => {
    setRules([
      ...rules,
      {
        id: Date.now().toString(),
        field: fields[0] || '',
        operator: 'contains',
        value: '',
        logic: rules.length > 0 ? 'AND' : undefined,
      },
    ]);
  };

  const removeRule = (id: string) => {
    setRules(rules.filter(r => r.id !== id));
  };

  const updateRule = (id: string, updates: Partial<FilterRule>) => {
    setRules(rules.map(r => r.id === id ? { ...r, ...updates } : r));
  };

  const handleApply = () => {
    onApply(rules.filter(r => r.value.trim() !== ''));
  };

  const operators = [
    { value: 'contains', label: 'contains' },
    { value: 'not_contains', label: "doesn't contain" },
    { value: 'equals', label: 'equals' },
    { value: 'greater_than', label: '>' },
    { value: 'less_than', label: '<' },
    { value: 'has', label: 'has' },
    { value: 'not_has', label: "doesn't have" },
  ];

  return (
    <div className="border border-border rounded p-4 mb-6 bg-hover/30">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm text-accent/70">advanced filters</h4>
        <div className="flex gap-2">
          <button
            onClick={addRule}
            className="px-3 py-1 text-xs border border-border hover:bg-hover rounded"
          >
            + add rule
          </button>
          {rules.length > 0 && (
            <button
              onClick={onReset}
              className="px-3 py-1 text-xs text-accent/60 hover:text-foreground underline"
            >
              reset
            </button>
          )}
        </div>
      </div>

      {rules.length === 0 ? (
        <p className="text-xs text-accent/50 text-center py-4">
          no filters applied. click "add rule" to start filtering.
        </p>
      ) : (
        <div className="space-y-2">
          {rules.map((rule, index) => (
            <div key={rule.id} className="flex items-center gap-2 flex-wrap">
              {index > 0 && (
                <select
                  value={rule.logic || 'AND'}
                  onChange={(e) => updateRule(rule.id, { logic: e.target.value as 'AND' | 'OR' })}
                  className="px-2 py-1 text-xs border border-border bg-background rounded"
                >
                  <option value="AND">AND</option>
                  <option value="OR">OR</option>
                </select>
              )}
              <select
                value={rule.field}
                onChange={(e) => updateRule(rule.id, { field: e.target.value })}
                className="px-2 py-1 text-xs border border-border bg-background rounded"
              >
                {fields.map(field => (
                  <option key={field} value={field}>{field}</option>
                ))}
              </select>
              <select
                value={rule.operator}
                onChange={(e) => updateRule(rule.id, { operator: e.target.value as FilterRule['operator'] })}
                className="px-2 py-1 text-xs border border-border bg-background rounded"
              >
                {operators.map(op => (
                  <option key={op.value} value={op.value}>{op.label}</option>
                ))}
              </select>
              {(rule.operator !== 'has' && rule.operator !== 'not_has') && (
                <input
                  type="text"
                  placeholder="value"
                  value={rule.value}
                  onChange={(e) => updateRule(rule.id, { value: e.target.value })}
                  className="px-2 py-1 text-xs border border-border bg-background rounded flex-1 min-w-[150px]"
                />
              )}
              <button
                onClick={() => removeRule(rule.id)}
                className="px-2 py-1 text-xs text-error hover:underline"
              >
                remove
              </button>
            </div>
          ))}
          <button
            onClick={handleApply}
            className="w-full px-4 py-2 bg-accent hover:bg-foreground text-background rounded transition-colors text-sm mt-4"
          >
            apply filters
          </button>
        </div>
      )}
    </div>
  );
}
