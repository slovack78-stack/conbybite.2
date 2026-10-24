// Browser voice: speechSynthesis (TTS) and SpeechRecognition (STT).
// Works in Chrome for Android and desktop Chrome/Edge. Everything runs on-device.

const MALE_HINTS = [
  'male', 'masculin', 'homem', 'daniel', 'ricardo', 'felipe', 'antonio', 'antônio', 'fabio', 'fábio',
  'thiago', 'duarte', 'cristiano', 'jorge', 'diego', 'david', 'mark', 'george', 'guy', 'christopher',
  'pt-br-x-ptd', 'pt-br-x-pte', 'pt-pt-x-pmj', 'en-us-x-iom', 'en-us-x-tpd', 'en-gb-x-rjs',
]
const FEMALE_HINTS = ['female', 'feminin', 'mulher', 'luciana', 'francisca', 'maria', 'helena', 'joana', 'zira', 'samantha', 'google português']

export function ttsSupported() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

export function listVoices(): SpeechSynthesisVoice[] {
  if (!ttsSupported()) return []
  return window.speechSynthesis.getVoices()
}

function score(v: SpeechSynthesisVoice) {
  const n = `${v.name} ${v.voiceURI}`.toLowerCase()
  let s = 0
  if (v.lang.toLowerCase().startsWith('pt-br')) s += 40
  else if (v.lang.toLowerCase().startsWith('pt')) s += 30
  if (MALE_HINTS.some((h) => n.includes(h))) s += 25
  if (FEMALE_HINTS.some((h) => n.includes(h))) s -= 20
  if (v.localService) s += 3
  return s
}

export function pickMaleVoice(voices: SpeechSynthesisVoice[], preferredURI?: string | null) {
  if (preferredURI) {
    const v = voices.find((x) => x.voiceURI === preferredURI)
    if (v) return v
  }
  return [...voices].sort((a, b) => score(b) - score(a))[0] ?? null
}

export function isLikelyMale(v: SpeechSynthesisVoice) {
  const n = `${v.name} ${v.voiceURI}`.toLowerCase()
  return MALE_HINTS.some((h) => n.includes(h))
}

export function toSpeakable(text: string) {
  return text
    .replace(/```[\s\S]*?```/g, ' (código omitido na leitura) ')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/\[(\d+)\]/g, '')
    .replace(/[*_#>`|]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function speak(
  text: string,
  voice: SpeechSynthesisVoice | null,
  handlers: { onStart?: () => void; onEnd?: () => void } = {},
) {
  if (!ttsSupported()) {
    handlers.onEnd?.()
    return
  }
  const synth = window.speechSynthesis
  synth.cancel()
  const clean = toSpeakable(text)
  if (!clean) {
    handlers.onEnd?.()
    return
  }
  // Split into sentences: Android Chrome cuts off long utterances.
  const chunks = clean.match(/[^.!?]+[.!?]*/g)?.map((c) => c.trim()).filter(Boolean) ?? [clean]
  const male = voice ? isLikelyMale(voice) : false
  chunks.forEach((chunk, i) => {
    const u = new SpeechSynthesisUtterance(chunk)
    if (voice) {
      u.voice = voice
      u.lang = voice.lang
    } else u.lang = 'pt-BR'
    // Deepen the tone when the device has no explicitly male voice.
    u.pitch = male ? 0.95 : 0.7
    u.rate = 1.02
    if (i === 0) u.onstart = () => handlers.onStart?.()
    if (i === chunks.length - 1) {
      u.onend = () => handlers.onEnd?.()
      u.onerror = () => handlers.onEnd?.()
    }
    synth.speak(u)
  })
}

export function stopSpeaking() {
  if (ttsSupported()) window.speechSynthesis.cancel()
}

// ---- Speech recognition ----

type Recognition = {
  lang: string
  interimResults: boolean
  continuous: boolean
  maxAlternatives: number
  start: () => void
  stop: () => void
  abort: () => void
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
}

export function sttSupported() {
  if (typeof window === 'undefined') return false
  const w = window as unknown as Record<string, unknown>
  return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition)
}

export function createRecognizer(handlers: {
  onInterim: (text: string) => void
  onFinal: (text: string) => void
  onError: (error: string) => void
  onEnd: () => void
}) {
  const w = window as unknown as Record<string, new () => Recognition>
  const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition
  if (!Ctor) return null
  const rec = new Ctor()
  rec.lang = 'pt-BR'
  rec.interimResults = true
  rec.continuous = false
  rec.maxAlternatives = 1
  rec.onresult = (e) => {
    let interim = ''
    let final = ''
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i]
      if (r.isFinal) final += r[0].transcript
      else interim += r[0].transcript
    }
    if (interim) handlers.onInterim(interim)
    if (final.trim()) handlers.onFinal(final.trim())
  }
  rec.onerror = (e) => handlers.onError(e.error)
  rec.onend = () => handlers.onEnd()
  return rec
}
