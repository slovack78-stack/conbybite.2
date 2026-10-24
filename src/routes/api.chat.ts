import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

import { answer } from '@/server/assistant'
import { GroqError } from '@/server/groq'
import { rateLimited } from '@/server/rate-limit'

const input = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().trim().min(1).max(6000),
      }),
    )
    .min(1)
    .max(40),
  search: z.enum(['auto', 'on', 'off']).default('auto'),
})

const noStore = { 'Cache-Control': 'no-store' }

export const Route = createFileRoute('/api/chat')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (rateLimited(request)) {
          return Response.json({ error: 'Muitas mensagens em pouco tempo. Aguarde um minuto.' }, { status: 429, headers: noStore })
        }
        let body: unknown
        try {
          body = await request.json()
        } catch {
          return Response.json({ error: 'JSON inválido.' }, { status: 400, headers: noStore })
        }
        const parsed = input.safeParse(body)
        if (!parsed.success || parsed.data.messages.at(-1)?.role !== 'user') {
          return Response.json({ error: 'Mensagem inválida.' }, { status: 400, headers: noStore })
        }
        // Keep the context small: lower latency and token usage.
        const history = parsed.data.messages.slice(-12)
        try {
          const result = await answer(history, parsed.data.search)
          return Response.json(result, { headers: noStore })
        } catch (e) {
          const status = e instanceof GroqError ? e.status : 500
          const error = e instanceof GroqError ? e.message : 'Erro interno. Tente novamente.'
          return Response.json({ error }, { status, headers: noStore })
        }
      },
    },
  },
})
