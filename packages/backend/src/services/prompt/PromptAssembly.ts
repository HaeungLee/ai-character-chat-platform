export interface LorebookEntry {
  id: string
  keys: string[]
  content: string
  priority: number
}

export type ExampleDialogueItem =
  | { user: string; assistant: string }
  | { role: 'user' | 'assistant'; content: string }

export interface PromptAssemblyInput {
  baseSystemPrompt: string
  userMessage: string
  lorebookEntries?: LorebookEntry[]
  exampleDialoguesJson?: string | null
  options?: {
    maxLorebookEntries?: number
    maxExamplesChars?: number
  }
}

export interface PromptAssemblyResult {
  assembledSystemPrompt: string
  usedLorebookEntries: LorebookEntry[]
  usedExamples: ExampleDialogueItem[]
}

const DEFAULT_MAX_LOREBOOK_ENTRIES = 5
const DEFAULT_MAX_EXAMPLES_CHARS = 2500

function normalizeForMatch(text: string): string {
  return text.toLowerCase()
}

function hasAnyKeyMatch(text: string, keys: string[]): boolean {
  const haystack = normalizeForMatch(text)
  return keys.some((key) => {
    if (!key) return false
    const needle = normalizeForMatch(String(key).trim())
    if (!needle) return false
    return haystack.includes(needle)
  })
}

export function pickTriggeredLorebookEntries(
  lorebookEntries: LorebookEntry[] | undefined,
  userMessage: string,
  options?: { maxLorebookEntries?: number }
): LorebookEntry[] {
  if (!lorebookEntries || lorebookEntries.length === 0) return []

  const maxEntries = options?.maxLorebookEntries ?? DEFAULT_MAX_LOREBOOK_ENTRIES
  const triggered = lorebookEntries
    .filter((e) => Array.isArray(e.keys) && hasAnyKeyMatch(userMessage, e.keys))
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))

  return triggered.slice(0, Math.max(0, maxEntries))
}

export function parseExampleDialoguesJson(exampleDialoguesJson?: string | null): ExampleDialogueItem[] {
  if (!exampleDialoguesJson) return []

  try {
    const parsed = JSON.parse(exampleDialoguesJson)
    if (!Array.isArray(parsed)) return []

    const items: ExampleDialogueItem[] = []
    for (const item of parsed) {
      if (item && typeof item === 'object') {
        const maybeUser = (item as any).user
        const maybeAssistant = (item as any).assistant
        if (typeof maybeUser === 'string' && typeof maybeAssistant === 'string') {
          items.push({ user: maybeUser, assistant: maybeAssistant })
          continue
        }

        const maybeRole = (item as any).role
        const maybeContent = (item as any).content
        if ((maybeRole === 'user' || maybeRole === 'assistant') && typeof maybeContent === 'string') {
          items.push({ role: maybeRole, content: maybeContent })
        }
      }
    }

    return items
  } catch {
    return []
  }
}

function formatLorebookBlock(entries: LorebookEntry[]): string {
  if (entries.length === 0) return ''

  const lines: string[] = ['[LOREBOOK]']
  for (const entry of entries) {
    const keys = Array.isArray(entry.keys) ? entry.keys.filter(Boolean).join(', ') : ''
    lines.push(`- Keys: ${keys}`)
    lines.push(`  Content: ${entry.content}`)
  }

  return lines.join('\n')
}

function formatExamplesBlock(examples: ExampleDialogueItem[]): string {
  if (examples.length === 0) return ''

  const lines: string[] = ['[EXAMPLES]']
  for (const ex of examples) {
    if ('user' in ex) {
      lines.push(`User: ${ex.user}`)
      lines.push(`Assistant: ${ex.assistant}`)
      continue
    }

    lines.push(`${ex.role === 'user' ? 'User' : 'Assistant'}: ${ex.content}`)
  }

  return lines.join('\n')
}

function clampByCharBudget(text: string, maxChars: number): string {
  if (maxChars <= 0) return ''
  if (text.length <= maxChars) return text
  return text.slice(0, maxChars)
}

export function assembleSystemPrompt(input: PromptAssemblyInput): PromptAssemblyResult {
  const maxLorebookEntries = input.options?.maxLorebookEntries ?? DEFAULT_MAX_LOREBOOK_ENTRIES
  const maxExamplesChars = input.options?.maxExamplesChars ?? DEFAULT_MAX_EXAMPLES_CHARS

  const usedLorebookEntries = pickTriggeredLorebookEntries(input.lorebookEntries, input.userMessage, {
    maxLorebookEntries,
  })

  const usedExamplesRaw = parseExampleDialoguesJson(input.exampleDialoguesJson)

  const lorebookBlock = formatLorebookBlock(usedLorebookEntries)
  const examplesBlock = clampByCharBudget(formatExamplesBlock(usedExamplesRaw), maxExamplesChars)

  const sections: string[] = [input.baseSystemPrompt.trim()]

  if (lorebookBlock) {
    sections.push('---')
    sections.push(lorebookBlock)
  }

  if (examplesBlock) {
    sections.push('---')
    sections.push(examplesBlock)
  }

  const assembledSystemPrompt = sections.filter(Boolean).join('\n')

  return {
    assembledSystemPrompt,
    usedLorebookEntries,
    usedExamples: usedExamplesRaw,
  }
}
