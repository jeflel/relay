import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { ShiftPeriodPill, StatusPill } from '@/components/ui/pill'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  addLocalDays,
  diffInCalendarDays,
  formatShiftDate,
  formatShiftTimeRange,
  getFourWeekDays,
  getFourWeekRange,
  getShiftPeriod,
  getWeekRange,
  getWeekStart,
  groupByDayKey,
} from '../lib/shiftFormat'

const weekdayFormatter = new Intl.DateTimeFormat(undefined, { weekday: 'short' })
const monthFormatter = new Intl.DateTimeFormat(undefined, { month: 'short' })

function getInitials(fullName) {
  if (!fullName) return '?'
  const parts = fullName.trim().split(/\s+/)
  const initials = parts.length === 1 ? parts[0][0] : parts[0][0] + parts[parts.length - 1][0]
  return initials.toUpperCase()
}

function groupByTimeSlot(dayShifts) {
  const groups = new Map()

  for (const shift of dayShifts) {
    const key = `${shift.starts_at}__${shift.ends_at}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(shift)
  }

  return Array.from(groups.values())
}

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

function ShiftCard({ date, title, subtitle, pill, belowPill, trailing, onClick }) {
  const isInteractive = typeof onClick === 'function'
  const Comp = isInteractive ? 'button' : 'div'

  return (
    <Comp
      type={isInteractive ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'flex w-full items-center rounded-xl bg-white p-4 shadow-sm',
        isInteractive && 'text-left transition-shadow active:shadow-none',
      )}
    >
      <div className="flex w-12 shrink-0 flex-col items-center justify-center gap-0.5 text-center">
        <span className="text-xs font-medium tracking-wide text-[#9CA3AF] uppercase">
          {weekdayFormatter.format(date)}
        </span>
        <span className="text-2xl font-bold text-[#111111]">{date.getDate()}</span>
        <span className="text-xs font-medium tracking-wide text-[#9CA3AF] uppercase">
          {monthFormatter.format(date)}
        </span>
      </div>

      <div className="mx-3 h-8 self-center border-l border-[#E8E6E3]" />

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          <p className="truncate text-sm font-semibold text-[#111111]">{title}</p>
          {pill}
        </div>
        {subtitle}
        {belowPill && <div className="mt-2">{belowPill}</div>}
      </div>

      {trailing && <div className="ml-3 shrink-0">{trailing}</div>}
    </Comp>
  )
}

function DayOffRow({ label, text }) {
  return (
    <li className="flex items-center gap-3 py-1 pl-1 text-sm text-[#9CA3AF]">
      <span className="w-12 shrink-0 text-center text-xs font-medium tracking-wide uppercase">
        {label}
      </span>
      <span>{text}</span>
    </li>
  )
}

function MyShiftsTab({ user }) {
  const [shifts, setShifts] = useState([])
  const [credential, setCredential] = useState(null)
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

  useEffect(() => {
    let cancelled = false

    async function fetchCredential() {
      const { data } = await supabase
        .from('profiles')
        .select('credential')
        .eq('id', user.id)
        .maybeSingle()

      if (!cancelled) setCredential(data?.credential ?? null)
    }

    fetchCredential()
    return () => { cancelled = true }
  }, [user.id])

  const shiftsByDay = groupByDayKey(shifts, (shift) => shift.starts_at)
  const days = getFourWeekDays()

  if (loading) return <p className="text-sm text-[#6B7280]">Loading shifts…</p>
  if (error) return <p className="text-sm text-red-700">Could not load shifts: {error}</p>

  return (
    <ul className="flex flex-col gap-3">
      {days.map((day) => {
        const dayShifts = shiftsByDay[day.key] ?? []

        if (dayShifts.length === 0) {
          return <DayOffRow key={day.key} label={day.label} text="Day off" />
        }

        return dayShifts.map((shift) => {
          const period = getShiftPeriod(shift.starts_at)
          const isPending = shift.status === 'pending'

          return (
            <li key={shift.id}>
              <ShiftCard
                date={new Date(shift.starts_at)}
                title={formatShiftTimeRange(shift.starts_at, shift.ends_at)}
                pill={<ShiftPeriodPill period={period} />}
                belowPill={isPending ? <StatusPill status="pending" label="Pending" /> : null}
                subtitle={
                  <div className="mt-1 flex items-center gap-1.5">
                    <p className="truncate text-xs text-[#9CA3AF]">{shift.unit}</p>
                    {credential && (
                      <>
                        <span className="h-3 border-l border-[#E8E6E3]" />
                        <p className="text-xs text-[#9CA3AF]">{credential}</p>
                      </>
                    )}
                  </div>
                }
              />
            </li>
          )
        })
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

  if (loading) return <p className="text-sm text-[#6B7280]">Loading open shifts…</p>
  if (error) return <p className="text-sm text-red-700">Could not load open shifts: {error}</p>

  return (
    <>
      {successMessage && <p className="mb-4 text-sm text-[#16A34A]">{successMessage}</p>}

      {shifts.length === 0 ? (
        <p className="text-sm text-[#6B7280]">No open shifts right now</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {shifts.map((shift) => {
            const isPending = shift.status === 'pending'
            const isClaiming = claimingId === shift.id

            return (
              <li key={shift.id}>
                <ShiftCard
                  date={new Date(shift.starts_at)}
                  title={formatShiftTimeRange(shift.starts_at, shift.ends_at)}
                  pill={<StatusPill status={shift.status} label={isPending ? 'Pending approval' : undefined} />}
                  subtitle={
                    <div className="mt-1">
                      <p className="truncate text-xs text-[#9CA3AF]">{shift.unit}</p>
                    </div>
                  }
                  trailing={
                    isPending ? (
                      <span className="text-xs font-medium text-[#9CA3AF]">Requested</span>
                    ) : (
                      <Button
                        type="button"
                        onClick={() => handleClaim(shift)}
                        disabled={isClaiming}
                        className="h-auto rounded-full bg-[#111111] px-4 py-1.5 text-xs font-medium text-white hover:bg-[#111111]/90 disabled:opacity-60"
                      >
                        {isClaiming ? 'Requesting…' : 'Claim'}
                      </Button>
                    )
                  }
                />

                {takenId === shift.id && (
                  <p className="mt-1.5 pl-1 text-xs text-red-700">This shift was just taken.</p>
                )}
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

  if (loading) return <p className="text-sm text-[#6B7280]">Loading team schedule…</p>
  if (error) return <p className="text-sm text-red-700">Could not load team schedule: {error}</p>

  return (
    <ul className="flex flex-col gap-4">
      {days.map((day) => {
        const dayShifts = shiftsByDay[day.key] ?? []

        if (dayShifts.length === 0) {
          return <DayOffRow key={day.key} label={day.label} text="No shifts" />
        }

        const timeSlots = groupByTimeSlot(dayShifts)
        const dayHeaderLabel = `${weekdayFormatter.format(day.date)} ${day.date.getDate()} ${monthFormatter.format(day.date)}`

        return (
          <li key={day.key}>
            <p className="mb-2 text-sm font-medium text-[#6B7280] uppercase">{dayHeaderLabel}</p>

            <div className="flex flex-col gap-3">
              {timeSlots.map((slotShifts) => {
                const [firstShift] = slotShifts
                const period = getShiftPeriod(firstShift.starts_at)
                const units = Array.from(new Set(slotShifts.map((shift) => shift.unit)))

                return (
                  <div
                    key={`${firstShift.starts_at}__${firstShift.ends_at}`}
                    className="rounded-xl bg-white p-4 shadow-sm"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-[#111111]">
                        {formatShiftTimeRange(firstShift.starts_at, firstShift.ends_at)}
                      </p>
                      <ShiftPeriodPill period={period} />
                    </div>
                    <p className="mt-0.5 text-xs text-[#9CA3AF]">{units.join(', ')}</p>

                    <div className="mt-3 border-b border-[#E8E6E3]" />

                    <ul className="flex flex-col">
                      {slotShifts.map((shift) => {
                        if (shift.status === 'open') {
                          return (
                            <li
                              key={shift.id}
                              className="flex items-center justify-between border-b border-[#E8E6E3] py-3 last:border-b-0"
                            >
                              <p className="text-sm text-[#9CA3AF]">Open shift</p>
                              <StatusPill status="open" />
                            </li>
                          )
                        }

                        const displayName =
                          shift.status === 'pending'
                            ? (shift.claimant?.full_name ?? 'Pending claim')
                            : shift.profiles?.full_name
                        const displayCredential =
                          shift.status === 'pending'
                            ? shift.claimant?.credential
                            : shift.profiles?.credential

                        return (
                          <li
                            key={shift.id}
                            className="flex items-center gap-3 border-b border-[#E8E6E3] py-3 last:border-b-0"
                          >
                            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#F8F7F5] text-xs font-semibold text-[#6B7280]">
                              {getInitials(displayName)}
                            </div>

                            <div className="flex min-w-0 flex-1 items-center gap-1.5">
                              <p className="truncate text-sm font-medium text-[#111111]">
                                {displayName}
                              </p>
                              {displayCredential && (
                                <>
                                  <span className="h-3 border-l border-[#E8E6E3]" />
                                  <p className="text-xs text-[#9CA3AF]">{displayCredential}</p>
                                </>
                              )}
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                )
              })}
            </div>
          </li>
        )
      })}
    </ul>
  )
}

const inputClassName =
  'w-full rounded-xl border border-[#E8E6E3] p-3 text-sm focus:border-[#111111] focus:outline-none'
const labelClassName = 'text-xs font-medium tracking-wide text-[#6B7280] uppercase'

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

  const [recentShifts, setRecentShifts] = useState([])
  const [recentLoading, setRecentLoading] = useState(true)
  const [recentError, setRecentError] = useState(null)
  const [showAllRecent, setShowAllRecent] = useState(false)

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

  async function fetchRecentShifts() {
    setRecentLoading(true)
    setRecentError(null)

    const { data, error: fetchError } = await supabase
      .from('shifts')
      .select('id, unit, starts_at, ends_at, status, nurse_id, profiles!nurse_id ( full_name )')
      .order('created_at', { ascending: false })

    if (fetchError) {
      setRecentError(fetchError.message)
      setRecentShifts([])
    } else {
      setRecentShifts(data ?? [])
    }

    setRecentLoading(false)
  }

  useEffect(() => {
    fetchRecentShifts()
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
      fetchRecentShifts()
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
    fetchRecentShifts()
  }

  function handleCancelCopy() {
    setDupConfirm(null)
  }

  if (loading) return <p className="text-sm text-[#6B7280]">Loading…</p>

  const visibleRecentShifts = showAllRecent ? recentShifts : recentShifts.slice(0, 3)

  return (
    <div className="flex flex-col gap-10">
      <section>
        <h2 className="mb-4 text-sm font-semibold text-[#111111]">Post a shift</h2>

        <div className="flex flex-col gap-4">
          <label className="flex items-center gap-2 text-sm font-medium text-[#111111]">
            <input
              type="checkbox"
              checked={form.unassigned}
              onChange={(e) =>
                setForm({ ...form, unassigned: e.target.checked, nurse_id: '' })
              }
              className="h-4 w-4 rounded border-[#E8E6E3] accent-[#111111]"
            />
            Leave unassigned (open shift)
          </label>

          <div className="flex flex-col gap-1.5">
            <label className={labelClassName}>Nurse</label>
            <select
              value={form.nurse_id}
              onChange={(e) => setForm({ ...form, nurse_id: e.target.value })}
              disabled={form.unassigned}
              className={cn(inputClassName, 'disabled:opacity-50')}
            >
              <option value="">Select a nurse</option>
              {nurses.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.full_name} {n.credential ? `(${n.credential})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className={labelClassName}>Unit</label>
            <select
              value={form.unit}
              onChange={(e) => setForm({ ...form, unit: e.target.value })}
              className={inputClassName}
            >
              <option value="Unit 1">Unit 1</option>
              <option value="Unit 2">Unit 2</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className={labelClassName}>Date</label>
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              className={inputClassName}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className={labelClassName}>Shift</label>
            <select
              value={form.shift_type}
              onChange={(e) => setForm({ ...form, shift_type: e.target.value })}
              className={inputClassName}
            >
              <option value="day">Day (7am – 7pm)</option>
              <option value="evening">Evening (3pm – 11pm)</option>
              <option value="night">Night (11pm – 7am)</option>
            </select>
          </div>

          {error && <p className="text-sm text-red-700">{error}</p>}
          {success && <p className="text-sm text-[#16A34A]">Shift posted successfully.</p>}

          <Button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="h-auto w-full rounded-full bg-[#111111] py-3 text-base font-semibold text-white hover:bg-[#111111]/90 disabled:opacity-60"
          >
            {saving ? 'Posting…' : 'Post shift'}
          </Button>
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-sm font-semibold text-[#111111]">Recent shifts</h2>

        {recentLoading && <p className="text-sm text-[#6B7280]">Loading…</p>}
        {!recentLoading && recentError && (
          <p className="text-sm text-red-700">Could not load recent shifts: {recentError}</p>
        )}

        {!recentLoading && !recentError && (
          recentShifts.length === 0 ? (
            <p className="text-sm text-[#6B7280]">No shifts posted yet.</p>
          ) : (
            <>
              <ul className="flex flex-col gap-3">
                {visibleRecentShifts.map((shift) => (
                  <li key={shift.id}>
                    <ShiftCard
                      date={new Date(shift.starts_at)}
                      title={formatShiftTimeRange(shift.starts_at, shift.ends_at)}
                      pill={<StatusPill status={shift.status} />}
                      subtitle={
                        <div className="mt-1">
                          <p className="truncate text-xs text-[#9CA3AF]">
                            {shift.profiles?.full_name ?? 'Open'}
                          </p>
                          <p className="mt-0.5 truncate text-xs text-[#9CA3AF]">{shift.unit}</p>
                        </div>
                      }
                    />
                  </li>
                ))}
              </ul>

              {recentShifts.length > 3 && (
                <button
                  type="button"
                  onClick={() => setShowAllRecent((current) => !current)}
                  className="mt-3 text-sm text-[#6B7280] hover:underline"
                >
                  {showAllRecent ? 'Show less' : 'Show all'}
                </button>
              )}
            </>
          )
        )}
      </section>

      <section>
        <h2 className="mb-4 text-sm font-semibold text-[#111111]">Pending claims</h2>

        {pendingLoading && <p className="text-sm text-[#6B7280]">Loading pending claims…</p>}
        {pendingError && (
          <p className="text-sm text-red-700">Could not load pending claims: {pendingError}</p>
        )}
        {actionError && <p className="mb-3 text-sm text-red-700">{actionError}</p>}

        {!pendingLoading && !pendingError && pendingClaims.length === 0 && (
          <p className="text-sm text-[#6B7280]">No pending claims.</p>
        )}

        {!pendingLoading && pendingClaims.length > 0 && (
          <ul className="flex flex-col gap-3">
            {pendingClaims.map((claim) => (
              <li key={claim.id}>
                <div className="rounded-xl bg-white p-4 shadow-sm">
                  <p className="text-sm font-semibold text-[#111111]">
                    {claim.claimant?.full_name ?? 'Unknown'}
                    {claim.claimant?.credential ? ` (${claim.claimant.credential})` : ''}
                  </p>
                  <p className="mt-1 text-sm text-[#6B7280]">
                    {claim.unit} · {formatShiftDate(claim.starts_at)} ·{' '}
                    {formatShiftTimeRange(claim.starts_at, claim.ends_at)}
                  </p>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleApprove(claim)}
                      disabled={actioningId === claim.id}
                      className="rounded-full bg-[#111111] px-4 py-1.5 text-sm font-medium text-white disabled:opacity-60"
                    >
                      {actioningId === claim.id ? 'Approving…' : 'Approve'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeny(claim)}
                      disabled={actioningId === claim.id}
                      className="rounded-full border border-[#E8E6E3] px-4 py-1.5 text-sm font-medium text-[#111111] disabled:opacity-60"
                    >
                      {actioningId === claim.id ? 'Denying…' : 'Deny'}
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-4 text-sm font-semibold text-[#111111]">Duplicate a week</h2>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className={labelClassName}>Source week (any day in that week)</label>
            <input
              type="date"
              value={dupSourceDate}
              onChange={(e) => {
                setDupSourceDate(e.target.value)
                setDupConfirm(null)
                setDupSuccess(null)
              }}
              className={inputClassName}
            />
            {dupSourceDate && (
              <span className="text-xs text-[#9CA3AF]">
                Week of {formatWeekRangeLabel(getWeekStart(`${dupSourceDate}T00:00:00`))}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label className={labelClassName}>Destination week (any day in that week)</label>
            <input
              type="date"
              value={dupDestDate}
              onChange={(e) => {
                setDupDestDate(e.target.value)
                setDupConfirm(null)
                setDupSuccess(null)
              }}
              className={inputClassName}
            />
            {dupDestDate && (
              <span className="text-xs text-[#9CA3AF]">
                Week of {formatWeekRangeLabel(getWeekStart(`${dupDestDate}T00:00:00`))}
              </span>
            )}
          </div>

          {dupSourceDate && !dupSourceLoading && dupSourceShifts.length === 0 && (
            <p className="text-sm text-[#6B7280]">No shifts in the selected week.</p>
          )}

          {dupError && <p className="text-sm text-red-700">{dupError}</p>}
          {dupSuccess && <p className="text-sm text-[#16A34A]">{dupSuccess}</p>}

          {dupConfirm ? (
            <div className="rounded-xl bg-white p-4 shadow-sm">
              <p className="text-sm text-[#111111]">
                Copy {dupConfirm.count} shift{dupConfirm.count === 1 ? '' : 's'} to the week of{' '}
                {formatWeekRangeLabel(dupConfirm.destStart)}?
              </p>
              {dupConfirm.destConflictCount > 0 && (
                <p className="mt-2 text-sm text-[#D97706]">
                  The destination week already has {dupConfirm.destConflictCount} shift
                  {dupConfirm.destConflictCount === 1 ? '' : 's'}. Copying may create duplicate
                  bookings.
                </p>
              )}
              <div className="mt-3 flex gap-2">
                <Button
                  type="button"
                  onClick={handleConfirmCopy}
                  disabled={dupSaving}
                  className="h-auto flex-1 rounded-full bg-[#111111] py-2.5 text-sm font-semibold text-white hover:bg-[#111111]/90 disabled:opacity-60"
                >
                  {dupSaving
                    ? 'Copying…'
                    : dupConfirm.destConflictCount > 0
                      ? 'Copy anyway'
                      : 'Confirm copy'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancelCopy}
                  disabled={dupSaving}
                  className="h-auto flex-1 rounded-full border-[#E8E6E3] py-2.5 text-sm font-semibold text-[#111111] shadow-none hover:bg-white"
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button
              type="button"
              onClick={handleReviewCopy}
              disabled={
                !dupSourceDate ||
                !dupDestDate ||
                dupSourceLoading ||
                dupChecking ||
                dupSourceShifts.length === 0
              }
              className="h-auto w-full rounded-full bg-[#111111] py-3 text-base font-semibold text-white hover:bg-[#111111]/90 disabled:opacity-60"
            >
              {dupChecking ? 'Checking…' : 'Copy shifts'}
            </Button>
          )}
        </div>
      </section>
    </div>
  )
}

export default function Schedule({ user, role, initialTab = 'my' }) {
  const [activeTab, setActiveTab] = useState(initialTab)
  const isCoordinator = role === 'coordinator'

  const tabs = [
    { id: 'my', label: 'My Shifts' },
    ...(!isCoordinator ? [{ id: 'open', label: 'Open Shifts' }] : []),
    { id: 'team', label: 'Team Schedule' },
    ...(isCoordinator ? [{ id: 'manage', label: 'Manage' }] : []),
  ]

  return (
    <main className="mx-auto w-full max-w-md px-5 pt-12 pb-12">
      <h1 className="mb-6 text-3xl font-bold tracking-tight text-[#111111]">Schedule</h1>

      <div className="mb-6 flex border-b border-[#E8E6E3]" role="tablist" aria-label="Schedule views">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex-1 border-b-2 px-2 py-3 text-sm font-medium transition-colors',
              activeTab === tab.id
                ? 'border-[#111111] font-semibold text-[#111111]'
                : 'border-transparent text-[#9CA3AF]',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div role="tabpanel">
        {activeTab === 'my' && <MyShiftsTab user={user} />}
        {activeTab === 'open' && !isCoordinator && <OpenShiftsTab user={user} />}
        {activeTab === 'team' && <TeamScheduleTab />}
        {activeTab === 'manage' && isCoordinator && <ManageTab />}
      </div>
    </main>
  )
}
