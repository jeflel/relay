import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const fieldClassName =
  'h-auto border-gray-300 bg-white px-3.5 py-3 focus-visible:border-[#111] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#111] focus-visible:ring-0'

const CREDENTIAL_OPTIONS = ['RN', 'CNA', 'LVN', 'Other']
const HOME_UNIT_OPTIONS = ['Unit 1', 'Unit 2', 'Unit 3', 'Unit 4']

export default function Auth() {
  const [view, setView] = useState('signin')
  const [signupStep, setSignupStep] = useState(1)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [credential, setCredential] = useState(CREDENTIAL_OPTIONS[0])
  const [homeUnit, setHomeUnit] = useState(HOME_UNIT_OPTIONS[0])
  const [loading, setLoading] = useState(false)
  const [signedUp, setSignedUp] = useState(false)
  const [error, setError] = useState(null)
  const [showPassword, setShowPassword] = useState(false)

  function toggleView() {
    setView((current) => (current === 'signin' ? 'signup' : 'signin'))
    setSignupStep(1)
    setError(null)
  }

  function handleNextStep(event) {
    event.preventDefault()
    setError(null)
    setSignupStep(2)
  }

  async function handleSignIn(event) {
    event.preventDefault()
    setLoading(true)
    setError(null)

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    setLoading(false)

    if (signInError) {
      setError(signInError.message)
    }
  }

  async function handleSignUp(event) {
    event.preventDefault()
    setLoading(true)
    setError(null)

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          credential,
          home_unit: homeUnit,
          role: 'nurse',
        },
      },
    })

    setLoading(false)

    if (signUpError) {
      setError(signUpError.message)
      return
    }

    if (!data.session) {
      setSignedUp(true)
    }
  }

  if (signedUp) {
    return (
      <main className="mx-auto w-full max-w-md px-5 pt-6 pb-8">
        <p className="py-8 text-center text-base">Check your email to confirm your account</p>
      </main>
    )
  }

  if (view === 'signup') {
    return (
      <main className="mx-auto w-full max-w-md px-5 pt-16 pb-8">
        <p className="mb-8 text-center text-2xl font-bold text-[#4F46E5]">Relay</p>
        <h1 className="mb-2 text-2xl font-semibold">Sign up</h1>
        <p className="mb-8 text-xs text-[#9CA3AF]">{signupStep} of 2</p>

        {signupStep === 1 && (
          <form className="flex flex-col" onSubmit={handleNextStep}>
            <Label htmlFor="fullName" className="mb-2">Full name</Label>
            <Input
              id="fullName"
              type="text"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              placeholder="Your name"
              required
              autoComplete="name"
              className={`mb-6 ${fieldClassName}`}
            />

            <Label htmlFor="signupEmail" className="mb-2">Email</Label>
            <Input
              id="signupEmail"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
              className={`mb-6 ${fieldClassName}`}
            />

            <Label htmlFor="signupPassword" className="mb-2">Password</Label>
            <Input
              id="signupPassword"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Create a password"
              required
              autoComplete="new-password"
              className={`mb-6 ${fieldClassName}`}
            />

            {error && <p className="mb-3 text-sm text-red-700">{error}</p>}

            <Button
              type="submit"
              className="h-auto w-full bg-[#111] px-4 py-3 text-white hover:bg-[#111] disabled:opacity-60"
            >
              Next
            </Button>
          </form>
        )}

        {signupStep === 2 && (
          <form className="flex flex-col" onSubmit={handleSignUp}>
            <Label htmlFor="credential" className="mb-2">Credential</Label>
            <select
              id="credential"
              value={credential}
              onChange={(event) => setCredential(event.target.value)}
              className={`mb-6 ${fieldClassName}`}
            >
              {CREDENTIAL_OPTIONS.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>

            <Label htmlFor="homeUnit" className="mb-2">Home unit</Label>
            <select
              id="homeUnit"
              value={homeUnit}
              onChange={(event) => setHomeUnit(event.target.value)}
              className={`mb-6 ${fieldClassName}`}
            >
              {HOME_UNIT_OPTIONS.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>

            {error && <p className="mb-3 text-sm text-red-700">{error}</p>}

            <Button
              type="submit"
              disabled={loading}
              className="h-auto w-full bg-[#111] px-4 py-3 text-white hover:bg-[#111] disabled:opacity-60"
            >
              {loading ? 'Creating account…' : 'Create account'}
            </Button>

            <button
              type="button"
              onClick={() => setSignupStep(1)}
              className="mt-4 text-center text-sm font-medium text-[#111]"
            >
              Back
            </button>
          </form>
        )}

        <p className="mt-4 text-center text-sm text-[#6B7280]">
          Already have an account?{' '}
          <button type="button" onClick={toggleView} className="font-medium text-[#111]">
            Sign in
          </button>
        </p>
      </main>
    )
  }

  return (
    <main className="mx-auto w-full max-w-md px-5 pt-16 pb-8">
      <p className="text-center text-2xl font-bold text-[#4F46E5]">Relay</p>
      <h1 className="mt-8 text-center text-2xl font-bold tracking-tight text-ink">Your schedule, clear as day.</h1>
      <p className="mx-auto mt-2 max-w-xs text-center text-sm text-[#6B7280]">
        Sign in to view your shifts and stay connected with your team.
      </p>

      <form className="mt-8 flex flex-col" onSubmit={handleSignIn}>
        <Label htmlFor="email" className="mb-2">Email</Label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Enter email"
          required
          autoComplete="email"
          className={`mb-3 ${fieldClassName}`}
        />

        <Label htmlFor="password" className="mb-2">Password</Label>
        <div className="relative mb-6">
          <Input
            id="password"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter password"
            required
            autoComplete="current-password"
            className={`pr-11 ${fieldClassName}`}
          />
          <button
            type="button"
            onClick={() => setShowPassword((current) => !current)}
            className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-[#6B7280]"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>

        {error && <p className="mb-3 text-sm text-red-700">{error}</p>}

        <Button
          type="submit"
          disabled={loading}
          className="h-auto w-full rounded-xl bg-ink px-4 py-4 font-semibold text-white hover:bg-ink/90 disabled:opacity-60"
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>

      <p className="mt-4 text-center text-sm text-[#6B7280]">
        Don't have an account?{' '}
        <button type="button" onClick={toggleView} className="font-medium text-[#4F46E5]">
          Sign up
        </button>
      </p>
    </main>
  )
}
