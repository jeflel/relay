import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
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
  const [scheduleInitialTab, setScheduleInitialTab] = useState('my')

  useEffect(() => {
    let active = true

    async function initAuth() {
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

  function handleBottomNavChange(tab) {
    setScheduleInitialTab('my')
    setActiveTab(tab)
  }

  function handleGoToManage() {
    setScheduleInitialTab('manage')
    setActiveTab('schedule')
  }

  if (loading) return null
  if (!session) return <Auth />

  return (
    <div className="app-shell">
      <div className="app-content">
        {activeTab === 'home' && (
          <Home user={session.user} role={role} onGoToManage={handleGoToManage} />
        )}
        {activeTab === 'schedule' && (
          <Schedule user={session.user} role={role} initialTab={scheduleInitialTab} />
        )}
        {activeTab === 'more' && <More />}
      </div>
      <BottomNav activeTab={activeTab} onTabChange={handleBottomNavChange} />
    </div>
  )
}

export default App
