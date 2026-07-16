import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function Auth() {
  const [mode, setMode] = useState('magic')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState(null)

  function toggleMode() {
    setMode((current) => (current === 'password' ? 'magic' : 'password'))
    setError(null)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setLoading(true)
    setError(null)

    if (mode === 'password') {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      setLoading(false)

      if (signInError) {
        setError(signInError.message)
      }
      return
    }

    const { error: signInError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin,
      },
    })

    setLoading(false)

    if (signInError) {
      setError(signInError.message)
      return
    }

    setSent(true)
  }

  if (sent) {
    return (
      <main className="mx-auto w-full max-w-md px-5 pt-6 pb-8">
        <p className="py-8 text-center text-base">Check your email for a login link</p>
      </main>
    )
  }

  return (
    <main className="mx-auto w-full max-w-md px-5 pt-6 pb-8">
      <h1 className="mb-2 text-2xl font-semibold">Sign in</h1>
      <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          required
          autoComplete="email"
          className="h-auto border-gray-300 bg-white px-3.5 py-3 focus-visible:border-[#111] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#111] focus-visible:ring-0"
        />

        {mode === 'password' && (
          <>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Your password"
              required
              autoComplete="current-password"
              className="h-auto border-gray-300 bg-white px-3.5 py-3 focus-visible:border-[#111] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#111] focus-visible:ring-0"
            />
          </>
        )}

        {error && <p className="text-sm text-red-700">{error}</p>}

        <Button
          type="submit"
          disabled={loading}
          className="mt-1 h-auto w-full bg-[#111] px-4 py-3 text-white hover:bg-[#111] disabled:opacity-60"
        >
          {loading
            ? mode === 'password'
              ? 'Signing in…'
              : 'Sending…'
            : mode === 'password'
              ? 'Sign in'
              : 'Send login link'}
        </Button>
      </form>

      <Button
        type="button"
        variant="outline"
        onClick={toggleMode}
        className="mt-3 h-auto border-gray-300 bg-white px-5 py-3 text-base font-semibold text-[#111] shadow-none hover:bg-white hover:text-[#111]"
      >
        {mode === 'password' ? 'Sign in with magic link' : 'Sign in with password'}
      </Button>
    </main>
  )
}
