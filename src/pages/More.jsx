import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function More({ isLocalDev, actualRole, roleOverride, onRoleOverrideChange }) {
  const [signingOut, setSigningOut] = useState(false)

  async function handleSignOut() {
    setSigningOut(true)
    await supabase.auth.signOut()
  }

  return (
    <main className="page more">
      <h1>More</h1>

      {isLocalDev && (
        <div className="more-dev-tools">
          <h2>Dev tools</h2>
          <p className="more-dev-hint">
            Preview the app as a different role without changing your account.
          </p>
          <div className="role-toggle" role="group" aria-label="Preview role">
            <button
              type="button"
              className={!roleOverride ? 'active' : undefined}
              onClick={() => onRoleOverrideChange(null)}
            >
              Actual{actualRole ? ` (${actualRole})` : ''}
            </button>
            <button
              type="button"
              className={roleOverride === 'nurse' ? 'active' : undefined}
              onClick={() => onRoleOverrideChange('nurse')}
            >
              Nurse
            </button>
            <button
              type="button"
              className={roleOverride === 'coordinator' ? 'active' : undefined}
              onClick={() => onRoleOverrideChange('coordinator')}
            >
              Coordinator
            </button>
          </div>
        </div>
      )}

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
