import React from 'react';
export type SearchDropdownOption = { label: string; value: string | number }

export function filterAndSortOptions(options: SearchDropdownOption[], search: string): SearchDropdownOption[] {
  if (search.trim() === '') {
    return [...options].sort((a, b) => a.label.localeCompare(b.label));
  }
  const searchLower = search.toLowerCase();
  let searchWords = searchLower.split(/\s+/).filter(Boolean);
  // If search ends with space, treat last word as whole word match only
  const endsWithSpace = search.endsWith(' ');
  // Only show options that contain ALL search words
  let allWordOptions = options.filter(opt => {
    const labelWords = opt.label.toLowerCase().split(/\s+/);
    return searchWords.every((word, i) => {
      if (endsWithSpace && i === searchWords.length - 1) {
        // Only match whole word for last search word
        return labelWords.includes(word);
      } else {
        return labelWords.some(w => w.startsWith(word));
      }
    });
  });
  // 1. Exact match (whole label)
  const exact = allWordOptions.filter(opt => opt.label.toLowerCase() === searchLower);
  // 2. First word exact match (not whole label)
  const firstWordExact = allWordOptions.filter(opt => {
    const firstWord = opt.label.split(/\s+/)[0].toLowerCase();
    return firstWord === searchLower && opt.label.toLowerCase() !== searchLower;
  });
  // 3. First word starts with search term (not exact)
  const firstWordPrefix = allWordOptions.filter(opt => {
    const firstWord = opt.label.split(/\s+/)[0].toLowerCase();
    return firstWord.startsWith(searchLower) && firstWord !== searchLower && opt.label.toLowerCase() !== searchLower;
  });
  // 4. Any word (not first) starts with search term
  let wordStartsWith = allWordOptions
    .map(opt => {
      const words = opt.label.toLowerCase().split(/\s+/);
      const matchIndex = words.findIndex((w, i) => i > 0 && w.startsWith(searchLower));
      return {
        opt,
        matchIndex
      };
    })
    .filter(({ opt, matchIndex }) =>
      matchIndex !== -1 &&
      opt.label.toLowerCase() !== searchLower &&
      !firstWordExact.includes(opt) &&
      !firstWordPrefix.includes(opt)
    )
    .sort((a, b) => {
      if (a.matchIndex !== b.matchIndex) return a.matchIndex - b.matchIndex;
      return a.opt.label.localeCompare(b.opt.label);
    })
    .map(({ opt }) => opt);
  // 5. All words present (any order, not exact, not startsWith)
  let allWords = allWordOptions.filter(opt =>
    opt.label.toLowerCase() !== searchLower &&
    !firstWordExact.includes(opt) &&
    !firstWordPrefix.includes(opt) &&
    !wordStartsWith.includes(opt)
  );
  // Sort allWords by position of matching words (multi-word: minimal distance, single-word: first match)
  if (searchWords.length > 1) {
    const sortByWordOrderAndDistance = (a: SearchDropdownOption, b: SearchDropdownOption) => {
      const aWords = a.label.toLowerCase().split(/\s+/);
      const bWords = b.label.toLowerCase().split(/\s+/);
      const aIndices = searchWords.map(sw => aWords.findIndex(w => w.startsWith(sw)));
      const bIndices = searchWords.map(sw => bWords.findIndex(w => w.startsWith(sw)));
      const aValid = aIndices.every(idx => idx !== -1);
      const bValid = bIndices.every(idx => idx !== -1);
      if (aValid && bValid) {
        const aDist = aIndices[aIndices.length-1] - aIndices[0];
        const bDist = bIndices[bIndices.length-1] - bIndices[0];
        if (aDist !== bDist) return aDist - bDist;
        if (aIndices[0] !== bIndices[0]) return aIndices[0] - bIndices[0];
        return a.label.localeCompare(b.label);
      }
      if (aValid) return -1;
      if (bValid) return 1;
      return a.label.localeCompare(b.label);
    };
    allWords = allWords.sort(sortByWordOrderAndDistance);
  } else if (searchWords.length === 1) {
    const word = searchWords[0];
    const sortByMatchIndex = (a: SearchDropdownOption, b: SearchDropdownOption) => {
      const aIndex = a.label.toLowerCase().split(/\s+/).findIndex(w => w.startsWith(word));
      const bIndex = b.label.toLowerCase().split(/\s+/).findIndex(w => w.startsWith(word));
      if (aIndex !== bIndex) return aIndex - bIndex;
      return a.label.localeCompare(b.label);
    };
    allWords = allWords.sort(sortByMatchIndex);
  }
  return [
    ...exact,
    ...firstWordExact,
    ...firstWordPrefix,
    ...wordStartsWith,
    ...allWords
  ];
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
  value: string | number
  onChange: (v: string) => void
  options: SearchDropdownOption[]
  label?: string
  className?: string
  size?: 'sm' | 'md'
  ariaLabel?: string
  fullWidth?: boolean
}) {
  const pad = size === 'md' ? 'px-3 py-2 text-sm' : 'px-2 py-1 text-xs'
  const [isOpen, setIsOpen] = React.useState(false)
  const [search, setSearch] = React.useState('')
  const dropdownRef = React.useRef<HTMLDivElement>(null)
  // Use the shared filterAndSortOptions function for filtering and sorting
  const filteredOptions = filterAndSortOptions(options, search);
  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    } else {
      setSearch('')
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])
  const selectedLabel = options.find(opt => String(opt.value) === String(value))?.label || ''
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
                      const next = document.getElementById(`dropdown-opt-${i+1}`);
                      if (next) next.focus();
                    } else if (e.key === 'ArrowUp') {
                      // Navigate up the list with ArrowUp
                      e.preventDefault();
                      if (i === 0) {
                        const searchInput = document.querySelector<HTMLInputElement>('input[placeholder="Search..."]');
                        if (searchInput) searchInput.focus();
                      } else {
                        const prev = document.getElementById(`dropdown-opt-${i-1}`);
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
