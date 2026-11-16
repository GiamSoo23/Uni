export interface KeyedMutex {
  /**
   * Runs `fn` after every earlier task with the same key has settled. Tasks with
   * different keys do not wait for each other. A rejection reaches only the caller
   * of that task; the queue keeps going.
   */
  run<T>(key: string, fn: () => Promise<T>): Promise<T>
  /** Number of keys with a running or queued task. */
  activeKeyCount(): number
}

/** Per-process lock keyed by Job_ID (Requirement 10.3). */
export function createKeyedMutex(): KeyedMutex {
  const tails = new Map<string, Promise<void>>()

  return {
    run<T>(key: string, fn: () => Promise<T>): Promise<T> {
      const previous = tails.get(key) ?? Promise.resolve()
      const result = previous.then(fn)
      const tail = result.then(
        () => undefined,
        () => undefined,
      )
      tails.set(key, tail)
      void tail.then(() => {
        if (tails.get(key) === tail) tails.delete(key)
      })
      return result
    },
    activeKeyCount(): number {
      return tails.size
    },
  }
}
