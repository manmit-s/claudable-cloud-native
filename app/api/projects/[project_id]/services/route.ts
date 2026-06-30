import { NextRequest, NextResponse } from 'next/server';
import { listProjectServices } from '@/lib/services/project-services';
import { withAuth, getProjectWithOwnership, AuthError } from '@/lib/middleware/auth';

interface RouteContext {
  params: Promise<{ project_id: string }>;
}

async function getHandler(_request: NextRequest, userId: string, { params }: RouteContext) {
  try {
    const { project_id } = await params;
    await getProjectWithOwnership(project_id, userId);
    const services = await listProjectServices(project_id);
    const payload = services.map((service) => ({
      ...service,
      service_data: service.serviceData,
    }));
    return NextResponse.json(payload);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    console.error('[API] Failed to load project services:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to load project services',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

export const GET = withAuth(getHandler);

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
