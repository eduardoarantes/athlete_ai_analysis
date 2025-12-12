import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-center font-mono text-sm">
        <h1 className="text-4xl font-bold text-center mb-4">Cycling AI Analysis</h1>
        <p className="text-center text-gray-600 dark:text-gray-400 mb-8">
          AI-powered cycling performance analysis
        </p>
        <div className="flex gap-4 justify-center">
          <Link href="/login">
            <Button>Get Started</Button>
          </Link>
        </div>
      </div>
    </main>
  )
}
