/** The Uni hook, the same drawing as app/icon.svg without the background. */
export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="8 2 48 56" aria-hidden="true" className={className}>
      <path fill="#131c33" d="M32 54 A18 18 0 0 1 14 30 L13 21 L21.5 33 A11 11 0 0 0 32 47 Z" />
      <path fill="#e8264d" d="M32 54 A18 18 0 0 0 50 36 V17 H43 V36 A11 11 0 0 1 32 47 Z" />
      <circle cx="46.5" cy="11" r="5" fill="none" stroke="#e8264d" strokeWidth="3.5" />
    </svg>
  )
}
