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
    <main className="mx-auto w-full max-w-md px-5 pt-12 pb-12">
      <p className="text-center text-2xl font-bold text-[#4F46E5]">Relay</p>
      <div className="mt-1 flex justify-center">
        <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-[#4F46E5]">Beta</span>
      </div>
      <h1 className="mt-10 text-2xl font-semibold text-ink">More</h1>

      <Button
        type="button"
        onClick={handleSignOut}
        disabled={signingOut}
        className="mt-3 h-auto w-full rounded-full bg-ink px-4 py-3 text-white hover:bg-ink disabled:opacity-60"
      >
        {signingOut ? 'Signing out…' : 'Sign out'}
      </Button>
    </main>
  )
}
