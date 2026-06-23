/**
 * 从完整释义串里取「主要含义」——第一个词性段的第一个义项，去掉词性前缀。
 * 词库无重要度排序，取第一个义项作为主要释义（ECDICT 通常把最常用义项排在前）。
 *
 * 例：
 *   "n. 权利, 右边, 正义, 右派, 公正；a. 正确的, 对的…" -> "权利"
 *   "vt. 听到, 倾听, 听说; vi. 听见, 听"               -> "听到"
 *   "prep. 在...的时候"                               -> "在...的时候"
 *   "n. 政府, 内阁; [经] 政府, 政治, 政体"             -> "政府"
 */
export function primaryMeaning(meaning?: string): string {
  if (!meaning) return ''
  // 1) 取第一个词性段（中文/英文分号分隔）
  const firstGroup = meaning.split(/[;；]/)[0].trim()
  // 2) 去掉开头的词性前缀，如 n. / vt. / adv. / prep.
  const withoutPos = firstGroup.replace(/^[a-zA-Z]+\.\s*/, '')
  // 3) 取第一个义项（逗号/顿号分隔）
  const firstSense = withoutPos.split(/[,，、]/)[0].trim()
  return firstSense
}
