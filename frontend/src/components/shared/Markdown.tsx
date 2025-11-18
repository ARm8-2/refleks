
function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function slugify(h: string) {
  return h
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

function basicMarkdownToHtml(src: string) {
  // 1) Extract code fences with placeholders to avoid rewriting inside them
  const FENCE_TOKEN_START = '\u0001REFLEKS_CODE_'
  const FENCE_TOKEN_END = '\u0001'
  const fences: string[] = []
  const withPlaceholders = String(src).replace(/```[\t ]*\n?([\s\S]*?)```/g, (_m, code) => {
    const idx = fences.push(escapeHtml(String(code))) - 1
    return `${FENCE_TOKEN_START}${idx}${FENCE_TOKEN_END}`
  })

  // 2) Escape non-code content
  let s = escapeHtml(withPlaceholders)

  // 2.5) Light normalization before parsing:
  // - Fix stray list markers directly before headings (e.g., "- ## Title" -> "## Title")
  // - Normalize "• " bullets to "- " so list parsing can recognize them
  s = s.replace(/(^|\n)[-*•]\s*(#{1,6}\s+)/g, '$1$2')
  s = s.replace(/^\s*•\s+/gm, '- ')

  // 3) Headings (add ids + classes) without TOC injection
  let h2Count = 0
  s = s.replace(/^\s*###\s+(.*)$/gm, (_m, h) => `<h3 id="${slugify(h)}" class="mk-h3">${h}</h3>`)
  s = s.replace(/^\s*##\s+(.*)$/gm, (_m, h) => {
    h2Count++
    const hr = h2Count > 1 ? '<hr class="mk-hr" />' : ''
    return `${hr}<h2 id="${slugify(h)}" class="mk-h2">${h}</h2>`
  })
  s = s.replace(/^\s*#\s+(.*)$/gm, (_m, h) => `<h1 id="${slugify(h)}" class="mk-h1">${h}</h1>`)
  // 4) Bold and italic (very naive)
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  s = s.replace(/\*(.+?)\*/g, '<em>$1</em>')
  // 5) Links [text](url)
  s = s.replace(/\[([^\]]+)\]\((https?:[^\)\s]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>')
  // 6) Lists: unordered (-,*) and ordered (1.) simple implementation; add classes
  // Unordered
  s = s.replace(/^(?:\s*[-*] .*(?:\r?\n|$))+?/gm, (block) => {
    const items = block.trim().split(/\r?\n/).map(l => l.replace(/^\s*[-*]\s+/, '').trim()).filter(Boolean)
    if (!items.length) return block
    return `<ul class="mk-ul">${items.map(it => `<li>${it}</li>`).join('')}</ul>`
  })
  // Ordered (\d. )
  s = s.replace(/^(?:\s*\d+\. .*(?:\r?\n|$))+?/gm, (block) => {
    const items = block.trim().split(/\r?\n/).map(l => l.replace(/^\s*\d+\.\s+/, '').trim()).filter(Boolean)
    if (!items.length) return block
    return `<ol class="mk-ol">${items.map(it => `<li>${it}</li>`).join('')}</ol>`
  })

  // 7) Restore code fences now so paragraphing treats them as block elements
  s = s.replace(new RegExp(FENCE_TOKEN_START + '(\\d+)' + FENCE_TOKEN_END, 'g'), (_m, idx) => {
    const i = Number(idx)
    const codeHtml = fences[i] ?? ''
    return `<pre class="mk-code"><code>${codeHtml}</code></pre>`
  })

  // 8) Paragraphs: wrap isolated lines (that are not already block-level) into <p>
  const chunks = s.split(/\r?\n\r?\n/)
  s = chunks.map(chunk => {
    const trimmed = chunk.trim()
    if (!trimmed) return ''
    if (/^<(h1|h2|h3|ul|ol|pre)/.test(trimmed)) return trimmed
    return `<p>${trimmed.replace(/\r?\n/g, '<br/>')}</p>`
  }).join('')
  return s
}

export function Markdown({ text }: { text: string }) {
  const html = basicMarkdownToHtml(text)
  return (
    <div className="markdown-root prose prose-invert max-w-none prose-sm" dangerouslySetInnerHTML={{ __html: html }} />
  )
}
