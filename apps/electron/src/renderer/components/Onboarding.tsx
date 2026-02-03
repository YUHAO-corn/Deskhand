import { useState } from 'react'

interface OnboardingProps {
  onComplete: () => void
}

type Step = 'select-auth' | 'enter-key'

export function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState<Step>('select-auth')
  const [apiKey, setApiKey] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [isValidating, setIsValidating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSelectApiKey = () => {
    setStep('enter-key')
  }

  const handleValidateAndSave = async () => {
    if (!apiKey.trim()) {
      setError('Please enter your API key')
      return
    }

    setIsValidating(true)
    setError(null)

    try {
      // Validate API key
      const validateResult = await window.electronAPI.validateApiKey(apiKey, baseUrl || undefined)
      if (!validateResult.success) {
        setError(validateResult.error || 'Validation failed')
        setIsValidating(false)
        return
      }

      if (!validateResult.data?.valid) {
        setError(validateResult.data?.error || 'Invalid API key')
        setIsValidating(false)
        return
      }

      // Save configuration
      const saveResult = await window.electronAPI.saveOnboardingConfig({
        authType: 'api_key',
        credential: apiKey,
        anthropicBaseUrl: baseUrl || undefined,
      })

      if (!saveResult.success) {
        setError(saveResult.error || 'Failed to save configuration')
        setIsValidating(false)
        return
      }

      onComplete()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred')
    } finally {
      setIsValidating(false)
    }
  }

  return (
    <div className="h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-md p-8">
        {/* Logo / Title */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-foreground">Welcome to Deskhand</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Your lightweight AI desktop assistant
          </p>
        </div>

        {step === 'select-auth' && (
          <div className="space-y-4">
            <p className="text-sm text-secondary-foreground text-center mb-6">
              Choose how to connect to Claude
            </p>

            {/* API Key option */}
            <button
              onClick={handleSelectApiKey}
              className="w-full p-4 rounded-xl border border-border hover:bg-accent transition-colors text-left"
            >
              <div className="font-medium text-foreground">API Key</div>
              <div className="text-sm text-muted-foreground mt-1">
                Use your Anthropic API key
              </div>
            </button>

            {/* OAuth option (disabled for MVP) */}
            <button
              disabled
              className="w-full p-4 rounded-xl border border-border opacity-50 cursor-not-allowed text-left"
            >
              <div className="font-medium text-foreground">Claude Pro / Max</div>
              <div className="text-sm text-muted-foreground mt-1">
                Sign in with your Claude subscription (coming soon)
              </div>
            </button>
          </div>
        )}

        {step === 'enter-key' && (
          <div className="space-y-4">
            <button
              onClick={() => setStep('select-auth')}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              ← Back
            </button>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Anthropic API Key
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-ant-..."
                className="w-full px-4 py-3 rounded-xl border border-border bg-input focus:outline-none focus:ring-2 focus:ring-accent text-foreground placeholder:text-muted-foreground"
                autoFocus
              />
              <p className="text-xs text-muted-foreground mt-2">
                Get your API key from{' '}
                <a
                  href="https://console.anthropic.com/settings/keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent-primary hover:underline"
                >
                  console.anthropic.com
                </a>
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                API Base URL <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://api.anthropic.com"
                className="w-full px-4 py-3 rounded-xl border border-border bg-input focus:outline-none focus:ring-2 focus:ring-accent text-foreground placeholder:text-muted-foreground"
              />
              <p className="text-xs text-muted-foreground mt-2">
                Leave empty for official API, or enter your proxy URL
              </p>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                {error}
              </div>
            )}

            <button
              onClick={handleValidateAndSave}
              disabled={isValidating || !apiKey.trim()}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-[#5EACAB] to-[#4A9190] text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isValidating ? 'Validating...' : 'Continue'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
