/**
 * POST /api/projects/[id]/preview/stop
 * Stops the development server for the project if it is running.
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
    const preview = await previewManager.stop(project_id);

    return NextResponse.json({
      success: true,
      data: preview,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    console.error('[API] Failed to stop preview:', error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to stop preview',
      },
      { status: 500 }
    );
  }
}

export const POST = withAuth(handler);

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
