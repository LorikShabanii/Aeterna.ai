export function SealMark({ className }: { className?: string }) {
  return (
    <span
      className={`grid place-items-center rounded-full bg-seal/85 font-serif text-[10px] font-medium tracking-wide text-paper ${className ?? ''}`}
    >
      A
    </span>
  )
}
