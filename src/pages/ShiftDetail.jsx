import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { ShiftPeriodPill } from '@/components/ui/pill'
import {
  formatShiftDate,
  formatShiftTimeRange,
  getShiftPeriod,
} from '../lib/shiftFormat'

export default function ShiftDetail({ shift, user, onBack }) {
  const [coworkers, setCoworkers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const period = getShiftPeriod(shift.starts_at)

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
          profiles (
            full_name,
            credential
          )
        `)
        .eq('unit', shift.unit)
        .neq('nurse_id', user.id)
        .lt('starts_at', shift.ends_at)
        .gt('ends_at', shift.starts_at)

      if (cancelled) return

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
        uniqueCoworkers.push({
          nurseId: row.nurse_id,
          full_name: row.profiles?.full_name,
          credential: row.profiles?.credential,
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
    <div className="shift-detail">
      <main className="page shift-detail-page">
        <button type="button" className="back-button" onClick={onBack}>
          ← Back
        </button>

        <div className="shift-detail-header">
          <div className="shift-card-header">
            <p className="shift-unit">{shift.unit}</p>
            <ShiftPeriodPill period={period} />
          </div>
          <p className="shift-date">{formatShiftDate(shift.starts_at)}</p>
          <p className="shift-time">
            {formatShiftTimeRange(shift.starts_at, shift.ends_at)}
          </p>
        </div>

        <section className="coworkers-section">
          <h2>Working with</h2>

          {loading && <p className="page-status">Loading coworkers…</p>}

          {!loading && error && (
            <p className="page-error">Could not load coworkers: {error}</p>
          )}

          {!loading && !error && coworkers.length === 0 && (
            <p className="page-status">No coworkers scheduled for this shift</p>
          )}

          {!loading && !error && coworkers.length > 0 && (
            <ul className="coworker-list">
              {coworkers.map((coworker) => (
                <li key={coworker.nurseId} className="coworker-card">
                  <p className="coworker-name">{coworker.full_name}</p>
                  {coworker.credential && (
                    <p className="coworker-credential">{coworker.credential}</p>
                  )}
                  <p className="coworker-time">
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
