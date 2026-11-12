'use server'

import { revalidatePath } from 'next/cache'
import { getListings } from '@/lib/jobs'

export interface SyncState {
  ok: boolean
  message: string
}

const STATUS_MESSAGES = {
  downloaded: 'Listo: se descargó una versión nueva.',
  not_modified: 'Listo: no hubo cambios desde la última sincronización.',
  cache: 'Listo.',
  stale: 'No se pudo conectar con GitHub. Se muestra la última copia guardada.',
} as const

/** Botón "Sync ahora": ignora la edad de la copia local y consulta a GitHub. */
export async function syncNow(previous: SyncState | null): Promise<SyncState> {
  void previous
  try {
    const result = await getListings({ force: true })
    revalidatePath('/')
    return { ok: result.status !== 'stale', message: STATUS_MESSAGES[result.status] }
  } catch (error) {
    console.error('Sync ahora falló', error)
    return { ok: false, message: 'La sincronización falló. Revisa la consola del servidor.' }
  }
}
