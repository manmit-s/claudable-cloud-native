import { NextRequest, NextResponse } from 'next/server';
import { updateEnvVar, deleteEnvVar } from '@/lib/services/env';
import { withAuth, AuthError, getProjectWithOwnership } from '@/lib/middleware/auth';

interface RouteContext {
  params: Promise<{ project_id: string; key: string }>;
}

async function putHandler(request: NextRequest, userId: string, { params }: RouteContext) {
  try {
    const { project_id, key } = await params;
    await getProjectWithOwnership(project_id, userId);
    const body = await request.json();
    if (typeof body?.value !== 'string') {
      return NextResponse.json(
        { success: false, error: 'value must be a string' },
        { status: 400 },
      );
    }

    const updated = await updateEnvVar(project_id, key, body.value);
    if (!updated) {
      return NextResponse.json(
        { success: false, error: 'Environment variable not found' },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      message: `Environment variable '${key}' updated`,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    console.error('[Env API] Failed to update env var:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update environment variable',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

async function deleteHandler(_request: NextRequest, userId: string, { params }: RouteContext) {
  try {
    const { project_id, key } = await params;
    await getProjectWithOwnership(project_id, userId);
    const deleted = await deleteEnvVar(project_id, key);
    if (!deleted) {
      return NextResponse.json(
        { success: false, error: 'Environment variable not found' },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      message: `Environment variable '${key}' deleted`,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    console.error('[Env API] Failed to delete env var:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete environment variable',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

export const PUT = withAuth(putHandler);
export const DELETE = withAuth(deleteHandler);

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
