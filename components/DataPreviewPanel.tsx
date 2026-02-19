'use client';

import { useState, useMemo, useEffect } from 'react';
import { ScrapeResult } from '@/types';
import { preparePreviewData, filterPreviewData, PreviewData, exportPreviewData } from '@/lib/preview';
import { downloadCsv } from '@/lib/exportCsv';
import { downloadJson } from '@/lib/exportJson';

interface DataPreviewPanelProps {
  results: ScrapeResult;
  onExport?: (filteredResults: ScrapeResult) => void;
}

export default function DataPreviewPanel({ results, onExport }: DataPreviewPanelProps) {
  const [previewData, setPreviewData] = useState<PreviewData[]>(() => preparePreviewData(results));
  
  // Update preview data when results change
  useEffect(() => {
    setPreviewData(preparePreviewData(results));
  }, [results]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(new Set(['title', 'price', 'image', 'url']));

  const filteredData = useMemo(() => {
    let filtered = [...previewData];
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(item => {
        const dataStr = JSON.stringify(item.data).toLowerCase();
        return dataStr.includes(term);
      });
    }

    if (sortColumn) {
      filtered.sort((a, b) => {
        const aVal = a.data[sortColumn] || '';
        const bVal = b.data[sortColumn] || '';
        const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        return sortDirection === 'asc' ? comparison : -comparison;
      });
    }

    return filtered;
  }, [previewData, searchTerm, sortColumn, sortDirection]);

  const handleToggleSelect = (id: string) => {
    setPreviewData(prev => 
      prev.map(item => 
        item.id === id ? { ...item, selected: !item.selected } : item
      )
    );
  };

  const handleSelectAll = () => {
    setPreviewData(prev => prev.map(item => ({ ...item, selected: true })));
  };

  const handleDeselectAll = () => {
    setPreviewData(prev => prev.map(item => ({ ...item, selected: false })));
  };

  const handleDeleteSelected = () => {
    setPreviewData(prev => prev.filter(item => !item.selected));
  };

  const handleEditField = (id: string, field: string, value: any) => {
    setPreviewData(prev =>
      prev.map(item =>
        item.id === id ? { ...item, data: { ...item.data, [field]: value } } : item
      )
    );
  };

  const handleExport = () => {
    const filteredResults = exportPreviewData(previewData);
    if (onExport) {
      onExport(filteredResults);
    } else {
      downloadJson(filteredResults);
    }
  };

  const handleExportCsv = () => {
    const filteredResults = exportPreviewData(previewData);
    downloadCsv(filteredResults);
  };

  const getColumns = () => {
    if (previewData.length === 0) return [];
    
    const firstItem = previewData[0];
    if (firstItem.type === 'product') {
      return ['title', 'price', 'image', 'url', 'description'];
    }
    if (firstItem.type === 'image') {
      return ['url', 'alt', 'width', 'height'];
    }
    if (firstItem.type === 'video') {
      return ['url', 'title', 'provider', 'durationSeconds', 'mimeType', 'width', 'height', 'poster'];
    }
    if (firstItem.type === 'contact') {
      return ['type', 'value'];
    }
    return Object.keys(firstItem.data);
  };

  const columns = getColumns();
  const selectedCount = previewData.filter(p => p.selected).length;

  if (previewData.length === 0) {
    return (
      <div className="border border-border rounded p-8 text-center text-accent/60">
        <p>no data to preview</p>
      </div>
    );
  }

  return (
    <div className="border border-border rounded p-4 bg-hover/30">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="text-sm text-accent/70">preview data</h3>
          <span className="text-xs text-accent/50">
            {selectedCount} of {previewData.length} selected
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleSelectAll}
            className="px-3 py-1 text-xs border border-border hover:bg-hover rounded"
          >
            select all
          </button>
          <button
            onClick={handleDeselectAll}
            className="px-3 py-1 text-xs border border-border hover:bg-hover rounded"
          >
            deselect all
          </button>
          <button
            onClick={handleDeleteSelected}
            className="px-3 py-1 text-xs border border-border hover:bg-hover rounded text-error"
          >
            delete selected
          </button>
        </div>
      </div>

      <div className="mb-4">
        <input
          type="text"
          placeholder="search..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-border bg-background rounded"
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-2 px-2">
                <input
                  type="checkbox"
                  checked={selectedCount === previewData.length && previewData.length > 0}
                  onChange={(e) => e.target.checked ? handleSelectAll() : handleDeselectAll()}
                  className="w-4 h-4"
                />
              </th>
              {columns.map((col) => (
                <th
                  key={col}
                  className="text-left py-2 px-2 text-accent/70 font-normal cursor-pointer hover:text-foreground"
                  onClick={() => {
                    if (sortColumn === col) {
                      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                    } else {
                      setSortColumn(col);
                      setSortDirection('asc');
                    }
                  }}
                >
                  {col}
                  {sortColumn === col && (
                    <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                  )}
                </th>
              ))}
              <th className="text-left py-2 px-2 text-accent/70 font-normal">actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredData.map((item) => (
              <tr
                key={item.id}
                className={`border-b border-border/50 hover:bg-hover/30 transition-colors ${
                  !item.selected ? 'opacity-50' : ''
                }`}
              >
                <td className="py-2 px-2">
                  <input
                    type="checkbox"
                    checked={item.selected}
                    onChange={() => handleToggleSelect(item.id)}
                    className="w-4 h-4"
                  />
                </td>
                {columns.map((col) => (
                  <td key={col} className="py-2 px-2">
                    {col === 'image' && item.data[col] ? (
                      <img
                        src={item.data[col]}
                        alt=""
                        className="w-12 h-12 object-cover rounded"
                      />
                    ) : (
                      <input
                        type="text"
                        value={item.data[col] || ''}
                        onChange={(e) => handleEditField(item.id, col, e.target.value)}
                        className="w-full px-2 py-1 text-xs border border-border bg-background rounded"
                      />
                    )}
                  </td>
                ))}
                <td className="py-2 px-2">
                  <button
                    onClick={() => setPreviewData(prev => prev.filter(p => p.id !== item.id))}
                    className="text-xs text-error hover:underline"
                  >
                    delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <button
          onClick={handleExportCsv}
          className="px-4 py-2 bg-accent hover:bg-foreground text-background rounded text-sm"
        >
          export csv
        </button>
        <button
          onClick={handleExport}
          className="px-4 py-2 bg-accent hover:bg-foreground text-background rounded text-sm"
        >
          export json
        </button>
      </div>
    </div>
  );
}
