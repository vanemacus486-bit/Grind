import { useCallback, useEffect, useState } from 'react'
import { db } from '../db/dexie'
import type { VocabLevel } from '../db/types'
import { BUILTIN_DECKS, BUILTIN_LEVELS } from '../db/types'

export type DeckOption = { id: number; name: string; level?: VocabLevel }

/**
 * 统一加载 deck 列表：一次 db.decks.toArray()，按「内置分级(带 level，按 BUILTIN_LEVELS 排序) + 用户自建」排列。
 * resolveCumulativeIds：内置 deck → 累进聚合所有 ≤ 当前等级的内置 deck id（选「雅思」=全部）；
 * 用户 deck → 仅自身。背词区 / 词库浏览共用，行为一致。
 */
export function useDecks(): {
  decks: DeckOption[]
  loading: boolean
  reload: () => Promise<void>
  resolveCumulativeIds: (deckId: number) => number[]
} {
  const [decks, setDecks] = useState<DeckOption[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    const all = await db.decks.toArray()
    const byName = new Map(all.map((d) => [d.name, d]))

    const builtin: DeckOption[] = []
    const builtinIds = new Set<number>()
    for (const level of BUILTIN_LEVELS) {
      const d = byName.get(BUILTIN_DECKS[level])
      if (d) {
        builtin.push({ id: d.id, name: d.name, level })
        builtinIds.add(d.id)
      }
    }

    const user: DeckOption[] = all
      .filter((d) => !builtinIds.has(d.id))
      .map((d) => ({ id: d.id, name: d.name }))

    setDecks([...builtin, ...user])
    setLoading(false)
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  const resolveCumulativeIds = useCallback(
    (deckId: number): number[] => {
      const sel = decks.find((d) => d.id === deckId)
      if (sel?.level) {
        const selIdx = BUILTIN_LEVELS.indexOf(sel.level)
        return decks
          .filter((d) => d.level && BUILTIN_LEVELS.indexOf(d.level) <= selIdx)
          .map((d) => d.id)
      }
      return [deckId]
    },
    [decks]
  )

  return { decks, loading, reload, resolveCumulativeIds }
}
