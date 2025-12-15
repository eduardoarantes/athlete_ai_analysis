import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { FitFileStorageService } from '@/lib/services/fit-file-storage-service'

/**
 * Upload FIT file(s)
 * POST /api/fit-files/upload
 *
 * Accepts multipart/form-data with one or more FIT files
 */
export async function POST(request: NextRequest) {
  try {
    // Check if user is authenticated
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse form data
    const formData = await request.formData()
    const files = formData.getAll('files') as File[]

    if (files.length === 0) {
      return NextResponse.json(
        { error: 'No files provided' },
        { status: 400 }
      )
    }

    // Validate files are .fit files
    const invalidFiles = files.filter(
      (file) => !file.name.toLowerCase().endsWith('.fit')
    )
    if (invalidFiles.length > 0) {
      return NextResponse.json(
        {
          error: 'All files must be FIT files (.fit extension)',
          invalidFiles: invalidFiles.map((f) => f.name),
        },
        { status: 400 }
      )
    }

    // Upload files
    const storageService = new FitFileStorageService()
    const results = await Promise.all(
      files.map(async (file) => {
        const buffer = Buffer.from(await file.arrayBuffer())
        return storageService.uploadFitFile(user.id, buffer, file.name)
      })
    )

    // Check for failures
    const failures = results.filter((r) => !r.success)
    if (failures.length > 0) {
      return NextResponse.json(
        {
          error: 'Some files failed to upload',
          failures: failures.map((f) => f.error),
          successCount: results.length - failures.length,
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      filesUploaded: results.length,
      paths: results.map((r) => r.path),
    })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to upload files',
      },
      { status: 500 }
    )
  }
}
