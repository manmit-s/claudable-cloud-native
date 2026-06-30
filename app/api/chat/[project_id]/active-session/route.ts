import { NextResponse } from 'next/server';
import { getActiveSession } from '@/lib/services/chat-sessions';
import { withAuth, getProjectWithOwnership, AuthError } from '@/lib/middleware/auth';

interface RouteContext {
  params: Promise<{ project_id: string }>;
}

async function handler(_request: Request, _userId: string, { params }: RouteContext) {
  try {
    const { project_id } = await params;
    await getProjectWithOwnership(project_id, _userId);
    const session = await getActiveSession(project_id);

    // Return 200 with null data when no session exists (successful query, no results)
    // This prevents console 404 errors while still indicating no active session
    if (!session) {
      return NextResponse.json({ success: true, data: null });
    }

    return NextResponse.json({ success: true, data: session });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    console.error('[API] Failed to get active session:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get active session',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

export const GET = withAuth(handler);

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
