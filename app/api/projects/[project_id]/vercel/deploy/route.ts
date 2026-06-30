import { NextRequest, NextResponse } from 'next/server';
import { triggerVercelDeployment } from '@/lib/services/vercel';
import { withAuth, getProjectWithOwnership, AuthError } from '@/lib/middleware/auth';

interface RouteContext {
  params: Promise<{ project_id: string }>;
}

async function postHandler(_request: NextRequest, userId: string, { params }: RouteContext) {
  try {
    const { project_id } = await params;
    await getProjectWithOwnership(project_id, userId);
    const result = await triggerVercelDeployment(project_id);
    return NextResponse.json({
      success: true,
      deployment_id: result.deploymentId ?? null,
      deployment_url: result.deploymentUrl ?? null,
      status: result.status ?? null,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    console.error('[API] Failed to trigger Vercel deployment:', error);
    const status = error instanceof Error && 'status' in error ? (error as any).status ?? 500 : 500;
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to trigger Vercel deployment',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status },
    );
  }
}

export const POST = withAuth(postHandler);

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
