import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  formatShiftDate,
  formatShiftTimeRange,
  getShiftPeriod,
  isSameLocalDay,
  isWithinNextSevenDays,
} from '../lib/shiftFormat'

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

export default function Home({ user }) {
  const [fullName, setFullName] = useState(null)
  const [shifts, setShifts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function fetchHomeData() {
      setLoading(true)
      setError(null)

      const [profileResult, shiftsResult] = await Promise.all([
        supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle(),
        supabase
          .from('shifts')
          .select('id, unit, starts_at, ends_at')
          .eq('nurse_id', user.id)
          .order('starts_at', { ascending: true }),
      ])

      if (cancelled) return

      if (profileResult.error) {
        setError(profileResult.error.message)
        setFullName(null)
        setShifts([])
        setLoading(false)
        return
      }

      if (shiftsResult.error) {
        setError(shiftsResult.error.message)
        setFullName(profileResult.data?.full_name ?? null)
        setShifts([])
        setLoading(false)
        return
      }

      setFullName(profileResult.data?.full_name ?? null)
      setShifts(shiftsResult.data ?? [])
      setLoading(false)
    }

    fetchHomeData()

    return () => {
      cancelled = true
    }
  }, [user.id])

  const today = new Date()
  const todayLabel = formatShiftDate(today.toISOString())
  const todayShifts = shifts.filter((shift) => isSameLocalDay(new Date(shift.starts_at), today))
  const upcomingShifts = shifts.filter((shift) => isWithinNextSevenDays(shift.starts_at))
  const displayName = fullName || user.email

  return (
    <main className="page home">
      <h1>
        {getGreeting()}
        {displayName ? `, ${displayName}` : ''}
      </h1>

      <p className="home-date">{todayLabel}</p>

      {loading && <p className="page-status">Loading…</p>}

      {!loading && error && <p className="page-error">Could not load home data: {error}</p>}

      {!loading && !error && (
        <>
          <p className="home-today-status">
            {todayShifts.length > 0 ? "You're working today" : 'You have the day off'}
          </p>

          <section className="home-upcoming">
            <h2>Upcoming shifts</h2>

            {upcomingShifts.length === 0 ? (
              <p className="page-status">No upcoming shifts</p>
            ) : (
              <ul className="shift-list">
                {upcomingShifts.map((shift) => {
                  const period = getShiftPeriod(shift.starts_at)

                  return (
                  <li key={shift.id} className="shift-card">
                    <div className="shift-card-header">
                      <p className="shift-unit">{shift.unit}</p>
                      <span className={`shift-period shift-period--${period.toLowerCase()}`}>
                        {period}
                      </span>
                    </div>
                    <p className="shift-date">{formatShiftDate(shift.starts_at)}</p>
                    <p className="shift-time">
                      {formatShiftTimeRange(shift.starts_at, shift.ends_at)}
                    </p>
                  </li>
                  )
                })}
              </ul>
            )}
          </section>
        </>
      )}
    </main>
  )
}
