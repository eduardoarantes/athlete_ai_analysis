/**
 * Note Attachment Service
 * Handles uploading, downloading, and managing note attachments in AWS S3
 *
 * S3 Key Structure: note-attachments/{user_id}/{note_id}/{filename}
 *
 * Environment Variables Required:
 * - AWS_S3_BUCKET_PREFIX: Base bucket name (e.g., 'athlete-ai-note-attachments')
 * - AWS_S3_REGION: AWS region (e.g., 'us-east-1')
 * - APP_ENV: Environment identifier (dev | staging | prod)
 * - AWS_ACCESS_KEY_ID: AWS credentials (optional if using IAM role)
 * - AWS_SECRET_ACCESS_KEY: AWS credentials (optional if using IAM role)
 */

import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { errorLogger } from '@/lib/monitoring/error-logger'
import {
  NOTE_ATTACHMENT_ALLOWED_TYPES,
  NOTE_ATTACHMENT_MAX_SIZE_BYTES,
  isAllowedAttachmentType,
} from '@/lib/types/training-plan'

// =============================================================================
// Types
// =============================================================================

export interface UploadResult {
  success: boolean
  s3Key?: string
  error?: string
}

export interface DeleteResult {
  success: boolean
  error?: string
}

export interface ValidationResult {
  valid: boolean
  error?: string
}

export interface PresignedUrlResult {
  success: boolean
  url?: string
  error?: string
}

// =============================================================================
// Note Attachment Service
// =============================================================================

export class NoteAttachmentService {
  private readonly s3Client: S3Client
  private readonly bucketPrefix: string
  private readonly region: string
  private readonly environment: string

  constructor() {
    this.bucketPrefix = process.env.AWS_S3_BUCKET_PREFIX || 'athlete-ai-note-attachments'
    this.region = process.env.AWS_S3_REGION || 'us-east-1'
    this.environment = process.env.APP_ENV || 'dev'

    this.s3Client = new S3Client({
      region: this.region,
      // AWS credentials are automatically loaded from environment variables
      // AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY, or from IAM role
    })
  }

  /**
   * Get the full bucket name based on environment
   * Pattern: {prefix}-{environment}
   * Example: athlete-ai-note-attachments-dev
   */
  private getBucketName(): string {
    return `${this.bucketPrefix}-${this.environment}`
  }

  /**
   * Generate S3 key for a note attachment
   * Pattern: note-attachments/{user_id}/{note_id}/{filename}
   */
  private generateS3Key(userId: string, noteId: string, filename: string): string {
    // Sanitize filename to remove potentially problematic characters
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_')
    return `note-attachments/${userId}/${noteId}/${sanitizedFilename}`
  }

  /**
   * Validate file type and size before upload
   */
  validateFile(contentType: string, sizeBytes: number): ValidationResult {
    // Check file type
    if (!isAllowedAttachmentType(contentType)) {
      return {
        valid: false,
        error: `Invalid file type: ${contentType}. Allowed types: ${NOTE_ATTACHMENT_ALLOWED_TYPES.join(', ')}`,
      }
    }

    // Check file size
    if (sizeBytes > NOTE_ATTACHMENT_MAX_SIZE_BYTES) {
      const maxSizeMB = NOTE_ATTACHMENT_MAX_SIZE_BYTES / (1024 * 1024)
      return {
        valid: false,
        error: `File size exceeds maximum allowed size of ${maxSizeMB}MB`,
      }
    }

    return { valid: true }
  }

  /**
   * Upload a file to S3 for a note
   *
   * @param userId - User ID for path isolation
   * @param noteId - Note ID for organizing attachments
   * @param fileBuffer - File content as Buffer
   * @param filename - Original filename
   * @param contentType - MIME type of the file
   * @returns Upload result with S3 key on success
   */
  async uploadAttachment(
    userId: string,
    noteId: string,
    fileBuffer: Buffer,
    filename: string,
    contentType: string
  ): Promise<UploadResult> {
    try {
      // Validate file before upload
      const validation = this.validateFile(contentType, fileBuffer.length)
      if (!validation.valid) {
        return {
          success: false,
          error: validation.error || 'Invalid file',
        }
      }

      const s3Key = this.generateS3Key(userId, noteId, filename)
      const bucketName = this.getBucketName()

      const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: s3Key,
        Body: fileBuffer,
        ContentType: contentType,
        // Add metadata for tracking
        Metadata: {
          'user-id': userId,
          'note-id': noteId,
          'original-filename': filename,
        },
      })

      await this.s3Client.send(command)

      errorLogger.logInfo('Note attachment uploaded successfully', {
        userId,
        metadata: {
          noteId,
          s3Key,
          contentType,
          sizeBytes: fileBuffer.length,
        },
      })

      return {
        success: true,
        s3Key,
      }
    } catch (error) {
      errorLogger.logError(error as Error, {
        userId,
        path: 'NoteAttachmentService.uploadAttachment',
        metadata: {
          noteId,
          filename,
          contentType,
        },
      })

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to upload attachment',
      }
    }
  }

  /**
   * Generate a presigned URL for downloading an attachment
   *
   * @param s3Key - S3 object key
   * @param expiresInSeconds - URL expiry time (default: 15 minutes)
   * @returns Presigned URL result
   */
  async getDownloadUrl(s3Key: string, expiresInSeconds: number = 900): Promise<PresignedUrlResult> {
    try {
      const bucketName = this.getBucketName()

      const command = new GetObjectCommand({
        Bucket: bucketName,
        Key: s3Key,
      })

      const url = await getSignedUrl(this.s3Client, command, {
        expiresIn: expiresInSeconds,
      })

      return {
        success: true,
        url,
      }
    } catch (error) {
      errorLogger.logError(error as Error, {
        path: 'NoteAttachmentService.getDownloadUrl',
        metadata: { s3Key },
      })

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate download URL',
      }
    }
  }

  /**
   * Delete an attachment from S3
   *
   * @param s3Key - S3 object key to delete
   * @returns Delete result
   */
  async deleteAttachment(s3Key: string): Promise<DeleteResult> {
    try {
      const bucketName = this.getBucketName()

      const command = new DeleteObjectCommand({
        Bucket: bucketName,
        Key: s3Key,
      })

      await this.s3Client.send(command)

      errorLogger.logInfo('Note attachment deleted successfully', {
        metadata: { s3Key },
      })

      return { success: true }
    } catch (error) {
      errorLogger.logError(error as Error, {
        path: 'NoteAttachmentService.deleteAttachment',
        metadata: { s3Key },
      })

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete attachment',
      }
    }
  }
}

// =============================================================================
// Singleton Instance
// =============================================================================

/**
 * Singleton instance of NoteAttachmentService
 * Use this for all note attachment operations
 */
export const noteAttachmentService = new NoteAttachmentService()
