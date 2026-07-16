import { useState } from 'react'
import { supabase } from '../lib/supabase'

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
      <main className="page auth">
        <p className="auth-success">Check your email for a login link</p>
      </main>
    )
  }

  return (
    <main className="page auth">
      <h1>Sign in</h1>
      <form className="auth-form" onSubmit={handleSubmit}>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          required
          autoComplete="email"
        />

        {mode === 'password' && (
          <>
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Your password"
              required
              autoComplete="current-password"
            />
          </>
        )}

        {error && <p className="auth-error">{error}</p>}

        <button type="submit" disabled={loading}>
          {loading
            ? mode === 'password'
              ? 'Signing in…'
              : 'Sending…'
            : mode === 'password'
              ? 'Sign in'
              : 'Send login link'}
        </button>
      </form>

      <button type="button" className="btn-secondary" onClick={toggleMode}>
        {mode === 'password' ? 'Sign in with magic link' : 'Sign in with password'}
      </button>
    </main>
  )
}
