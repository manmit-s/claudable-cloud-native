import { NextRequest, NextResponse } from 'next/server';
import { getCurrentDeploymentStatus } from '@/lib/services/vercel';
import { withAuth, getProjectWithOwnership, AuthError } from '@/lib/middleware/auth';

interface RouteContext {
  params: Promise<{ project_id: string }>;
}

async function getHandler(_request: NextRequest, userId: string, { params }: RouteContext) {
  try {
    const { project_id } = await params;
    await getProjectWithOwnership(project_id, userId);
    const status = await getCurrentDeploymentStatus(project_id);
    return NextResponse.json(status);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    console.error('[API] Failed to get deployment status:', error);
    const statusCode = error instanceof Error && 'status' in error ? (error as any).status ?? 500 : 500;
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get deployment status',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: statusCode },
    );
  }
}

export const GET = withAuth(getHandler);

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
