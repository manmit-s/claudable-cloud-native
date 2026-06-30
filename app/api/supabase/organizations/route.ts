import { NextRequest, NextResponse } from 'next/server';
import { listSupabaseOrganizations } from '@/lib/services/supabase';
import { withAuth, AuthError } from '@/lib/middleware/auth';

async function getHandler() {
  try {
    const organizations = await listSupabaseOrganizations();
    return NextResponse.json({ success: true, organizations });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    console.error('[API] Failed to list Supabase organizations:', error);
    const status = error instanceof Error && 'status' in error ? (error as any).status ?? 500 : 500;
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch Supabase organizations',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status },
    );
  }
}

export const GET = withAuth(getHandler);

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
