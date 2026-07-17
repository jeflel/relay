import { useEffect, useState } from 'react'
import { AlertTriangle, Pencil, Trash2, Users } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { ShiftPeriodPill, StatusPill } from '@/components/ui/pill'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  addLocalDays,
  diffInCalendarDays,
  formatLocalDateKey,
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
        'flex w-full items-center rounded-xl bg-white p-4 shadow-sm border border-[#E8E6E3]',
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
  const [homeUnit, setHomeUnit] = useState(undefined)
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

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('home_unit')
        .eq('id', user.id)
        .single()

      if (cancelled) return

      if (profileError) {
        setError(profileError.message)
        setHomeUnit(null)
        setShifts([])
        setLoading(false)
        return
      }

      const unit = profile?.home_unit ?? null
      setHomeUnit(unit)

      if (!unit) {
        setShifts([])
        setLoading(false)
        return
      }

      const { data, error: fetchError } = await supabase
        .from('shifts')
        .select('id, unit, starts_at, ends_at, status')
        .eq('status', 'open')
        .eq('unit', unit)
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
  }, [user.id])

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
  if (!homeUnit) {
    return (
      <p className="text-sm text-[#6B7280]">
        Your home unit hasn&apos;t been set yet. Contact your coordinator.
      </p>
    )
  }

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
                    className="rounded-xl bg-white p-4 shadow-sm border border-[#E8E6E3]"
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
  const [recentActionMessage, setRecentActionMessage] = useState(null)

  const [openShiftAction, setOpenShiftAction] = useState(null)
  const [editForm, setEditForm] = useState(null)
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState(null)
  const [deleteSaving, setDeleteSaving] = useState(false)
  const [deleteError, setDeleteError] = useState(null)

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

  function handleCloseShiftAction() {
    setOpenShiftAction(null)
    setEditForm(null)
    setEditError(null)
    setDeleteError(null)
  }

  function handleOpenEdit(shift) {
    setRecentActionMessage(null)
    setEditError(null)
    setEditForm({
      nurse_id: shift.nurse_id ?? '',
      unit: shift.unit,
      date: formatLocalDateKey(new Date(shift.starts_at)),
      shift_type: getShiftPeriod(shift.starts_at).toLowerCase(),
    })
    setOpenShiftAction({ type: 'edit', shiftId: shift.id })
  }

  function handleOpenDelete(shift) {
    setRecentActionMessage(null)
    setDeleteError(null)
    setOpenShiftAction({ type: 'delete', shiftId: shift.id })
  }

  async function handleSaveEdit(shiftId) {
    if (!editForm.nurse_id) {
      setEditError('Please select a nurse.')
      return
    }
    if (!editForm.date) {
      setEditError('Please choose a date.')
      return
    }

    setEditSaving(true)
    setEditError(null)

    const { starts_at, ends_at } = buildShiftTimes(editForm.date, editForm.shift_type)

    const { error: updateError } = await supabase
      .from('shifts')
      .update({
        nurse_id: editForm.nurse_id,
        unit: editForm.unit,
        starts_at,
        ends_at,
        status: 'scheduled',
      })
      .eq('id', shiftId)

    setEditSaving(false)

    if (updateError) {
      setEditError(updateError.message)
      return
    }

    handleCloseShiftAction()
    setRecentActionMessage('Shift updated.')
    fetchRecentShifts()
  }

  async function handleConfirmDelete(shiftId) {
    setDeleteSaving(true)
    setDeleteError(null)

    const { error: deleteErr } = await supabase.from('shifts').delete().eq('id', shiftId)

    setDeleteSaving(false)

    if (deleteErr) {
      setDeleteError(deleteErr.message)
      return
    }

    handleCloseShiftAction()
    setRecentActionMessage('Shift deleted.')
    fetchRecentShifts()
  }

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

        {recentActionMessage && (
          <p className="mb-3 text-sm text-[#16A34A]">{recentActionMessage}</p>
        )}

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
                      trailing={
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(shift)}
                            aria-label="Edit shift"
                            className="p-1 text-[#6B7280]"
                          >
                            <Pencil size={15} strokeWidth={2} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenDelete(shift)}
                            aria-label="Delete shift"
                            className="p-1 text-[#EF4444]"
                          >
                            <Trash2 size={15} strokeWidth={2} />
                          </button>
                        </div>
                      }
                    />

                    {openShiftAction?.type === 'edit' &&
                      openShiftAction.shiftId === shift.id &&
                      editForm && (
                        <div className="mt-2 flex flex-col gap-4 rounded-xl bg-white p-4 shadow-sm border border-[#E8E6E3]">
                          <div className="flex flex-col gap-1.5">
                            <label className={labelClassName}>Nurse</label>
                            <select
                              value={editForm.nurse_id}
                              onChange={(e) =>
                                setEditForm({ ...editForm, nurse_id: e.target.value })
                              }
                              className={inputClassName}
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
                              value={editForm.unit}
                              onChange={(e) => setEditForm({ ...editForm, unit: e.target.value })}
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
                              value={editForm.date}
                              onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                              className={inputClassName}
                            />
                          </div>

                          <div className="flex flex-col gap-1.5">
                            <label className={labelClassName}>Shift</label>
                            <select
                              value={editForm.shift_type}
                              onChange={(e) =>
                                setEditForm({ ...editForm, shift_type: e.target.value })
                              }
                              className={inputClassName}
                            >
                              <option value="day">Day (7am – 7pm)</option>
                              <option value="evening">Evening (3pm – 11pm)</option>
                              <option value="night">Night (11pm – 7am)</option>
                            </select>
                          </div>

                          {editError && <p className="text-sm text-red-700">{editError}</p>}

                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => handleSaveEdit(shift.id)}
                              disabled={editSaving}
                              className="rounded-full bg-[#111111] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                            >
                              {editSaving ? 'Saving…' : 'Save'}
                            </button>
                            <button
                              type="button"
                              onClick={handleCloseShiftAction}
                              disabled={editSaving}
                              className="rounded-full border border-[#E8E6E3] px-4 py-2 text-sm font-medium text-[#111111] disabled:opacity-60"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}

                    {openShiftAction?.type === 'delete' && openShiftAction.shiftId === shift.id && (
                      <div className="mt-2 flex flex-col gap-3 rounded-xl bg-white p-4 shadow-sm border border-[#E8E6E3]">
                        <p className="text-sm font-medium text-[#111111]">Delete this shift?</p>

                        {shift.status === 'pending' && (
                          <div className="flex items-start gap-1.5 text-sm text-[#D97706]">
                            <AlertTriangle size={15} strokeWidth={2} className="mt-0.5 shrink-0" />
                            <p>This shift has a pending claim. Deleting it will remove the claim.</p>
                          </div>
                        )}

                        {deleteError && <p className="text-sm text-red-700">{deleteError}</p>}

                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleConfirmDelete(shift.id)}
                            disabled={deleteSaving}
                            className="rounded-full bg-red-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                          >
                            {deleteSaving ? 'Deleting…' : 'Delete'}
                          </button>
                          <button
                            type="button"
                            onClick={handleCloseShiftAction}
                            disabled={deleteSaving}
                            className="rounded-full border border-[#E8E6E3] px-4 py-2 text-sm font-medium text-[#111111] disabled:opacity-60"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
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
                <div className="rounded-xl bg-white p-4 shadow-sm border border-[#E8E6E3]">
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
            <div className="rounded-xl bg-white p-4 shadow-sm border border-[#E8E6E3]">
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

function StaffTab() {
  const [nurses, setNurses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [weekStats, setWeekStats] = useState({})
  const [expandedId, setExpandedId] = useState(null)
  const [editForm, setEditForm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [savedId, setSavedId] = useState(null)
  const [savedFading, setSavedFading] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function fetchStaff() {
      setLoading(true)
      setError(null)

      const { data: nurseData, error: nurseError } = await supabase
        .from('profiles')
        .select('id, full_name, credential, home_unit, email')
        .eq('role', 'nurse')
        .order('full_name', { ascending: true })

      if (cancelled) return

      if (nurseError) {
        setError(nurseError.message)
        setNurses([])
        setLoading(false)
        return
      }

      const weekStart = getWeekStart(new Date())
      const { start, end } = getWeekRange(weekStart)

      const { data: shiftData, error: shiftError } = await supabase
        .from('shifts')
        .select('nurse_id, starts_at, ends_at')
        .not('nurse_id', 'is', null)
        .gte('starts_at', start.toISOString())
        .lt('starts_at', end.toISOString())

      if (cancelled) return

      if (shiftError) {
        setError(shiftError.message)
        setNurses([])
        setLoading(false)
        return
      }

      const stats = {}
      for (const shift of shiftData ?? []) {
        const hours = (new Date(shift.ends_at) - new Date(shift.starts_at)) / 3600000
        if (!stats[shift.nurse_id]) stats[shift.nurse_id] = { count: 0, hours: 0 }
        stats[shift.nurse_id].count += 1
        stats[shift.nurse_id].hours += hours
      }

      setNurses(nurseData ?? [])
      setWeekStats(stats)
      setLoading(false)
    }

    fetchStaff()
    return () => { cancelled = true }
  }, [])

  function handleFieldChange(field, value) {
    setEditForm((current) => ({ ...current, [field]: value }))
  }

  function handleToggleEdit(nurse) {
    setSaveError(null)
    setExpandedId((current) => {
      if (current === nurse.id) return null
      setEditForm({
        email: nurse.email ?? '',
        home_unit: nurse.home_unit ?? '',
        credential: nurse.credential ?? '',
      })
      return nurse.id
    })
  }

  function handleCancelEdit() {
    setExpandedId(null)
    setEditForm(null)
    setSaveError(null)
  }

  async function handleSave(nurse) {
    setSaving(true)
    setSaveError(null)

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        email: editForm.email || null,
        home_unit: editForm.home_unit || null,
        credential: editForm.credential || null,
      })
      .eq('id', nurse.id)

    setSaving(false)

    if (updateError) {
      setSaveError(updateError.message)
      return
    }

    setNurses((current) => current.map((n) => (n.id === nurse.id ? { ...n, ...editForm } : n)))
    setSavedId(nurse.id)
    setSavedFading(false)
    setTimeout(() => setSavedFading(true), 1500)
    setTimeout(() => {
      setSavedId((current) => (current === nurse.id ? null : current))
      setSavedFading(false)
    }, 2000)
  }

  if (loading) return <p className="text-sm text-[#6B7280]">Loading staff…</p>
  if (error) return <p className="text-sm text-red-700">Could not load staff: {error}</p>

  return (
    <div>
      <h2 className="mb-4 flex items-center gap-1.5 text-sm font-semibold text-[#111111]">
        <Users size={14} strokeWidth={2} />
        Staff
      </h2>

      {nurses.length === 0 ? (
        <p className="text-sm text-[#6B7280]">No nurses found.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {nurses.map((nurse) => {
            const stats = weekStats[nurse.id] ?? { count: 0, hours: 0 }
            const roundedHours = Math.round(stats.hours * 10) / 10
            const isExpanded = expandedId === nurse.id

            return (
              <li key={nurse.id}>
                <div className="relative rounded-xl bg-white p-4 shadow-sm border border-[#E8E6E3]">
                  <button
                    type="button"
                    onClick={() => handleToggleEdit(nurse)}
                    aria-label="Edit nurse"
                    className="absolute top-4 right-4 text-[#9CA3AF]"
                  >
                    <Pencil size={15} strokeWidth={2} />
                  </button>

                  <div className="flex items-center gap-3 pr-6">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#F8F7F5] text-xs font-semibold text-[#6B7280]">
                      {getInitials(nurse.full_name)}
                    </div>
                    <div className="flex min-w-0 flex-1 items-center gap-1.5">
                      <p className="truncate text-sm font-semibold text-[#111111]">
                        {nurse.full_name}
                      </p>
                      {nurse.credential && (
                        <>
                          <span className="h-3 border-l border-[#E8E6E3]" />
                          <p className="text-xs text-[#9CA3AF]">{nurse.credential}</p>
                        </>
                      )}
                    </div>
                  </div>

                  <p className="mt-2 text-xs text-[#6B7280]">
                    {stats.count} shift{stats.count === 1 ? '' : 's'} · {roundedHours} hrs
                  </p>
                </div>

                {isExpanded && editForm && (
                  <div className="mt-2 flex flex-col gap-4 rounded-xl bg-white p-4 shadow-sm border border-[#E8E6E3]">
                    <div className="flex flex-col gap-1.5">
                      <label className={labelClassName}>Email</label>
                      <input
                        type="email"
                        value={editForm.email}
                        onChange={(e) => handleFieldChange('email', e.target.value)}
                        className="w-full rounded-xl border border-[#E8E6E3] p-2 text-sm"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className={labelClassName}>Home unit</label>
                      <select
                        value={editForm.home_unit}
                        onChange={(e) => handleFieldChange('home_unit', e.target.value)}
                        className="w-full rounded-xl border border-[#E8E6E3] p-2 text-sm"
                      >
                        <option value="">Select unit</option>
                        <option value="Unit 1">Unit 1</option>
                        <option value="Unit 2">Unit 2</option>
                        <option value="Unit 3">Unit 3</option>
                      </select>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className={labelClassName}>Credential</label>
                      <input
                        type="text"
                        value={editForm.credential}
                        onChange={(e) => handleFieldChange('credential', e.target.value)}
                        className="w-full rounded-xl border border-[#E8E6E3] p-2 text-sm"
                      />
                    </div>

                    {saveError && <p className="text-sm text-red-700">Could not save: {saveError}</p>}

                    {savedId === nurse.id && (
                      <span
                        className={cn(
                          'text-xs text-[#16A34A] transition-opacity duration-500',
                          savedFading ? 'opacity-0' : 'opacity-100',
                        )}
                      >
                        Saved
                      </span>
                    )}

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleSave(nurse)}
                        disabled={saving}
                        className="rounded-full bg-[#111111] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                      >
                        {saving ? 'Saving…' : 'Save'}
                      </button>
                      <button
                        type="button"
                        onClick={handleCancelEdit}
                        disabled={saving}
                        className="rounded-full border border-[#E8E6E3] px-4 py-2 text-sm font-medium text-[#111111] disabled:opacity-60"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export default function Schedule({ user, role, initialTab = 'my' }) {
  const isCoordinator = role === 'coordinator'

  const tabs = isCoordinator
    ? [
        { id: 'team', label: 'Team Schedule' },
        { id: 'manage', label: 'Manage' },
        { id: 'staff', label: 'Staff' },
      ]
    : [
        { id: 'my', label: 'My Shifts' },
        { id: 'open', label: 'Open Shifts' },
        { id: 'team', label: 'Team Schedule' },
      ]

  const [activeTab, setActiveTab] = useState(
    tabs.some((tab) => tab.id === initialTab) ? initialTab : tabs[0].id,
  )

  // Only re-check when role changes (e.g. resolves after Schedule mounts), not on every tab switch.
  useEffect(() => {
    if (!tabs.some((tab) => tab.id === activeTab)) {
      setActiveTab(tabs[0].id)
    }
  }, [isCoordinator])

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
        {activeTab === 'my' && !isCoordinator && <MyShiftsTab user={user} />}
        {activeTab === 'open' && !isCoordinator && <OpenShiftsTab user={user} />}
        {activeTab === 'team' && <TeamScheduleTab />}
        {activeTab === 'manage' && isCoordinator && <ManageTab />}
        {activeTab === 'staff' && isCoordinator && <StaffTab />}
      </div>
    </main>
  )
}
