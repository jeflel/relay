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
    return () => { cancelled = true }
  }, [user.id])

  const shiftsByDay = groupByDayKey(shifts, (shift) => shift.starts_at)
  const days = getFourWeekDays()

  if (loading) return <p className="page-status">Loading shifts…</p>
  if (error) return <p className="page-error">Could not load shifts: {error}</p>

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
          id, unit, starts_at, ends_at, nurse_id,
          profiles ( full_name, credential )
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
    return () => { cancelled = true }
  }, [])

  const shiftsByDay = groupByDayKey(shifts, (shift) => shift.starts_at)
  const days = getFourWeekDays()

  if (loading) return <p className="page-status">Loading team schedule…</p>
  if (error) return <p className="page-error">Could not load team schedule: {error}</p>

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

function ManageTab() {
  const [nurses, setNurses] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  const [form, setForm] = useState({
    nurse_id: '',
    unit: 'Unit 1',
    date: '',
    shift_type: 'day',
  })

  const SHIFT_HOURS = {
    day:     { start: 7,  end: 19 },
    evening: { start: 15, end: 23 },
    night:   { start: 23, end: 7  },
  }

  useEffect(() => {
    async function fetchNurses() {
      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select('id, full_name, credential')
        .eq('role', 'nurse')
        .order('full_name', { ascending: true })

      if (!fetchError) setNurses(data ?? [])
      setLoading(false)
    }
    fetchNurses()
  }, [])

  function buildShiftTimes(date, shift_type) {
    const { start, end } = SHIFT_HOURS[shift_type]
    const starts_at = new Date(`${date}T${String(start).padStart(2, '0')}:00:00`)
    const ends_at = new Date(`${date}T${String(end).padStart(2, '0')}:00:00`)
    if (ends_at <= starts_at) ends_at.setDate(ends_at.getDate() + 1)
    return { starts_at: starts_at.toISOString(), ends_at: ends_at.toISOString() }
  }

  async function handleSubmit() {
    setError(null)
    setSuccess(false)
  
    if (!form.nurse_id || !form.date) {
      setError('Please fill out all fields.')
      return
    }
  
    setSaving(true)
    const { starts_at, ends_at } = buildShiftTimes(form.date, form.shift_type)
  
    const { error: insertError } = await supabase.from('shifts').insert({
      nurse_id: form.nurse_id,
      unit: form.unit,
      starts_at,
      ends_at,
    })
  
    setSaving(false)
  
    if (insertError) {
      setError(insertError.message)
    } else {
      setSuccess(true)
      setForm({ nurse_id: '', unit: 'Unit 1', date: '', shift_type: 'day' })
    }
  }

  if (loading) return <p className="page-status">Loading…</p>

  return (
    <div className="manage-tab">
      <h2>Post a Shift</h2>

      <div className="manage-form">
        <label>
          Nurse
          <select
            value={form.nurse_id}
            onChange={(e) => setForm({ ...form, nurse_id: e.target.value })}
          >
            <option value="">Select a nurse</option>
            {nurses.map((n) => (
              <option key={n.id} value={n.id}>
                {n.full_name} {n.credential ? `(${n.credential})` : ''}
              </option>
            ))}
          </select>
        </label>

        <label>
          Unit
          <select
            value={form.unit}
            onChange={(e) => setForm({ ...form, unit: e.target.value })}
          >
            <option value="Unit 1">Unit 1</option>
            <option value="Unit 2">Unit 2</option>
          </select>
        </label>

        <label>
          Date
          <input
            type="date"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
          />
        </label>

        <label>
          Shift
          <select
            value={form.shift_type}
            onChange={(e) => setForm({ ...form, shift_type: e.target.value })}
          >
            <option value="day">Day (7am – 7pm)</option>
            <option value="evening">Evening (3pm – 11pm)</option>
            <option value="night">Night (11pm – 7am)</option>
          </select>
        </label>

        {error && <p className="page-error">{error}</p>}
        {success && <p className="page-success">Shift posted successfully.</p>}

        <button
          type="button"
          className="btn-primary"
          onClick={handleSubmit}
          disabled={saving}
        >
          {saving ? 'Posting…' : 'Post Shift'}
        </button>
      </div>
    </div>
  )
}

export default function Schedule({ user, role }) {
  const [activeTab, setActiveTab] = useState('my')
  const isCoordinator = role === 'coordinator'

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
        {isCoordinator && (
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'manage'}
            className={activeTab === 'manage' ? 'active' : undefined}
            onClick={() => setActiveTab('manage')}
          >
            Manage
          </button>
        )}
      </div>

      <div className="schedule-panel" role="tabpanel">
        {activeTab === 'my' && <MyShiftsTab user={user} />}
        {activeTab === 'team' && <TeamScheduleTab />}
        {activeTab === 'manage' && isCoordinator && <ManageTab />}
      </div>
    </main>
  )
}