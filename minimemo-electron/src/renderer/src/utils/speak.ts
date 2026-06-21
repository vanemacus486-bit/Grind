/**
 * speak.ts — 单词发音（浏览器原生 Web Speech API，离线可用，无需联网）
 */

let enVoice: SpeechSynthesisVoice | null = null

function pickVoice(): void {
  if (!isSpeechSupported()) return
  const voices = window.speechSynthesis.getVoices()
  if (voices.length === 0) return
  enVoice =
    voices.find((v) => /en[-_]US/i.test(v.lang)) ||
    voices.find((v) => /en[-_]GB/i.test(v.lang)) ||
    voices.find((v) => /^en/i.test(v.lang)) ||
    null
}

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  pickVoice()
  window.speechSynthesis.onvoiceschanged = pickVoice
}

export function isSpeechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

/** 朗读一个英文单词/短语；会打断上一条未读完的 */
export function speak(text: string): void {
  if (!isSpeechSupported() || !text) return
  if (!enVoice) pickVoice()
  const synth = window.speechSynthesis
  synth.cancel()
  const u = new SpeechSynthesisUtterance(text)
  if (enVoice) u.voice = enVoice
  u.lang = enVoice?.lang || 'en-US'
  u.rate = 0.9
  synth.speak(u)
}
