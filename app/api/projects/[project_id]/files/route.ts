/**
 * GET /api/projects/[id]/files - Get project directory list
 */

import { NextRequest, NextResponse } from 'next/server';
import { listProjectDirectory, FileBrowserError } from '@/lib/services/file-browser';
import { withAuth } from '@/lib/middleware/auth';

interface RouteContext {
  params: Promise<{ project_id: string }>;
}

async function getFilesHandler(
  request: NextRequest,
  userId: string,
  { params }: RouteContext
) {
  try {
    const { project_id } = await params;
    const url = new URL(request.url);
    const dir = url.searchParams.get('path') ?? '.';

    const entries = await listProjectDirectory(project_id, dir, userId);

    return NextResponse.json({
      success: true,
      data: {
        entries,
      },
    });
  } catch (error) {
    if (error instanceof FileBrowserError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.status }
      );
    }

    console.error('[API] Failed to list project files:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to list project files',
      },
      { status: 500 }
    );
  }
}

export const GET = withAuth(getFilesHandler);
