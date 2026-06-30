import { NextResponse } from 'next/server';
import { getSessionById } from '@/lib/services/chat-sessions';
import { withAuth } from '@/lib/middleware/auth';

interface RouteContext {
  params: Promise<{ project_id: string; session_id: string }>;
}

async function handler(_request: Request, _userId: string, { params }: RouteContext) {
  try {
    const { project_id, session_id } = await params;
    const session = await getSessionById(project_id, session_id);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Session not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: session });
  } catch (error) {
    console.error('[API] Failed to get session status:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get session status',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

export const GET = withAuth(handler);

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
