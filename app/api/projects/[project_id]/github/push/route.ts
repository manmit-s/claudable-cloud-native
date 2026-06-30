import { NextResponse } from 'next/server';
import { pushProjectToGitHub } from '@/lib/services/github';
import { withAuth, AuthError, getProjectWithOwnership } from '@/lib/middleware/auth';

interface RouteContext {
  params: Promise<{ project_id: string }>;
}

async function handler(_request: Request, userId: string, { params }: RouteContext) {
  try {
    const { project_id } = await params;
    await getProjectWithOwnership(project_id, userId);
    await pushProjectToGitHub(project_id);
    return NextResponse.json({ success: true, message: 'Changes pushed to GitHub' });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    console.error('[API] Failed to push to GitHub:', error);
    const status = error instanceof Error && 'status' in error ? (error as any).status ?? 500 : 500;
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to push to GitHub',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status },
    );
  }
}

export const POST = withAuth(handler);

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
