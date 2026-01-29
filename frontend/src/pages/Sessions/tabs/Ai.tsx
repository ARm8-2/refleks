import { ScenarioRecord } from "../../../types/ipc";

export function AiTab({ sessionId, records }: { sessionId?: string; records?: ScenarioRecord[] }) {
  return <div className="text-sm text-secondary">Coming soon.</div>
}


// import { Send, Trash2 } from 'lucide-react'
// import { useEffect, useMemo, useRef, useState } from 'react'
// import { EventsOn } from '../../../../wailsjs/runtime'
// import { Button } from '../../../components/shared/Button'
// import { Markdown } from '../../../components/shared/Markdown'
// import { useUIState } from '../../../hooks/useUIState'
// import { cancelSessionInsights, generateSessionInsights, getSettings } from '../../../lib/internal'
// import type { ScenarioRecord, Settings } from '../../../types/ipc'

// type StreamEvent = { requestId: string; text?: string; error?: string; cached?: boolean }
// type ChatMsg = { role: 'user' | 'assistant'; content: string }

// export function AiTab({ sessionId, records }: { sessionId?: string; records?: ScenarioRecord[] }) {
//   const [prompt, setPrompt] = useState('')
//   const [requestId, setRequestId] = useState<string | null>(null)
//   const [hasKey, setHasKey] = useState<boolean>(false)
//   const [history, setHistory] = useUIState<ChatMsg[]>(`aiChat:${sessionId?.trim() || 'no-session'}`, [])

//   const scrollRef = useRef<HTMLDivElement | null>(null)
//   const currentReqRef = useRef<string | null>(null)
//   const bufferRef = useRef('')
//   const autoRanRef = useRef(false)
//   const continuationTriggeredRef = useRef(false)

//   useEffect(() => {
//     getSettings().then((s: Settings) => setHasKey(Boolean(s.geminiApiKey))).catch(() => setHasKey(false))
//   }, [])

//   // Stream wiring
//   useEffect(() => {
//     const offStart = EventsOn('ai:session:start', (e: StreamEvent) => {
//       if (!e?.requestId || e.requestId !== currentReqRef.current) return
//       bufferRef.current = ''
//       setHistory(prev => [...prev, { role: 'assistant', content: '' }])
//     })
//     const offDelta = EventsOn('ai:session:delta', (e: StreamEvent) => {
//       if (!e?.requestId || e.requestId !== currentReqRef.current) return
//       const t = e.text ?? ''
//       if (!t) return
//       bufferRef.current += t
//       const preview = normalizePreview(bufferRef.current)
//       setHistory(prev => {
//         if (prev.length === 0) return prev
//         const next = [...prev]
//         const last = next[next.length - 1]
//         if (last.role === 'assistant') last.content = preview
//         else next.push({ role: 'assistant', content: preview })
//         return next
//       })
//     })
//     const offError = EventsOn('ai:session:error', (e: StreamEvent) => {
//       if (!e?.requestId || e.requestId !== currentReqRef.current) return
//       setHistory(prev => [...prev, { role: 'assistant', content: `\n\n[Error] ${e?.error || 'Unknown error'}` }])
//     })
//     const offDone = EventsOn('ai:session:done', (e: StreamEvent) => {
//       if (!e?.requestId || e.requestId !== currentReqRef.current) return
//       setTimeout(() => setRequestId(null), 0)
//       currentReqRef.current = null
//       const raw = bufferRef.current
//       let finalized = finalizeAssistant(raw)
//       setHistory(prev => {
//         if (!prev.length) return prev
//         const next = [...prev]
//         const last = next[next.length - 1]
//         if (last.role === 'assistant') last.content = finalized
//         return next
//       })
//       // Auto continuation if incomplete and not yet triggered
//       if (!continuationTriggeredRef.current && needsContinuation(raw)) {
//         continuationTriggeredRef.current = true
//         void continueAnswer()
//       } else {
//         continuationTriggeredRef.current = false
//       }
//     })
//     return () => {
//       offStart(); offDelta(); offError(); offDone()
//       const rid = currentReqRef.current
//       if (rid) { cancelSessionInsights(rid).catch(() => { }); currentReqRef.current = null }
//     }
//   }, [setHistory, sessionId])

//   const disabled = useMemo(() => !hasKey || !records || records.length === 0, [hasKey, records])
//   const isStreaming = Boolean(requestId)

//   // Auto-scroll
//   useEffect(() => {
//     const el = scrollRef.current
//     if (el) el.scrollTop = el.scrollHeight
//   }, [history, requestId])

//   // Auto-run once per new session if empty
//   useEffect(() => { autoRanRef.current = false; setRequestId(null) }, [sessionId])
//   useEffect(() => {
//     if (!autoRanRef.current && hasKey && !isStreaming && history.length === 0 && records && records.length > 0) {
//       autoRanRef.current = true
//       void runSummary()
//     }
//   }, [hasKey, isStreaming, history.length, records])

//   async function runSummary() {
//     await sendCore("Give a concise analysis of this session. Include: key observations and short trend notes, top strengths, top weaknesses, and 3–5 scenario suggestions with one‑sentence rationales. Use clear H2 headings and bullet points. Keep it tight—no fluff.")
//   }

//   async function send() {
//     const q = prompt.trim()
//     if (!q || disabled || isStreaming) return
//     setPrompt('')
//     await sendCore(q)
//   }

//   async function sendCore(question: string) {
//     setHistory(prev => [...prev, { role: 'user', content: question }])
//     try {
//       const composed = composePrompt(history, question)
//       const id = await generateSessionInsights(sessionId ?? 'session', records ?? [], composed, { maxRunsPerScenario: 16, systemPersona: 'session-analyst' })
//       setRequestId(id)
//       currentReqRef.current = id
//       continuationTriggeredRef.current = false
//     } catch (err: any) {
//       setHistory(prev => [...prev, { role: 'assistant', content: `[Error] ${err?.message || String(err)}` }])
//     }
//   }

//   async function continueAnswer() {
//     // Use last assistant content context, request only missing continuation
//     const lastAssistant = history.filter(h => h.role === 'assistant').slice(-1)[0]?.content || ''
//     const tail = lastAssistant.split('\n').slice(-6).join('\n').slice(-400)
//     const contPrompt = [
//       'Continue and finish the previous answer. Only provide the missing remainder of the last incomplete sentence or bullet.',
//       'Do NOT repeat already supplied text. No new headings unless required to finish an existing section.',
//       'If the answer actually seems complete, reply with a single line: "(No continuation needed)".',
//       '',
//       'Context tail:',
//       tail,
//     ].join('\n')
//     try {
//       const id = await generateSessionInsights(sessionId ?? 'session', records ?? [], contPrompt, { maxRunsPerScenario: 8, systemPersona: 'session-analyst' })
//       setRequestId(id)
//       currentReqRef.current = id
//       // Reuse existing last assistant message instead of pushing a new one
//       bufferRef.current = ''
//     } catch (err: any) {
//       // Surface error as appended note
//       setHistory(prev => {
//         if (!prev.length) return prev
//         const next = [...prev]
//         const last = next[next.length - 1]
//         if (last.role === 'assistant') last.content += `\n\n[Continuation error] ${err?.message || String(err)}`
//         return next
//       })
//     }
//   }

//   function clearChat() {
//     if (isStreaming) return
//     setHistory([])
//   }

//   return (
//     <div className="flex flex-col h-full gap-3">
//       {!hasKey && (
//         <div className="text-sm text-secondary">Set your Gemini API key in the RefleK's settings to enable AI insights.</div>
//       )}
//       <div className="flex items-center justify-between">
//         <div className="text-sm font-medium opacity-70">Session AI Insights</div>
//         <div className="flex items-center gap-2">
//           {!isStreaming && (
//             <Button variant="secondary" size="sm" onClick={clearChat} disabled={history.length === 0}><Trash2 size={16} /> Clear</Button>
//           )}
//           {isStreaming && (
//             <Button variant="secondary" size="sm" onClick={() => { const rid = currentReqRef.current; if (rid) cancelSessionInsights(rid).catch(() => { }); currentReqRef.current = null; setRequestId(null) }}>Stop</Button>
//           )}
//         </div>
//       </div>
//       <div ref={scrollRef} className="flex-1 min-h-0 overflow-auto p-3 rounded border border-primary bg-surface-2 text-sm space-y-4">
//         {history.length === 0 ? (
//           <div className="text-secondary">Ask a question about this session, or try: “Give a concise analysis with key observations, strengths/weaknesses, and 3–5 scenario suggestions with brief rationales.”</div>
//         ) : (
//           history.map((m, i) => (
//             <div key={i}>
//               <div className="text-xs mb-1 opacity-70">{m.role === 'user' ? 'You' : 'Assistant'}</div>
//               <Markdown text={m.content} />
//             </div>
//           ))
//         )}
//       </div>
//       <div className="flex items-center gap-2 sticky bottom-0 bg-primary/80 backdrop-blur supports-[backdrop-filter]:bg-primary/60 py-2">
//         <div className="relative flex-1">
//           <input
//             value={prompt}
//             onChange={e => setPrompt(e.target.value)}
//             onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send() } }}
//             placeholder="Ask a follow-up..."
//             className="w-full pr-10 pl-3 py-2 rounded bg-surface-3 border border-primary"
//           />
//           {!isStreaming && (
//             <button
//               aria-label="Send"
//               title="Send"
//               onClick={() => void send()}
//               disabled={disabled}
//               className={`absolute right-1 top-1/2 -translate-y-1/2 p-2 rounded ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-surface-2'} text-primary`}
//             >
//               <Send size={18} />
//             </button>
//           )}
//         </div>
//       </div>
//     </div>
//   )
// }

// function composePrompt(history: ChatMsg[], question: string): string {
//   // Include up to the last 10 turns for context (trimmed), but make the new question primary
//   const turns = history.slice(-10)
//   const context = turns.map(m => (m.role === 'user' ? `Q: ${m.content}` : `A: ${m.content}`)).join('\n')
//   return [
//     `New question: ${question}`,
//     '',
//     'Answer the new question directly, based only on the provided session data and the short context below. Be concise. Do not re-summarize the entire session unless explicitly asked.',
//     '- Prefer a short paragraph or 2–5 concise bullets.',
//     '- If asked for scenario suggestions, list 3–5 with a one‑sentence rationale each.',
//     '- Avoid role labels, avoid repeating prior headings, and keep numbers tidy (e.g., 78%, 1.3s).',
//     context ? `\nPrevious Q&A (trimmed):\n${context}\n` : '',
//   ].filter(Boolean).join('\n')
// }

// function finalizeAssistant(raw: string): string {
//   if (!raw) return ''
//   let s = raw.replace(/\r\n?/g, '\n')
//   // Drop any leading role labels (defensive)
//   s = s
//     .split('\n')
//     .filter(l => !/^\s*(user|assistant)\s*:/i.test(l))
//     .join('\n')
//   // Join words split by a single newline during streaming
//   s = s.replace(/([A-Za-z0-9])\n(?=[A-Za-z0-9])/g, '$1 ')
//   // Collapse 3+ blank lines to 2
//   s = s.replace(/\n{3,}/g, '\n\n')
//   return s.trim()
// }

// function normalizePreview(raw: string): string {
//   if (!raw) return ''
//   let s = raw.replace(/\r\n?/g, '\n')
//   // If the model splits a word/sentence across lines, join with a space to preserve word boundaries
//   s = s.replace(/([A-Za-z0-9])\n(?=[A-Za-z0-9])/g, '$1 ')
//   s = s.replace(/\n{3,}/g, '\n\n')
//   return s
// }

// function needsContinuation(raw: string): boolean {
//   if (!raw) return false
//   const trimmed = raw.trimEnd()
//   // If ends with typical completion punctuation or closing code fence, assume complete
//   if (/[.!?)]\s*$/.test(trimmed) || /```\s*$/.test(trimmed)) return false
//   // Detect truncated bullet (starts with dash, ends without punctuation and short)
//   const lines = trimmed.split('\n').filter(l => l.trim() !== '')
//   const last = lines[lines.length - 1]
//   if (/^[-*]\s+/.test(last) && !/[.!?]$/.test(last.trim()) && last.trim().length < 120) return true
//   // Heading with no following content
//   if (/^##\s+/.test(last)) return true
//   // Ends mid-word (no vowel after last character pattern) simplistic heuristic
//   if (/[a-zA-Z]{3,}$/.test(last) && !/[.!?]$/.test(last)) return true
//   return false
// }
