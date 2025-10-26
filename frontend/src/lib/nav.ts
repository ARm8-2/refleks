export function goto(path: string) {
  if (window.location.pathname + window.location.search !== path) {
    window.history.pushState({}, '', path)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }
}

export function getQuery(): Record<string, string> {
  const out: Record<string, string> = {}
  const sp = new URLSearchParams(window.location.search)
  sp.forEach((v, k) => { out[k] = v })
  return out
}
