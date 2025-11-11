import Image from 'next/image'

export function RightfitLogo({ className = '' }: { className?: string }) {
  // Navbar logo: 64px (4rem) for premium feel - intentional and refined
  // Default to navbar size since that's primary use case
  const isHero = className.includes('hero') || className.includes('lg:text')
  const logoHeight = isHero ? '5rem' : '4rem' // 64px for navbar, 80px for hero
  
  // Logo is 942x375 (wide format, not square)
  return (
    <div 
      className="inline-block overflow-hidden"
      style={{ 
        height: logoHeight,
        display: 'flex',
        alignItems: 'center',
        lineHeight: 0
      }}
    >
      <Image
        src="/rightfit_logo.png"
        alt="Rightfit"
        width={942}
        height={375}
        className="w-auto"
        style={{
          height: logoHeight,
          width: 'auto',
          objectFit: 'contain',
          objectPosition: 'center',
        }}
        priority
      />
    </div>
  )
}

