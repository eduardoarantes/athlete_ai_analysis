/**
 * Note Attachment Service Tests
 *
 * Tests for the NoteAttachmentService validation and utility methods.
 * Note: S3 operations require integration tests with localstack or actual AWS.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { NoteAttachmentService } from '../note-attachment-service'

// =============================================================================
// Tests
// =============================================================================

describe('NoteAttachmentService', () => {
  let service: NoteAttachmentService

  beforeEach(() => {
    // Set up environment variables
    process.env.AWS_S3_BUCKET_PREFIX = 'test-bucket'
    process.env.AWS_S3_REGION = 'us-east-1'
    process.env.APP_ENV = 'test'

    service = new NoteAttachmentService()
  })

  // ---------------------------------------------------------------------------
  // validateFile
  // ---------------------------------------------------------------------------
  describe('validateFile', () => {
    it('should accept valid PDF file', () => {
      const result = service.validateFile('application/pdf', 1024 * 1024) // 1MB

      expect(result.valid).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it('should accept valid PNG image', () => {
      const result = service.validateFile('image/png', 1024 * 1024) // 1MB

      expect(result.valid).toBe(true)
    })

    it('should accept valid JPEG image', () => {
      const result = service.validateFile('image/jpeg', 1024 * 1024)

      expect(result.valid).toBe(true)
    })

    it('should accept valid Word document', () => {
      const result = service.validateFile(
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        1024 * 1024
      )

      expect(result.valid).toBe(true)
    })

    it('should reject invalid content type', () => {
      const result = service.validateFile('application/x-executable', 1024)

      expect(result.valid).toBe(false)
      expect(result.error).toContain('Invalid file type')
    })

    it('should reject JavaScript files', () => {
      const result = service.validateFile('application/javascript', 1024)

      expect(result.valid).toBe(false)
      expect(result.error).toContain('Invalid file type')
    })

    it('should reject file exceeding size limit', () => {
      // Max is 10MB (10 * 1024 * 1024 bytes)
      const result = service.validateFile('application/pdf', 100 * 1024 * 1024) // 100MB

      expect(result.valid).toBe(false)
      expect(result.error).toContain('exceeds maximum')
    })

    it('should accept file at exactly the size limit', () => {
      const result = service.validateFile('application/pdf', 10 * 1024 * 1024) // 10MB

      expect(result.valid).toBe(true)
    })

    it('should reject file just over the size limit', () => {
      const result = service.validateFile('application/pdf', 10 * 1024 * 1024 + 1) // 10MB + 1 byte

      expect(result.valid).toBe(false)
      expect(result.error).toContain('exceeds maximum')
    })
  })

  // ---------------------------------------------------------------------------
  // generateS3Key
  // ---------------------------------------------------------------------------
  describe('generateS3Key', () => {
    it('should generate correct S3 key format', () => {
      const key = service.generateS3Key('user-123', 'note-456', 'document.pdf')

      expect(key).toBe('note-attachments/user-123/note-456/document.pdf')
    })

    it('should sanitize filenames with spaces', () => {
      const key = service.generateS3Key('user-123', 'note-456', 'my document.pdf')

      // Spaces are replaced with underscores
      expect(key).toBe('note-attachments/user-123/note-456/my_document.pdf')
    })

    it('should sanitize filenames with special characters', () => {
      const key = service.generateS3Key('user-123', 'note-456', 'file (1).pdf')

      // Parentheses and spaces are replaced with underscores
      expect(key).toBe('note-attachments/user-123/note-456/file__1_.pdf')
    })
  })

  // ---------------------------------------------------------------------------
  // getBucketName
  // ---------------------------------------------------------------------------
  describe('getBucketName', () => {
    it('should construct bucket name from prefix and environment', () => {
      const bucketName = service.getBucketName()

      expect(bucketName).toBe('test-bucket-test')
    })

    it('should use default bucket prefix if not set', () => {
      delete process.env.AWS_S3_BUCKET_PREFIX
      process.env.APP_ENV = 'dev'

      const newService = new NoteAttachmentService()
      const bucketName = newService.getBucketName()

      expect(bucketName).toBe('athlete-ai-note-attachments-dev')
    })
  })
})
