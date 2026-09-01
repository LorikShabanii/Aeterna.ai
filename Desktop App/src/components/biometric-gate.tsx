import { useEffect, useState } from 'react'
import {
  checkBiometricAvailability,
  hasAskedAboutBiometricLogin,
  isBiometricLoginEnabled,
  isTauriRuntime,
  markAskedAboutBiometricLogin,
  requestBiometricVerification,
  setBiometricLoginEnabled,
} from '@/lib/tauri/biometric'
import { Button } from '@/components/ui/button'

// Runs right after a password sign-in/sign-up succeeds, inside the Tauri
// shell: if this device already has biometric sign-in enabled, verifies it
// before letting the caller proceed; if it's never been asked before and
// Windows Hello is available, offers to enable it. Outside Tauri, or once
// the device has already been asked, this resolves immediately — biometric
// sign-in is opt-in and never blocks an account that has no compatible
// hardware, since that's the same local-device-only trust model the
// Heartbeat check-in already uses (see src/lib/tauri/biometric.ts).
export function BiometricGate({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = useState<'checking' | 'offer' | 'verifying' | 'error'>('checking')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void run()
  }, [])

  async function run() {
    if (!isTauriRuntime()) {
      onDone()
      return
    }

    if (isBiometricLoginEnabled()) {
      setPhase('verifying')
      const result = await requestBiometricVerification("Confirm it's you to sign in to Aeterna")
      if (result.ok) {
        onDone()
      } else {
        setError(result.reason ?? 'Could not verify. Try again.')
        setPhase('error')
      }
      return
    }

    if (hasAskedAboutBiometricLogin()) {
      onDone()
      return
    }

    const available = await checkBiometricAvailability()
    markAskedAboutBiometricLogin()
    if (available) {
      setPhase('offer')
    } else {
      onDone()
    }
  }

  async function handleEnable() {
    setPhase('verifying')
    const result = await requestBiometricVerification('Set up biometric sign-in for Aeterna')
    if (result.ok) {
      setBiometricLoginEnabled(true)
      onDone()
    } else {
      setError(result.reason ?? 'Could not verify. Try again.')
      setPhase('error')
    }
  }

  if (phase === 'checking' || phase === 'verifying') {
    return <p className="text-center text-sm text-muted-foreground">Checking Windows Hello…</p>
  }

  if (phase === 'offer') {
    return (
      <div className="space-y-3 text-center">
        <p className="text-sm text-ink">
          Enable biometric sign-in on this device? You'll still use your password too.
        </p>
        <div className="flex justify-center gap-2">
          <Button onClick={handleEnable}>Enable</Button>
          <Button variant="ghost" onClick={onDone}>
            Skip
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3 text-center">
      <p className="text-sm text-destructive">{error}</p>
      <div className="flex justify-center gap-2">
        <Button
          onClick={() => {
            setPhase('checking')
            void run()
          }}
        >
          Try again
        </Button>
        <Button variant="ghost" onClick={onDone}>
          Use password only this time
        </Button>
      </div>
    </div>
  )
}
