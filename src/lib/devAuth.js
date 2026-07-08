import { supabase } from './supabase'

export const isLocalDev =
  import.meta.env.DEV &&
  typeof window !== 'undefined' &&
  ['localhost', '127.0.0.1'].includes(window.location.hostname)

export async function ensureDevSession() {
  if (!isLocalDev) return null

  const email = import.meta.env.VITE_DEV_EMAIL
  const password = import.meta.env.VITE_DEV_PASSWORD

  if (!email || !password) {
    console.warn('Local dev auth bypass needs VITE_DEV_EMAIL and VITE_DEV_PASSWORD in .env')
    return null
  }

  const { data: existing } = await supabase.auth.getSession()
  if (existing.session) return existing.session

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) {
    console.error('Local dev sign-in failed:', error.message)
    return null
  }

  return data.session
}
