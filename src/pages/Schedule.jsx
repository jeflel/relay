import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  formatShiftTimeRange,
  getFourWeekDays,
  getFourWeekRange,
  getShiftPeriod,
  groupByDayKey,
} from '../lib/shiftFormat'

function MyShiftsTab({ user }) {
  const [shifts, setShifts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    const { start, end } = getFourWeekRange()

    async function fetchMyShifts() {
      setLoading(true)
      setError(null)

      const { data, error: fetchError } = await supabase
        .from('shifts')
        .select('id, unit, starts_at, ends_at')
        .eq('nurse_id', user.id)
        .gte('starts_at', start.toISOString())
        .lt('starts_at', end.toISOString())
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

    fetchMyShifts()

    return () => {
      cancelled = true
    }
  }, [user.id])

  const shiftsByDay = groupByDayKey(shifts, (shift) => shift.starts_at)
  const days = getFourWeekDays()

  if (loading) {
    return <p className="page-status">Loading shifts…</p>
  }

  if (error) {
    return <p className="page-error">Could not load shifts: {error}</p>
  }

  return (
    <ul className="schedule-list">
      {days.map((day) => {
        const dayShifts = shiftsByDay[day.key] ?? []

        return (
          <li key={day.key} className="schedule-day-row">
            <div className="schedule-day-label">{day.label}</div>
            <div className="schedule-day-content">
              {dayShifts.length === 0 ? (
                <p className="schedule-day-off">Day off</p>
              ) : (
                dayShifts.map((shift) => {
                  const period = getShiftPeriod(shift.starts_at)

                  return (
                    <div key={shift.id} className="shift-card schedule-shift-card">
                      <div className="shift-card-header">
                        <p className="shift-unit">{shift.unit}</p>
                        <span className={`shift-period shift-period--${period.toLowerCase()}`}>
                          {period}
                        </span>
                      </div>
                      <p className="shift-time">
                        {formatShiftTimeRange(shift.starts_at, shift.ends_at)}
                      </p>
                    </div>
                  )
                })
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}

function TeamScheduleTab() {
  const [shifts, setShifts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    const { start, end } = getFourWeekRange()

    async function fetchTeamShifts() {
      setLoading(true)
      setError(null)

      const { data, error: fetchError } = await supabase
        .from('shifts')
        .select(`
          id,
          unit,
          starts_at,
          ends_at,
          nurse_id,
          profiles (
            full_name,
            credential
          )
        `)
        .gte('starts_at', start.toISOString())
        .lt('starts_at', end.toISOString())
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

    fetchTeamShifts()

    return () => {
      cancelled = true
    }
  }, [])

  const shiftsByDay = groupByDayKey(shifts, (shift) => shift.starts_at)
  const days = getFourWeekDays()

  if (loading) {
    return <p className="page-status">Loading team schedule…</p>
  }

  if (error) {
    return <p className="page-error">Could not load team schedule: {error}</p>
  }

  return (
    <ul className="schedule-list">
      {days.map((day) => {
        const dayShifts = shiftsByDay[day.key] ?? []

        return (
          <li key={day.key} className="schedule-day-row">
            <div className="schedule-day-label">{day.label}</div>
            <div className="schedule-day-content">
              {dayShifts.length === 0 ? (
                <p className="schedule-day-off">No shifts</p>
              ) : (
                dayShifts.map((shift) => (
                  <div key={shift.id} className="team-shift-card">
                    <p className="team-shift-name">{shift.profiles?.full_name}</p>
                    {shift.profiles?.credential && (
                      <p className="team-shift-credential">{shift.profiles.credential}</p>
                    )}
                    <p className="team-shift-unit">{shift.unit}</p>
                    <p className="team-shift-time">
                      {formatShiftTimeRange(shift.starts_at, shift.ends_at)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}

export default function Schedule({ user }) {
  const [activeTab, setActiveTab] = useState('my')

  return (
    <main className="page schedule">
      <h1>Schedule</h1>

      <div className="schedule-tabs" role="tablist" aria-label="Schedule views">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'my'}
          className={activeTab === 'my' ? 'active' : undefined}
          onClick={() => setActiveTab('my')}
        >
          My Shifts
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'team'}
          className={activeTab === 'team' ? 'active' : undefined}
          onClick={() => setActiveTab('team')}
        >
          Team Schedule
        </button>
      </div>

      <div className="schedule-panel" role="tabpanel">
        {activeTab === 'my' ? <MyShiftsTab user={user} /> : <TeamScheduleTab />}
      </div>
    </main>
  )
}
