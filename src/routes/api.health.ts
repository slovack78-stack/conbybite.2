import { createFileRoute } from '@tanstack/react-router'

import { groqConfigured } from '@/server/groq'

export const Route = createFileRoute('/api/health')({
  server: {
    handlers: {
      GET: () =>
        Response.json(
          { ok: true, name: 'CONBYBITE 2.0', developer: 'SLOVACK', groq: groqConfigured() ? 'configurado' : 'faltando GROQ_API_KEY' },
          { headers: { 'Cache-Control': 'no-store' } },
        ),
    },
  },
})
