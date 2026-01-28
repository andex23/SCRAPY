'use client';

import { useState, useEffect } from 'react';
import { ProductData } from '@/types';
import ImageModal from './ImageModal';

interface ProductPreviewTableProps {
  products: ProductData[];
  onUpdate: (products: ProductData[]) => void;
  onExport?: (products: ProductData[]) => void;
}

export default function ProductPreviewTable({ products, onUpdate, onExport }: ProductPreviewTableProps) {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set(products.map((_, i) => i)));
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editedProducts, setEditedProducts] = useState<ProductData[]>([...products]);
  const [showImageModal, setShowImageModal] = useState<string | null>(null);
  
  // Update edited products when props change
  useEffect(() => {
    setEditedProducts([...products]);
    setSelectedIds(new Set(products.map((_, i) => i)));
  }, [products]);

  const handleSelect = (index: number) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedIds(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedIds.size === products.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(products.map((_, i) => i)));
    }
  };

  const handleDelete = (index: number) => {
    const newProducts = editedProducts.filter((_, i) => i !== index);
    setEditedProducts(newProducts);
    onUpdate(newProducts);
    const newSelected = new Set(selectedIds);
    newSelected.delete(index);
    Array.from(selectedIds)
      .filter(i => i > index)
      .forEach(i => {
        newSelected.delete(i);
        newSelected.add(i - 1);
      });
    setSelectedIds(newSelected);
  };

  const handleDeleteSelected = () => {
    const newProducts = editedProducts.filter((_, i) => !selectedIds.has(i));
    setEditedProducts(newProducts);
    onUpdate(newProducts);
    setSelectedIds(new Set());
  };

  const handleEdit = (index: number, field: string, value: string) => {
    const newProducts = [...editedProducts];
    newProducts[index] = { ...newProducts[index], [field]: value };
    setEditedProducts(newProducts);
  };

  const handleBulkEdit = (field: string, value: string) => {
    const newProducts = editedProducts.map((p, i) =>
      selectedIds.has(i) ? { ...p, [field]: value } : p
    );
    setEditedProducts(newProducts);
    onUpdate(newProducts);
  };

  const handleExport = () => {
    const filtered = editedProducts.filter((_, i) => selectedIds.has(i));
    if (onExport) {
      onExport(filtered);
    }
  };

  return (
    <>
      <div className="border border-border rounded p-4 bg-hover/30">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <h3 className="text-sm text-accent/70">product preview</h3>
            <span className="text-xs text-accent/50">
              {selectedIds.size} of {editedProducts.length} selected
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSelectAll}
              className="px-3 py-1 text-xs border border-border hover:bg-hover rounded"
            >
              {selectedIds.size === products.length ? 'deselect all' : 'select all'}
            </button>
            <button
              onClick={handleDeleteSelected}
              className="px-3 py-1 text-xs border border-border hover:bg-hover rounded text-error"
            >
              delete selected
            </button>
            <button
              onClick={handleExport}
              className="px-3 py-1 text-xs bg-accent hover:bg-foreground text-background rounded"
            >
              export selected
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 px-2">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === products.length && products.length > 0}
                    onChange={handleSelectAll}
                    className="w-4 h-4"
                  />
                </th>
                <th className="text-left py-2 px-2 text-accent/70 font-normal">title</th>
                <th className="text-left py-2 px-2 text-accent/70 font-normal">price</th>
                <th className="text-left py-2 px-2 text-accent/70 font-normal">image</th>
                <th className="text-left py-2 px-2 text-accent/70 font-normal">description</th>
                <th className="text-left py-2 px-2 text-accent/70 font-normal">url</th>
                <th className="text-left py-2 px-2 text-accent/70 font-normal">actions</th>
              </tr>
            </thead>
            <tbody>
              {editedProducts.map((product, index) => (
                <tr
                  key={index}
                  className={`border-b border-border/50 hover:bg-hover/30 transition-colors ${
                    !selectedIds.has(index) ? 'opacity-50' : ''
                  }`}
                >
                  <td className="py-2 px-2">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(index)}
                      onChange={() => handleSelect(index)}
                      className="w-4 h-4"
                    />
                  </td>
                  <td className="py-2 px-2">
                    <input
                      type="text"
                      value={product.title || ''}
                      onChange={(e) => handleEdit(index, 'title', e.target.value)}
                      className="w-full px-2 py-1 text-xs border border-border bg-background rounded"
                    />
                  </td>
                  <td className="py-2 px-2">
                    <input
                      type="text"
                      value={product.price || ''}
                      onChange={(e) => handleEdit(index, 'price', e.target.value)}
                      className="w-full px-2 py-1 text-xs border border-border bg-background rounded"
                    />
                  </td>
                  <td className="py-2 px-2">
                    {product.image ? (
                      <img
                        src={product.image}
                        alt=""
                        className="w-12 h-12 object-cover rounded cursor-pointer"
                        onClick={() => setShowImageModal(product.image || null)}
                      />
                    ) : (
                      <span className="text-xs text-accent/50">no image</span>
                    )}
                  </td>
                  <td className="py-2 px-2">
                    <textarea
                      value={product.description || ''}
                      onChange={(e) => handleEdit(index, 'description', e.target.value)}
                      className="w-full px-2 py-1 text-xs border border-border bg-background rounded"
                      rows={2}
                    />
                  </td>
                  <td className="py-2 px-2">
                    {product.link ? (
                      <a
                        href={product.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-accent hover:text-foreground underline truncate block max-w-xs"
                      >
                        {product.link}
                      </a>
                    ) : (
                      <span className="text-xs text-accent/50">—</span>
                    )}
                  </td>
                  <td className="py-2 px-2">
                    <button
                      onClick={() => handleDelete(index)}
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

        {selectedIds.size > 0 && (
          <div className="mt-4 p-3 bg-accent/10 rounded">
            <h4 className="text-xs text-accent/70 mb-2">bulk edit selected ({selectedIds.size})</h4>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                placeholder="set price for all"
                onBlur={(e) => {
                  if (e.target.value) handleBulkEdit('price', e.target.value);
                }}
                className="px-2 py-1 text-xs border border-border bg-background rounded"
              />
              <input
                type="text"
                placeholder="set description for all"
                onBlur={(e) => {
                  if (e.target.value) handleBulkEdit('description', e.target.value);
                }}
                className="px-2 py-1 text-xs border border-border bg-background rounded"
              />
            </div>
          </div>
        )}
      </div>

      {showImageModal && (
        <ImageModal
          imageUrl={showImageModal}
          onClose={() => setShowImageModal(null)}
        />
      )}
    </>
  );
}
