import { Navbar } from '@/components/layout/navbar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto py-6">{children}</main>
    </div>
  )
}
