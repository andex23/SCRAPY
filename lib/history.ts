import { ScrapeResult } from '@/types';

export interface ScrapeHistoryItem {
  id: string;
  url: string;
  modules: string[];
  result: ScrapeResult;
  timestamp: number;
}

const HISTORY_KEY = 'scrape_history';
const MAX_HISTORY = 50;

export function saveToHistory(url: string, modules: string[], result: ScrapeResult): void {
  if (typeof window === 'undefined') return;

  try {
    const history = getHistory();
    const newItem: ScrapeHistoryItem = {
      id: Date.now().toString(),
      url,
      modules,
      result,
      timestamp: Date.now(),
    };

    // Add to beginning and limit size
    const updated = [newItem, ...history].slice(0, MAX_HISTORY);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error('Failed to save history:', error);
  }
}

export function getHistory(): ScrapeHistoryItem[] {
  if (typeof window === 'undefined') return [];

  try {
    const stored = localStorage.getItem(HISTORY_KEY);
    if (!stored) return [];
    return JSON.parse(stored);
  } catch (error) {
    console.error('Failed to load history:', error);
    return [];
  }
}

export function clearHistory(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(HISTORY_KEY);
}

export function deleteHistoryItem(id: string): void {
  if (typeof window === 'undefined') return;

  try {
    const history = getHistory();
    const filtered = history.filter((item) => item.id !== id);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error('Failed to delete history item:', error);
  }
}
