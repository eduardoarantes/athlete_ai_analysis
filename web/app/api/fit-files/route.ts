import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { FitFileStorageService } from '@/lib/services/fit-file-storage-service'

/**
 * List all FIT files for the authenticated user
 * GET /api/fit-files
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const storageService = new FitFileStorageService()
    const result = await storageService.listFitFiles(user.id)

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    return NextResponse.json({
      files: result.files,
      count: result.files?.length || 0,
    })
  } catch (error) {
    console.error('List files error:', error)
    return NextResponse.json({ error: 'Failed to list files' }, { status: 500 })
  }
}

/**
 * Delete a FIT file
 * DELETE /api/fit-files?filename=example.fit
 */
export async function DELETE(request: NextRequest) {
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

    if (!filename) {
      return NextResponse.json({ error: 'Filename is required' }, { status: 400 })
    }

    const storageService = new FitFileStorageService()
    const result = await storageService.deleteFitFile(user.id, filename)

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete file error:', error)
    return NextResponse.json({ error: 'Failed to delete file' }, { status: 500 })
  }
}
