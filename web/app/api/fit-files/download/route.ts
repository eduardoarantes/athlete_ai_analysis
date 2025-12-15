import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { FitFileStorageService } from '@/lib/services/fit-file-storage-service'

/**
 * Download a FIT file
 * GET /api/fit-files/download?filename=example.fit
 *
 * Returns a signed URL for downloading the file
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const filename = searchParams.get('filename')
    const expiresIn = parseInt(searchParams.get('expiresIn') || '3600')

    if (!filename) {
      return NextResponse.json(
        { error: 'Filename is required' },
        { status: 400 }
      )
    }

    const storageService = new FitFileStorageService()

    // Check if file exists
    const exists = await storageService.fileExists(user.id, filename)
    if (!exists) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    // Get signed URL
    const result = await storageService.getSignedUrl(
      user.id,
      filename,
      expiresIn
    )

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    return NextResponse.json({
      url: result.url,
      expiresIn,
    })
  } catch (error) {
    console.error('Download file error:', error)
    return NextResponse.json(
      { error: 'Failed to get download URL' },
      { status: 500 }
    )
  }
}
