import type { ReactNode } from 'react'

export type Source = { title: string; url: string; snippet: string }

// Tiny, safe formatter (no innerHTML): code blocks, lists, **bold**, `code`, [n] citations.
function inline(text: string, sources: Source[], keyBase: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\[\d+\])/g)
  return parts.map((p, i) => {
    const k = `${keyBase}-${i}`
    if (p.startsWith('**') && p.endsWith('**') && p.length > 4) return <strong key={k}>{p.slice(2, -2)}</strong>
    if (p.startsWith('`') && p.endsWith('`') && p.length > 2)
      return (
        <code key={k} className="rounded bg-black/40 px-1.5 py-0.5 text-[0.85em] text-primary">
          {p.slice(1, -1)}
        </code>
      )
    const cite = p.match(/^\[(\d+)\]$/)
    if (cite) {
      const s = sources[Number(cite[1]) - 1]
      if (s)
        return (
          <a
            key={k}
            href={s.url}
            target="_blank"
            rel="noopener noreferrer"
            title={s.title}
            className="mx-0.5 inline-grid h-4 min-w-4 place-items-center rounded-full bg-primary/20 px-1 align-super text-[0.65rem] font-bold text-primary no-underline hover:bg-primary/35"
          >
            {cite[1]}
          </a>
        )
    }
    return p
  })
}

export function RichText({ text, sources = [] }: { text: string; sources?: Source[] }) {
  const blocks = text.split(/(```[\s\S]*?```)/g)
  return (
    <div className="space-y-2 leading-relaxed">
      {blocks.map((block, bi) => {
        if (block.startsWith('```')) {
          const code = block.replace(/^```[^\n]*\n?/, '').replace(/```$/, '')
          return (
            <pre key={bi} className="overflow-x-auto rounded-xl bg-black/50 p-3 text-xs">
              <code>{code}</code>
            </pre>
          )
        }
        const lines = block.split('\n')
        const out: ReactNode[] = []
        let list: ReactNode[] = []
        const flush = () => {
          if (list.length) out.push(<ul key={`l${out.length}`} className="ml-4 list-disc space-y-1 marker:text-primary">{list}</ul>)
          list = []
        }
        lines.forEach((raw, li) => {
          const line = raw.trimEnd()
          const k = `${bi}-${li}`
          const item = line.match(/^\s*(?:[-*•]|\d+[.)])\s+(.*)$/)
          if (item) {
            list.push(<li key={k}>{inline(item[1], sources, k)}</li>)
            return
          }
          flush()
          if (!line.trim()) return
          const h = line.match(/^#{1,4}\s+(.*)$/)
          if (h) out.push(<p key={k} className="font-semibold text-primary">{inline(h[1], sources, k)}</p>)
          else out.push(<p key={k}>{inline(line, sources, k)}</p>)
        })
        flush()
        return out
      })}
    </div>
  )
}
