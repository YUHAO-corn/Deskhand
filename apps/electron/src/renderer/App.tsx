import { useEffect, useState } from 'react'
import { useAtom } from 'jotai'
import { authStateAtom, currentSessionAtom } from './atoms'
import { Onboarding } from './components/Onboarding'
import { SessionList } from './components/SessionList'

function MainApp() {
  const [currentSession, setCurrentSession] = useAtom(currentSessionAtom)
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)

  const handleSessionSelect = async (sessionId: string) => {
    setSelectedSessionId(sessionId)
    setCurrentSession((prev) => ({ ...prev, isLoading: true }))

    try {
      const result = await window.electronAPI.loadSession(sessionId)
      if (result.success && result.data) {
        setCurrentSession({
          session: result.data,
          messages: result.data.messages,
          isLoading: false,
        })
      } else {
        setCurrentSession((prev) => ({ ...prev, isLoading: false }))
      }
    } catch (error) {
      console.error('Failed to load session:', error)
      setCurrentSession((prev) => ({ ...prev, isLoading: false }))
    }
  }

  const handleSessionCreate = async () => {
    try {
      const result = await window.electronAPI.createSession()
      if (result.success && result.data) {
        setSelectedSessionId(result.data.id)
        setCurrentSession({
          session: result.data,
          messages: [],
          isLoading: false,
        })
      }
    } catch (error) {
      console.error('Failed to create session:', error)
    }
  }

  return (
    <div className="h-screen flex">
      {/* Navigator Panel */}
      <aside className="w-[280px] bg-secondary border-r border-border flex flex-col">
        <div className="h-[52px] flex items-center px-4 drag-region">
          <span className="text-sm font-medium text-secondary-foreground">Deskhand</span>
        </div>
        <SessionList
          selectedSessionId={selectedSessionId}
          onSessionSelect={handleSessionSelect}
          onSessionCreate={handleSessionCreate}
        />
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col bg-background">
        {/* Toolbar */}
        <header className="h-[52px] flex items-center px-4 border-b border-border drag-region">
          <span className="text-sm text-muted-foreground">
            {currentSession.session?.name || 'Welcome to Deskhand'}
          </span>
        </header>

        {/* Chat Area */}
        <div className="flex-1 flex items-center justify-center">
          {currentSession.isLoading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : currentSession.session ? (
            currentSession.messages.length === 0 ? (
              <p className="text-muted-foreground">Start a conversation</p>
            ) : (
              <div className="w-full h-full p-4 overflow-y-auto">
                {/* Messages will be rendered here */}
                <p className="text-muted-foreground text-center">
                  {currentSession.messages.length} messages
                </p>
              </div>
            )
          ) : (
            <p className="text-muted-foreground">Select or create a new chat to get started</p>
          )}
        </div>

        {/* Input Area */}
        <div className="p-4 border-t border-border">
          <div className="max-w-3xl mx-auto">
            <input
              type="text"
              placeholder="Type a message..."
              disabled={!currentSession.session}
              className="w-full px-4 py-3 rounded-xl border border-border bg-input focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>
        </div>
      </main>
    </div>
  )
}

export default function App() {
  const [authState, setAuthState] = useAtom(authStateAtom)

  useEffect(() => {
    // Check auth state on mount
    async function checkAuth() {
      try {
        const result = await window.electronAPI.getAuthState()
        if (result.success && result.data) {
          setAuthState({
            isConfigured: result.data.isConfigured,
            authType: result.data.authType,
            isLoading: false,
          })
        } else {
          setAuthState((prev) => ({ ...prev, isLoading: false }))
        }
      } catch (error) {
        console.error('Failed to check auth state:', error)
        setAuthState((prev) => ({ ...prev, isLoading: false }))
      }
    }

    checkAuth()
  }, [setAuthState])

  // Loading state
  if (authState.isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  // Show onboarding if not configured
  if (!authState.isConfigured) {
    return (
      <Onboarding
        onComplete={() => {
          setAuthState((prev) => ({
            ...prev,
            isConfigured: true,
            authType: 'api_key',
          }))
        }}
      />
    )
  }

  // Main app
  return <MainApp />
}
