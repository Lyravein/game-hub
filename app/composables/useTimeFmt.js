export function useNow (intervalMs = 30000) {
  const now = useState('now', () => Date.now())
  if (import.meta.client) {
    onMounted(() => {
      const t = setInterval(() => { now.value = Date.now() }, intervalMs)
      onUnmounted(() => clearInterval(t))
    })
  }
  return now
}

export function fmtDate (d) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function useCountdown () {
  const now = useNow()
  return (endsAt) => {
    const ms = new Date(endsAt) - now.value
    if (ms <= 0) return 'ended'
    const d = Math.floor(ms / 86400e3)
    const h = Math.floor(ms % 86400e3 / 3600e3)
    const m = Math.floor(ms % 3600e3 / 60e3)
    if (d > 0) return `${d}d ${h}h left`
    if (h > 0) return `${h}h ${m}m left`
    return `${m}m left`
  }
}
