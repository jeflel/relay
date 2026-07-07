import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  year: 'numeric',
})

const userLocale = navigator.language
const userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone

const timeFormatOptions = {
  hour: 'numeric',
  minute: '2-digit',
  timeZone: userTimeZone,
}

function formatShiftDate(startsAt) {
  return dateFormatter.format(new Date(startsAt))
}

function formatShiftTimeRange(startsAt, endsAt) {
  const start = new Date(startsAt).toLocaleTimeString(userLocale, timeFormatOptions)
  const end = new Date(endsAt).toLocaleTimeString(userLocale, timeFormatOptions)
  return `${start} – ${end}`
}

export default function Schedule({ user }) {
  const [shifts, setShifts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function fetchShifts() {
      setLoading(true)
      setError(null)

      const { data, error: fetchError } = await supabase
        .from('shifts')
        .select('id, unit, starts_at, ends_at')
        .eq('nurse_id', user.id)
        .order('starts_at', { ascending: true })

      if (cancelled) return

      if (fetchError) {
        setError(fetchError.message)
        setShifts([])
      } else {
        setShifts(data ?? [])
      }

      setLoading(false)
    }

    fetchShifts()

    return () => {
      cancelled = true
    }
  }, [user.id])

  return (
    <main className="page schedule">
      <h1>My Schedule</h1>
      <p className="schedule-email">{user?.email}</p>

      {loading && <p className="schedule-status">Loading shifts…</p>}

      {!loading && error && (
        <p className="schedule-error">Could not load shifts: {error}</p>
      )}

      {!loading && !error && shifts.length === 0 && (
        <p className="schedule-status">No shifts scheduled</p>
      )}

      {!loading && !error && shifts.length > 0 && (
        <ul className="shift-list">
          {shifts.map((shift) => (
            <li key={shift.id} className="shift-card">
              <p className="shift-unit">{shift.unit}</p>
              <p className="shift-date">{formatShiftDate(shift.starts_at)}</p>
              <p className="shift-time">
                {formatShiftTimeRange(shift.starts_at, shift.ends_at)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
