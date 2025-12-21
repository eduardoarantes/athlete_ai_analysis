'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

/**
 * Hook to check if the current user has admin role.
 *
 * Uses Supabase RPC to call is_admin() function.
 * Caches the result for the lifetime of the component.
 *
 * @returns boolean indicating if user is admin
 *
 * @example
 * ```tsx
 * function AdminPanel() {
 *   const isAdmin = useIsAdmin()
 *
 *   if (!isAdmin) return null
 *
 *   return <div>Admin content</div>
 * }
 * ```
 */
export function useIsAdmin(): boolean {
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    const checkAdmin = async () => {
      const supabase = createClient()
      const { data: adminStatus } = await supabase.rpc('is_admin')
      setIsAdmin(adminStatus === true)
    }
    checkAdmin()
  }, [])

  return isAdmin
}
