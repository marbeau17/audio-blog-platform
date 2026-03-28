'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X } from 'lucide-react';
import { api } from '@/lib/api';

interface SearchSuggestion {
  type: 'content' | 'creator';
  id: string;
  title: string;
}

interface SearchBarProps {
  className?: string;
}

const RECENT_SEARCHES_KEY = 'audioblog_recent_searches';
const MAX_RECENT_SEARCHES = 5;

function getRecentSearches(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveRecentSearch(query: string) {
  const recent = getRecentSearches().filter((s) => s !== query);
  recent.unshift(query);
  localStorage.setItem(
    RECENT_SEARCHES_KEY,
    JSON.stringify(recent.slice(0, MAX_RECENT_SEARCHES)),
  );
}

export default function SearchBar({ className }: SearchBarProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load recent searches on mount
  useEffect(() => {
    setRecentSearches(getRecentSearches());
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    setLoadingSuggestions(true);
    try {
      const res = await api.get<SearchSuggestion[]>(
        `/search?q=${encodeURIComponent(q.trim())}&limit=5`,
      );
      setSuggestions(res.data);
    } catch {
      setSuggestions([]);
    } finally {
      setLoadingSuggestions(false);
    }
  }, []);

  const handleInputChange = (value: string) => {
    setQuery(value);
    setShowDropdown(true);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchSuggestions(value);
    }, 300);
  };

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    saveRecentSearch(trimmed);
    setRecentSearches(getRecentSearches());
    setShowDropdown(false);
    router.push(`/search?q=${encodeURIComponent(trimmed)}`);
  };

  const handleRecentClick = (term: string) => {
    setQuery(term);
    setShowDropdown(false);
    saveRecentSearch(term);
    router.push(`/search?q=${encodeURIComponent(term)}`);
  };

  const handleSuggestionClick = (suggestion: SearchSuggestion) => {
    setQuery(suggestion.title);
    setShowDropdown(false);
    saveRecentSearch(suggestion.title);
    router.push(`/search?q=${encodeURIComponent(suggestion.title)}`);
  };

  const clearQuery = () => {
    setQuery('');
    setSuggestions([]);
    inputRef.current?.focus();
  };

  const showRecent = showDropdown && query.trim().length === 0 && recentSearches.length > 0;
  const showSuggestionsList = showDropdown && query.trim().length >= 2 && (suggestions.length > 0 || loadingSuggestions);

  return (
    <div ref={containerRef} className={`relative ${className || ''}`}>
      <form onSubmit={handleSubmit} className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => setShowDropdown(true)}
          placeholder="コンテンツやクリエイターを検索..."
          className="w-full pl-10 pr-9 py-2 text-sm border border-gray-300 rounded-full bg-gray-50 focus:bg-white focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none transition-colors"
        />
        {query && (
          <button
            type="button"
            onClick={clearQuery}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </form>

      {/* Dropdown */}
      {(showRecent || showSuggestionsList) && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 overflow-hidden">
          {/* Recent searches */}
          {showRecent && (
            <div>
              <div className="px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">
                最近の検索
              </div>
              {recentSearches.map((term) => (
                <button
                  key={term}
                  onClick={() => handleRecentClick(term)}
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left"
                >
                  <Search className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  <span className="truncate">{term}</span>
                </button>
              ))}
            </div>
          )}

          {/* Suggestions */}
          {showSuggestionsList && (
            <div>
              {loadingSuggestions ? (
                <div className="px-4 py-3 text-sm text-gray-400">検索中...</div>
              ) : (
                suggestions.map((suggestion) => (
                  <button
                    key={`${suggestion.type}-${suggestion.id}`}
                    onClick={() => handleSuggestionClick(suggestion)}
                    className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left"
                  >
                    <Search className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                    <span className="truncate">{suggestion.title}</span>
                    <span className="ml-auto text-xs text-gray-400 shrink-0">
                      {suggestion.type === 'content' ? 'コンテンツ' : 'クリエイター'}
                    </span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
