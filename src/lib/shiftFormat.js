const userLocale = navigator.language
const userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  year: 'numeric',
})

const timeFormatOptions = {
  hour: 'numeric',
  minute: '2-digit',
  timeZone: userTimeZone,
}

export function formatLocalDateKey(date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: userTimeZone }).format(date)
}

export function formatShiftDate(startsAt) {
  return dateFormatter.format(new Date(startsAt))
}

export function formatShiftTimeRange(startsAt, endsAt) {
  const start = new Date(startsAt).toLocaleTimeString(userLocale, timeFormatOptions)
  const end = new Date(endsAt).toLocaleTimeString(userLocale, timeFormatOptions)
  return `${start} – ${end}`
}

export function getShiftPeriod(startsAt) {
  const hour = Number(
    new Intl.DateTimeFormat(userLocale, {
      hour: 'numeric',
      hour12: false,
      timeZone: userTimeZone,
    })
      .formatToParts(new Date(startsAt))
      .find((part) => part.type === 'hour').value,
  )

  if (hour < 15) return 'Day'
  if (hour < 23) return 'Evening'
  return 'Night'
}

export function isSameLocalDay(dateA, dateB) {
  return formatLocalDateKey(dateA) === formatLocalDateKey(dateB)
}

export function isWithinNextSevenDays(startsAt) {
  const shiftKey = formatLocalDateKey(new Date(startsAt))
  const todayKey = formatLocalDateKey(new Date())
  const end = new Date()
  end.setDate(end.getDate() + 7)
  const endKey = formatLocalDateKey(end)

  return shiftKey >= todayKey && shiftKey < endKey
}

const dayLabelFormatter = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  day: 'numeric',
  timeZone: userTimeZone,
})

export function formatDayLabel(date) {
  return dayLabelFormatter.format(date)
}

export function getFourWeekRange() {
  const start = new Date()
  start.setHours(0, 0, 0, 0)

  const end = new Date(start)
  end.setDate(end.getDate() + 28)

  return { start, end }
}

export function getFourWeekDays() {
  const { start } = getFourWeekRange()
  const days = []

  for (let index = 0; index < 28; index += 1) {
    const date = new Date(start)
    date.setDate(start.getDate() + index)
    days.push({
      date,
      key: formatLocalDateKey(date),
      label: formatDayLabel(date),
    })
  }

  return days
}

export function groupByDayKey(items, getStartsAt) {
  const grouped = {}

  for (const item of items) {
    const key = formatLocalDateKey(new Date(getStartsAt(item)))
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(item)
  }

  return grouped
}
