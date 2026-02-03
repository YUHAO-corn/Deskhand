export default function App() {
  return (
    <div className="h-screen flex">
      {/* Navigator Panel */}
      <aside className="w-[280px] bg-secondary border-r border-border flex flex-col">
        <div className="h-[52px] flex items-center px-4 drag-region">
          <span className="text-sm font-medium text-secondary-foreground">Deskhand</span>
        </div>
        <div className="flex-1 p-3">
          <button className="w-full px-3 py-2 text-sm text-left rounded-lg hover:bg-accent">
            + New Chat
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col bg-background">
        {/* Toolbar */}
        <header className="h-[52px] flex items-center px-4 border-b border-border drag-region">
          <span className="text-sm text-muted-foreground">Welcome to Deskhand</span>
        </header>

        {/* Chat Area */}
        <div className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground">Select or create a new chat to get started</p>
        </div>

        {/* Input Area */}
        <div className="p-4 border-t border-border">
          <div className="max-w-3xl mx-auto">
            <input
              type="text"
              placeholder="Type a message..."
              className="w-full px-4 py-3 rounded-xl border border-border bg-input focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
        </div>
      </main>
    </div>
  )
}
