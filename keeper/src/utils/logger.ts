const timestamp = () => new Date().toISOString()

export const log = {
  info: (tag: string, msg: string) => console.log(`${timestamp()} [${tag}] ${msg}`),
  warn: (tag: string, msg: string) => console.warn(`${timestamp()} ⚠️ [${tag}] ${msg}`),
  error: (tag: string, msg: string, err?: unknown) => {
    console.error(`${timestamp()} ❌ [${tag}] ${msg}`)
    if (err instanceof Error) console.error(`  → ${err.message}`)
  },
  success: (tag: string, msg: string) => console.log(`${timestamp()} ✅ [${tag}] ${msg}`),
}
