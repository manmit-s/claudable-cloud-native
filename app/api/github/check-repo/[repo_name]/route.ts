import { NextResponse } from 'next/server';
import { checkRepositoryAvailability } from '@/lib/services/github';
import { withAuth } from '@/lib/middleware/auth';

interface RouteContext {
  params: Promise<{ repo_name: string }>;
}

async function handler(_request: Request, _userId: string, { params }: RouteContext) {
  try {
    const { repo_name } = await params;
    const result = await checkRepositoryAvailability(repo_name);
    if (result.exists) {
      return NextResponse.json({ available: false, username: result.username }, { status: 409 });
    }
    return NextResponse.json({ available: true, username: result.username });
  } catch (error) {
    console.error('[API] Failed to check repository availability:', error);
    const status = error instanceof Error && 'status' in error ? (error as any).status ?? 500 : 500;
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to check repository availability',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status },
    );
  }
}

export const GET = withAuth(handler);

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
