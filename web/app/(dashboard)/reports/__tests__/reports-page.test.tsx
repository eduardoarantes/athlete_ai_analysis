/**
 * Reports List Page Tests
 *
 * Tests for /reports page
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import {
  mockCompletedReport,
  mockProcessingReport,
  mockFailedReport,
  createMockSupabaseClient,
  createMockTranslations,
} from './test-utils'

// Mock modules before importing component
vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(),
}))

vi.mock('next-intl', () => ({
  useTranslations: vi.fn(),
}))

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    className,
  }: {
    children: React.ReactNode
    href: string
    className?: string
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}))

// Import after mocks
import ReportsPage from '../page'
import { createClient } from '@/lib/supabase/client'
import { useTranslations } from 'next-intl'

describe('ReportsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useTranslations).mockReturnValue(
      createMockTranslations() as unknown as ReturnType<typeof useTranslations>
    )
  })

  it('shows loading state initially', () => {
    const mockSupabase = createMockSupabaseClient({ reports: [] })
    // Make the promise never resolve to keep loading state
    mockSupabase.from = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue(new Promise(() => {})),
      }),
    })
    vi.mocked(createClient).mockReturnValue(mockSupabase as never)

    const { container } = render(<ReportsPage />)

    // Should show loading spinner (Loader2 component with animate-spin class)
    const spinner = container.querySelector('.animate-spin')
    expect(spinner).toBeTruthy()
  })

  it('renders empty state when no reports exist', async () => {
    const mockSupabase = createMockSupabaseClient({ reports: [] })
    vi.mocked(createClient).mockReturnValue(mockSupabase as never)

    render(<ReportsPage />)

    await waitFor(() => {
      expect(screen.getByText('noReportsTitle')).toBeInTheDocument()
      expect(screen.getByText('noReportsDescription')).toBeInTheDocument()
    })
  })

  it('renders reports list with completed report', async () => {
    const mockSupabase = createMockSupabaseClient({ reports: [mockCompletedReport] })
    vi.mocked(createClient).mockReturnValue(mockSupabase as never)

    render(<ReportsPage />)

    await waitFor(() => {
      // Check status badge
      expect(screen.getByText('status.completed')).toBeInTheDocument()
      // Check summary is shown
      expect(
        screen.getByText(mockCompletedReport.report_data.performance_analysis.ai_insights.summary)
      ).toBeInTheDocument()
      // Check activities count
      expect(screen.getByText('activitiesCount')).toBeInTheDocument()
    })
  })

  it('renders processing report with correct status badge', async () => {
    const mockSupabase = createMockSupabaseClient({ reports: [mockProcessingReport] })
    vi.mocked(createClient).mockReturnValue(mockSupabase as never)

    render(<ReportsPage />)

    await waitFor(() => {
      expect(screen.getByText('status.processing')).toBeInTheDocument()
    })
  })

  it('renders failed report with error message', async () => {
    const mockSupabase = createMockSupabaseClient({ reports: [mockFailedReport] })
    vi.mocked(createClient).mockReturnValue(mockSupabase as never)

    render(<ReportsPage />)

    await waitFor(() => {
      expect(screen.getByText('status.failed')).toBeInTheDocument()
      expect(screen.getByText(mockFailedReport.error_message!)).toBeInTheDocument()
    })
  })

  it('renders multiple reports correctly', async () => {
    const mockSupabase = createMockSupabaseClient({
      reports: [mockCompletedReport, mockProcessingReport, mockFailedReport],
    })
    vi.mocked(createClient).mockReturnValue(mockSupabase as never)

    render(<ReportsPage />)

    await waitFor(() => {
      expect(screen.getByText('status.completed')).toBeInTheDocument()
      expect(screen.getByText('status.processing')).toBeInTheDocument()
      expect(screen.getByText('status.failed')).toBeInTheDocument()
    })
  })

  it('completed reports link to detail page', async () => {
    const mockSupabase = createMockSupabaseClient({ reports: [mockCompletedReport] })
    vi.mocked(createClient).mockReturnValue(mockSupabase as never)

    render(<ReportsPage />)

    await waitFor(() => {
      const link = screen.getByRole('link', { name: /reportType.performance/i })
      expect(link).toHaveAttribute('href', `/reports/${mockCompletedReport.id}`)
    })
  })

  it('non-completed reports have disabled links', async () => {
    const mockSupabase = createMockSupabaseClient({ reports: [mockProcessingReport] })
    vi.mocked(createClient).mockReturnValue(mockSupabase as never)

    const { container } = render(<ReportsPage />)

    await waitFor(() => {
      // Find links - non-completed should have pointer-events-none class
      const disabledLink = container.querySelector('a.pointer-events-none')
      expect(disabledLink).toBeTruthy()
      expect(disabledLink).toHaveAttribute('href', '#')
    })
  })

  it('displays page title and subtitle', async () => {
    const mockSupabase = createMockSupabaseClient({ reports: [] })
    vi.mocked(createClient).mockReturnValue(mockSupabase as never)

    render(<ReportsPage />)

    await waitFor(() => {
      expect(screen.getByText('title')).toBeInTheDocument()
      expect(screen.getByText('subtitle')).toBeInTheDocument()
    })
  })

  it('displays report creation date', async () => {
    const mockSupabase = createMockSupabaseClient({ reports: [mockCompletedReport] })
    vi.mocked(createClient).mockReturnValue(mockSupabase as never)

    render(<ReportsPage />)

    await waitFor(() => {
      // The translation key should be called with the date
      expect(screen.getByText(/created/i)).toBeInTheDocument()
    })
  })

  it('displays period date range', async () => {
    const mockSupabase = createMockSupabaseClient({ reports: [mockCompletedReport] })
    vi.mocked(createClient).mockReturnValue(mockSupabase as never)

    render(<ReportsPage />)

    await waitFor(() => {
      // Period dates should be displayed
      const periodStart = new Date(mockCompletedReport.period_start).toLocaleDateString()
      const periodEnd = new Date(mockCompletedReport.period_end).toLocaleDateString()
      expect(screen.getByText(new RegExp(`${periodStart}.*${periodEnd}`))).toBeInTheDocument()
    })
  })

  it('handles different report types', async () => {
    const trainingPlanReport = {
      ...mockCompletedReport,
      id: '423e4567-e89b-12d3-a456-426614174003',
      report_type: 'training_plan',
    }
    const mockSupabase = createMockSupabaseClient({ reports: [trainingPlanReport] })
    vi.mocked(createClient).mockReturnValue(mockSupabase as never)

    const { container } = render(<ReportsPage />)

    await waitFor(() => {
      // The translation function returns the key, so look for it in the page
      // The getReportTypeLabel function calls t('reportType.training_plan')
      const cardTitle = container.querySelector('.text-lg')
      expect(cardTitle?.textContent).toContain('reportType.training_plan')
    })
  })
})
