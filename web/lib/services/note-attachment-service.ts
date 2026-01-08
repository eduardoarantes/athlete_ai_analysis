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
 *
 * Optional Environment Variables:
 * - NOTE_ATTACHMENT_PRESIGNED_URL_EXPIRY: Download URL expiry in seconds (default: 900 = 15 minutes)
 */

import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
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

export interface ListResult {
  success: boolean
  keys?: string[]
  error?: string
}

export interface CleanupResult {
  success: boolean
  deletedCount: number
  deletedKeys: string[]
  failedKeys: string[]
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
  private readonly defaultPresignedUrlExpiry: number

  constructor() {
    this.bucketPrefix = process.env.AWS_S3_BUCKET_PREFIX || 'athlete-ai-note-attachments'
    this.region = process.env.AWS_S3_REGION || 'us-east-1'
    this.environment = process.env.APP_ENV || 'dev'
    this.defaultPresignedUrlExpiry = parseInt(
      process.env.NOTE_ATTACHMENT_PRESIGNED_URL_EXPIRY || '900',
      10
    )

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
  getBucketName(): string {
    return `${this.bucketPrefix}-${this.environment}`
  }

  /**
   * Generate S3 key for a note attachment
   * Pattern: note-attachments/{user_id}/{note_id}/{filename}
   */
  generateS3Key(userId: string, noteId: string, filename: string): string {
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
   * @param expiresInSeconds - URL expiry time (default: from NOTE_ATTACHMENT_PRESIGNED_URL_EXPIRY env var, or 900 seconds)
   * @returns Presigned URL result
   */
  async getDownloadUrl(s3Key: string, expiresInSeconds?: number): Promise<PresignedUrlResult> {
    const expiry = expiresInSeconds ?? this.defaultPresignedUrlExpiry
    try {
      const bucketName = this.getBucketName()

      const command = new GetObjectCommand({
        Bucket: bucketName,
        Key: s3Key,
      })

      const url = await getSignedUrl(this.s3Client, command, {
        expiresIn: expiry,
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

  // ===========================================================================
  // Orphan Cleanup Methods
  // ===========================================================================

  /**
   * List all attachment keys in S3 for a given user (or all users if not specified)
   *
   * This method is used for orphan cleanup - comparing S3 objects against database records.
   *
   * @param userId - Optional user ID to filter by (prefix filter)
   * @returns List of S3 keys
   */
  async listAttachmentKeys(userId?: string): Promise<ListResult> {
    try {
      const bucketName = this.getBucketName()
      const prefix = userId ? `note-attachments/${userId}/` : 'note-attachments/'

      const keys: string[] = []
      let continuationToken: string | undefined

      // Paginate through all objects
      do {
        const command = new ListObjectsV2Command({
          Bucket: bucketName,
          Prefix: prefix,
          ContinuationToken: continuationToken,
        })

        const response = await this.s3Client.send(command)

        if (response.Contents) {
          for (const obj of response.Contents) {
            if (obj.Key) {
              keys.push(obj.Key)
            }
          }
        }

        continuationToken = response.NextContinuationToken
      } while (continuationToken)

      return { success: true, keys }
    } catch (error) {
      errorLogger.logError(error as Error, {
        path: 'NoteAttachmentService.listAttachmentKeys',
        metadata: { userId },
      })

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list attachments',
      }
    }
  }

  /**
   * Clean up orphaned S3 attachments that no longer have corresponding database records
   *
   * STRATEGY: This method compares S3 objects against a list of valid keys from the database.
   * Any S3 object not in the valid list is considered orphaned and deleted.
   *
   * WHEN TO RUN:
   * - As a scheduled job (e.g., daily) to clean up any orphans from failed transactions
   * - After bulk operations that might leave orphans
   * - Manually when investigating storage usage
   *
   * SAFETY CONSIDERATIONS:
   * - This is a destructive operation - deleted files cannot be recovered
   * - Consider enabling S3 versioning for recovery options
   * - Run in dry-run mode first (dryRun=true) to see what would be deleted
   * - Only process one user at a time to limit blast radius
   *
   * @param validS3Keys - Set of S3 keys that have valid database records
   * @param userId - Optional user ID to scope cleanup to a single user
   * @param dryRun - If true, only report what would be deleted without actually deleting
   * @returns Cleanup result with deleted and failed keys
   */
  async cleanupOrphanedAttachments(
    validS3Keys: Set<string>,
    userId?: string,
    dryRun: boolean = false
  ): Promise<CleanupResult> {
    const deletedKeys: string[] = []
    const failedKeys: string[] = []

    try {
      // List all S3 keys
      const listResult = await this.listAttachmentKeys(userId)
      if (!listResult.success || !listResult.keys) {
        return {
          success: false,
          deletedCount: 0,
          deletedKeys: [],
          failedKeys: [],
          error: listResult.error || 'Failed to list attachments',
        }
      }

      // Find orphaned keys (in S3 but not in database)
      const orphanedKeys = listResult.keys.filter((key) => !validS3Keys.has(key))

      errorLogger.logInfo('Orphan cleanup started', {
        metadata: {
          userId,
          totalS3Keys: listResult.keys.length,
          validDbKeys: validS3Keys.size,
          orphanedCount: orphanedKeys.length,
          dryRun,
        },
      })

      if (orphanedKeys.length === 0) {
        return {
          success: true,
          deletedCount: 0,
          deletedKeys: [],
          failedKeys: [],
        }
      }

      if (dryRun) {
        // In dry-run mode, just report what would be deleted
        return {
          success: true,
          deletedCount: orphanedKeys.length,
          deletedKeys: orphanedKeys,
          failedKeys: [],
        }
      }

      // Delete orphaned keys
      for (const key of orphanedKeys) {
        const deleteResult = await this.deleteAttachment(key)
        if (deleteResult.success) {
          deletedKeys.push(key)
        } else {
          failedKeys.push(key)
        }
      }

      errorLogger.logInfo('Orphan cleanup completed', {
        metadata: {
          userId,
          deletedCount: deletedKeys.length,
          failedCount: failedKeys.length,
        },
      })

      return {
        success: failedKeys.length === 0,
        deletedCount: deletedKeys.length,
        deletedKeys,
        failedKeys,
      }
    } catch (error) {
      errorLogger.logError(error as Error, {
        path: 'NoteAttachmentService.cleanupOrphanedAttachments',
        metadata: { userId, dryRun },
      })

      return {
        success: false,
        deletedCount: deletedKeys.length,
        deletedKeys,
        failedKeys,
        error: error instanceof Error ? error.message : 'Failed to cleanup orphans',
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
