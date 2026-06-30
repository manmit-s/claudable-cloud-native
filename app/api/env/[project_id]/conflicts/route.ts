import { NextResponse } from 'next/server';
import { detectEnvConflicts } from '@/lib/services/env';
import { withAuth, AuthError, getProjectWithOwnership } from '@/lib/middleware/auth';

interface RouteContext {
  params: Promise<{ project_id: string }>;
}

async function handler(_request: Request, userId: string, { params }: RouteContext) {
  try {
    const { project_id } = await params;
    await getProjectWithOwnership(project_id, userId);
    const result = await detectEnvConflicts(project_id);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    console.error('[Env API] Failed to check conflicts:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to check environment conflicts',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

export const GET = withAuth(handler);

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
