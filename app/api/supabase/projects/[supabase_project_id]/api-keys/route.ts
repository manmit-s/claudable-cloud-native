import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseApiKeys } from '@/lib/services/supabase';
import { withAuth, AuthError } from '@/lib/middleware/auth';

interface RouteContext {
  params: Promise<{ supabase_project_id: string }>;
}

async function getHandler(_request: NextRequest, userId: string, { params }: RouteContext) {
  try {
    const { supabase_project_id } = await params;
    const keys = await getSupabaseApiKeys(supabase_project_id);
    return NextResponse.json({ success: true, keys });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    console.error('[API] Failed to fetch Supabase API keys:', error);
    const status = error instanceof Error && 'status' in error ? (error as any).status ?? 500 : 500;
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch Supabase API keys',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status },
    );
  }
}

export const GET = withAuth(getHandler);

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
