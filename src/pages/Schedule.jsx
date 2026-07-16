import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  addLocalDays,
  diffInCalendarDays,
  formatShiftDate,
  formatShiftTimeRange,
  getFourWeekDays,
  getFourWeekRange,
  getShiftPeriod,
  getStatusLabel,
  getStatusModifier,
  getWeekRange,
  getWeekStart,
  groupByDayKey,
} from '../lib/shiftFormat'

function formatWeekRangeLabel(weekStart) {
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 6)
  const startLabel = weekStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  const endLabel = weekEnd.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
  return `${startLabel} – ${endLabel}`
}

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
        .select('id, unit, starts_at, ends_at, status')
        .or(`nurse_id.eq.${user.id},claimed_by.eq.${user.id}`)
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
                      <span
                        className={`status-pill status-pill--${getStatusModifier(shift.status)}`}
                      >
                        {shift.status === 'pending' ? 'Pending approval' : getStatusLabel(shift.status)}
                      </span>
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

function OpenShiftsTab({ user }) {
  const [shifts, setShifts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [claimingId, setClaimingId] = useState(null)
  const [takenId, setTakenId] = useState(null)
  const [successMessage, setSuccessMessage] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function fetchOpenShifts() {
      setLoading(true)
      setError(null)

      const { data, error: fetchError } = await supabase
        .from('shifts')
        .select('id, unit, starts_at, ends_at, status')
        .eq('status', 'open')
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

    fetchOpenShifts()
    return () => { cancelled = true }
  }, [])

  async function handleClaim(shift) {
    setTakenId(null)
    setSuccessMessage(null)
    setClaimingId(shift.id)

    // Optimistic UI: show this shift as pending immediately
    setShifts((current) =>
      current.map((s) => (s.id === shift.id ? { ...s, status: 'pending' } : s)),
    )

    const { data, error: claimError } = await supabase
      .from('shifts')
      .update({ status: 'pending', claimed_by: user.id, claimed_at: new Date().toISOString() })
      .eq('id', shift.id)
      .eq('status', 'open')
      .select()

    setClaimingId(null)

    if (claimError || !data || data.length === 0) {
      // Race lost (someone else claimed it first) - roll back and tell the nurse
      setShifts((current) =>
        current.map((s) => (s.id === shift.id ? { ...s, status: 'open' } : s)),
      )
      setTakenId(shift.id)
      return
    }

    // Claim succeeded - it's no longer open, so drop it from this list.
    // It now shows up as Pending in My Shifts.
    setShifts((current) => current.filter((s) => s.id !== shift.id))
    setSuccessMessage(`Requested ${shift.unit} shift - check My Shifts for status.`)
  }

  if (loading) return <p className="page-status">Loading open shifts…</p>
  if (error) return <p className="page-error">Could not load open shifts: {error}</p>

  return (
    <>
      {successMessage && <p className="page-success">{successMessage}</p>}

      {shifts.length === 0 ? (
        <p className="page-status">No open shifts right now</p>
      ) : (
        <ul className="shift-list">
          {shifts.map((shift) => {
            const period = getShiftPeriod(shift.starts_at)
            const isPending = shift.status === 'pending'
            const isClaiming = claimingId === shift.id

            return (
              <li key={shift.id}>
                <div className="shift-card open-shift-card">
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

                  <div className="open-shift-footer">
                    <span
                      className={`status-pill status-pill--${getStatusModifier(shift.status)}`}
                    >
                      {isPending ? 'Pending approval' : getStatusLabel(shift.status)}
                    </span>

                    <button
                      type="button"
                      className="btn-primary"
                      onClick={() => handleClaim(shift)}
                      disabled={isPending || isClaiming}
                    >
                      {isPending ? 'Requested' : isClaiming ? 'Requesting…' : 'Claim'}
                    </button>
                  </div>

                  {takenId === shift.id && (
                    <p className="page-error">This shift was just taken.</p>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </>
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
          id, unit, starts_at, ends_at, status, nurse_id,
          profiles!nurse_id ( full_name, credential ),
          claimant:profiles!claimed_by ( full_name, credential )
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
                dayShifts.map((shift) => {
                  const displayName =
                    shift.status === 'open'
                      ? 'Open shift'
                      : shift.status === 'pending'
                        ? shift.claimant?.full_name ?? 'Pending claim'
                        : shift.profiles?.full_name
                  const displayCredential =
                    shift.status === 'pending' ? shift.claimant?.credential : shift.profiles?.credential

                  return (
                    <div key={shift.id} className="team-shift-card">
                      <div className="shift-card-header">
                        <p className="team-shift-name">{displayName}</p>
                        <span
                          className={`status-pill status-pill--${getStatusModifier(shift.status)}`}
                        >
                          {getStatusLabel(shift.status)}
                        </span>
                      </div>
                      {displayCredential && (
                        <p className="team-shift-credential">{displayCredential}</p>
                      )}
                      <p className="team-shift-unit">{shift.unit}</p>
                      <p className="team-shift-time">
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
    unassigned: false,
  })

  const SHIFT_HOURS = {
    day:     { start: 7,  end: 19 },
    evening: { start: 15, end: 23 },
    night:   { start: 23, end: 7  },
  }

  const [pendingClaims, setPendingClaims] = useState([])
  const [pendingLoading, setPendingLoading] = useState(true)
  const [pendingError, setPendingError] = useState(null)
  const [actionError, setActionError] = useState(null)
  const [actioningId, setActioningId] = useState(null)

  const [dupSourceDate, setDupSourceDate] = useState('')
  const [dupDestDate, setDupDestDate] = useState('')
  const [dupSourceShifts, setDupSourceShifts] = useState([])
  const [dupSourceLoading, setDupSourceLoading] = useState(false)
  const [dupChecking, setDupChecking] = useState(false)
  const [dupSaving, setDupSaving] = useState(false)
  const [dupError, setDupError] = useState(null)
  const [dupSuccess, setDupSuccess] = useState(null)
  const [dupConfirm, setDupConfirm] = useState(null)

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

  async function fetchPendingClaims() {
    setPendingLoading(true)
    setPendingError(null)

    const { data, error: fetchError } = await supabase
      .from('shifts')
      .select(`
        id, unit, starts_at, ends_at, claimed_by, claimed_at,
        claimant:profiles!claimed_by ( full_name, credential )
      `)
      .eq('status', 'pending')
      .order('claimed_at', { ascending: true })

    if (fetchError) {
      setPendingError(fetchError.message)
      setPendingClaims([])
    } else {
      setPendingClaims(data ?? [])
    }

    setPendingLoading(false)
  }

  useEffect(() => {
    fetchPendingClaims()
  }, [])

  useEffect(() => {
    let cancelled = false

    if (!dupSourceDate) {
      setDupSourceShifts([])
      return
    }

    async function fetchSourceWeekShifts() {
      setDupSourceLoading(true)
      setDupError(null)

      const weekStart = getWeekStart(`${dupSourceDate}T00:00:00`)
      const { start, end } = getWeekRange(weekStart)

      const { data, error: fetchError } = await supabase
        .from('shifts')
        .select('id, nurse_id, unit, starts_at, ends_at')
        .gte('starts_at', start.toISOString())
        .lt('starts_at', end.toISOString())
        .order('starts_at', { ascending: true })

      if (cancelled) return

      if (fetchError) {
        setDupError(fetchError.message)
        setDupSourceShifts([])
      } else {
        setDupSourceShifts(data ?? [])
      }

      setDupSourceLoading(false)
    }

    fetchSourceWeekShifts()
    return () => { cancelled = true }
  }, [dupSourceDate])

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

    if (!form.date || (!form.unassigned && !form.nurse_id)) {
      setError('Please fill out all fields.')
      return
    }

    setSaving(true)
    const { starts_at, ends_at } = buildShiftTimes(form.date, form.shift_type)

    const payload = form.unassigned
      ? { unit: form.unit, starts_at, ends_at, status: 'open', nurse_id: null }
      : { nurse_id: form.nurse_id, unit: form.unit, starts_at, ends_at }

    const { error: insertError } = await supabase.from('shifts').insert(payload)

    setSaving(false)

    if (insertError) {
      setError(insertError.message)
    } else {
      setSuccess(true)
      setForm({ nurse_id: '', unit: 'Unit 1', date: '', shift_type: 'day', unassigned: false })
    }
  }

  async function handleApprove(claim) {
    setActionError(null)
    setActioningId(claim.id)

    const { error: updateError } = await supabase
      .from('shifts')
      .update({
        nurse_id: claim.claimed_by,
        status: 'scheduled',
        claimed_by: null,
        claimed_at: null,
      })
      .eq('id', claim.id)

    setActioningId(null)

    if (updateError) {
      setActionError(updateError.message)
      return
    }

    fetchPendingClaims()
  }

  async function handleDeny(claim) {
    setActionError(null)
    setActioningId(claim.id)

    const { error: updateError } = await supabase
      .from('shifts')
      .update({ status: 'open', claimed_by: null, claimed_at: null })
      .eq('id', claim.id)

    setActioningId(null)

    if (updateError) {
      setActionError(updateError.message)
      return
    }

    fetchPendingClaims()
  }

  async function handleReviewCopy() {
    setDupError(null)
    setDupSuccess(null)
    setDupConfirm(null)

    if (!dupSourceDate || !dupDestDate) {
      setDupError('Choose both a source week and a destination week.')
      return
    }

    if (dupSourceShifts.length === 0) {
      setDupError('No shifts in the selected week.')
      return
    }

    const sourceStart = getWeekStart(`${dupSourceDate}T00:00:00`)
    const destStart = getWeekStart(`${dupDestDate}T00:00:00`)

    setDupChecking(true)
    const { start: destRangeStart, end: destRangeEnd } = getWeekRange(destStart)
    const { data: destShifts, error: destError } = await supabase
      .from('shifts')
      .select('id')
      .gte('starts_at', destRangeStart.toISOString())
      .lt('starts_at', destRangeEnd.toISOString())
    setDupChecking(false)

    if (destError) {
      setDupError(destError.message)
      return
    }

    setDupConfirm({
      sourceStart,
      destStart,
      count: dupSourceShifts.length,
      destConflictCount: destShifts?.length ?? 0,
    })
  }

  async function handleConfirmCopy() {
    if (!dupConfirm) return

    setDupSaving(true)
    setDupError(null)

    const dayOffset = diffInCalendarDays(dupConfirm.sourceStart, dupConfirm.destStart)

    const rows = dupSourceShifts.map((shift) => ({
      nurse_id: shift.nurse_id,
      unit: shift.unit,
      starts_at: addLocalDays(shift.starts_at, dayOffset),
      ends_at: addLocalDays(shift.ends_at, dayOffset),
    }))

    const { error: insertError } = await supabase.from('shifts').insert(rows)

    setDupSaving(false)

    if (insertError) {
      setDupError(insertError.message)
      return
    }

    setDupSuccess(
      `Copied ${rows.length} shift${rows.length === 1 ? '' : 's'} to the week of ${formatWeekRangeLabel(dupConfirm.destStart)}.`,
    )
    setDupConfirm(null)
    setDupSourceDate('')
    setDupDestDate('')
    setDupSourceShifts([])
  }

  function handleCancelCopy() {
    setDupConfirm(null)
  }

  if (loading) return <p className="page-status">Loading…</p>

  return (
    <div className="manage-tab">
      <h2>Post a Shift</h2>

      <div className="manage-form">
        <label className="manage-checkbox">
          <input
            type="checkbox"
            checked={form.unassigned}
            onChange={(e) =>
              setForm({ ...form, unassigned: e.target.checked, nurse_id: '' })
            }
          />
          Leave unassigned (open shift)
        </label>

        <label>
          Nurse
          <select
            value={form.nurse_id}
            onChange={(e) => setForm({ ...form, nurse_id: e.target.value })}
            disabled={form.unassigned}
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

      <h2 className="manage-section-heading">Pending claims</h2>

      <div className="manage-form">
        {pendingLoading && <p className="page-status">Loading pending claims…</p>}
        {pendingError && (
          <p className="page-error">Could not load pending claims: {pendingError}</p>
        )}
        {actionError && <p className="page-error">{actionError}</p>}

        {!pendingLoading && !pendingError && pendingClaims.length === 0 && (
          <p className="page-status">No pending claims.</p>
        )}

        {!pendingLoading && pendingClaims.length > 0 && (
          <ul className="shift-list">
            {pendingClaims.map((claim) => (
              <li key={claim.id}>
                <div className="shift-card pending-claim-card">
                  <div className="shift-card-header">
                    <p className="shift-unit">{claim.unit}</p>
                    <span
                      className={`status-pill status-pill--${getStatusModifier('pending')}`}
                    >
                      {getStatusLabel('pending')}
                    </span>
                  </div>
                  <p className="shift-date">{formatShiftDate(claim.starts_at)}</p>
                  <p className="shift-time">
                    {formatShiftTimeRange(claim.starts_at, claim.ends_at)}
                  </p>
                  <p className="pending-claim-nurse">
                    Claimed by {claim.claimant?.full_name ?? 'Unknown'}
                    {claim.claimant?.credential ? ` (${claim.claimant.credential})` : ''}
                  </p>
                  <div className="dup-confirm-actions">
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={() => handleApprove(claim)}
                      disabled={actioningId === claim.id}
                    >
                      {actioningId === claim.id ? 'Approving…' : 'Approve'}
                    </button>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => handleDeny(claim)}
                      disabled={actioningId === claim.id}
                    >
                      {actioningId === claim.id ? 'Denying…' : 'Deny'}
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <h2 className="manage-section-heading">Duplicate a week</h2>

      <div className="manage-form">
        <label>
          Source week (any day in that week)
          <input
            type="date"
            value={dupSourceDate}
            onChange={(e) => {
              setDupSourceDate(e.target.value)
              setDupConfirm(null)
              setDupSuccess(null)
            }}
          />
          {dupSourceDate && (
            <span className="dup-hint">
              Week of {formatWeekRangeLabel(getWeekStart(`${dupSourceDate}T00:00:00`))}
            </span>
          )}
        </label>

        <label>
          Destination week (any day in that week)
          <input
            type="date"
            value={dupDestDate}
            onChange={(e) => {
              setDupDestDate(e.target.value)
              setDupConfirm(null)
              setDupSuccess(null)
            }}
          />
          {dupDestDate && (
            <span className="dup-hint">
              Week of {formatWeekRangeLabel(getWeekStart(`${dupDestDate}T00:00:00`))}
            </span>
          )}
        </label>

        {dupSourceDate && !dupSourceLoading && dupSourceShifts.length === 0 && (
          <p className="page-status">No shifts in the selected week.</p>
        )}

        {dupError && <p className="page-error">{dupError}</p>}
        {dupSuccess && <p className="page-success">{dupSuccess}</p>}

        {dupConfirm ? (
          <div className="dup-confirm">
            <p>
              Copy {dupConfirm.count} shift{dupConfirm.count === 1 ? '' : 's'} to the week of{' '}
              {formatWeekRangeLabel(dupConfirm.destStart)}?
            </p>
            {dupConfirm.destConflictCount > 0 && (
              <p className="page-error">
                The destination week already has {dupConfirm.destConflictCount} shift
                {dupConfirm.destConflictCount === 1 ? '' : 's'}. Copying may create duplicate
                bookings.
              </p>
            )}
            <div className="dup-confirm-actions">
              <button
                type="button"
                className="btn-primary"
                onClick={handleConfirmCopy}
                disabled={dupSaving}
              >
                {dupSaving
                  ? 'Copying…'
                  : dupConfirm.destConflictCount > 0
                    ? 'Copy anyway (may create duplicates)'
                    : 'Confirm copy'}
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={handleCancelCopy}
                disabled={dupSaving}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="btn-primary"
            onClick={handleReviewCopy}
            disabled={
              !dupSourceDate ||
              !dupDestDate ||
              dupSourceLoading ||
              dupChecking ||
              dupSourceShifts.length === 0
            }
          >
            {dupChecking ? 'Checking…' : 'Copy shifts'}
          </button>
        )}
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
        {!isCoordinator && (
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'open'}
            className={activeTab === 'open' ? 'active' : undefined}
            onClick={() => setActiveTab('open')}
          >
            Open Shifts
          </button>
        )}
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
        {activeTab === 'open' && !isCoordinator && <OpenShiftsTab user={user} />}
        {activeTab === 'team' && <TeamScheduleTab />}
        {activeTab === 'manage' && isCoordinator && <ManageTab />}
      </div>
    </main>
  )
}