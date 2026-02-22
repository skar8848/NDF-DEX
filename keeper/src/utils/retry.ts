import { log } from './logger.js'

export async function retry<T>(
  fn: () => Promise<T>,
  tag: string,
  maxRetries = 3,
  delayMs = 1000,
): Promise<T | null> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn()
    } catch (err) {
      log.warn(tag, `Attempt ${i + 1}/${maxRetries} failed`)
      if (i < maxRetries - 1) {
        await new Promise((r) => setTimeout(r, delayMs * (i + 1)))
      } else {
        log.error(tag, 'All retries exhausted', err)
      }
    }
  }
  return null
}
