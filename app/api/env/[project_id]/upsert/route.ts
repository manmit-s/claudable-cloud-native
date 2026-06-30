import { NextRequest, NextResponse } from 'next/server';
import { upsertEnvVar } from '@/lib/services/env';
import { withAuth, AuthError, getProjectWithOwnership } from '@/lib/middleware/auth';

interface RouteContext {
  params: Promise<{ project_id: string }>;
}

async function handler(request: NextRequest, userId: string, { params }: RouteContext) {
  try {
    const { project_id } = await params;
    await getProjectWithOwnership(project_id, userId);
    const body = await request.json();
    if (!body?.key || typeof body.key !== 'string') {
      return NextResponse.json(
        { success: false, error: 'key is required' },
        { status: 400 },
      );
    }
    if (typeof body.value !== 'string') {
      return NextResponse.json(
        { success: false, error: 'value must be a string' },
        { status: 400 },
      );
    }

    const record = await upsertEnvVar(project_id, {
      key: body.key,
      value: body.value,
      scope: body.scope,
      varType: body.var_type ?? body.varType,
      isSecret: body.is_secret ?? body.isSecret,
      description: body.description,
    });

    return NextResponse.json({ success: true, data: record });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    console.error('[Env API] Failed to upsert env var:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to upsert environment variable',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

export const POST = withAuth(handler);

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
