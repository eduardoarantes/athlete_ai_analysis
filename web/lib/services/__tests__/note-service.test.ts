/**
 * Note Service Tests
 *
 * Tests for the NoteService which handles CRUD operations for plan instance notes
 * including file attachment management via S3.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock modules before importing service
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

vi.mock('@/lib/monitoring/error-logger', () => ({
  errorLogger: {
    logInfo: vi.fn(),
    logWarning: vi.fn(),
    logError: vi.fn(),
  },
}))

vi.mock('../note-attachment-service', () => ({
  noteAttachmentService: {
    uploadAttachment: vi.fn(),
    deleteAttachment: vi.fn(),
    getDownloadUrl: vi.fn(),
  },
}))

// Import after mocks
import { NoteService } from '../note-service'
import { createClient } from '@/lib/supabase/server'
import { noteAttachmentService } from '../note-attachment-service'

// =============================================================================
// Test Data Factories
// =============================================================================

const createMockNote = (overrides = {}) => ({
  id: 'note-123',
  plan_instance_id: 'instance-123',
  user_id: 'user-123',
  title: 'Test Note',
  description: 'Test description',
  note_date: '2025-01-15',
  attachment_s3_key: null,
  attachment_filename: null,
  attachment_size_bytes: null,
  attachment_content_type: null,
  created_at: '2025-01-15T10:00:00Z',
  updated_at: '2025-01-15T10:00:00Z',
  ...overrides,
})

const createMockInstance = (overrides = {}) => ({
  id: 'instance-123',
  user_id: 'user-123',
  status: 'active',
  ...overrides,
})

/**
 * Creates a chainable mock that returns itself for any method call
 * and resolves to the specified result when awaited
 */
const createChainableMock = (result: { data: unknown; error: unknown }) => {
  const chainable: Record<string, unknown> = {}

  const handler: ProxyHandler<Record<string, unknown>> = {
    get: (_target, prop) => {
      if (prop === 'then') {
        return (resolve: (value: unknown) => void) => resolve(result)
      }
      return () => new Proxy(chainable, handler)
    },
  }

  return new Proxy(chainable, handler)
}

/**
 * Creates a mock Supabase client for testing
 */
const createMockSupabase = (config: {
  fromResults?: Record<string, { data: unknown; error: unknown }>
}) => {
  const { fromResults = {} } = config

  return {
    from: vi.fn((table: string) => {
      const result = fromResults[table] || { data: null, error: null }
      return createChainableMock(result)
    }),
  }
}

// =============================================================================
// Tests
// =============================================================================

describe('NoteService', () => {
  let service: NoteService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new NoteService()
  })

  // ---------------------------------------------------------------------------
  // validateAccess
  // ---------------------------------------------------------------------------
  describe('validateAccess', () => {
    it('should return valid when user owns the instance', async () => {
      const mockSupabase = createMockSupabase({
        fromResults: {
          plan_instances: {
            data: createMockInstance(),
            error: null,
          },
        },
      })
      vi.mocked(createClient).mockResolvedValue(mockSupabase as never)

      const result = await service.validateAccess('instance-123', 'user-123')

      expect(result.valid).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it('should return invalid when instance not found', async () => {
      const mockSupabase = createMockSupabase({
        fromResults: {
          plan_instances: {
            data: null,
            error: { code: 'PGRST116', message: 'Not found' },
          },
        },
      })
      vi.mocked(createClient).mockResolvedValue(mockSupabase as never)

      const result = await service.validateAccess('instance-123', 'user-123')

      expect(result.valid).toBe(false)
      expect(result.error).toBe('Plan instance not found')
    })

    it('should return invalid when user does not own instance', async () => {
      const mockSupabase = createMockSupabase({
        fromResults: {
          plan_instances: {
            data: createMockInstance({ user_id: 'other-user' }),
            error: null,
          },
        },
      })
      vi.mocked(createClient).mockResolvedValue(mockSupabase as never)

      const result = await service.validateAccess('instance-123', 'user-123')

      expect(result.valid).toBe(false)
      expect(result.error).toBe('Not authorized to access this plan')
    })
  })

  // ---------------------------------------------------------------------------
  // createNote
  // ---------------------------------------------------------------------------
  describe('createNote', () => {
    it('should create a note without attachment', async () => {
      const mockNote = createMockNote()
      const mockSupabase = createMockSupabase({
        fromResults: {
          plan_instances: {
            data: createMockInstance(),
            error: null,
          },
          plan_instance_notes: {
            data: mockNote,
            error: null,
          },
        },
      })
      vi.mocked(createClient).mockResolvedValue(mockSupabase as never)

      const result = await service.createNote('user-123', 'instance-123', {
        title: 'Test Note',
        note_date: '2025-01-15',
      })

      expect(result.success).toBe(true)
      expect(result.note).toEqual(mockNote)
    })

    it('should create a note with attachment', async () => {
      const mockNote = createMockNote({
        attachment_s3_key: 'note-attachments/user-123/note-123/test.pdf',
        attachment_filename: 'test.pdf',
        attachment_size_bytes: 1024,
        attachment_content_type: 'application/pdf',
      })

      const mockSupabase = createMockSupabase({
        fromResults: {
          plan_instances: {
            data: createMockInstance(),
            error: null,
          },
          plan_instance_notes: {
            data: mockNote,
            error: null,
          },
        },
      })
      vi.mocked(createClient).mockResolvedValue(mockSupabase as never)

      vi.mocked(noteAttachmentService.uploadAttachment).mockResolvedValue({
        success: true,
        s3Key: 'note-attachments/user-123/note-123/test.pdf',
      })

      const fileInput = {
        buffer: Buffer.from('test content'),
        filename: 'test.pdf',
        contentType: 'application/pdf',
      }

      const result = await service.createNote(
        'user-123',
        'instance-123',
        {
          title: 'Test Note',
          note_date: '2025-01-15',
        },
        fileInput
      )

      expect(result.success).toBe(true)
      expect(noteAttachmentService.uploadAttachment).toHaveBeenCalled()
    })

    it('should fail when user does not have access', async () => {
      const mockSupabase = createMockSupabase({
        fromResults: {
          plan_instances: {
            data: createMockInstance({ user_id: 'other-user' }),
            error: null,
          },
        },
      })
      vi.mocked(createClient).mockResolvedValue(mockSupabase as never)

      const result = await service.createNote('user-123', 'instance-123', {
        title: 'Test Note',
        note_date: '2025-01-15',
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe('Not authorized to access this plan')
    })
  })

  // ---------------------------------------------------------------------------
  // deleteNote
  // ---------------------------------------------------------------------------
  describe('deleteNote', () => {
    it('should delete a note without attachment', async () => {
      const mockNote = createMockNote()
      const mockSupabase = createMockSupabase({
        fromResults: {
          plan_instance_notes: {
            data: mockNote,
            error: null,
          },
        },
      })
      vi.mocked(createClient).mockResolvedValue(mockSupabase as never)

      const result = await service.deleteNote('user-123', 'note-123')

      expect(result.success).toBe(true)
    })

    it('should delete S3 attachment before deleting note', async () => {
      const mockNote = createMockNote({
        attachment_s3_key: 'note-attachments/user-123/note-123/test.pdf',
      })
      const mockSupabase = createMockSupabase({
        fromResults: {
          plan_instance_notes: {
            data: mockNote,
            error: null,
          },
        },
      })
      vi.mocked(createClient).mockResolvedValue(mockSupabase as never)
      vi.mocked(noteAttachmentService.deleteAttachment).mockResolvedValue({
        success: true,
      })

      const result = await service.deleteNote('user-123', 'note-123')

      expect(result.success).toBe(true)
      expect(noteAttachmentService.deleteAttachment).toHaveBeenCalledWith(
        'note-attachments/user-123/note-123/test.pdf'
      )
    })

    it('should fail when note not found', async () => {
      const mockSupabase = createMockSupabase({
        fromResults: {
          plan_instance_notes: {
            data: null,
            error: { code: 'PGRST116', message: 'Not found' },
          },
        },
      })
      vi.mocked(createClient).mockResolvedValue(mockSupabase as never)

      const result = await service.deleteNote('user-123', 'note-123')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Note not found')
    })

    it('should fail when user does not own the note', async () => {
      const mockNote = createMockNote({ user_id: 'other-user' })
      const mockSupabase = createMockSupabase({
        fromResults: {
          plan_instance_notes: {
            data: mockNote,
            error: null,
          },
        },
      })
      vi.mocked(createClient).mockResolvedValue(mockSupabase as never)

      const result = await service.deleteNote('user-123', 'note-123')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Not authorized to delete this note')
    })
  })

  // ---------------------------------------------------------------------------
  // listNotes
  // ---------------------------------------------------------------------------
  describe('listNotes', () => {
    it('should list all notes for an instance', async () => {
      const mockNotes = [
        createMockNote(),
        createMockNote({ id: 'note-456', title: 'Another Note' }),
      ]
      const mockSupabase = createMockSupabase({
        fromResults: {
          plan_instance_notes: {
            data: mockNotes,
            error: null,
          },
        },
      })
      vi.mocked(createClient).mockResolvedValue(mockSupabase as never)

      const result = await service.listNotes('instance-123')

      expect(result.success).toBe(true)
      expect(result.notes).toHaveLength(2)
    })

    it('should return empty array when no notes exist', async () => {
      const mockSupabase = createMockSupabase({
        fromResults: {
          plan_instance_notes: {
            data: [],
            error: null,
          },
        },
      })
      vi.mocked(createClient).mockResolvedValue(mockSupabase as never)

      const result = await service.listNotes('instance-123')

      expect(result.success).toBe(true)
      expect(result.notes).toHaveLength(0)
    })
  })

  // ---------------------------------------------------------------------------
  // getAttachmentDownloadUrl
  // ---------------------------------------------------------------------------
  describe('getAttachmentDownloadUrl', () => {
    it('should return download URL for valid note with attachment', async () => {
      const mockNote = createMockNote({
        attachment_s3_key: 'note-attachments/user-123/note-123/test.pdf',
      })
      const mockSupabase = createMockSupabase({
        fromResults: {
          plan_instance_notes: {
            data: mockNote,
            error: null,
          },
        },
      })
      vi.mocked(createClient).mockResolvedValue(mockSupabase as never)
      vi.mocked(noteAttachmentService.getDownloadUrl).mockResolvedValue({
        success: true,
        url: 'https://s3.amazonaws.com/presigned-url',
      })

      // Note: signature is (noteId, userId)
      const result = await service.getAttachmentDownloadUrl('note-123', 'user-123')

      expect(result.url).toBe('https://s3.amazonaws.com/presigned-url')
      expect(result.error).toBeUndefined()
    })

    it('should fail when note has no attachment', async () => {
      const mockNote = createMockNote()
      const mockSupabase = createMockSupabase({
        fromResults: {
          plan_instance_notes: {
            data: mockNote,
            error: null,
          },
        },
      })
      vi.mocked(createClient).mockResolvedValue(mockSupabase as never)

      const result = await service.getAttachmentDownloadUrl('note-123', 'user-123')

      expect(result.error).toBe('Note has no attachment')
      expect(result.url).toBeUndefined()
    })

    it('should fail when user does not own the note', async () => {
      const mockNote = createMockNote({ user_id: 'other-user' })
      const mockSupabase = createMockSupabase({
        fromResults: {
          plan_instance_notes: {
            data: mockNote,
            error: null,
          },
        },
      })
      vi.mocked(createClient).mockResolvedValue(mockSupabase as never)

      const result = await service.getAttachmentDownloadUrl('note-123', 'user-123')

      expect(result.error).toBe('Not authorized to access this attachment')
      expect(result.url).toBeUndefined()
    })
  })
})
