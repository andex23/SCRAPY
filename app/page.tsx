'use client';

import { useState } from 'react';
import { ScrapeResult, AuthConfig } from '@/types';
import { Template } from '@/lib/templates';
import ModuleSelector from '@/components/ModuleSelector';
import ResultsSection from '@/components/ResultsSection';
import HistoryPanel from '@/components/HistoryPanel';
import AuthPanel from '@/components/AuthPanel';
import SchedulerPanel from '@/components/SchedulerPanel';
import TemplateSelector from '@/components/TemplateSelector';
import ScrapeWizard from '@/components/ScrapeWizard';
import DataPreviewPanel from '@/components/DataPreviewPanel';
import ProductFilterPanel from '@/components/ProductFilterPanel';
import ProductPreviewTable from '@/components/ProductPreviewTable';
import { saveToHistory } from '@/lib/history';
import { ScheduledJob } from '@/lib/scheduler';
import { downloadCsv } from '@/lib/exportCsv';
import { downloadJson } from '@/lib/exportJson';

export default function Home() {
  const [url, setUrl] = useState('');
  const [bulkUrls, setBulkUrls] = useState('');
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [selectedModules, setSelectedModules] = useState<string[]>(['images']);
  const [results, setResults] = useState<ScrapeResult>({});
  const [bulkResults, setBulkResults] = useState<Array<{ url: string; result: ScrapeResult; error?: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0 });
  const [error, setError] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [showScheduler, setShowScheduler] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [authConfig, setAuthConfig] = useState<AuthConfig>({});
  const [crawlDepth, setCrawlDepth] = useState(1);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [filteredProducts, setFilteredProducts] = useState<ScrapeResult['products']>(undefined);

  const handleScrape = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isBulkMode) {
      await handleBulkScrape();
      return;
    }

    if (!url.trim()) {
      setError('please enter a URL');
      return;
    }

    if (selectedModules.length === 0) {
      setError('please select at least one module');
      return;
    }

    // Auto-add https:// if protocol is missing
    let finalUrl = url.trim();
    if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
      finalUrl = 'https://' + finalUrl;
      setUrl(finalUrl); // Update the input field
    }

    setLoading(true);
    setError('');
    setResults({});

    try {
      const response = await fetch('/api/scrape', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          url: finalUrl,
          modules: selectedModules,
          authConfig: Object.keys(authConfig).length > 0 ? authConfig : undefined,
          crawlDepth: selectedModules.includes('crawl') ? crawlDepth : undefined,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        try {
          const errorData = JSON.parse(errorText);
          setError(errorData.error || 'failed to scrape data');
        } catch {
          setError(`Server error: ${response.status} ${response.statusText}`);
        }
        return;
      }

      const data = await response.json();

      if (!data.success) {
        setError(data.error || 'failed to scrape data');
        return;
      }

      setResults(data.data);
      
      // Save to history
      saveToHistory(finalUrl, selectedModules, data.data);
      
      // Check if no data was found
      const hasData = Object.keys(data.data).some(key => {
        const value = data.data[key];
        return Array.isArray(value) ? value.length > 0 : (value && Object.keys(value).length > 0);
      });

      if (!hasData) {
        setError('no data found on this page');
      }
    } catch (err) {
      setError('network error. please try again.');
      console.error('Scraping error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleBulkScrape = async () => {
    if (!bulkUrls.trim()) {
      setError('please enter URLs (one per line)');
      return;
    }

    if (selectedModules.length === 0) {
      setError('please select at least one module');
      return;
    }

    const urls = bulkUrls
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(line => {
        if (!line.startsWith('http://') && !line.startsWith('https://')) {
          return 'https://' + line;
        }
        return line;
      });

    if (urls.length === 0) {
      setError('please enter at least one URL');
      return;
    }

    setLoading(true);
    setError('');
    setBulkResults([]);
    setBulkProgress({ current: 0, total: urls.length });

    const results: Array<{ url: string; result: ScrapeResult; error?: string }> = [];

    for (let i = 0; i < urls.length; i++) {
      const currentUrl = urls[i];
      setBulkProgress({ current: i + 1, total: urls.length });

      try {
        const response = await fetch('/api/scrape', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            url: currentUrl,
            modules: selectedModules,
            authConfig: Object.keys(authConfig).length > 0 ? authConfig : undefined,
            crawlDepth: selectedModules.includes('crawl') ? crawlDepth : undefined,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          try {
            const errorData = JSON.parse(errorText);
            results.push({ url: currentUrl, result: {}, error: errorData.error || 'failed to scrape' });
          } catch {
            results.push({ url: currentUrl, result: {}, error: `Server error: ${response.status}` });
          }
          continue;
        }

        const data = await response.json();
        if (data.success) {
          results.push({ url: currentUrl, result: data.data });
        } else {
          results.push({ url: currentUrl, result: {}, error: data.error || 'failed to scrape' });
        }
      } catch (err) {
        results.push({ url: currentUrl, result: {}, error: 'network error' });
      }

      setBulkResults([...results]);
    }

    setLoading(false);
  };

  const handleLoadHistory = (url: string, modules: string[], result: ScrapeResult) => {
    setUrl(url);
    setSelectedModules(modules);
    setResults(result);
    setIsBulkMode(false);
  };

  const handleRunScheduledJob = async (job: ScheduledJob) => {
    setUrl(job.url);
    setSelectedModules(job.modules);
    setIsBulkMode(false);
    
    // Auto-trigger scrape
    const finalUrl = job.url.startsWith('http') ? job.url : `https://${job.url}`;
    setLoading(true);
    setError('');
    setResults({});

    try {
      const response = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: finalUrl,
          modules: job.modules,
          authConfig: Object.keys(authConfig).length > 0 ? authConfig : undefined,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setResults(data.data);
          saveToHistory(finalUrl, job.modules, data.data);
        }
      }
    } catch (err) {
      console.error('Scheduled job error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadAllImages = async () => {
    if (!results.images || results.images.length === 0) return;

    setLoading(true);
    try {
      const response = await fetch('/api/download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageUrls: results.images.map((img) => img.url),
        }),
      });

      if (!response.ok) {
        throw new Error('Download failed');
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `scraped-images-${Date.now()}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      alert('Failed to download images');
      console.error('Download error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen p-8 md:p-12 lg:p-16 flex flex-col">
      <div className="max-w-7xl mx-auto w-full flex-1 flex flex-col">
        {/* Header */}
        <header className="mb-12">
          <h1 className="text-2xl md:text-3xl mb-2 font-heading flex items-center gap-1">
            scrape anything
            <span className="inline-block w-2 h-6 bg-foreground animate-blink"></span>
          </h1>
          <p className="text-sm text-accent/70">
            extract data with quiet precision
          </p>
        </header>

        {/* Mode Toggle & History */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowWizard(true)}
              className="px-4 py-2 rounded text-sm bg-accent text-background hover:bg-foreground transition-colors"
            >
              wizard
            </button>
            <button
              type="button"
              onClick={() => {
                setIsBulkMode(false);
                setBulkUrls('');
                setBulkResults([]);
              }}
              className={`px-4 py-2 rounded text-sm transition-colors ${
                !isBulkMode
                  ? 'bg-accent text-background'
                  : 'bg-hover/50 text-accent hover:bg-hover'
              }`}
            >
              single
            </button>
            <button
              type="button"
              onClick={() => {
                setIsBulkMode(true);
                setUrl('');
                setResults({});
              }}
              className={`px-4 py-2 rounded text-sm transition-colors ${
                isBulkMode
                  ? 'bg-accent text-background'
                  : 'bg-hover/50 text-accent hover:bg-hover'
              }`}
            >
              bulk
            </button>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowHistory(true)}
              className="px-4 py-2 rounded text-sm bg-hover/50 text-accent hover:bg-hover transition-colors"
            >
              history
            </button>
            <button
              type="button"
              onClick={() => setShowScheduler(true)}
              className="px-4 py-2 rounded text-sm bg-hover/50 text-accent hover:bg-hover transition-colors"
            >
              schedule
            </button>
          </div>
        </div>

        {/* Template Selector */}
        {!isBulkMode && !showWizard && (
          <div className="mb-6">
            <TemplateSelector
              selectedTemplate={selectedTemplate?.id}
              onSelect={(template) => {
                setSelectedTemplate(template);
                if (template) {
                  setSelectedModules(template.modules);
                } else {
                  setSelectedModules(['images']);
                }
              }}
            />
          </div>
        )}

        {/* Input Form */}
        <form onSubmit={handleScrape} className="mb-8">
          {!isBulkMode ? (
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <input
                type="text"
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  setError('');
                }}
                placeholder="https://example.com"
                className="flex-1 px-4 py-3 border border-border bg-background text-foreground rounded focus:outline-none focus:border-accent transition-colors"
                disabled={loading}
              />
              <button
                type="submit"
                disabled={loading || selectedModules.length === 0}
                className="px-8 py-3 bg-accent hover:bg-foreground text-background rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              >
                {loading ? 'scraping...' : 'scrape'}
              </button>
            </div>
          ) : (
            <div className="mb-4 space-y-3">
              <textarea
                value={bulkUrls}
                onChange={(e) => {
                  setBulkUrls(e.target.value);
                  setError('');
                }}
                placeholder="https://example.com&#10;https://another-site.com&#10;https://third-site.com"
                rows={6}
                className="w-full px-4 py-3 border border-border bg-background text-foreground rounded focus:outline-none focus:border-accent transition-colors font-mono text-sm"
                disabled={loading}
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-accent/60">
                  {bulkUrls.split('\n').filter(l => l.trim()).length} URLs
                </span>
                <button
                  type="submit"
                  disabled={loading || selectedModules.length === 0}
                  className="px-8 py-3 bg-accent hover:bg-foreground text-background rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  {loading
                    ? `scraping ${bulkProgress.current}/${bulkProgress.total}...`
                    : 'scrape all'}
                </button>
              </div>
            </div>
          )}

          {/* Module Selector */}
          <ModuleSelector
            selected={selectedModules}
            onChange={setSelectedModules}
            disabled={loading}
          />

          {/* Crawl Depth */}
          {selectedModules.includes('crawl') && (
            <div className="mb-4">
              <label className="text-xs text-accent/50 mb-1 block">crawl depth</label>
              <input
                type="number"
                min="1"
                max="5"
                value={crawlDepth}
                onChange={(e) => setCrawlDepth(Math.max(1, Math.min(5, parseInt(e.target.value) || 1)))}
                className="px-3 py-2 text-sm border border-border bg-background rounded w-24"
                disabled={loading}
              />
              <span className="ml-2 text-xs text-accent/50">(1-5 levels)</span>
            </div>
          )}

          {/* Auth Panel */}
          <div className="mb-4">
            <AuthPanel authConfig={authConfig} onChange={setAuthConfig} />
          </div>

          {/* Error message */}
          {error && (
            <div className="mt-4 px-4 py-3 border border-error bg-error/10 rounded text-error text-sm">
              {error}
            </div>
          )}
        </form>

        {/* Loading state */}
        {loading && Object.keys(results).length === 0 && (
          <div className="text-center py-20 space-y-4">
            <div className="inline-block">
              <span className="text-accent animate-pulse">— scanning page —</span>
            </div>
            {!isBulkMode && (
              <div className="mt-4">
                <div className="w-64 mx-auto bg-hover/50 rounded-full h-2 overflow-hidden">
                  <div className="h-full bg-accent rounded-full animate-pulse" style={{ width: '60%' }}></div>
                </div>
                <p className="text-xs text-accent/50 mt-2">extracting modules...</p>
              </div>
            )}
            {isBulkMode && bulkProgress.total > 0 && (
              <div className="mt-4">
                <div className="w-64 mx-auto bg-hover/50 rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full bg-accent rounded-full transition-all duration-300"
                    style={{ width: `${(bulkProgress.current / bulkProgress.total) * 100}%` }}
                  ></div>
                </div>
                <p className="text-xs text-accent/50 mt-2">
                  {bulkProgress.current} of {bulkProgress.total} URLs
                </p>
              </div>
            )}
          </div>
        )}

        {/* Bulk Results */}
        {!loading && isBulkMode && bulkResults.length > 0 && (
          <div className="space-y-6">
            <h3 className="text-sm text-accent/60 mb-4">bulk results ({bulkResults.length})</h3>
            {bulkResults.map((item, idx) => (
              <div key={idx} className="border border-border rounded p-4">
                <div className="flex items-center justify-between mb-3">
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-accent hover:text-foreground underline truncate flex-1"
                  >
                    {item.url}
                  </a>
                  {item.error && (
                    <span className="text-xs text-error ml-2">{item.error}</span>
                  )}
                </div>
                {!item.error && (
                  <ResultsSection
                    results={item.result}
                    onDownloadAllImages={handleDownloadAllImages}
                  />
                )}
              </div>
            ))}
          </div>
        )}

        {/* Single Results */}
        {!loading && !isBulkMode && Object.keys(results).length > 0 && (
          <div className="space-y-6">
            {/* Preview Toggle */}
            <div className="flex items-center justify-between">
              <h3 className="text-sm text-accent/70">results</h3>
              <button
                onClick={() => setShowPreview(!showPreview)}
                className="px-4 py-2 text-sm border border-border hover:bg-hover rounded"
              >
                {showPreview ? 'hide preview' : 'show preview'}
              </button>
            </div>

            {/* Product-Specific Preview */}
            {results.products && results.products.length > 0 && (
              <div className="space-y-4">
                <ProductFilterPanel
                  products={results.products}
                  onFiltered={(filtered) => {
                    setFilteredProducts(filtered);
                  }}
                />
                <ProductPreviewTable
                  products={filteredProducts || results.products}
                  onUpdate={(updated) => {
                    setFilteredProducts(updated);
                    setResults({ ...results, products: updated });
                  }}
                  onExport={(products) => {
                    const exportData: ScrapeResult = { ...results, products };
                    downloadCsv(exportData);
                  }}
                />
              </div>
            )}

            {/* General Data Preview */}
            {showPreview && (
              <DataPreviewPanel
                results={results}
                onExport={(filteredResults) => {
                  downloadJson(filteredResults);
                }}
              />
            )}

            {/* Standard Results View */}
            {!showPreview && (
              <ResultsSection results={results} onDownloadAllImages={handleDownloadAllImages} />
            )}
          </div>
        )}

        {/* Empty state when no loading and no results */}
        {!loading && Object.keys(results).length === 0 && !error && (
          <div className="text-center py-20 text-accent/40 text-sm flex-1 flex items-center justify-center">
            <p>enter a URL above to begin</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="mt-16 text-center text-xs text-accent/40">
        © AVD studios
      </footer>

      {/* History Panel */}
      {showHistory && (
        <HistoryPanel
          onLoadHistory={handleLoadHistory}
          onClose={() => setShowHistory(false)}
        />
      )}

      {/* Scheduler Panel */}
      {showScheduler && (
        <SchedulerPanel
          onRunJob={handleRunScheduledJob}
          onClose={() => setShowScheduler(false)}
        />
      )}

      {/* Wizard */}
      {showWizard && (
        <ScrapeWizard
          onComplete={async (config) => {
            setShowWizard(false);
            setUrl(config.url);
            setSelectedModules(config.modules);
            setSelectedTemplate(config.template || null);
            if (config.authConfig) {
              setAuthConfig(config.authConfig);
            }
            
            // Auto-trigger scrape
            const finalUrl = config.url.startsWith('http') ? config.url : `https://${config.url}`;
            setLoading(true);
            setError('');
            setResults({});

            try {
              const response = await fetch('/api/scrape', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  url: finalUrl,
                  modules: config.modules,
                  authConfig: config.authConfig,
                  customSelectors: config.customSelectors,
                }),
              });

              if (response.ok) {
                const data = await response.json();
                if (data.success) {
                  setResults(data.data);
                  saveToHistory(finalUrl, config.modules, data.data);
                  setShowPreview(true);
                } else {
                  setError(data.error || 'failed to scrape');
                }
              }
            } catch (err) {
              setError('network error. please try again.');
              console.error('Scraping error:', err);
            } finally {
              setLoading(false);
            }
          }}
          onCancel={() => setShowWizard(false)}
        />
      )}
    </main>
  );
}
