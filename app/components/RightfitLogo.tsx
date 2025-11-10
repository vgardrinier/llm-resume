export function RightfitLogo({ className = '' }: { className?: string }) {
  return (
    <div className={`inline-block ${className}`}>
      <span
        className="font-bold tracking-tight"
        style={{
          background: 'var(--gradient-brand)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          fontWeight: 700,
          letterSpacing: '-0.02em',
        }}
      >
        Rightfit
      </span>
    </div>
  )
}

