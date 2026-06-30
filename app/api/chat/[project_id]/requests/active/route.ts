import { NextResponse } from 'next/server';
import { getActiveRequests } from '@/lib/services/user-requests';
import { withAuth } from '@/lib/middleware/auth';

interface RouteContext {
  params: Promise<{ project_id: string }>;
}

async function handler(_request: Request, _userId: string, { params }: RouteContext) {
  try {
    const { project_id } = await params;
    const summary = await getActiveRequests(project_id);
    return NextResponse.json(summary);
  } catch (error) {
    console.error('[API] Failed to get active requests:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get active requests',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

export const GET = withAuth(handler);

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
