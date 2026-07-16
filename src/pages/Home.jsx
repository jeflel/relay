import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import ShiftDetail from './ShiftDetail'
import {
  formatDayLabel,
  formatLocalDateKey,
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

function getSummaryRange() {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(end.getDate() + 8)
  return { start, end }
}

export default function Home({ user, role, onGoToManage }) {
  const [fullName, setFullName] = useState(null)
  const [shifts, setShifts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedShift, setSelectedShift] = useState(null)

  const isCoordinator = role === 'coordinator'

  useEffect(() => {
    let cancelled = false

    async function fetchHomeData() {
      setLoading(true)
      setError(null)

      const shiftsQuery = isCoordinator
        ? (() => {
            const { start, end } = getSummaryRange()
            return supabase
              .from('shifts')
              .select('id, unit, nurse_id, starts_at, ends_at')
              .gte('starts_at', start.toISOString())
              .lt('starts_at', end.toISOString())
              .order('starts_at', { ascending: true })
          })()
        : supabase
            .from('shifts')
            .select('id, unit, starts_at, ends_at')
            .eq('nurse_id', user.id)
            .order('starts_at', { ascending: true })

      const [profileResult, shiftsResult] = await Promise.all([
        supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle(),
        shiftsQuery,
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
  }, [user.id, isCoordinator])

  if (selectedShift) {
    return (
      <ShiftDetail
        shift={selectedShift}
        user={user}
        onBack={() => setSelectedShift(null)}
      />
    )
  }

  const today = new Date()
  const todayLabel = formatShiftDate(today.toISOString())

  return (
    <main className="page home">
      <h1 className={loading ? 'home-greeting home-greeting--loading' : 'home-greeting'}>
        {!loading && (
          <>
            {getGreeting()}
            {fullName ? `, ${fullName}` : ''}
          </>
        )}
      </h1>

      <p className="home-date">{todayLabel}</p>

      {!loading && error && <p className="page-error">Could not load home data: {error}</p>}

      {!loading && !error && (
        isCoordinator ? (
          <CoordinatorSummary shifts={shifts} today={today} onGoToManage={onGoToManage} />
        ) : (
          <NurseSummary shifts={shifts} today={today} onSelectShift={setSelectedShift} />
        )
      )}
    </main>
  )
}

function NurseSummary({ shifts, today, onSelectShift }) {
  const todayShifts = shifts.filter((shift) => isSameLocalDay(new Date(shift.starts_at), today))
  const upcomingShifts = shifts.filter((shift) => isWithinNextSevenDays(shift.starts_at))

  return (
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
                <li key={shift.id}>
                  <button
                    type="button"
                    className="shift-card"
                    onClick={() => onSelectShift(shift)}
                  >
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
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </>
  )
}

function CoordinatorSummary({ shifts, today, onGoToManage }) {
  const todayShifts = shifts.filter((shift) => isSameLocalDay(new Date(shift.starts_at), today))
  const uniqueNursesToday = new Set(todayShifts.map((shift) => shift.nurse_id)).size

  const { start } = getSummaryRange()
  const scheduledDayKeys = new Set(
    shifts.map((shift) => formatLocalDateKey(new Date(shift.starts_at))),
  )
  const unstaffedDates = []
  for (let offset = 1; offset <= 7; offset += 1) {
    const date = new Date(start)
    date.setDate(start.getDate() + offset)
    if (!scheduledDayKeys.has(formatLocalDateKey(date))) {
      unstaffedDates.push(date)
    }
  }

  return (
    <section className="coordinator-summary">
      <div className="summary-stats">
        <div className="summary-stat">
          <p className="summary-stat-value">{todayShifts.length}</p>
          <p className="summary-stat-label">Shifts today</p>
        </div>
        <div className="summary-stat">
          <p className="summary-stat-value">{uniqueNursesToday}</p>
          <p className="summary-stat-label">Nurses scheduled today</p>
        </div>
      </div>

      <div className="summary-gaps">
        <h2>Unstaffed days (next 7 days)</h2>

        {unstaffedDates.length === 0 ? (
          <p className="page-status">Every day this week has coverage</p>
        ) : (
          <ul className="summary-gap-list">
            {unstaffedDates.map((date) => (
              <li key={formatLocalDateKey(date)}>{formatDayLabel(date)}</li>
            ))}
          </ul>
        )}
      </div>

      <button type="button" className="btn-primary" onClick={onGoToManage}>
        Go to Manage
      </button>
    </section>
  )
}
