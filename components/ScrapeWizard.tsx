'use client';

import { useState } from 'react';
import { Template } from '@/lib/templates';
import TemplateSelector from './TemplateSelector';
import ModuleSelector from './ModuleSelector';
import AuthPanel from './AuthPanel';
import SelectorBuilder from './SelectorBuilder';
import { AuthConfig } from '@/types';

interface ScrapeWizardProps {
  onComplete: (config: {
    url: string;
    modules: string[];
    template?: Template;
    authConfig?: AuthConfig;
    customSelectors?: Record<string, string[]>;
  }) => void;
  onCancel: () => void;
}

export default function ScrapeWizard({ onComplete, onCancel }: ScrapeWizardProps) {
  const [step, setStep] = useState(1);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [url, setUrl] = useState('');
  const [modules, setModules] = useState<string[]>(['images']);
  const [authConfig, setAuthConfig] = useState<AuthConfig>({});
  const [customSelectors, setCustomSelectors] = useState<Record<string, string[]>>({});
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleTemplateSelect = (template: Template | null) => {
    setSelectedTemplate(template);
    if (template) {
      setModules(template.modules);
    }
  };

  const handleNext = () => {
    if (step === 1 && !selectedTemplate && !showAdvanced) {
      setShowAdvanced(true);
      return;
    }
    if (step === 2 && !url.trim()) {
      alert('Please enter a URL');
      return;
    }
    if (step < 5) {
      setStep(step + 1);
    } else {
      handleComplete();
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleComplete = () => {
    onComplete({
      url,
      modules,
      template: selectedTemplate || undefined,
      authConfig: Object.keys(authConfig).length > 0 ? authConfig : undefined,
      customSelectors: Object.keys(customSelectors).length > 0 ? customSelectors : undefined,
    });
  };

  const getStepTitle = () => {
    switch (step) {
      case 1: return 'choose template';
      case 2: return 'enter url';
      case 3: return 'configure';
      case 4: return 'preview & filter';
      case 5: return 'export';
      default: return '';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background border border-border rounded p-6 max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold mb-1">scraping wizard</h2>
            <p className="text-xs text-accent/60">step {step} of 5: {getStepTitle()}</p>
          </div>
          <button
            onClick={onCancel}
            className="text-accent hover:text-foreground"
          >
            ×
          </button>
        </div>

        {/* Progress Bar */}
        <div className="mb-6">
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((s) => (
              <div
                key={s}
                className={`flex-1 h-2 rounded ${
                  s <= step ? 'bg-accent' : 'bg-hover/50'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Step Content */}
        <div className="mb-6 min-h-[400px]">
          {step === 1 && (
            <div>
              <TemplateSelector
                selectedTemplate={selectedTemplate?.id}
                onSelect={handleTemplateSelect}
              />
              {!selectedTemplate && (
                <div className="mt-4">
                  <button
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="text-sm text-accent hover:text-foreground underline"
                  >
                    {showAdvanced ? 'hide' : 'show'} advanced options
                  </button>
                  {showAdvanced && (
                    <div className="mt-4">
                      <ModuleSelector
                        selected={modules}
                        onChange={setModules}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div>
              <label className="text-sm text-accent/70 mb-2 block">website url</label>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com"
                className="w-full px-4 py-3 border border-border bg-background rounded mb-4"
              />
              {selectedTemplate?.exampleUrls && (
                <div className="mt-4">
                  <p className="text-xs text-accent/50 mb-2">example urls for this template:</p>
                  <div className="space-y-1">
                    {selectedTemplate.exampleUrls.map((exampleUrl, idx) => (
                      <button
                        key={idx}
                        onClick={() => setUrl(exampleUrl)}
                        className="text-xs text-accent hover:text-foreground underline block"
                      >
                        {exampleUrl}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              {!selectedTemplate && (
                <div>
                  <h4 className="text-sm text-accent/70 mb-2">modules</h4>
                  <ModuleSelector
                    selected={modules}
                    onChange={setModules}
                  />
                </div>
              )}
              <div>
                <h4 className="text-sm text-accent/70 mb-2">authentication</h4>
                <AuthPanel authConfig={authConfig} onChange={setAuthConfig} />
              </div>
              {selectedTemplate?.defaultSelectors && (
                <div>
                  <h4 className="text-sm text-accent/70 mb-2">custom selectors (optional)</h4>
                  <SelectorBuilder
                    fields={Object.keys(selectedTemplate.defaultSelectors)}
                    onSave={setCustomSelectors}
                    initialSelectors={selectedTemplate.defaultSelectors}
                  />
                </div>
              )}
            </div>
          )}

          {step === 4 && (
            <div>
              <p className="text-sm text-accent/60 mb-4">
                After scraping, you'll be able to preview, filter, and edit the extracted data before exporting.
              </p>
              <div className="border border-border rounded p-4 bg-hover/30">
                <p className="text-xs text-accent/50">
                  Ready to scrape: <strong>{url}</strong>
                </p>
                <p className="text-xs text-accent/50 mt-2">
                  Modules: {modules.join(', ')}
                </p>
              </div>
            </div>
          )}

          {step === 5 && (
            <div>
              <p className="text-sm text-accent/60 mb-4">
                Click "complete" to start scraping. You'll be able to preview and export the results.
              </p>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex justify-between">
          <button
            onClick={handleBack}
            disabled={step === 1}
            className="px-4 py-2 border border-border hover:bg-hover rounded text-sm disabled:opacity-50"
          >
            back
          </button>
          <button
            onClick={handleNext}
            className="px-4 py-2 bg-accent hover:bg-foreground text-background rounded text-sm"
          >
            {step === 5 ? 'complete' : 'next'}
          </button>
        </div>
      </div>
    </div>
  );
}
