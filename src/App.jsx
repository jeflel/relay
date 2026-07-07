import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import Auth from './components/Auth'
import BottomNav from './components/BottomNav'
import Home from './pages/Home'
import Schedule from './pages/Schedule'
import More from './pages/More'

function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('home')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
    return null
  }

  if (!session) {
    return <Auth />
  }

  return (
    <div className="app-shell">
      <div className="app-content">
        {activeTab === 'home' && <Home user={session.user} />}
        {activeTab === 'schedule' && <Schedule />}
        {activeTab === 'more' && <More />}
      </div>
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  )
}

export default App
