import React from 'react';
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

export function SearchDropdown({
  value,
  onChange,
  options,
  label,
  className = '',
  size = 'sm',
  ariaLabel,
  fullWidth = false,
}: {
  value: string | number;
  onChange: (v: string) => void;
  options: SearchDropdownOption[];
  label?: string;
  className?: string;
  size?: 'sm' | 'md';
  ariaLabel?: string;
  fullWidth?: boolean;
}) {
  const pad = size === 'md' ? 'px-3 py-2 text-sm' : 'px-2 py-1 text-xs';
  const [isOpen, setIsOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const dropdownRef = React.useRef<HTMLDivElement>(null);
  const filteredOptions = filterAndSortOptions(options, search);
  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      setSearch('');
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen])
  const selectedLabel = options.find(opt => String(opt.value) === String(value))?.label || '';
  return (
    <label className={`inline-flex items-center gap-2 text-[var(--text-secondary)] ${size === 'md' ? 'text-sm' : 'text-xs'} ${fullWidth ? 'w-full' : ''}`}>
      {label && <span className="select-none">{label}</span>}
      <div ref={dropdownRef} className={`relative ${fullWidth ? 'flex-1' : ''}`}>
        <button
          type="button"
          aria-label={ariaLabel || label}
          className={`flex items-center justify-between ${pad} rounded bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/40 hover:bg-[var(--bg-secondary)] w-full ${className}`}
          onClick={() => setIsOpen((open) => !open)}
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
          <div className="absolute left-0 z-10 mt-1 min-w-[16rem] rounded bg-[var(--bg-card)] border border-[var(--border-primary)] shadow-lg">
            <input
              type="text"
              className="mb-1 w-full rounded border border-[var(--border-primary)] bg-[var(--bg-card)] px-2 py-1 text-xs text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/40"
              placeholder="Search..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              autoFocus
              onKeyDown={e => {
                // Jump to the list with ArrowDown or Tab from the search input
                if ((e.key === 'ArrowDown' || e.key === 'Tab') && filteredOptions.length > 0) {
                  e.preventDefault();
                  const firstOption = document.getElementById('dropdown-opt-0');
                  if (firstOption) firstOption.focus();
                } else if (e.key === 'Escape') {
                  // Close dropdown on Escape
                  setIsOpen(false);
                  e.preventDefault();
                }
              }}
            />
            <ul className="max-h-72 overflow-auto">
              {filteredOptions.length === 0 && (
                <li className="px-2 py-1 text-xs text-[var(--text-secondary)] select-none">No options</li>
              )}
              {filteredOptions.map((opt, i) => (
                <li
                  key={String(opt.value)}
                  id={`dropdown-opt-${i}`}
                  tabIndex={0}
                  className={`px-2 py-1 text-xs cursor-pointer hover:bg-[var(--accent-hover)] focus:bg-[var(--accent-hover)] focus:text-white ${String(opt.value) === String(value) ? 'bg-[var(--accent-primary)] text-white' : ''}`}
                  onClick={() => {
                    onChange(String(opt.value))
                    setIsOpen(false)
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      // Select option on Enter or Space
                      onChange(String(opt.value));
                      setIsOpen(false);
                      e.preventDefault();
                    } else if (e.key === 'ArrowDown') {
                      // Navigate down the list with ArrowDown
                      e.preventDefault();
                      const next = document.getElementById(`dropdown-opt-${i + 1}`);
                      if (next) next.focus();
                      // Loop to top if at the end and down is pressed
                      else if (i + 1 === filteredOptions.length) {
                        const firstOption = document.getElementById('dropdown-opt-0');
                        if (firstOption) firstOption.focus();
                      }
                    } else if (e.key === 'ArrowUp') {
                      // Navigate up the list with ArrowUp
                      e.preventDefault();
                      if (i === 0) {
                        const searchInput = document.querySelector<HTMLInputElement>('input[placeholder="Search..."]');
                        if (searchInput) searchInput.focus();
                      } else {
                        const prev = document.getElementById(`dropdown-opt-${i - 1}`);
                        if (prev) prev.focus();
                      }
                    } else if (e.key === 'Escape') {
                      // Close dropdown on Escape
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
  )
}
