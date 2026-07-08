import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { ensureDevSession, isLocalDev } from './lib/devAuth'
import Auth from './components/Auth'
import BottomNav from './components/BottomNav'
import Home from './pages/Home'
import Schedule from './pages/Schedule'
import More from './pages/More'

function App() {
  const [session, setSession] = useState(null)
  const [role, setRole] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('home')

  useEffect(() => {
    let active = true

    async function initAuth() {
      if (isLocalDev) {
        const devSession = await ensureDevSession()
        if (!active) return

        if (devSession) {
          setSession(devSession)
          fetchRole(devSession.user.id)
          return
        }
      }

      const { data: { session: currentSession } } = await supabase.auth.getSession()
      if (!active) return

      setSession(currentSession)
      if (currentSession) {
        fetchRole(currentSession.user.id)
      } else {
        setLoading(false)
      }
    }

    initAuth()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession)
      if (currentSession) {
        fetchRole(currentSession.user.id)
      }
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  async function fetchRole(userId) {
    const { data, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single()

    console.log('role fetch result:', data, error)
    if (!error && data) {
      setRole(data.role)
    }
    setLoading(false)
  }

  if (loading) return null
  if (!session && !isLocalDev) return <Auth />
  if (!session) {
    return (
      <main className="page auth">
        <h1>Local dev sign-in</h1>
        <p className="auth-error">
          Add <code>VITE_DEV_EMAIL</code> and <code>VITE_DEV_PASSWORD</code> to your <code>.env</code>{' '}
          file, then restart the dev server.
        </p>
      </main>
    )
  }

  return (
    <div className="app-shell">
      <div className="app-content">
        {activeTab === 'home' && <Home user={session.user} role={role} />}
        {activeTab === 'schedule' && <Schedule user={session.user} role={role} />}
        {activeTab === 'more' && <More />}
      </div>
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  )
}

export default App
