import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function JoinWorkspaceForm({ user, onSuccess, submitLabel = 'Join' }) {
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(event) {
    event.preventDefault()
    setLoading(true)
    setError(null)

    const trimmedCode = code.trim()

    const { data: workspace, error: lookupError } = await supabase
      .from('workspaces')
      .select('id, name')
      .eq('code', trimmedCode)
      .maybeSingle()

    if (lookupError || !workspace) {
      setLoading(false)
      setError("That code didn't match a workspace")
      return
    }

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ workspace_id: workspace.id })
      .eq('id', user.id)

    setLoading(false)

    if (updateError) {
      setError("That code didn't match a workspace")
      return
    }

    onSuccess(workspace)
  }

  return (
    <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
      <Input
        type="text"
        value={code}
        onChange={(event) => setCode(event.target.value)}
        placeholder="Enter code"
        required
        autoCapitalize="characters"
        className="h-auto border-gray-300 bg-white px-3.5 py-3 text-center text-lg font-medium tracking-widest uppercase focus-visible:border-[#111] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#111] focus-visible:ring-0"
      />

      {error && <p className="text-sm text-red-700">{error}</p>}

      <Button
        type="submit"
        disabled={loading}
        className="h-auto w-full rounded-full bg-ink px-4 py-3 text-white hover:bg-ink/90 disabled:opacity-60"
      >
        {loading ? 'Joining…' : submitLabel}
      </Button>
    </form>
  )
}
