import { toBlob } from 'html-to-image'

export type CopyOptions = {
  pixelRatio?: number
  backgroundColor?: string
  cacheBust?: boolean
  quality?: number // for jpeg; we'll use png by default
}

// Convert a DOM node to an image and copy to the clipboard. Falls back to download if clipboard isn't available.
export async function copyNodeToClipboard(node: HTMLElement, opts: CopyOptions = {}): Promise<{ copied: boolean; blob?: Blob }> {
  // Ensure the node is in the DOM and visible enough to measure
  const pixelRatio = opts.pixelRatio ?? 2
  const backgroundColor = opts.backgroundColor
  const cacheBust = opts.cacheBust ?? false

  const blob = await toBlob(node, {
    pixelRatio,
    backgroundColor,
    cacheBust,
  })

  if (!blob) throw new Error('Failed to render image')

  // Try clipboard first
  try {
    const ClipboardItemCtor = (window as any).ClipboardItem
    if (ClipboardItemCtor && navigator.clipboard && (navigator.clipboard as any).write) {
      const item = new ClipboardItemCtor({ 'image/png': blob })
      await (navigator.clipboard as any).write([item])
      return { copied: true, blob }
    }
  } catch (e) {
    // Continue to fallback
    console.warn('Clipboard write failed; falling back to download', e)
  }

  // Fallback: trigger a download to let the user save/share manually
  try {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'refleks-share.png'
    document.body.appendChild(a)
    a.click()
    setTimeout(() => {
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    }, 0)
  } catch { /* ignore */ }

  return { copied: false, blob }
}
