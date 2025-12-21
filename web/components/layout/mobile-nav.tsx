'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Shield } from 'lucide-react'
import { useIsAdmin } from '@/lib/hooks/use-is-admin'

export function MobileNav() {
  const router = useRouter()
  const supabase = createClient()
  const t = useTranslations('nav')
  const tUser = useTranslations('userMenu')
  const [isOpen, setIsOpen] = useState(false)
  const isAdmin = useIsAdmin()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild className="md:hidden">
        <Button variant="ghost" size="sm">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="w-6 h-6"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
            />
          </svg>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem asChild>
          <Link href="/dashboard">{t('dashboard')}</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/activities">{t('activities')}</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/reports">{t('reports')}</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/training-plans">{t('trainingPlans')}</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/schedule">{t('schedule')}</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/profile">{t('profile')}</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings">{t('settings')}</Link>
        </DropdownMenuItem>
        {isAdmin && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/admin" className="flex items-center">
                <Shield className="mr-2 h-4 w-4" />
                {tUser('admin')}
              </Link>
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout} className="text-red-600">
          {tUser('logout')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
