'use client';

import { useState, useEffect, useRef } from 'react';

interface WikiSearchResult {
  title: string;
  description: string;
  pageName: string;
}

interface WikiAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect: (pageName: string) => void;
  placeholder: string;
  label: string;
}

export default function WikiAutocomplete({ 
  value, 
  onChange, 
  onSelect, 
  placeholder,
  label 
}: WikiAutocompleteProps) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<WikiSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Search Wikipedia as user types
  useEffect(() => {
    const fetchResults = async () => {
      if (query.trim().length < 2) {
        setResults([]);
        return;
      }
      
      setIsLoading(true);
      
      try {
        const response = await fetch(`/api/wiki-search?q=${encodeURIComponent(query)}`);
        if (!response.ok) throw new Error('Search request failed');
        
        const data = await response.json();
        setResults(data.results || []);
      } catch (error) {
        console.error('Search error:', error);
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    };
    
    // Debounce search requests
    const timeoutId = setTimeout(fetchResults, 300);
    return () => clearTimeout(timeoutId);
  }, [query]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        inputRef.current && 
        resultsRef.current && 
        !inputRef.current.contains(event.target as Node) && 
        !resultsRef.current.contains(event.target as Node)
      ) {
        setShowResults(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    onChange(value);
    setShowResults(true);
  };

  const handleSelectResult = (result: WikiSearchResult) => {
    setQuery(result.title);
    onChange(result.title);
    onSelect(result.pageName);
    setShowResults(false);
  };

  return (
    <div className="relative">
      <label className="block text-sm font-medium mb-1">{label}</label>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={() => setShowResults(true)}
          className="w-full p-2 rounded bg-white/20 border border-white/30 focus:outline-none focus:ring-2 focus:ring-pink-500 pr-8"
          placeholder={placeholder}
        />
        {isLoading && (
          <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
            <div className="animate-spin w-4 h-4 border-2 border-pink-500 border-t-transparent rounded-full"></div>
          </div>
        )}
      </div>
      
      {showResults && results.length > 0 && (
        <div 
          ref={resultsRef}
          className="absolute z-10 mt-1 w-full bg-gray-800 border border-gray-700 rounded shadow-xl max-h-60 overflow-auto"
        >
          <ul className="py-1">
            {results.map((result) => (
              <li 
                key={result.pageName}
                className="px-3 py-2 hover:bg-gray-700 cursor-pointer"
                onClick={() => handleSelectResult(result)}
              >
                <div className="font-medium">{result.title}</div>
                <div className="text-xs text-gray-400 truncate">{result.description}</div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
} 