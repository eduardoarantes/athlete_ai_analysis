/**
 * Report Detail Page Tests
 *
 * Tests for /reports/[id] page
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import {
  mockDetailedReport,
  mockProcessingReport,
  createMockSupabaseClient,
  createMockTranslations,
  createMockRouter,
} from './test-utils'

// Mock modules before importing component
vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(),
}))

vi.mock('next-intl', () => ({
  useTranslations: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useParams: vi.fn(),
  useRouter: vi.fn(),
}))

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

// Import after mocks
import ReportDetailPage from '../[id]/page'
import { createClient } from '@/lib/supabase/client'
import { useTranslations } from 'next-intl'
import { useParams, useRouter } from 'next/navigation'

describe('ReportDetailPage', () => {
  const mockRouter = createMockRouter()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useTranslations).mockReturnValue(
      createMockTranslations() as unknown as ReturnType<typeof useTranslations>
    )
    vi.mocked(useRouter).mockReturnValue(mockRouter as ReturnType<typeof useRouter>)
    vi.mocked(useParams).mockReturnValue({ id: mockDetailedReport.id })
  })

  it('shows loading state initially', () => {
    const mockSupabase = createMockSupabaseClient({})
    // Make the promise never resolve to keep loading state
    mockSupabase.from = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockReturnValue(new Promise(() => {})),
        }),
      }),
    })
    vi.mocked(createClient).mockReturnValue(mockSupabase as never)

    render(<ReportDetailPage />)

    expect(document.querySelector('.animate-spin')).toBeTruthy()
  })

  it('shows not found state for invalid UUID', async () => {
    vi.mocked(useParams).mockReturnValue({ id: 'invalid-id' })
    const mockSupabase = createMockSupabaseClient({})
    vi.mocked(createClient).mockReturnValue(mockSupabase as never)

    render(<ReportDetailPage />)

    await waitFor(() => {
      expect(screen.getByText('Report not found')).toBeInTheDocument()
      expect(screen.getByText('backToReports')).toBeInTheDocument()
    })
  })

  it('shows not found state when report does not exist', async () => {
    const mockSupabase = createMockSupabaseClient({ singleReport: null })
    vi.mocked(createClient).mockReturnValue(mockSupabase as never)

    render(<ReportDetailPage />)

    await waitFor(() => {
      expect(screen.getByText('Report not found')).toBeInTheDocument()
    })
  })

  it('redirects to /reports for non-completed reports', async () => {
    const mockSupabase = createMockSupabaseClient({ singleReport: mockProcessingReport })
    vi.mocked(createClient).mockReturnValue(mockSupabase as never)

    render(<ReportDetailPage />)

    await waitFor(() => {
      expect(mockRouter.push).toHaveBeenCalledWith('/reports')
    })
  })

  it('renders report title and completed badge', async () => {
    const mockSupabase = createMockSupabaseClient({ singleReport: mockDetailedReport })
    vi.mocked(createClient).mockReturnValue(mockSupabase as never)

    render(<ReportDetailPage />)

    await waitFor(() => {
      expect(screen.getByText('title')).toBeInTheDocument()
      expect(screen.getByText('completed')).toBeInTheDocument()
    })
  })

  it('renders back to reports link', async () => {
    const mockSupabase = createMockSupabaseClient({ singleReport: mockDetailedReport })
    vi.mocked(createClient).mockReturnValue(mockSupabase as never)

    render(<ReportDetailPage />)

    await waitFor(() => {
      const backLink = screen.getByRole('link', { name: /backToReports/i })
      expect(backLink).toHaveAttribute('href', '/reports')
    })
  })

  it('renders AI summary section', async () => {
    const mockSupabase = createMockSupabaseClient({ singleReport: mockDetailedReport })
    vi.mocked(createClient).mockReturnValue(mockSupabase as never)

    render(<ReportDetailPage />)

    await waitFor(() => {
      expect(screen.getByText('aiSummary')).toBeInTheDocument()
      expect(
        screen.getByText(mockDetailedReport.report_data.performance_analysis.ai_insights.summary)
      ).toBeInTheDocument()
    })
  })

  it('renders training focus badge', async () => {
    const mockSupabase = createMockSupabaseClient({ singleReport: mockDetailedReport })
    vi.mocked(createClient).mockReturnValue(mockSupabase as never)

    render(<ReportDetailPage />)

    await waitFor(() => {
      // trainingFocus label and badge with the actual focus value
      expect(screen.getByText(/trainingFocus/i)).toBeInTheDocument()
      expect(
        screen.getByText(
          mockDetailedReport.report_data.performance_analysis.ai_insights.training_focus!
        )
      ).toBeInTheDocument()
    })
  })

  it('renders athlete profile metrics', async () => {
    const mockSupabase = createMockSupabaseClient({ singleReport: mockDetailedReport })
    vi.mocked(createClient).mockReturnValue(mockSupabase as never)

    render(<ReportDetailPage />)

    const profile = mockDetailedReport.report_data.performance_analysis.athlete_profile

    await waitFor(() => {
      expect(screen.getByText('athleteProfile')).toBeInTheDocument()
      expect(screen.getByText(`${profile.ftp}W`)).toBeInTheDocument()
      expect(screen.getByText(`${profile.weight_kg}kg`)).toBeInTheDocument()
      expect(screen.getByText(profile.power_to_weight.toFixed(2))).toBeInTheDocument()
      expect(screen.getByText(String(profile.max_hr))).toBeInTheDocument()
      expect(screen.getByText(String(profile.age))).toBeInTheDocument()
    })
  })

  it('renders period comparison cards', async () => {
    const mockSupabase = createMockSupabaseClient({ singleReport: mockDetailedReport })
    vi.mocked(createClient).mockReturnValue(mockSupabase as never)

    render(<ReportDetailPage />)

    const recentPeriod = mockDetailedReport.report_data.performance_analysis.recent_period
    const previousPeriod = mockDetailedReport.report_data.performance_analysis.previous_period

    await waitFor(() => {
      // Recent period
      expect(screen.getByText(recentPeriod.period)).toBeInTheDocument()
      // Previous period
      expect(screen.getByText(previousPeriod.period)).toBeInTheDocument()
    })
  })

  it('renders performance trends', async () => {
    const mockSupabase = createMockSupabaseClient({ singleReport: mockDetailedReport })
    vi.mocked(createClient).mockReturnValue(mockSupabase as never)

    render(<ReportDetailPage />)

    await waitFor(() => {
      expect(screen.getByText('performanceTrends')).toBeInTheDocument()
      expect(screen.getByText('trendsDescription')).toBeInTheDocument()
    })
  })

  it('renders positive trends with green color and up arrow', async () => {
    const mockSupabase = createMockSupabaseClient({ singleReport: mockDetailedReport })
    vi.mocked(createClient).mockReturnValue(mockSupabase as never)

    const { container } = render(<ReportDetailPage />)

    await waitFor(() => {
      // Distance change is +33.3% - look for the green trend span
      const greenTrends = container.querySelectorAll('.text-green-600')
      expect(greenTrends.length).toBeGreaterThan(0)
      // Check that at least one contains the positive percentage
      const hasPositiveTrend = Array.from(greenTrends).some((el) =>
        el.textContent?.includes('+33.3%')
      )
      expect(hasPositiveTrend).toBe(true)
    })
  })

  it('renders negative trends with red color and down arrow', async () => {
    const mockSupabase = createMockSupabaseClient({ singleReport: mockDetailedReport })
    vi.mocked(createClient).mockReturnValue(mockSupabase as never)

    const { container } = render(<ReportDetailPage />)

    await waitFor(() => {
      // HR change is -4.1% - look for the red trend span
      const redTrends = container.querySelectorAll('.text-red-600')
      expect(redTrends.length).toBeGreaterThan(0)
      // Check that at least one contains the negative percentage
      const hasNegativeTrend = Array.from(redTrends).some((el) => el.textContent?.includes('-4.1%'))
      expect(hasNegativeTrend).toBe(true)
    })
  })

  it('renders key findings', async () => {
    const mockSupabase = createMockSupabaseClient({ singleReport: mockDetailedReport })
    vi.mocked(createClient).mockReturnValue(mockSupabase as never)

    render(<ReportDetailPage />)

    const keyFindings = mockDetailedReport.report_data.performance_analysis.ai_insights.key_findings

    await waitFor(() => {
      expect(screen.getByText('keyFindings')).toBeInTheDocument()
      keyFindings.forEach((finding) => {
        expect(screen.getByText(finding)).toBeInTheDocument()
      })
    })
  })

  it('renders strengths', async () => {
    const mockSupabase = createMockSupabaseClient({ singleReport: mockDetailedReport })
    vi.mocked(createClient).mockReturnValue(mockSupabase as never)

    render(<ReportDetailPage />)

    const strengths = mockDetailedReport.report_data.performance_analysis.ai_insights.strengths

    await waitFor(() => {
      expect(screen.getByText('strengths')).toBeInTheDocument()
      strengths.forEach((strength) => {
        expect(screen.getByText(strength)).toBeInTheDocument()
      })
    })
  })

  it('renders areas for improvement', async () => {
    const mockSupabase = createMockSupabaseClient({ singleReport: mockDetailedReport })
    vi.mocked(createClient).mockReturnValue(mockSupabase as never)

    render(<ReportDetailPage />)

    const areas =
      mockDetailedReport.report_data.performance_analysis.ai_insights.areas_for_improvement

    await waitFor(() => {
      expect(screen.getByText('areasForImprovement')).toBeInTheDocument()
      areas.forEach((area) => {
        expect(screen.getByText(area)).toBeInTheDocument()
      })
    })
  })

  it('renders recommendations', async () => {
    const mockSupabase = createMockSupabaseClient({ singleReport: mockDetailedReport })
    vi.mocked(createClient).mockReturnValue(mockSupabase as never)

    render(<ReportDetailPage />)

    const recommendations =
      mockDetailedReport.report_data.performance_analysis.ai_insights.recommendations

    await waitFor(() => {
      expect(screen.getByText('recommendations')).toBeInTheDocument()
      expect(screen.getByText('shortTermActions')).toBeInTheDocument()
      expect(screen.getByText('longTermGoals')).toBeInTheDocument()

      recommendations.short_term.forEach((rec) => {
        expect(screen.getByText(rec)).toBeInTheDocument()
      })
      recommendations.long_term.forEach((rec) => {
        expect(screen.getByText(rec)).toBeInTheDocument()
      })
    })
  })

  it('renders AI metadata footer', async () => {
    const mockSupabase = createMockSupabaseClient({ singleReport: mockDetailedReport })
    vi.mocked(createClient).mockReturnValue(mockSupabase as never)

    render(<ReportDetailPage />)

    await waitFor(() => {
      // Check that the AI metadata is displayed
      expect(screen.getByText(/generatedOn/i)).toBeInTheDocument()
      expect(screen.getByText(/aiMetadata/i)).toBeInTheDocument()
    })
  })

  it('displays activities analyzed count', async () => {
    const mockSupabase = createMockSupabaseClient({ singleReport: mockDetailedReport })
    vi.mocked(createClient).mockReturnValue(mockSupabase as never)

    render(<ReportDetailPage />)

    await waitFor(() => {
      expect(screen.getByText(/activitiesAnalyzed/i)).toBeInTheDocument()
    })
  })

  it('displays period date range in subtitle', async () => {
    const mockSupabase = createMockSupabaseClient({ singleReport: mockDetailedReport })
    vi.mocked(createClient).mockReturnValue(mockSupabase as never)

    render(<ReportDetailPage />)

    await waitFor(() => {
      const periodStart = new Date(mockDetailedReport.period_start).toLocaleDateString()
      const periodEnd = new Date(mockDetailedReport.period_end).toLocaleDateString()
      expect(screen.getByText(new RegExp(`${periodStart}.*${periodEnd}`))).toBeInTheDocument()
    })
  })

  it('handles report without optional fields gracefully', async () => {
    const minimalReport = {
      ...mockDetailedReport,
      report_data: {
        performance_analysis: {
          ai_insights: {
            summary: 'Basic summary',
          },
        },
      },
    }
    const mockSupabase = createMockSupabaseClient({ singleReport: minimalReport })
    vi.mocked(createClient).mockReturnValue(mockSupabase as never)

    render(<ReportDetailPage />)

    await waitFor(() => {
      expect(screen.getByText('Basic summary')).toBeInTheDocument()
      // Should not throw errors for missing optional fields
    })
  })
})
