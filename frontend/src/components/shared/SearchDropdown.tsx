import { useEffect, useMemo, useRef, useState } from 'react';

export type SearchDropdownOption = { label: string; value: string | number }

export function filterAndSortOptions(options: SearchDropdownOption[], search: string): SearchDropdownOption[] {
  if (search.trim() === '') {
    return [...options].sort((a, b) => a.label.localeCompare(b.label));
  }
  const searchLower = search.toLowerCase();
  const searchWords = searchLower.split(/\s+/).filter(Boolean);
  const endsWithSpace = search.endsWith(' ');
  // Precompute lowercased label and split words for each option
  const optionMeta = options.map(opt => ({
    opt,
    labelLower: opt.label.toLowerCase(),
    labelWords: opt.label.toLowerCase().split(/\s+/)
  }));

  // Scoring strategy
  function getScore(meta: { opt: SearchDropdownOption; labelLower: string; labelWords: string[] }): number {
    // Only show options that contain ALL search words, filter out options that don't contain all words (if more than one word in search term)
    const allWordsPresent = searchWords.every((word, i) => {
      if (endsWithSpace && i === searchWords.length - 1) {
        return meta.labelWords.includes(word);
      } else {
        return meta.labelWords.some(w => w.includes(word));
      }
    });
    if (!allWordsPresent) return -1;
    // Highest score: exact complete match
    if (meta.labelLower === searchLower) return 100;
    // First word exactly matches
    if (meta.labelWords[0] === searchLower && meta.labelLower !== searchLower) return 90;
    // Any other word exact match
    if (meta.labelWords.some(w => w === searchLower) && meta.labelLower !== searchLower) return 85;
    // First word starts with search term (not exact) (e.g. "App" matches "Apple")
    if (meta.labelWords[0].startsWith(searchLower) && meta.labelWords[0] !== searchLower && meta.labelLower !== searchLower) return 80;
    // Any other word starts with search term (not exact)
    if (meta.labelWords.some(w => w.startsWith(searchLower) && w !== searchLower) && meta.labelLower !== searchLower) return 75;
    // Any word contains search term (not startswith, not exact) (e.g. "track" matches "microtrack")
    if (meta.labelWords.some(w => w.includes(searchLower) && !w.startsWith(searchLower) && w !== searchLower) && meta.labelLower !== searchLower) return 65;
    // All words present (any order, not exact, not startsWith, not contains)
    return 60;
  }

  // Score and filter
  const scoredOptions = optionMeta
    .map(meta => ({
      opt: meta.opt,
      score: getScore(meta)
    }))
    .filter(({ score }) => score > 0);

  // Sort by score descending, then label
  scoredOptions.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.opt.label.localeCompare(b.opt.label);
  });

  return scoredOptions.map(({ opt }) => opt);
}

type SearchDropdownProps = {
  value: string | number
  onChange: (v: string) => void
  options: SearchDropdownOption[]
  label?: string
  className?: string
  size?: 'sm' | 'md'
  ariaLabel?: string
  fullWidth?: boolean
}
export function SearchDropdown({
  value,
  onChange,
  options,
  label,
  className = '',
  size = 'sm',
  ariaLabel,
  fullWidth = false,
}: SearchDropdownProps) {
  // Styling helpers
  const pad = size === 'md' ? 'px-3 py-2 text-sm' : 'px-2 py-1 text-xs';

  // Controlled selection; ephemeral UI state kept local
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');

  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Selected label memoized for performance
  const selectedLabel = useMemo(() => options.find(opt => String(opt.value) === String(value))?.label ?? '', [options, value]);

  // Use the existing helper for filtering/sorting so tests and behavior remain predictable
  const filteredOptions = useMemo(() => filterAndSortOptions(options, search), [options, search]);

  // When opening, focus the search input. When closing, clear ephemeral search state.
  useEffect(() => {
    if (!isOpen) { setSearch(''); return; }
    const t = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [isOpen]);

  // Click-outside closes the dropdown
  useEffect(() => {
    if (!isOpen) return;
    function onDocClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [isOpen]);

  const openAndFocus = () => {
    setIsOpen(true);
    // ensure input is focused after mount
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  return (
    <label className={`inline-flex items-center gap-2 text-[var(--text-secondary)] ${size === 'md' ? 'text-sm' : 'text-xs'} ${fullWidth ? 'w-full' : ''}`}>
      {label && <span className="select-none">{label}</span>}
      <div ref={dropdownRef} className={`relative ${fullWidth ? 'flex-1' : ''}`}>
        <button
          type="button"
          aria-label={ariaLabel || label}
          aria-expanded={isOpen}
          className={`flex items-center justify-between ${pad} rounded bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/40 hover:bg-[var(--bg-secondary)] w-full ${className}`}
          onClick={() => setIsOpen(v => !v)}
          onKeyDown={e => {
            // Open and focus search input when using ArrowDown, Enter or Space
            if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              openAndFocus();
            }
          }}
        >
          <span className="truncate">{selectedLabel || 'Select...'}</span>
          <svg
            className="ml-2 text-[var(--text-secondary)]"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {isOpen && (
          <div className={`absolute left-0 z-10 mt-1 ${fullWidth ? 'w-full' : 'min-w-[16rem]'} rounded bg-[var(--bg-tertiary)] border border-[var(--border-primary)] shadow-lg`}>
            <input
              ref={inputRef}
              type="text"
              className={`mb-1 w-full rounded border border-[var(--border-primary)] bg-[var(--bg-tertiary)] ${pad} text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/40`}
              placeholder="Search..."
              aria-label={`Search ${label || ''}`}
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => {
                // When user presses ArrowDown or Tab, move focus to the first option if present
                if ((e.key === 'ArrowDown' || e.key === 'Tab') && filteredOptions.length > 0) {
                  e.preventDefault();
                  const first = dropdownRef.current?.querySelector('li[role="option"]') as HTMLElement | null;
                  if (first) first.focus();
                } else if (e.key === 'Escape') {
                  setIsOpen(false);
                  e.preventDefault();
                }
              }}
            />

            <ul role="listbox" aria-label={label ?? 'options'} className="max-h-72 overflow-auto">
              {filteredOptions.length === 0 && (
                <li className="px-2 py-1 text-xs text-[var(--text-secondary)] select-none">No options</li>
              )}

              {filteredOptions.map((opt: SearchDropdownOption, i: number) => (
                <li
                  key={String(opt.value)}
                  tabIndex={0}
                  role="option"
                  aria-selected={String(opt.value) === String(value)}
                  className={`px-2 py-1 text-xs cursor-pointer hover:bg-[var(--accent-hover)] focus:bg-[var(--accent-hover)] focus:text-white ${String(opt.value) === String(value) ? 'bg-[var(--accent-primary)] text-white' : ''}`}
                  onClick={() => {
                    onChange(String(opt.value));
                    setIsOpen(false);
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onChange(String(opt.value));
                      setIsOpen(false);
                    } else if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      const next = (e.currentTarget as HTMLElement).nextElementSibling as HTMLElement | null;
                      if (next) next.focus();
                      else {
                        const first = dropdownRef.current?.querySelector('li[role="option"]') as HTMLElement | null;
                        if (first) first.focus();
                      }
                    } else if (e.key === 'ArrowUp') {
                      e.preventDefault();
                      const prev = (e.currentTarget as HTMLElement).previousElementSibling as HTMLElement | null;
                      if (prev) prev.focus();
                      else inputRef.current?.focus();
                    } else if (e.key === 'Escape') {
                      setIsOpen(false);
                      e.preventDefault();
                    }
                  }}
                >
                  {opt.label}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </label>
  );
}
