import Link from 'next/link'
import type { User } from '@supabase/supabase-js'
import { Shield } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

interface AdminHeaderProps {
  user: User
}

export function AdminHeader({ user }: AdminHeaderProps) {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-16 items-center px-6">
        <Link href="/admin" className="flex items-center gap-2">
          <Shield className="h-6 w-6 text-primary" />
          <span className="font-bold text-xl">Admin Panel</span>
        </Link>

        <div className="ml-4">
          <Badge
            variant="secondary"
            className="bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400"
          >
            Admin Mode
          </Badge>
        </div>

        <div className="ml-auto flex items-center gap-4">
          <span className="text-sm text-muted-foreground">{user.email}</span>
        </div>
      </div>
    </header>
  )
}
