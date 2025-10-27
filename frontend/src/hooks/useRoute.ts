import { useCallback, useEffect, useState } from 'react'

export function useRoute() {
  const [path, setPath] = useState<string>(window.location.pathname)
  const [query, setQueryState] = useState<Record<string, string>>(getQuery())

  useEffect(() => {
    const onPop = () => {
      setPath(window.location.pathname)
      setQueryState(getQuery())
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  // Expose a stable navigate function without shadowing the module export
  const go = useCallback((to: string, opts?: { replace?: boolean; preserveSearch?: boolean }) => {
    navigate(to, opts)
  }, [])

  return { path, query, navigate: go }
}

function buildUrl(path: string, preserveSearch = false): string {
  const url = new URL(path, window.location.origin)
  if (preserveSearch && !path.includes('?')) {
    url.search = window.location.search
  }
  return url.pathname + url.search
}

export function navigate(path: string, opts?: { replace?: boolean; preserveSearch?: boolean }) {
  const target = buildUrl(path, !!opts?.preserveSearch)
  const current = window.location.pathname + window.location.search
  if (current !== target) {
    if (opts?.replace) window.history.replaceState({}, '', target)
    else window.history.pushState({}, '', target)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }
}

export function getQuery(): Record<string, string> {
  const out: Record<string, string> = {}
  const sp = new URLSearchParams(window.location.search)
  sp.forEach((v, k) => { out[k] = v })
  return out
}

export function setQuery(updates: Record<string, string | undefined>, opts?: { replace?: boolean }) {
  const url = new URL(window.location.href)
  for (const [k, v] of Object.entries(updates)) {
    if (v == null || v === '') url.searchParams.delete(k)
    else url.searchParams.set(k, v)
  }
  const target = url.pathname + url.search
  const current = window.location.pathname + window.location.search
  if (current !== target) {
    if (opts?.replace) window.history.replaceState({}, '', target)
    else window.history.pushState({}, '', target)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }
}
