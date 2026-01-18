/**
 * Service Metrics Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { serviceMetrics, trackServiceMetrics } from '../service-metrics'

describe('ServiceMetrics', () => {
  beforeEach(() => {
    serviceMetrics.clear()
  })

  describe('recordQueryTime', () => {
    it('should record successful query metrics', () => {
      serviceMetrics.recordQueryTime('test_operation', 150, { userId: 'user-123' })

      const summary = serviceMetrics.getSummary('test_operation')
      expect(summary).not.toBeNull()
      expect(summary?.totalCalls).toBe(1)
      expect(summary?.successCount).toBe(1)
      expect(summary?.errorCount).toBe(0)
      expect(summary?.avgDuration).toBe(150)
    })

    it('should track multiple operations', () => {
      serviceMetrics.recordQueryTime('test_operation', 100)
      serviceMetrics.recordQueryTime('test_operation', 200)
      serviceMetrics.recordQueryTime('test_operation', 300)

      const summary = serviceMetrics.getSummary('test_operation')
      expect(summary?.totalCalls).toBe(3)
      expect(summary?.successCount).toBe(3)
      expect(summary?.avgDuration).toBe(200)
      expect(summary?.maxDuration).toBe(300)
      expect(summary?.minDuration).toBe(100)
    })
  })

  describe('recordQueryError', () => {
    it('should record error metrics', () => {
      const error = new Error('Database connection failed')
      serviceMetrics.recordQueryError('test_operation', error, { userId: 'user-123' })

      const summary = serviceMetrics.getSummary('test_operation')
      expect(summary).not.toBeNull()
      expect(summary?.totalCalls).toBe(1)
      expect(summary?.successCount).toBe(0)
      expect(summary?.errorCount).toBe(1)
    })

    it('should track both success and error metrics', () => {
      serviceMetrics.recordQueryTime('test_operation', 150)
      serviceMetrics.recordQueryTime('test_operation', 200)
      serviceMetrics.recordQueryError('test_operation', new Error('Failed'))

      const summary = serviceMetrics.getSummary('test_operation')
      expect(summary?.totalCalls).toBe(3)
      expect(summary?.successCount).toBe(2)
      expect(summary?.errorCount).toBe(1)
    })
  })

  describe('getSummary', () => {
    it('should return null for non-existent operations', () => {
      const summary = serviceMetrics.getSummary('non_existent')
      expect(summary).toBeNull()
    })

    it('should calculate correct statistics', () => {
      const durations = [100, 200, 300, 400, 500]
      durations.forEach((d) => serviceMetrics.recordQueryTime('test_op', d))

      const summary = serviceMetrics.getSummary('test_op')
      expect(summary?.avgDuration).toBe(300)
      expect(summary?.maxDuration).toBe(500)
      expect(summary?.minDuration).toBe(100)
    })

    it('should handle operations with only errors', () => {
      serviceMetrics.recordQueryError('test_op', new Error('Error 1'))
      serviceMetrics.recordQueryError('test_op', new Error('Error 2'))

      const summary = serviceMetrics.getSummary('test_op')
      expect(summary?.successCount).toBe(0)
      expect(summary?.errorCount).toBe(2)
      expect(summary?.avgDuration).toBe(0)
    })
  })

  describe('getAllMetrics', () => {
    it('should return all recorded metrics', () => {
      serviceMetrics.recordQueryTime('op1', 100)
      serviceMetrics.recordQueryTime('op2', 200)
      serviceMetrics.recordQueryError('op3', new Error('Failed'))

      const allMetrics = serviceMetrics.getAllMetrics()
      expect(allMetrics).toHaveLength(3)
      expect(allMetrics[0]?.name).toBe('op1')
      expect(allMetrics[1]?.name).toBe('op2')
      expect(allMetrics[2]?.name).toBe('op3')
    })
  })

  describe('clear', () => {
    it('should clear all metrics', () => {
      serviceMetrics.recordQueryTime('test_op', 100)
      serviceMetrics.recordQueryTime('test_op', 200)

      serviceMetrics.clear()

      const summary = serviceMetrics.getSummary('test_op')
      expect(summary).toBeNull()
      expect(serviceMetrics.getAllMetrics()).toHaveLength(0)
    })
  })

  describe('trackServiceMetrics', () => {
    it('should track successful operations', async () => {
      const operation = vi.fn().mockResolvedValue('success')

      const result = await trackServiceMetrics('test_operation', operation, { test: true })

      expect(result).toBe('success')
      expect(operation).toHaveBeenCalledTimes(1)

      const summary = serviceMetrics.getSummary('test_operation')
      expect(summary?.successCount).toBe(1)
      expect(summary?.errorCount).toBe(0)
    })

    it('should track failed operations', async () => {
      const error = new Error('Operation failed')
      const operation = vi.fn().mockRejectedValue(error)

      await expect(trackServiceMetrics('test_operation', operation)).rejects.toThrow('Operation failed')

      const summary = serviceMetrics.getSummary('test_operation')
      expect(summary?.successCount).toBe(0)
      expect(summary?.errorCount).toBe(1)
    })

    it('should measure operation duration', async () => {
      const operation = vi.fn().mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50))
        return 'done'
      })

      await trackServiceMetrics('test_operation', operation)

      const summary = serviceMetrics.getSummary('test_operation')
      expect(summary?.avgDuration).toBeGreaterThan(0)
    })
  })
})
