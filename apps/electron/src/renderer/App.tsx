import { useEffect, useState, useCallback } from 'react'
import { useAtom } from 'jotai'
import { authStateAtom, currentSessionAtom } from './atoms'
import { Onboarding } from './components/Onboarding'
import { SessionList } from './components/SessionList'
import { MessageList } from './components/MessageList'
import { ChatInput } from './components/ChatInput'
import type { SessionEvent } from '../shared/types'
import type { Message } from '@deskhand/shared/sessions'

function MainApp() {
  const [currentSession, setCurrentSession] = useAtom(currentSessionAtom)
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)

  // Handle session events from main process
  useEffect(() => {
    const unsubscribe = window.electronAPI.onSessionEvent((event: SessionEvent) => {
      // Only handle events for the current session
      if (event.sessionId !== selectedSessionId) return

      switch (event.type) {
        case 'user_message':
          // Add user message to list
          setCurrentSession((prev) => ({
            ...prev,
            messages: [...prev.messages, event.message],
            isProcessing: event.status === 'processing',
          }))
          break

        case 'text_delta':
          // Update streaming text
          setCurrentSession((prev) => ({
            ...prev,
            streamingText: prev.streamingText + event.delta,
          }))
          break

        case 'text_complete': {
          // Finalize assistant message
          const assistantMessage: Message = {
            id: `msg-${Date.now()}`,
            role: 'assistant',
            content: event.text,
            timestamp: Date.now(),
          }
          setCurrentSession((prev) => ({
            ...prev,
            messages: [...prev.messages, assistantMessage],
            streamingText: '',
          }))
          break
        }

        case 'error': {
          // Show error message
          const errorMessage: Message = {
            id: `err-${Date.now()}`,
            role: 'error',
            content: event.error,
            timestamp: Date.now(),
          }
          setCurrentSession((prev) => ({
            ...prev,
            messages: [...prev.messages, errorMessage],
            streamingText: '',
          }))
          break
        }

        case 'complete':
          // Processing complete
          setCurrentSession((prev) => ({
            ...prev,
            isProcessing: false,
            streamingText: '',
          }))
          break

        case 'interrupted':
          setCurrentSession((prev) => ({
            ...prev,
            isProcessing: false,
            streamingText: '',
          }))
          break
      }
    })

    return () => unsubscribe()
  }, [selectedSessionId, setCurrentSession])

  const handleSessionSelect = useCallback(
    async (sessionId: string) => {
      setSelectedSessionId(sessionId)
      setCurrentSession((prev) => ({ ...prev, isLoading: true }))

      try {
        const result = await window.electronAPI.loadSession(sessionId)
        if (result.success && result.data) {
          setCurrentSession({
            session: result.data,
            messages: result.data.messages,
            isLoading: false,
            isProcessing: false,
            streamingText: '',
          })
        } else {
          setCurrentSession((prev) => ({ ...prev, isLoading: false }))
        }
      } catch (error) {
        console.error('Failed to load session:', error)
        setCurrentSession((prev) => ({ ...prev, isLoading: false }))
      }
    },
    [setCurrentSession]
  )

  const handleSessionCreate = useCallback(async () => {
    try {
      const result = await window.electronAPI.createSession()
      if (result.success && result.data) {
        setSelectedSessionId(result.data.id)
        setCurrentSession({
          session: result.data,
          messages: [],
          isLoading: false,
          isProcessing: false,
          streamingText: '',
        })
      }
    } catch (error) {
      console.error('Failed to create session:', error)
    }
  }, [setCurrentSession])

  const handleSendMessage = useCallback(
    async (message: string) => {
      if (!currentSession.session) return

      setCurrentSession((prev) => ({ ...prev, isProcessing: true }))

      try {
        await window.electronAPI.sendMessage(currentSession.session.id, message)
      } catch (error) {
        console.error('Failed to send message:', error)
        setCurrentSession((prev) => ({ ...prev, isProcessing: false }))
      }
    },
    [currentSession.session, setCurrentSession]
  )

  const handleCancelProcessing = useCallback(async () => {
    if (!currentSession.session) return

    try {
      await window.electronAPI.cancelProcessing(currentSession.session.id)
    } catch (error) {
      console.error('Failed to cancel processing:', error)
    }
  }, [currentSession.session])

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
        {currentSession.isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-muted-foreground">Loading...</p>
          </div>
        ) : currentSession.session ? (
          <>
            <MessageList
              messages={currentSession.messages}
              streamingText={currentSession.streamingText}
              isProcessing={currentSession.isProcessing}
            />
            <ChatInput
              onSend={handleSendMessage}
              onCancel={handleCancelProcessing}
              disabled={!currentSession.session}
              isProcessing={currentSession.isProcessing}
            />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-muted-foreground">Select or create a new chat to get started</p>
          </div>
        )}
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
