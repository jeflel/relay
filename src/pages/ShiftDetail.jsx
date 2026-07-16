import { useEffect, useState } from 'react'
import { ChevronLeft, Users } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { ShiftPeriodPill } from '@/components/ui/pill'
import {
  formatShiftDate,
  formatShiftTimeRange,
  getShiftPeriod,
} from '../lib/shiftFormat'

function getInitials(fullName) {
  if (!fullName) return '?'
  const parts = fullName.trim().split(/\s+/)
  const initials = parts.length === 1 ? parts[0][0] : parts[0][0] + parts[parts.length - 1][0]
  return initials.toUpperCase()
}

export default function ShiftDetail({ shift, user, onBack }) {
  const [coworkers, setCoworkers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [credential, setCredential] = useState(null)

  const period = getShiftPeriod(shift.starts_at)

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

  useEffect(() => {
    let cancelled = false

    async function fetchCoworkers() {
      setLoading(true)
      setError(null)

      const { data, error: fetchError } = await supabase
        .from('shifts')
        .select(`
          id,
          nurse_id,
          starts_at,
          ends_at,
          profiles!nurse_id (
            full_name,
            credential
          )
        `)
        .eq('unit', shift.unit)
        .neq('nurse_id', user.id)
        .lt('starts_at', shift.ends_at)
        .gt('ends_at', shift.starts_at)

      if (cancelled) return

      console.log('raw coworkers data', data, fetchError)

      if (fetchError) {
        setError(fetchError.message)
        setCoworkers([])
        setLoading(false)
        return
      }

      const uniqueCoworkers = []
      const seenNurseIds = new Set()

      for (const row of data ?? []) {
        if (seenNurseIds.has(row.nurse_id)) continue
        seenNurseIds.add(row.nurse_id)

        // PostgREST may return the embed as an object or a single-element array
        const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles

        uniqueCoworkers.push({
          nurseId: row.nurse_id,
          full_name: profile?.full_name ?? null,
          credential: profile?.credential ?? null,
          starts_at: row.starts_at,
          ends_at: row.ends_at,
        })
      }

      setCoworkers(uniqueCoworkers)
      setLoading(false)
    }

    fetchCoworkers()

    return () => {
      cancelled = true
    }
  }, [shift, user.id])

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-white">
      <main className="mx-auto w-full max-w-md px-5 pt-8 pb-12">
        <button
          type="button"
          onClick={onBack}
          className="mb-6 inline-flex items-center gap-1 text-sm font-medium text-[#6B7280]"
        >
          <ChevronLeft size={18} strokeWidth={2} />
          Back
        </button>

        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <p className="text-2xl font-bold text-[#111111]">
              {formatShiftTimeRange(shift.starts_at, shift.ends_at)}
            </p>
            <ShiftPeriodPill period={period} />
          </div>

          <div className="mt-1 flex items-center gap-1.5">
            <p className="text-xs text-[#9CA3AF]">{shift.unit}</p>
            {credential && (
              <>
                <span className="h-3 border-l border-[#E8E6E3]" />
                <p className="text-xs text-[#9CA3AF]">{credential}</p>
              </>
            )}
          </div>

          <p className="mt-3 text-sm text-[#6B7280]">{formatShiftDate(shift.starts_at)}</p>
        </div>

        <section className="mt-9">
          <h2 className="mb-4 flex items-center gap-1.5 text-sm font-semibold text-[#111111]">
            <Users size={14} strokeWidth={2.5} />
            Working with
          </h2>

          {loading && <p className="text-sm text-[#6B7280]">Loading coworkers…</p>}

          {!loading && error && (
            <p className="text-sm text-red-700">Could not load coworkers: {error}</p>
          )}

          {!loading && !error && coworkers.length === 0 && (
            <p className="text-sm text-[#6B7280]">No coworkers on this shift</p>
          )}

          {!loading && !error && coworkers.length > 0 && (
            <ul className="flex flex-col">
              {coworkers.map((coworker) => (
                <li
                  key={coworker.nurseId}
                  className="flex items-center gap-3 border-b border-[#E8E6E3] py-3 last:border-b-0"
                >
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#F8F7F5] text-xs font-semibold text-[#6B7280]">
                    {getInitials(coworker.full_name)}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[#111111]">
                      {coworker.full_name}
                    </p>
                    {coworker.credential && (
                      <p className="text-xs text-[#9CA3AF]">{coworker.credential}</p>
                    )}
                  </div>

                  <p className="shrink-0 text-xs text-[#9CA3AF]">
                    {formatShiftTimeRange(coworker.starts_at, coworker.ends_at)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  )
}
