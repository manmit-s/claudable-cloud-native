import { NextResponse } from 'next/server';
import { syncDbToEnvFile } from '@/lib/services/env';
import { withAuth, AuthError, getProjectWithOwnership } from '@/lib/middleware/auth';

interface RouteContext {
  params: Promise<{ project_id: string }>;
}

async function handler(_request: Request, userId: string, { params }: RouteContext) {
  try {
    const { project_id } = await params;
    await getProjectWithOwnership(project_id, userId);
    const synced = await syncDbToEnvFile(project_id);
    return NextResponse.json({
      success: true,
      synced_count: synced,
      message: `Synced ${synced} env vars from database to file`,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    console.error('[Env API] Failed to sync DB to file:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to sync database to env file',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

export const POST = withAuth(handler);

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
