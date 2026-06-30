/**
 * POST /api/projects/[id]/preview/start
 * Launches the development server for a project and returns the preview URL.
 */

import { NextResponse } from 'next/server';
import { previewManager } from '@/lib/services/preview';
import { withAuth, AuthError, getProjectWithOwnership } from '@/lib/middleware/auth';

interface RouteContext {
  params: Promise<{ project_id: string }>;
}

async function handler(
  _request: Request,
  userId: string,
  { params }: RouteContext
) {
  try {
    const { project_id } = await params;
    await getProjectWithOwnership(project_id, userId);
    const preview = await previewManager.start(project_id);

    return NextResponse.json({
      success: true,
      data: preview,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    console.error('[API] Failed to start preview:', error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to start preview',
      },
      { status: 500 }
    );
  }
}

export const POST = withAuth(handler);

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
