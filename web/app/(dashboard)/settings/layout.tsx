'use client'

import { useTranslations } from 'next-intl'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Settings, Palette, Plug } from 'lucide-react'

const settingsNavItems = [
  {
    key: 'appearance',
    href: '/settings',
    icon: Palette,
    color: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
  },
  {
    key: 'integrations',
    href: '/settings/integrations',
    icon: Plug,
    color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
  },
] as const

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations('settings')
  const pathname = usePathname()

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* Side Panel - Settings Navigation */}
      <aside className="lg:w-64 flex-shrink-0">
        <Card className="sticky top-20">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Settings className="h-4 w-4 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">{t('title')}</CardTitle>
                <CardDescription className="text-xs">{t('subtitle')}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {settingsNavItems.map((item) => {
              const isActive =
                item.href === '/settings'
                  ? pathname === '/settings'
                  : pathname.startsWith(item.href)
              const Icon = item.icon

              return (
                <Link
                  key={item.key}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 px-2 py-2 rounded-md transition-colors',
                    isActive
                      ? 'bg-muted'
                      : 'hover:bg-muted/50'
                  )}
                >
                  <div className={cn('h-8 w-8 rounded-md flex items-center justify-center', item.color)}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      'text-sm',
                      isActive ? 'font-semibold' : 'font-medium text-muted-foreground'
                    )}>
                      {t(`nav.${item.key}`)}
                    </p>
                  </div>
                </Link>
              )
            })}
          </CardContent>
        </Card>
      </aside>

      {/* Main Content */}
      <main className="flex-1 space-y-6 min-w-0">{children}</main>
    </div>
  )
}
