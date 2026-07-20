import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import Auth from './components/Auth'
import BottomNav from './components/BottomNav'
import Home from './pages/Home'
import Schedule from './pages/Schedule'
import More from './pages/More'
import JoinWorkspace from './pages/JoinWorkspace'
import Welcome from './pages/Welcome'

function App() {
  const [session, setSession] = useState(null)
  const [role, setRole] = useState(null)
  const [workspaceId, setWorkspaceId] = useState(null)
  const [fullName, setFullName] = useState(null)
  const [justJoinedWorkspace, setJustJoinedWorkspace] = useState(null)
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
      .select('role, workspace_id, full_name')
      .eq('id', userId)
      .single()

    console.log('role fetch result:', data, error)
    if (!error && data) {
      setRole(data.role)
      setWorkspaceId(data.workspace_id)
      setFullName(data.full_name)
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

  if (role === 'nurse' && workspaceId === null) {
    return (
      <JoinWorkspace
        user={session.user}
        onJoined={(workspace) => {
          setWorkspaceId(workspace.id)
          setJustJoinedWorkspace(workspace)
        }}
      />
    )
  }

  if (justJoinedWorkspace) {
    return (
      <Welcome
        fullName={fullName}
        workspaceName={justJoinedWorkspace.name}
        onContinue={() => setJustJoinedWorkspace(null)}
      />
    )
  }

  return (
    <div className="app-shell">
      <div className="app-content">
        {activeTab === 'home' && (
          <Home user={session.user} role={role} onGoToManage={handleGoToManage} />
        )}
        {activeTab === 'schedule' && (
          <Schedule user={session.user} role={role} initialTab={scheduleInitialTab} />
        )}
        {activeTab === 'more' && (
          <More user={session.user} onWorkspaceLeft={() => setWorkspaceId(null)} />
        )}
      </div>
      <BottomNav activeTab={activeTab} onTabChange={handleBottomNavChange} />
    </div>
  )
}

export default App
