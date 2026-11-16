import { describe, expect, it } from 'vitest'
import { createKeyedMutex } from './keyed-mutex'

interface Gate {
  promise: Promise<void>
  open: () => void
}

function gate(): Gate {
  let open = (): void => undefined
  const promise = new Promise<void>((resolve) => {
    open = resolve
  })
  return { promise, open }
}

async function flush(): Promise<void> {
  for (let i = 0; i < 10; i++) await Promise.resolve()
}

describe('createKeyedMutex', () => {
  it('runs tasks with the same key one at a time in arrival order', async () => {
    const mutex = createKeyedMutex()
    const events: string[] = []
    const first = gate()

    const a = mutex.run('job-1', async () => {
      events.push('a:start')
      await first.promise
      events.push('a:end')
      return 'a'
    })
    const b = mutex.run('job-1', () => {
      events.push('b:start')
      return Promise.resolve('b')
    })

    await flush()
    expect(events).toEqual(['a:start'])

    first.open()
    await expect(a).resolves.toBe('a')
    await expect(b).resolves.toBe('b')
    expect(events).toEqual(['a:start', 'a:end', 'b:start'])
  })

  it('lets tasks with different keys overlap', async () => {
    const mutex = createKeyedMutex()
    const events: string[] = []
    const first = gate()

    const a = mutex.run('job-1', async () => {
      events.push('a:start')
      await first.promise
      events.push('a:end')
    })
    const b = mutex.run('job-2', () => {
      events.push('b:start')
      return Promise.resolve()
    })

    await b
    expect(events).toEqual(['a:start', 'b:start'])
    first.open()
    await a
    expect(events).toEqual(['a:start', 'b:start', 'a:end'])
  })

  it('keeps running the queue when a task rejects', async () => {
    const mutex = createKeyedMutex()
    const failing = mutex.run('job-1', () => Promise.reject(new Error('boom')))
    const next = mutex.run('job-1', () => Promise.resolve('ok'))

    await expect(failing).rejects.toThrow('boom')
    await expect(next).resolves.toBe('ok')
  })

  it('deletes the key once its queue is empty', async () => {
    const mutex = createKeyedMutex()
    const first = gate()

    const a = mutex.run('job-1', () => first.promise)
    const b = mutex.run('job-1', () => Promise.reject(new Error('boom')))
    expect(mutex.activeKeyCount()).toBe(1)

    first.open()
    await a
    await expect(b).rejects.toThrow('boom')
    await flush()
    expect(mutex.activeKeyCount()).toBe(0)

    await expect(mutex.run('job-1', () => Promise.resolve(1))).resolves.toBe(1)
    await flush()
    expect(mutex.activeKeyCount()).toBe(0)
  })
})
