import { EnvelopeSealAnimation } from '@/components/envelope-seal-animation'

// A brief, reassuring beat shown while something is being encrypted and
// saved — not just a spinner. Parents keep this mounted for a minimum
// duration (see useSealing) even if the actual save finishes faster, so it
// never feels like a flash instead of a moment.
export function SealingOverlay({ label }: { label: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/20 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-4">
        <EnvelopeSealAnimation />
        <p className="font-serif text-lg text-ink">{label}</p>
      </div>
    </div>
  )
}
