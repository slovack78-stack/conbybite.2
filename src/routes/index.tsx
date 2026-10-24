import { createFileRoute } from '@tanstack/react-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Globe, Headphones, Mic, MicOff, SendHorizontal, Settings2, Square, Trash2, Volume2, VolumeX } from 'lucide-react'
import { toast } from 'sonner'

import { Ambient } from '@/components/cb/ambient'
import { Avatar, type AvatarKind, type AvatarState } from '@/components/cb/avatar'
import { RichText, type Source } from '@/components/cb/rich-text'
import { Splash } from '@/components/cb/splash'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Switch } from '@/components/ui/switch'
import {
  createRecognizer,
  isLikelyMale,
  listVoices,
  pickMaleVoice,
  speak,
  stopSpeaking,
  sttSupported,
  ttsSupported,
} from '@/lib/voice'

export const Route = createFileRoute('/')({
  component: Home,
})

type Msg = { id: string; role: 'user' | 'assistant'; content: string; sources?: Source[]; error?: boolean; query?: string | null }
type SearchMode = 'auto' | 'on' | 'off'
type Settings = { avatar: AvatarKind; voiceOn: boolean; voiceURI: string | null; search: SearchMode }

const DEFAULT_SETTINGS: Settings = { avatar: 'sphere', voiceOn: true, voiceURI: null, search: 'auto' }
const SUGGESTIONS = [
  'Quem é o seu desenvolvedor?',
  'Quais são as notícias de tecnologia de hoje?',
  'Explique buracos negros de forma simples',
  'Me ajude a criar um script em Python no Termux',
]
const STOP_WORDS = /^(parar|pare|desligar|encerrar|tchau|sair)( mãos livres)?[.!]?$/i

const uid = () => Math.random().toString(36).slice(2, 10)

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback
  } catch {
    return fallback
  }
}

function Home() {
  const [splash, setSplash] = useState(true)
  const [messages, setMessages] = useState<Msg[]>([])
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [input, setInput] = useState('')
  const [status, setStatus] = useState<AvatarState>('idle')
  const [interim, setInterim] = useState('')
  const [handsFree, setHandsFree] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [groqReady, setGroqReady] = useState<boolean | null>(null)
  const [support, setSupport] = useState({ stt: false, tts: false })

  const handsFreeRef = useRef(false)
  const busyRef = useRef(false)
  const recRef = useRef<ReturnType<typeof createRecognizer>>(null)
  const messagesRef = useRef<Msg[]>([])
  const settingsRef = useRef(settings)
  const voicesRef = useRef(voices)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesRef.current = messages
    settingsRef.current = settings
    voicesRef.current = voices
  })

  // ---- hydrate local state (client only) ----
  useEffect(() => {
    setSettings(load('cb.settings', DEFAULT_SETTINGS))
    try {
      const saved = JSON.parse(localStorage.getItem('cb.chat') ?? '[]') as Msg[]
      if (Array.isArray(saved)) setMessages(saved.slice(-60))
    } catch {
      /* ignore corrupted history */
    }
    setSupport({ stt: sttSupported(), tts: ttsSupported() })
    if (ttsSupported()) {
      const update = () => setVoices(listVoices())
      update()
      window.speechSynthesis.addEventListener('voiceschanged', update)
      return () => window.speechSynthesis.removeEventListener('voiceschanged', update)
    }
  }, [])

  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json())
      .then((d: { groq?: string }) => setGroqReady(d.groq === 'configurado'))
      .catch(() => setGroqReady(null))
  }, [])

  useEffect(() => {
    localStorage.setItem('cb.settings', JSON.stringify(settings))
  }, [settings])

  useEffect(() => {
    localStorage.setItem('cb.chat', JSON.stringify(messages.filter((m) => !m.error).slice(-60)))
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, status])

  const currentVoice = useCallback(
    () => pickMaleVoice(voicesRef.current, settingsRef.current.voiceURI),
    [],
  )

  // ---- listening ----
  const stopListening = useCallback(() => {
    recRef.current?.abort()
    recRef.current = null
    setInterim('')
  }, [])

  const startListening = useCallback(() => {
    if (!sttSupported()) {
      toast.error('Reconhecimento de voz indisponível neste navegador. Use o Chrome no Android.')
      return
    }
    stopSpeaking()
    recRef.current?.abort()
    let gotFinal = false
    const rec = createRecognizer({
      onInterim: (t) => setInterim(t),
      onFinal: (t) => {
        gotFinal = true
        setInterim('')
        if (handsFreeRef.current && STOP_WORDS.test(t.trim())) {
          handsFreeRef.current = false
          setHandsFree(false)
          setStatus('idle')
          speak('Mãos livres desligado. Até já, amigo.', currentVoice())
          return
        }
        void sendRef.current(t)
      },
      onError: (err) => {
        if (err === 'not-allowed' || err === 'service-not-allowed') {
          handsFreeRef.current = false
          setHandsFree(false)
          toast.error('Permita o uso do microfone para conversar por voz.')
        }
      },
      onEnd: () => {
        recRef.current = null
        setInterim('')
        if (gotFinal) return
        if (handsFreeRef.current && !busyRef.current) {
          // Silence timeout: keep listening in hands-free mode.
          setTimeout(() => handsFreeRef.current && !busyRef.current && startListening(), 350)
        } else if (!busyRef.current) setStatus('idle')
      },
    })
    if (!rec) return
    recRef.current = rec
    setStatus('listening')
    try {
      rec.start()
    } catch {
      /* already started */
    }
  }, [currentVoice])

  // ---- sending ----
  const send = useCallback(
    async (text: string) => {
      const content = text.trim()
      if (!content || busyRef.current) return
      busyRef.current = true
      stopListening()
      stopSpeaking()
      const userMsg: Msg = { id: uid(), role: 'user', content }
      const history = [...messagesRef.current.filter((m) => !m.error), userMsg]
      setMessages((m) => [...m, userMsg])
      setInput('')
      setStatus('thinking')

      let reply: Msg
      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: history.slice(-12).map((m) => ({ role: m.role, content: m.content.slice(0, 6000) })),
            search: settingsRef.current.search,
          }),
        })
        const data = (await res.json().catch(() => ({}))) as {
          reply?: string
          sources?: Source[]
          query?: string | null
          error?: string
        }
        if (!res.ok || !data.reply) throw new Error(data.error ?? 'Não consegui responder agora.')
        reply = { id: uid(), role: 'assistant', content: data.reply, sources: data.sources ?? [], query: data.query }
      } catch (e) {
        reply = { id: uid(), role: 'assistant', content: e instanceof Error ? e.message : 'Erro de conexão.', error: true }
      }
      setMessages((m) => [...m, reply])
      busyRef.current = false

      const shouldSpeak = (settingsRef.current.voiceOn || handsFreeRef.current) && ttsSupported()
      if (shouldSpeak) {
        speak(reply.content, currentVoice(), {
          onStart: () => setStatus('speaking'),
          onEnd: () => {
            setStatus('idle')
            if (handsFreeRef.current) setTimeout(() => handsFreeRef.current && startListening(), 300)
          },
        })
      } else {
        setStatus('idle')
        if (handsFreeRef.current) startListening()
      }
    },
    [currentVoice, startListening, stopListening],
  )
  const sendRef = useRef(send)
  useEffect(() => {
    sendRef.current = send
  })

  const toggleHandsFree = (on: boolean) => {
    handsFreeRef.current = on
    setHandsFree(on)
    if (on) {
      if (!support.stt) {
        toast.error('Mãos livres precisa de reconhecimento de voz (Chrome no Android ou desktop).')
        handsFreeRef.current = false
        setHandsFree(false)
        return
      }
      speak('Hello friend. Mãos livres ativado. Pode falar.', currentVoice(), {
        onEnd: () => handsFreeRef.current && startListening(),
      })
      if (!support.tts) startListening()
    } else {
      stopListening()
      stopSpeaking()
      if (!busyRef.current) setStatus('idle')
    }
  }

  const micClick = () => {
    if (status === 'listening') {
      stopListening()
      setStatus('idle')
    } else startListening()
  }

  const clearChat = () => {
    stopSpeaking()
    setMessages([])
    setSettingsOpen(false)
    toast.success('Conversa apagada deste dispositivo.')
  }

  const update = (patch: Partial<Settings>) => setSettings((s) => ({ ...s, ...patch }))
  const ptVoices = voices.filter((v) => v.lang.toLowerCase().startsWith('pt'))
  const voiceOptions = ptVoices.length ? ptVoices : voices
  const statusLabel = {
    idle: handsFree ? 'Mãos livres ativo' : 'Pronto',
    listening: 'Ouvindo…',
    thinking: settings.search === 'off' ? 'Pensando…' : 'Pensando e pesquisando…',
    speaking: 'Falando…',
  }[status]

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden">
      <Ambient />
      {splash && <Splash onDone={() => setSplash(false)} />}

      {/* header */}
      <header className="relative z-10 flex items-center gap-3 px-4 pt-[max(env(safe-area-inset-top),0.75rem)] pb-3">
        <Avatar kind={settings.avatar} state={status} size={44} />
        <div className="min-w-0 flex-1">
          <p className="font-brand text-sm text-foreground">CONBYBITE 2.0</p>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span
              className={`h-1.5 w-1.5 rounded-full ${groqReady === false ? 'bg-destructive' : status === 'idle' ? 'bg-primary' : 'bg-primary animate-pulse'}`}
            />
            {statusLabel} · by SLOVACK
          </p>
        </div>
        <Button
          size="icon"
          variant="ghost"
          aria-label={settings.voiceOn ? 'Desativar voz' : 'Ativar voz'}
          onClick={() => {
            if (settings.voiceOn) stopSpeaking()
            update({ voiceOn: !settings.voiceOn })
          }}
        >
          {settings.voiceOn ? <Volume2 /> : <VolumeX />}
        </Button>
        <Button size="icon" variant="ghost" aria-label="Configurações" onClick={() => setSettingsOpen(true)}>
          <Settings2 />
        </Button>
      </header>

      {groqReady === false && (
        <div className="relative z-10 mx-4 mb-2 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-foreground">
          O servidor ainda não tem a chave do Groq. Configure a variável <code>GROQ_API_KEY</code> no Netlify (veja o README).
        </div>
      )}

      {/* messages */}
      <main ref={scrollRef} className="relative z-10 flex-1 overflow-y-auto px-4 pb-4">
        <div className="mx-auto flex max-w-2xl flex-col gap-4">
          {messages.length === 0 && (
            <section className="flex flex-col items-center pt-8 text-center">
              <Avatar kind={settings.avatar} state={status} size={150} />
              <h2 className="font-brand mt-6 text-xl tracking-[0.18em]">HELLO FRIEND</h2>
              <p className="font-brand mt-2 text-[0.65rem] tracking-[0.5em] text-primary">BY SLOVACK</p>
              <p className="mt-5 max-w-sm text-sm text-muted-foreground">
                Sou o CONBYBITE 2.0. Pergunte qualquer coisa — eu pesquiso na internet quando preciso e mostro as fontes.
                Ative o <strong className="text-foreground">mãos livres</strong> para conversar só por voz.
              </p>
              <div className="mt-6 grid w-full gap-2 sm:grid-cols-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => void send(s)}
                    className="cb-glass rounded-2xl px-4 py-3 text-left text-sm text-foreground/90 transition hover:border-primary/50"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </section>
          )}

          {messages.map((m) =>
            m.role === 'user' ? (
              <div key={m.id} className="cb-msg-in ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-primary/15 px-4 py-2.5 text-sm text-foreground">
                {m.content}
              </div>
            ) : (
              <div
                key={m.id}
                className={`cb-msg-in cb-glass max-w-[92%] rounded-2xl rounded-bl-md px-4 py-3 text-sm ${m.error ? 'border-destructive/50 text-destructive-foreground' : ''}`}
              >
                <RichText text={m.content} sources={m.sources} />
                {!!m.sources?.length && (
                  <div className="mt-3 border-t border-border pt-2">
                    <p className="mb-1.5 flex items-center gap-1 text-[0.7rem] uppercase tracking-wider text-muted-foreground">
                      <Globe className="size-3" /> Fontes {m.query ? `· “${m.query}”` : ''}
                    </p>
                    <ol className="space-y-1">
                      {m.sources.map((s, i) => (
                        <li key={s.url} className="truncate text-xs">
                          <span className="mr-1 text-primary">[{i + 1}]</span>
                          <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-foreground/80 underline-offset-2 hover:underline">
                            {s.title}
                          </a>
                          <span className="ml-1 text-muted-foreground">{new URL(s.url).hostname.replace(/^www\./, '')}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
                {!m.error && support.tts && (
                  <button
                    className="mt-2 flex items-center gap-1 text-[0.7rem] text-muted-foreground hover:text-primary"
                    onClick={() =>
                      speak(m.content, currentVoice(), { onStart: () => setStatus('speaking'), onEnd: () => setStatus('idle') })
                    }
                  >
                    <Volume2 className="size-3" /> Ouvir
                  </button>
                )}
              </div>
            ),
          )}

          {status === 'thinking' && (
            <div className="cb-glass cb-dots w-fit rounded-2xl px-4 py-3" aria-label="Pensando">
              <span />
              <span />
              <span />
            </div>
          )}
          {interim && <p className="ml-auto max-w-[85%] text-right text-sm italic text-muted-foreground">{interim}…</p>}
        </div>
      </main>

      {/* composer */}
      <footer className="relative z-10 px-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
        <div className="mx-auto max-w-2xl">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
            <label className="cb-glass flex items-center gap-2 rounded-full px-3 py-1.5">
              <Headphones className="size-3.5 text-primary" /> Mãos livres
              <Switch checked={handsFree} onCheckedChange={toggleHandsFree} aria-label="Modo mãos livres" />
            </label>
            <div className="cb-glass flex items-center rounded-full p-0.5" role="radiogroup" aria-label="Pesquisa na internet">
              <Globe className="ml-2 size-3.5 text-primary" />
              {(['auto', 'on', 'off'] as const).map((mode) => (
                <button
                  key={mode}
                  role="radio"
                  aria-checked={settings.search === mode}
                  onClick={() => update({ search: mode })}
                  className={`rounded-full px-2.5 py-1 transition ${settings.search === mode ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
                >
                  {mode === 'auto' ? 'Auto' : mode === 'on' ? 'Sempre' : 'Off'}
                </button>
              ))}
            </div>
            {status === 'speaking' && (
              <button
                onClick={() => {
                  stopSpeaking()
                  setStatus('idle')
                  if (handsFreeRef.current) startListening()
                }}
                className="cb-glass flex items-center gap-1 rounded-full px-3 py-1.5 text-primary"
              >
                <Square className="size-3" /> Parar voz
              </button>
            )}
          </div>
          <form
            className="cb-glass flex items-end gap-2 rounded-3xl p-2"
            onSubmit={(e) => {
              e.preventDefault()
              void send(input)
            }}
          >
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  void send(input)
                }
              }}
              rows={1}
              maxLength={6000}
              placeholder={handsFree ? 'Fale comigo… (diga “parar” para sair)' : 'Pergunte ao CONBYBITE…'}
              className="max-h-36 min-h-10 flex-1 resize-none bg-transparent px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
            {support.stt && (
              <Button
                type="button"
                size="icon"
                variant={status === 'listening' ? 'default' : 'ghost'}
                className="rounded-full"
                aria-label={status === 'listening' ? 'Parar de ouvir' : 'Falar'}
                onClick={micClick}
              >
                {status === 'listening' ? <MicOff /> : <Mic />}
              </Button>
            )}
            <Button type="submit" size="icon" className="rounded-full" aria-label="Enviar" disabled={!input.trim() || status === 'thinking'}>
              <SendHorizontal />
            </Button>
          </form>
        </div>
      </footer>

      {/* settings */}
      <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
        <SheetContent side="right" className="border-border bg-card">
          <SheetHeader>
            <SheetTitle className="font-brand text-base">Configurações</SheetTitle>
            <SheetDescription>CONBYBITE 2.0 — desenvolvido por SLOVACK</SheetDescription>
          </SheetHeader>
          <div className="space-y-6 px-4 text-sm">
            <section>
              <p className="mb-2 font-medium">Avatar</p>
              <div className="grid grid-cols-2 gap-2">
                {(['sphere', 'robot'] as const).map((k) => (
                  <button
                    key={k}
                    onClick={() => update({ avatar: k })}
                    className={`flex flex-col items-center gap-1 rounded-2xl border p-3 transition ${settings.avatar === k ? 'border-primary bg-primary/10' : 'border-border'}`}
                  >
                    <Avatar kind={k} state="idle" size={64} />
                    {k === 'sphere' ? 'Esfera' : 'Robozinho'}
                  </button>
                ))}
              </div>
            </section>

            <section>
              <p className="mb-2 font-medium">Voz (masculina)</p>
              {support.tts ? (
                <>
                  <select
                    className="w-full rounded-xl border border-input bg-background px-3 py-2"
                    value={settings.voiceURI ?? ''}
                    onChange={(e) => update({ voiceURI: e.target.value || null })}
                  >
                    <option value="">Automática (melhor voz masculina)</option>
                    {voiceOptions.map((v) => (
                      <option key={v.voiceURI} value={v.voiceURI}>
                        {v.name} ({v.lang}){isLikelyMale(v) ? ' ♂' : ''}
                      </option>
                    ))}
                  </select>
                  <Button
                    variant="secondary"
                    className="mt-2 w-full"
                    onClick={() => speak('Hello friend. Eu sou o CONBYBITE 2.0, desenvolvido por SLOVACK.', currentVoice())}
                  >
                    <Volume2 /> Testar voz
                  </Button>
                  <p className="mt-2 text-xs text-muted-foreground">
                    As vozes vêm do aparelho. No Android, instale vozes em Configurações › Idioma › Saída de texto para fala
                    (Google). Sem voz masculina instalada, o tom é aprofundado automaticamente.
                  </p>
                </>
              ) : (
                <p className="text-muted-foreground">Este navegador não suporta síntese de voz.</p>
              )}
            </section>

            <section className="flex items-center justify-between">
              <span>Ler respostas em voz alta</span>
              <Switch checked={settings.voiceOn} onCheckedChange={(v) => update({ voiceOn: v })} />
            </section>

            <Button variant="destructive" className="w-full" onClick={clearChat}>
              <Trash2 /> Apagar conversa
            </Button>
            <p className="text-xs text-muted-foreground">
              Sua conversa fica salva só neste aparelho. As chaves de API ficam protegidas no servidor e nunca chegam ao navegador.
            </p>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
