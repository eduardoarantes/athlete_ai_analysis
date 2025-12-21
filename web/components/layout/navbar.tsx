import { useTranslations } from 'next-intl'
import Image from 'next/image'
import Link from 'next/link'
import { UserMenu } from './user-menu'
import { MobileNav } from './mobile-nav'

export function Navbar() {
  const t = useTranslations('nav')

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 flex h-16 items-center">
        {/* Logo */}
        <Link href="/dashboard" className="mr-6 flex items-center space-x-2">
          <Image src="/logo.png" alt="Cycling AI" width={32} height={32} className="rounded-md" />
          <span className="font-bold text-xl">Cycling AI</span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex flex-1 items-center space-x-6 text-sm font-medium">
          <Link
            href="/dashboard"
            className="transition-colors hover:text-foreground/80 text-foreground/60"
          >
            {t('dashboard')}
          </Link>
          <Link
            href="/activities"
            className="transition-colors hover:text-foreground/80 text-foreground/60"
          >
            {t('activities')}
          </Link>
          <Link
            href="/reports"
            className="transition-colors hover:text-foreground/80 text-foreground/60"
          >
            {t('reports')}
          </Link>
          <Link
            href="/training-plans"
            className="transition-colors hover:text-foreground/80 text-foreground/60"
          >
            {t('training')}
          </Link>
          <Link
            href="/schedule"
            className="transition-colors hover:text-foreground/80 text-foreground/60"
          >
            {t('schedule')}
          </Link>
        </nav>

        {/* Right side actions */}
        <div className="flex flex-1 items-center justify-end space-x-4">
          <UserMenu />
          <MobileNav />
        </div>
      </div>
    </header>
  )
}
