import { sheetMessages, type SheetMessageTone } from '@/lib/sheet-messages'
import type { SheetState } from '@/lib/sheets/snapshot-cache'

const TONES: Record<SheetMessageTone, string> = {
  info: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300',
  warning: 'bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
}

/** Notices about the Google Sheet: not connected, a failed read, or rows Uni couldn't use. */
export function SheetStatus({ state }: { state: SheetState }) {
  const messages = sheetMessages(state)
  if (messages.length === 0) return null
  return (
    <div className="space-y-2" role="status">
      {messages.map((message) => (
        <p key={message.text} className={`rounded-md p-3 text-sm ${TONES[message.tone]}`}>
          {message.text}
        </p>
      ))}
    </div>
  )
}
