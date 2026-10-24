// Real web search used to ground answers. No key is required (DuckDuckGo HTML +
// Wikipedia). If TAVILY_API_KEY is set, Tavily is used first for better results.

export type Source = { title: string; url: string; snippet: string }

const UA =
  'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Mobile Safari/537.36 CONBYBITE/2.0'

async function fetchWithTimeout(url: string, init: RequestInit = {}, ms = 6000) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), ms)
  try {
    return await fetch(url, { ...init, signal: ctrl.signal })
  } finally {
    clearTimeout(t)
  }
}

function decodeEntities(s: string) {
  return s
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, ' ')
    .trim()
}

function isHttpUrl(u: string) {
  try {
    const p = new URL(u)
    return p.protocol === 'https:' || p.protocol === 'http:'
  } catch {
    return false
  }
}

async function tavily(query: string): Promise<Source[]> {
  const key = process.env.TAVILY_API_KEY
  if (!key) return []
  const res = await fetchWithTimeout('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ query, max_results: 6, search_depth: 'basic' }),
  })
  if (!res.ok) return []
  const data = (await res.json()) as { results?: Array<{ title?: string; url?: string; content?: string }> }
  return (data.results ?? [])
    .filter((r) => r.url && isHttpUrl(r.url))
    .map((r) => ({ title: r.title ?? r.url!, url: r.url!, snippet: (r.content ?? '').slice(0, 500) }))
}

async function duckduckgo(query: string): Promise<Source[]> {
  const res = await fetchWithTimeout('https://html.duckduckgo.com/html/', {
    method: 'POST',
    headers: {
      'User-Agent': UA,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
    },
    body: new URLSearchParams({ q: query, kl: 'br-pt' }).toString(),
  })
  if (!res.ok) return []
  const html = await res.text()
  const out: Source[] = []
  const blocks = html.split('class="result__body"').slice(1)
  for (const b of blocks) {
    const a = b.match(/class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/)
    if (!a) continue
    let url = a[1].replace(/&amp;/g, '&')
    const uddg = url.match(/[?&]uddg=([^&]+)/)
    if (uddg) url = decodeURIComponent(uddg[1])
    if (url.startsWith('//')) url = 'https:' + url
    if (!isHttpUrl(url) || url.includes('duckduckgo.com/y.js')) continue
    const sn = b.match(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/)
    out.push({ title: decodeEntities(a[2]), url, snippet: sn ? decodeEntities(sn[1]) : '' })
    if (out.length >= 6) break
  }
  return out
}

async function wikipedia(query: string, lang: 'pt' | 'en'): Promise<Source[]> {
  const url = `https://${lang}.wikipedia.org/w/api.php?action=query&list=search&format=json&srlimit=3&utf8=1&srsearch=${encodeURIComponent(query)}`
  const res = await fetchWithTimeout(url, { headers: { 'User-Agent': UA } })
  if (!res.ok) return []
  const data = (await res.json()) as { query?: { search?: Array<{ title: string; snippet: string }> } }
  return (data.query?.search ?? []).map((r) => ({
    title: `${r.title} — Wikipédia`,
    url: `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(r.title.replace(/ /g, '_'))}`,
    snippet: decodeEntities(r.snippet),
  }))
}

export async function webSearch(query: string): Promise<Source[]> {
  const q = query.slice(0, 200)
  const settled = await Promise.allSettled([tavily(q), duckduckgo(q), wikipedia(q, 'pt'), wikipedia(q, 'en')])
  const seen = new Set<string>()
  const all: Source[] = []
  for (const r of settled) {
    if (r.status !== 'fulfilled') continue
    for (const s of r.value) {
      const key = s.url.replace(/[#?].*$/, '').replace(/\/$/, '')
      if (seen.has(key)) continue
      seen.add(key)
      all.push(s)
    }
  }
  return all.slice(0, 8)
}
