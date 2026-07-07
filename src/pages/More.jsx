import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function More() {
  const [signingOut, setSigningOut] = useState(false)

  async function handleSignOut() {
    setSigningOut(true)
    await supabase.auth.signOut()
  }

  return (
    <main className="page more">
      <h1>More</h1>

      <div className="more-actions">
        <button
          type="button"
          className="sign-out-button"
          onClick={handleSignOut}
          disabled={signingOut}
        >
          {signingOut ? 'Signing out…' : 'Sign out'}
        </button>
      </div>
    </main>
  )
}
