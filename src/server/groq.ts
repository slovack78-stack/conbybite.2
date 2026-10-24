// Minimal Groq client (OpenAI-compatible REST). The key lives only in the
// server environment (GROQ_API_KEY) and is never sent to the browser.

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string }

const ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions'

export class GroqError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message)
  }
}

export function groqConfigured() {
  return Boolean(process.env.GROQ_API_KEY)
}

function models(): string[] {
  const preferred = process.env.GROQ_MODEL?.trim()
  const defaults = ['llama-3.3-70b-versatile', 'openai/gpt-oss-120b', 'llama-3.1-8b-instant']
  return preferred ? [preferred, ...defaults.filter((m) => m !== preferred)] : defaults
}

export const FAST_MODEL = process.env.GROQ_FAST_MODEL?.trim() || 'llama-3.1-8b-instant'

export async function groqChat(
  messages: ChatMessage[],
  opts: { model?: string; temperature?: number; maxTokens?: number; json?: boolean } = {},
): Promise<{ content: string; model: string }> {
  const key = process.env.GROQ_API_KEY
  if (!key) throw new GroqError('GROQ_API_KEY não configurada no servidor.', 503)

  const candidates = opts.model ? [opts.model] : models()
  let lastErr: GroqError | null = null

  for (const model of candidates) {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 25000)
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        signal: ctrl.signal,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model,
          messages,
          temperature: opts.temperature ?? 0.5,
          max_tokens: opts.maxTokens ?? 1200,
          ...(opts.json ? { response_format: { type: 'json_object' } } : {}),
        }),
      })
      if (res.ok) {
        const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> }
        const content = data.choices?.[0]?.message?.content?.trim()
        if (content) return { content, model }
        lastErr = new GroqError('Resposta vazia do Groq.', 502)
        continue
      }
      // Never forward the upstream body (may echo request details).
      if (res.status === 401 || res.status === 403) throw new GroqError('Chave do Groq inválida ou sem permissão.', 502)
      if (res.status === 429) throw new GroqError('Limite de uso do Groq atingido. Tente novamente em instantes.', 429)
      // 400/404 usually mean the model is unavailable/decommissioned → try the next one.
      lastErr = new GroqError(`Modelo indisponível (${res.status}).`, 502)
    } catch (e) {
      if (e instanceof GroqError) throw e
      lastErr = new GroqError('Falha de conexão com o Groq.', 504)
    } finally {
      clearTimeout(t)
    }
  }
  throw lastErr ?? new GroqError('Falha ao consultar o Groq.', 502)
}
