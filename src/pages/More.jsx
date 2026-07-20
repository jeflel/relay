import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Button } from '@/components/ui/button'
import JoinWorkspaceForm from '../components/JoinWorkspaceForm'

function AccountRow({ label, value, last }) {
  return (
    <div className={`flex items-center justify-between py-3 ${last ? '' : 'border-b border-[#E8E6E3]'}`}>
      <span className="text-xs font-medium tracking-wide text-[#6B7280] uppercase">{label}</span>
      <span className="text-sm font-medium text-ink">{value}</span>
    </div>
  )
}

export default function More({ user, onWorkspaceLeft }) {
  const [signingOut, setSigningOut] = useState(false)
  const [profile, setProfile] = useState(null)
  const [workspace, setWorkspace] = useState(null)
  const [openAction, setOpenAction] = useState(null)
  const [leaveSaving, setLeaveSaving] = useState(false)
  const [leaveError, setLeaveError] = useState(null)

  useEffect(() => {
    let active = true

    async function fetchAccount() {
      const { data } = await supabase
        .from('profiles')
        .select('full_name, email, credential, home_unit, workspace_id')
        .eq('id', user.id)
        .single()

      if (!active || !data) return
      setProfile(data)

      if (data.workspace_id) {
        const { data: workspaceData } = await supabase
          .from('workspaces')
          .select('id, name')
          .eq('id', data.workspace_id)
          .single()

        if (active && workspaceData) setWorkspace(workspaceData)
      }
    }

    fetchAccount()

    return () => {
      active = false
    }
  }, [user.id])

  async function handleSignOut() {
    setSigningOut(true)
    await supabase.auth.signOut()
  }

  function toggleAction(action) {
    setOpenAction((current) => (current === action ? null : action))
    setLeaveError(null)
  }

  async function handleConfirmLeave() {
    setLeaveSaving(true)
    setLeaveError(null)

    const { error } = await supabase
      .from('profiles')
      .update({ workspace_id: null })
      .eq('id', user.id)

    setLeaveSaving(false)

    if (error) {
      setLeaveError('Something went wrong. Try again.')
      return
    }

    setWorkspace(null)
    setOpenAction(null)
    onWorkspaceLeft()
  }

  function handleJoinedAnother(newWorkspace) {
    setWorkspace(newWorkspace)
    setOpenAction(null)
  }

  return (
    <main className="mx-auto w-full max-w-md px-5 pt-12 pb-12">
      <p className="text-center text-2xl font-bold text-[#4F46E5]">Relay</p>
      <div className="mt-1 flex justify-center">
        <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-[#4F46E5]">Beta</span>
      </div>
      <h1 className="mt-10 text-2xl font-semibold text-ink">More</h1>

      {profile && (
        <div className="mt-8 rounded-xl border border-[#E8E6E3] bg-white p-4 shadow-sm">
          <p className="text-xs font-medium tracking-wide text-[#6B7280] uppercase">Account</p>
          <div className="mt-2">
            <AccountRow label="Full name" value={profile.full_name} />
            <AccountRow label="Email" value={profile.email} />
            <AccountRow label="Credential" value={profile.credential} />
            <AccountRow label="Home unit" value={profile.home_unit} last />
          </div>
        </div>
      )}

      {profile && (
        <div className="mt-4 rounded-xl border border-[#E8E6E3] bg-white p-4 shadow-sm">
          <p className="text-xs font-medium tracking-wide text-[#6B7280] uppercase">Workspace</p>

          {workspace ? (
            <>
              <p className="mt-1 text-base font-semibold text-ink">{workspace.name}</p>
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => toggleAction('leave')}
                  className="rounded-full border border-[#E8E6E3] px-4 py-1.5 text-sm font-medium text-red-600"
                >
                  Leave workspace
                </button>
                <button
                  type="button"
                  onClick={() => toggleAction('join')}
                  className="rounded-full border border-[#E8E6E3] px-4 py-1.5 text-sm font-medium text-[#111111]"
                >
                  Join another workspace
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="mt-1 text-sm text-[#6B7280]">You're not in a workspace yet</p>
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => toggleAction('join')}
                  className="rounded-full border border-[#E8E6E3] px-4 py-1.5 text-sm font-medium text-[#111111]"
                >
                  Join workspace
                </button>
              </div>
            </>
          )}

          {openAction === 'leave' && (
            <div className="mt-4 flex flex-col gap-3 border-t border-[#E8E6E3] pt-4">
              <p className="text-sm font-medium text-[#111111]">Leave this workspace?</p>
              <p className="text-sm text-[#6B7280]">You'll need a code to rejoin.</p>
              {leaveError && <p className="text-sm text-red-700">{leaveError}</p>}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleConfirmLeave}
                  disabled={leaveSaving}
                  className="rounded-full bg-red-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                >
                  {leaveSaving ? 'Leaving…' : 'Leave'}
                </button>
                <button
                  type="button"
                  onClick={() => toggleAction('leave')}
                  disabled={leaveSaving}
                  className="rounded-full border border-[#E8E6E3] px-4 py-2 text-sm font-medium text-[#111111] disabled:opacity-60"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {openAction === 'join' && (
            <div className="mt-4 border-t border-[#E8E6E3] pt-4">
              <JoinWorkspaceForm user={user} onSuccess={handleJoinedAnother} submitLabel="Join" />
            </div>
          )}
        </div>
      )}

      <Button
        type="button"
        onClick={handleSignOut}
        disabled={signingOut}
        className="mt-8 h-auto w-full rounded-full bg-ink px-4 py-3 text-white hover:bg-ink disabled:opacity-60"
      >
        {signingOut ? 'Signing out…' : 'Sign out'}
      </Button>
    </main>
  )
}
