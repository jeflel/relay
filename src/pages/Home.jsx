import { useEffect, useState } from 'react'
import { Calendar, Users, AlertTriangle, CheckCircle2, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import ShiftDetail from './ShiftDetail'
import { ShiftPeriodPill } from '@/components/ui/pill'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  formatLocalDateKey,
  formatShiftDate,
  formatShiftTimeRange,
  getShiftPeriod,
  isSameLocalDay,
  isWithinNextSevenDays,
} from '../lib/shiftFormat'

const weekdayFormatter = new Intl.DateTimeFormat(undefined, { weekday: 'short' })
const monthFormatter = new Intl.DateTimeFormat(undefined, { month: 'short' })

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
  const [credential, setCredential] = useState(null)
  const [shifts, setShifts] = useState([])
  const [notifications, setNotifications] = useState([])
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

      const notificationsQuery = isCoordinator
        ? Promise.resolve({ data: [], error: null })
        : supabase
            .from('notifications')
            .select('id, type, message, shift_id, created_at')
            .eq('user_id', user.id)
            .eq('read', false)
            .order('created_at', { ascending: false })

      const [profileResult, shiftsResult, notificationsResult] = await Promise.all([
        supabase.from('profiles').select('full_name, credential').eq('id', user.id).maybeSingle(),
        shiftsQuery,
        notificationsQuery,
      ])

      if (cancelled) return

      if (profileResult.error) {
        setError(profileResult.error.message)
        setFullName(null)
        setCredential(null)
        setShifts([])
        setNotifications([])
        setLoading(false)
        return
      }

      if (shiftsResult.error) {
        setError(shiftsResult.error.message)
        setFullName(profileResult.data?.full_name ?? null)
        setCredential(profileResult.data?.credential ?? null)
        setShifts([])
        setNotifications([])
        setLoading(false)
        return
      }

      setFullName(profileResult.data?.full_name ?? null)
      setCredential(profileResult.data?.credential ?? null)
      setShifts(shiftsResult.data ?? [])
      setNotifications(notificationsResult.error ? [] : (notificationsResult.data ?? []))
      setLoading(false)
    }

    fetchHomeData()

    return () => {
      cancelled = true
    }
  }, [user.id, isCoordinator])

  async function handleDismissNotification(id) {
    setNotifications((current) => current.filter((n) => n.id !== id))
    await supabase.from('notifications').update({ read: true }).eq('id', id)
  }

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
    <main className="mx-auto w-full max-w-md px-5 pt-12 pb-12">
      {loading ? (
        <div className="h-9 w-48 animate-pulse rounded-md bg-line/60" />
      ) : (
        <h1 className="text-3xl tracking-tight">
          <span className="font-medium text-[#6B7280]">{getGreeting()}</span>
          {fullName && <span className="font-bold text-ink">, {fullName}</span>}
        </h1>
      )}

      <p className="mt-2 text-base font-normal text-[#9CA3AF]">{todayLabel}</p>

      {!loading && error && (
        <p className="mt-6 text-sm text-red-700">Could not load home data: {error}</p>
      )}

      {!loading && !error && (
        <div className="mt-8">
          {isCoordinator ? (
            <CoordinatorSummary shifts={shifts} today={today} onGoToManage={onGoToManage} />
          ) : (
            <NurseSummary
              shifts={shifts}
              today={today}
              credential={credential}
              onSelectShift={setSelectedShift}
              notifications={notifications}
              onDismissNotification={handleDismissNotification}
            />
          )}
        </div>
      )}
    </main>
  )
}

function NotificationBanner({ notification, onDismiss }) {
  const isApproved = notification.type === 'claim_approved'

  return (
    <div
      className={cn(
        'relative rounded-xl border-l-4 p-4',
        isApproved ? 'border-green-500 bg-green-50' : 'border-amber-500 bg-amber-50',
      )}
    >
      <div className="flex items-start gap-2 pr-6">
        {isApproved ? (
          <CheckCircle2 className="mt-0.5 shrink-0 text-[#16A34A]" size={16} strokeWidth={2} />
        ) : (
          <AlertTriangle className="mt-0.5 shrink-0 text-[#D97706]" size={16} strokeWidth={2} />
        )}
        <p className={cn('text-sm', isApproved ? 'text-[#166534]' : 'text-[#92400E]')}>
          {notification.message}
        </p>
      </div>

      <button
        type="button"
        onClick={() => onDismiss(notification.id)}
        aria-label="Dismiss notification"
        className={cn('absolute top-3 right-3', isApproved ? 'text-[#16A34A]' : 'text-[#D97706]')}
      >
        <X size={14} strokeWidth={2} />
      </button>
    </div>
  )
}

function NurseSummary({
  shifts,
  today,
  credential,
  onSelectShift,
  notifications,
  onDismissNotification,
}) {
  const todayShifts = shifts.filter((shift) => isSameLocalDay(new Date(shift.starts_at), today))
  const upcomingShifts = shifts.filter((shift) => isWithinNextSevenDays(shift.starts_at))
  const isWorkingToday = todayShifts.length > 0

  return (
    <>
      <div className="mb-9">
        <div className="flex items-center gap-2">
          {isWorkingToday && (
            <CheckCircle2 className="shrink-0 text-[#16A34A]" size={18} strokeWidth={2.5} />
          )}
          <p
            className={cn(
              'text-[17px]',
              isWorkingToday ? 'font-medium text-ink' : 'text-[#6B7280]',
            )}
          >
            {isWorkingToday ? "You're working today" : 'You have the day off'}
          </p>
        </div>

        {isWorkingToday && (
          <div className="mt-1.5 flex flex-col gap-0.5 pl-[26px]">
            {todayShifts.map((shift) => (
              <p key={shift.id} className="text-sm text-[#6B7280]">
                {shift.unit} · {formatShiftTimeRange(shift.starts_at, shift.ends_at)}
              </p>
            ))}
          </div>
        )}
      </div>

      {notifications.length > 0 && (
        <div className="mb-9 flex flex-col gap-2">
          {notifications.map((notification) => (
            <NotificationBanner
              key={notification.id}
              notification={notification}
              onDismiss={onDismissNotification}
            />
          ))}
        </div>
      )}

      <section>
        <h2 className="mb-4 text-lg font-semibold text-ink">Upcoming shifts</h2>

        {upcomingShifts.length === 0 ? (
          <p className="text-[15px] text-[#6B7280]">No upcoming shifts</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {upcomingShifts.map((shift) => {
              const period = getShiftPeriod(shift.starts_at)
              const shiftDate = new Date(shift.starts_at)

              return (
                <li key={shift.id}>
                  <button
                    type="button"
                    onClick={() => onSelectShift(shift)}
                    className="flex w-full items-center gap-4 rounded-card bg-white p-4 text-left shadow-sm border border-[#E8E6E3] transition-shadow active:shadow-none"
                  >
                    <div className="flex w-12 shrink-0 flex-col items-center justify-center gap-0.5 text-center">
                      <span className="text-xs font-medium tracking-wide text-[#9CA3AF] uppercase">
                        {weekdayFormatter.format(shiftDate)}
                      </span>
                      <span className="text-2xl font-bold text-ink">{shiftDate.getDate()}</span>
                      <span className="text-xs font-medium tracking-wide text-[#9CA3AF] uppercase">
                        {monthFormatter.format(shiftDate)}
                      </span>
                    </div>

                    <div className="h-12 w-px shrink-0 bg-line" />

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <p className="truncate text-sm font-semibold text-ink">
                          {formatShiftTimeRange(shift.starts_at, shift.ends_at)}
                        </p>
                        <ShiftPeriodPill period={period} />
                      </div>
                      <div className="mt-1 flex items-center gap-1.5">
                        <p className="truncate text-xs text-[#9CA3AF]">{shift.unit}</p>
                        {credential && (
                          <>
                            <span className="h-3 border-l border-line" />
                            <p className="text-xs font-medium text-[#6B7280]">{credential}</p>
                          </>
                        )}
                      </div>
                    </div>
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

  const hasUnstaffed = unstaffedDates.length > 0

  return (
    <section>
      <div className="grid grid-cols-3 gap-3">
        <Card className="gap-2 rounded-card border-none bg-surface p-5 text-center shadow-none">
          <Calendar className="mx-auto text-[#9CA3AF]" size={20} strokeWidth={2} />
          <p className="text-3xl font-bold text-ink">{todayShifts.length}</p>
          <p className="text-xs tracking-wide text-[#9CA3AF] uppercase">Shifts today</p>
        </Card>

        <Card className="gap-2 rounded-card border-none bg-surface p-5 text-center shadow-none">
          <Users className="mx-auto text-[#9CA3AF]" size={20} strokeWidth={2} />
          <p className="text-3xl font-bold text-ink">{uniqueNursesToday}</p>
          <p className="text-xs tracking-wide text-[#9CA3AF] uppercase">Nurses scheduled</p>
        </Card>

        <Card
          className={cn(
            'gap-2 rounded-card border-none p-5 text-center shadow-none',
            hasUnstaffed ? 'bg-[#FEF9C3]' : 'bg-surface',
          )}
        >
          <AlertTriangle
            className={cn('mx-auto', hasUnstaffed ? 'text-[#CA8A04]' : 'text-[#9CA3AF]')}
            size={20}
            strokeWidth={2}
          />
          <p className={cn('text-3xl font-bold', hasUnstaffed ? 'text-[#92400E]' : 'text-ink')}>
            {unstaffedDates.length}
          </p>
          <p
            className={cn(
              'text-xs tracking-wide uppercase',
              hasUnstaffed ? 'text-[#A16207]' : 'text-[#9CA3AF]',
            )}
          >
            Unstaffed days
          </p>
        </Card>
      </div>

      {hasUnstaffed && (
        <div className="mt-7">
          <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-ink">
            <AlertTriangle className="text-[#D97706]" size={16} strokeWidth={2.5} />
            Coverage gaps
          </h2>
          <ul className="flex flex-col gap-3">
            {unstaffedDates.map((date) => (
              <li key={formatLocalDateKey(date)}>
                <div className="flex items-center gap-4 rounded-card bg-white p-4 shadow-sm border border-[#E8E6E3]">
                  <div className="flex w-12 shrink-0 flex-col items-center justify-center gap-0.5 text-center">
                    <span className="text-xs font-medium tracking-wide text-[#9CA3AF] uppercase">
                      {weekdayFormatter.format(date)}
                    </span>
                    <span className="text-2xl font-bold text-ink">{date.getDate()}</span>
                    <span className="text-xs font-medium tracking-wide text-[#9CA3AF] uppercase">
                      {monthFormatter.format(date)}
                    </span>
                  </div>

                  <div className="h-12 w-px shrink-0 bg-line" />

                  <p className="min-w-0 flex-1 text-sm text-[#6B7280]">No shifts scheduled</p>

                  <AlertTriangle className="shrink-0 text-[#D97706]" size={14} strokeWidth={2.5} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Button
        type="button"
        onClick={onGoToManage}
        className="mt-9 h-auto w-full rounded-full bg-ink py-4 text-base font-semibold text-white hover:bg-ink/90"
      >
        Go to Manage
      </Button>
    </section>
  )
}
