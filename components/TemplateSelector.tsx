'use client';

import { TEMPLATES, Template } from '@/lib/templates';

interface TemplateSelectorProps {
  selectedTemplate?: string;
  onSelect: (template: Template | null) => void;
}

export default function TemplateSelector({ selectedTemplate, onSelect }: TemplateSelectorProps) {
  return (
    <div className="mb-6">
      <h3 className="text-sm text-accent/70 mb-4">choose a template</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {TEMPLATES.map((template) => (
          <button
            key={template.id}
            onClick={() => onSelect(selectedTemplate === template.id ? null : template)}
            className={`p-4 border rounded transition-colors text-left ${
              selectedTemplate === template.id
                ? 'border-accent bg-accent/10'
                : 'border-border hover:bg-hover/30'
            }`}
          >
            <div className="font-semibold text-sm mb-1">{template.name}</div>
            <div className="text-xs text-accent/60">{template.description}</div>
            <div className="mt-2 flex flex-wrap gap-1">
              {template.modules.map((module) => (
                <span
                  key={module}
                  className="text-xs px-2 py-0.5 bg-hover/50 rounded"
                >
                  {module}
                </span>
              ))}
            </div>
          </button>
        ))}
        <button
          onClick={() => onSelect(null)}
          className={`p-4 border rounded transition-colors text-left ${
            selectedTemplate === 'custom'
              ? 'border-accent bg-accent/10'
              : 'border-border hover:bg-hover/30'
          }`}
        >
          <div className="font-semibold text-sm mb-1">custom</div>
          <div className="text-xs text-accent/60">build your own scraping job</div>
        </button>
      </div>
    </div>
  );
}
