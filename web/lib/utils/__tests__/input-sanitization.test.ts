/**
 * Input Sanitization Tests
 *
 * Tests for input sanitization utilities that prevent injection attacks.
 */

import { describe, it, expect } from 'vitest'
import { sanitizeSearchInput, sanitizeUUID, sanitizeDateString } from '../input-sanitization'

describe('sanitizeSearchInput', () => {
  it('should preserve safe alphanumeric characters', () => {
    expect(sanitizeSearchInput('john123')).toBe('john123')
  })

  it('should preserve email addresses', () => {
    expect(sanitizeSearchInput('test@example.com')).toBe('test@example.com')
  })

  it('should preserve hyphenated names', () => {
    expect(sanitizeSearchInput('Jean-Pierre')).toBe('Jean-Pierre')
  })

  it('should preserve spaces', () => {
    expect(sanitizeSearchInput('John Doe')).toBe('John Doe')
  })

  it('should remove SQL injection attempts', () => {
    expect(sanitizeSearchInput("test%';DROP TABLE users;--")).toBe('testDROP TABLE users--')
  })

  it('should remove PostgREST operator injection attempts', () => {
    expect(sanitizeSearchInput('admin%,email.eq.admin@example.com')).toBe('adminemail.eq.admin@example.com')
  })

  it('should remove XSS attempts', () => {
    expect(sanitizeSearchInput('test<script>alert(1)</script>')).toBe('testscriptalert1script')
  })

  it('should remove pipe operators', () => {
    expect(sanitizeSearchInput('test|ilike|admin')).toBe('testilikeadmin')
  })

  it('should remove query string injection', () => {
    expect(sanitizeSearchInput('test&limit=1000')).toBe('testlimit1000')
  })

  it('should remove function call characters', () => {
    expect(sanitizeSearchInput('test()')).toBe('test')
  })

  it('should remove array notation', () => {
    expect(sanitizeSearchInput('test[]')).toBe('test')
  })

  it('should remove object notation', () => {
    expect(sanitizeSearchInput('test{}')).toBe('test')
  })

  it('should remove comparison operators', () => {
    expect(sanitizeSearchInput('test>100')).toBe('test100')
    expect(sanitizeSearchInput('test<100')).toBe('test100')
  })

  it('should handle empty string', () => {
    expect(sanitizeSearchInput('')).toBe('')
  })

  it('should handle string with only special characters', () => {
    expect(sanitizeSearchInput('%^&*()[]{}|')).toBe('')
  })
})

describe('sanitizeUUID', () => {
  it('should accept valid UUIDs', () => {
    const validUUID = '123e4567-e89b-12d3-a456-426614174000'
    expect(sanitizeUUID(validUUID)).toBe(validUUID)
  })

  it('should accept UUIDs in uppercase', () => {
    const validUUID = '123E4567-E89B-12D3-A456-426614174000'
    expect(sanitizeUUID(validUUID)).toBe(validUUID)
  })

  it('should reject invalid UUID format', () => {
    expect(() => sanitizeUUID('not-a-uuid')).toThrow('Invalid UUID format')
  })

  it('should reject UUID-like strings with wrong length', () => {
    expect(() => sanitizeUUID('123e4567-e89b-12d3-a456-42661417400')).toThrow('Invalid UUID format')
  })

  it('should reject UUIDs with invalid characters', () => {
    expect(() => sanitizeUUID('123e4567-e89b-12d3-a456-42661417400g')).toThrow('Invalid UUID format')
  })
})

describe('sanitizeDateString', () => {
  it('should accept valid dates in YYYY-MM-DD format', () => {
    expect(sanitizeDateString('2026-01-17')).toBe('2026-01-17')
    expect(sanitizeDateString('2025-12-31')).toBe('2025-12-31')
  })

  it('should reject dates in MM/DD/YYYY format', () => {
    expect(() => sanitizeDateString('01/17/2026')).toThrow('Invalid date format')
  })

  it('should reject dates in DD-MM-YYYY format', () => {
    expect(() => sanitizeDateString('17-01-2026')).toThrow('Invalid date format')
  })

  it('should reject invalid date strings', () => {
    expect(() => sanitizeDateString('not-a-date')).toThrow('Invalid date format')
  })

  it('should reject dates with time components', () => {
    expect(() => sanitizeDateString('2026-01-17T10:00:00')).toThrow('Invalid date format')
  })

  it('should reject empty strings', () => {
    expect(() => sanitizeDateString('')).toThrow('Invalid date format')
  })
})
