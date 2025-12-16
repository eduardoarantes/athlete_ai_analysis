/**
 * FIT File Storage Service
 * Handles uploading, downloading, and managing FIT files in Supabase Storage
 */

import { createClient } from '@/lib/supabase/server'

export interface FitFileMetadata {
  name: string
  size: number
  uploadedAt: Date
  path: string
}

export interface UploadResult {
  success: boolean
  path?: string
  error?: string
}

export interface ListResult {
  success: boolean
  files?: FitFileMetadata[]
  error?: string
}

export class FitFileStorageService {
  private readonly bucketName = 'fit-files'

  /**
   * Upload a FIT file to storage
   * Files are stored in user-specific folders: {userId}/{filename}
   */
  async uploadFitFile(
    userId: string,
    file: File | Buffer,
    filename: string
  ): Promise<UploadResult> {
    try {
      const supabase = await createClient()

      // Ensure filename ends with .fit
      if (!filename.toLowerCase().endsWith('.fit')) {
        filename = `${filename}.fit`
      }

      // Path: {userId}/{filename}
      const filePath = `${userId}/${filename}`

      // Upload file
      const { error } = await supabase.storage
        .from(this.bucketName)
        .upload(filePath, file, {
          contentType: 'application/octet-stream',
          upsert: true, // Allow overwriting existing file
        })

      if (error) {
        return {
          success: false,
          error: error.message,
        }
      }

      return {
        success: true,
        path: filePath,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Download a FIT file from storage
   */
  async downloadFitFile(
    userId: string,
    filename: string
  ): Promise<{ success: boolean; data?: Blob; error?: string }> {
    try {
      const supabase = await createClient()

      const filePath = `${userId}/${filename}`

      const { data, error } = await supabase.storage
        .from(this.bucketName)
        .download(filePath)

      if (error) {
        return {
          success: false,
          error: error.message,
        }
      }

      return {
        success: true,
        data,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Delete a FIT file from storage
   */
  async deleteFitFile(
    userId: string,
    filename: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const supabase = await createClient()

      const filePath = `${userId}/${filename}`

      const { error } = await supabase.storage
        .from(this.bucketName)
        .remove([filePath])

      if (error) {
        return {
          success: false,
          error: error.message,
        }
      }

      return {
        success: true,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * List all FIT files for a user
   */
  async listFitFiles(userId: string): Promise<ListResult> {
    try {
      const supabase = await createClient()

      const { data, error } = await supabase.storage
        .from(this.bucketName)
        .list(userId, {
          sortBy: { column: 'created_at', order: 'desc' },
        })

      if (error) {
        return {
          success: false,
          error: error.message,
        }
      }

      const files: FitFileMetadata[] = (data || []).map((file) => ({
        name: file.name,
        size: file.metadata?.size || 0,
        uploadedAt: new Date(file.created_at),
        path: `${userId}/${file.name}`,
      }))

      return {
        success: true,
        files,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Get a signed URL for temporary file access
   * Useful for downloading files via browser
   */
  async getSignedUrl(
    userId: string,
    filename: string,
    expiresIn: number = 3600 // 1 hour default
  ): Promise<{ success: boolean; url?: string; error?: string }> {
    try {
      const supabase = await createClient()

      const filePath = `${userId}/${filename}`

      const { data, error } = await supabase.storage
        .from(this.bucketName)
        .createSignedUrl(filePath, expiresIn)

      if (error) {
        return {
          success: false,
          error: error.message,
        }
      }

      return {
        success: true,
        url: data.signedUrl,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Check if a FIT file exists in storage
   */
  async fileExists(userId: string, filename: string): Promise<boolean> {
    try {
      const supabase = await createClient()

      const { data, error } = await supabase.storage
        .from(this.bucketName)
        .list(userId, {
          search: filename,
        })

      if (error) {
        return false
      }

      return (data || []).some((file) => file.name === filename)
    } catch {
      return false
    }
  }
}
