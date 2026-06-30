import { NextResponse } from 'next/server';
import { syncEnvFileToDb } from '@/lib/services/env';
import { withAuth, AuthError, getProjectWithOwnership } from '@/lib/middleware/auth';

interface RouteContext {
  params: Promise<{ project_id: string }>;
}

async function handler(_request: Request, userId: string, { params }: RouteContext) {
  try {
    const { project_id } = await params;
    await getProjectWithOwnership(project_id, userId);
    const synced = await syncEnvFileToDb(project_id);
    return NextResponse.json({
      success: true,
      synced_count: synced,
      message: `Synced ${synced} env vars from file to database`,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    console.error('[Env API] Failed to sync file to DB:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to sync env file to database',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

export const POST = withAuth(handler);

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
