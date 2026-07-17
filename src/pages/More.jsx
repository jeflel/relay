import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Button } from '@/components/ui/button'

export default function More() {
  const [signingOut, setSigningOut] = useState(false)

  async function handleSignOut() {
    setSigningOut(true)
    await supabase.auth.signOut()
  }

  return (
    <main className="mx-auto w-full max-w-md px-5 pt-10 pb-12">
      <p className="text-center text-2xl font-bold text-[#4F46E5]">Relay</p>
      <p className="mb-8 text-center text-xs text-muted">Beta</p>
      <h1 className="mb-8 text-2xl font-semibold text-ink">More</h1>

      <Button
        type="button"
        onClick={handleSignOut}
        disabled={signingOut}
        className="h-auto w-full rounded-full bg-ink px-4 py-3 text-white hover:bg-ink disabled:opacity-60"
      >
        {signingOut ? 'Signing out…' : 'Sign out'}
      </Button>
    </main>
  )
}
