/**
 * POST /api/projects/[project_id]/install-dependencies
 * Run npm install (or equivalent) for a project workspace.
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
    const result = await previewManager.installDependencies(project_id);

    return NextResponse.json({
      success: true,
      logs: result.logs,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    console.error('[API] Failed to install dependencies:', error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to install dependencies',
      },
      { status: 500 }
    );
  }
}

export const POST = withAuth(handler);

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
