#!/usr/bin/env node
// CONBYBITE 2.0 — cliente de terminal para Termux (Android) e qualquer Node 18+.
// HELLO FRIEND — BY SLOVACK
//
// Não guarda nenhuma chave: conversa com o servidor do CONBYBITE (que tem a chave
// do Groq protegida). Voz usa o Termux:API (termux-tts-speak / termux-speech-to-text).
//
// Uso:
//   node conbybite.mjs                  # chat por texto
//   node conbybite.mjs --voz            # lê as respostas em voz alta
//   node conbybite.mjs --maos-livres    # conversa só por voz (fala → ouve → responde)
//   node conbybite.mjs --pesquisa=on    # auto | on | off
//   node conbybite.mjs --teste          # verifica a conexão e sai
// Variável opcional: CONBYBITE_URL (padrão: https://conbybite-2.netlify.app)

import { spawn } from 'node:child_process'
import readline from 'node:readline'

const BASE = (process.env.CONBYBITE_URL || 'https://conbybite-2.netlify.app').replace(/\/$/, '')
const args = new Set(process.argv.slice(2))
const handsFree = args.has('--maos-livres')
const voice = handsFree || args.has('--voz')
const search = (process.argv.find((a) => a.startsWith('--pesquisa=')) || '--pesquisa=auto').split('=')[1]

const c = { cyan: '\x1b[96m', dim: '\x1b[2m', bold: '\x1b[1m', red: '\x1b[91m', reset: '\x1b[0m' }
const history = []

function run(cmd, cmdArgs, input) {
  return new Promise((resolve) => {
    const p = spawn(cmd, cmdArgs, { stdio: [input ? 'pipe' : 'ignore', 'pipe', 'ignore'] })
    let out = ''
    p.stdout.on('data', (d) => (out += d))
    p.on('error', () => resolve(null))
    p.on('close', () => resolve(out.trim()))
    if (input) {
      p.stdin.end(input)
    }
  })
}

const speakable = (t) =>
  t.replace(/```[\s\S]*?```/g, ' ').replace(/https?:\/\/\S+/g, '').replace(/\[\d+\]/g, '').replace(/[*_#>`|]/g, '')

async function say(text) {
  if (!voice) return
  // -p pitch, -r rate. Pitch < 1 deixa a voz mais grave (masculina).
  const r = await run('termux-tts-speak', ['-l', 'pt', '-n', 'BR', '-p', '0.8', '-r', '1.0'], speakable(text))
  if (r === null) console.log(`${c.dim}(instale: pkg install termux-api + app Termux:API para ter voz)${c.reset}`)
}

async function listen() {
  process.stdout.write(`${c.cyan}🎙  ouvindo…${c.reset}\n`)
  const out = await run('termux-speech-to-text', [])
  if (out === null) {
    console.log(`${c.red}termux-speech-to-text indisponível. Instale termux-api e o app Termux:API.${c.reset}`)
    process.exit(1)
  }
  return out.split('\n').pop()?.trim() || ''
}

async function ask(text) {
  history.push({ role: 'user', content: text.slice(0, 6000) })
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 60000)
  try {
    const res = await fetch(`${BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: history.slice(-12), search }),
      signal: ctrl.signal,
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok || !data.reply) throw new Error(data.error || `HTTP ${res.status}`)
    history.push({ role: 'assistant', content: data.reply })
    console.log(`\n${c.cyan}${c.bold}CONBYBITE ›${c.reset} ${data.reply}`)
    if (data.sources?.length) {
      console.log(`${c.dim}Fontes:`)
      data.sources.forEach((s, i) => console.log(`  [${i + 1}] ${s.title} — ${s.url}`))
      process.stdout.write(c.reset)
    }
    console.log()
    await say(data.reply)
  } catch (e) {
    history.pop()
    console.log(`${c.red}Erro: ${e.name === 'AbortError' ? 'tempo esgotado' : e.message}${c.reset}\n`)
  } finally {
    clearTimeout(t)
  }
}

async function banner() {
  console.log(`\n${c.cyan}${c.bold}   H E L L O   F R I E N D${c.reset}`)
  console.log(`${c.dim}        ─────────────\n         B Y  S L O V A C K${c.reset}`)
  console.log(`${c.dim}   CONBYBITE 2.0 · servidor: ${BASE} · pesquisa: ${search}${c.reset}\n`)
}

async function health() {
  try {
    const r = await fetch(`${BASE}/api/health`)
    const d = await r.json()
    console.log(`${d.ok ? '✅' : '❌'} servidor online · Groq: ${d.groq}`)
    return d.ok && d.groq === 'configurado'
  } catch {
    console.log(`❌ não consegui acessar ${BASE}`)
    return false
  }
}

await banner()
const ok = await health()
if (args.has('--teste')) {
  if (ok) await ask('Responda em uma frase: quem é o seu desenvolvedor?')
  process.exit(ok ? 0 : 1)
}

if (handsFree) {
  console.log(`${c.dim}Modo mãos livres. Diga "parar" para sair.${c.reset}\n`)
  await say('Hello friend. Mãos livres ativado.')
  for (;;) {
    const heard = await listen()
    if (!heard) continue
    console.log(`você › ${heard}`)
    if (/^(parar|pare|sair|tchau|encerrar)\b/i.test(heard)) {
      await say('Até logo, amigo.')
      break
    }
    await ask(heard)
  }
  process.exit(0)
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
const prompt = () =>
  rl.question(`${c.bold}você ›${c.reset} `, async (line) => {
    const text = line.trim()
    if (['/sair', 'sair', 'exit'].includes(text)) return rl.close()
    if (text === '/limpar') history.length = 0
    else if (text) await ask(text)
    prompt()
  })
console.log(`${c.dim}Digite sua pergunta. Comandos: /limpar, /sair${c.reset}\n`)
prompt()
