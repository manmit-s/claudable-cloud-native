import { NextRequest, NextResponse } from 'next/server';
import { deleteProjectService } from '@/lib/services/project-services';
import { withAuth, getProjectWithOwnership, AuthError } from '@/lib/middleware/auth';
import { prisma } from '@/lib/db/client';

interface RouteContext {
  params: Promise<{ project_id: string; service_id: string }>;
}

async function deleteHandler(_request: NextRequest, userId: string, { params }: RouteContext) {
  try {
    const { project_id, service_id } = await params;
    await getProjectWithOwnership(project_id, userId);

    // Verify service connection belongs to this project
    const connection = await prisma.projectServiceConnection.findUnique({
      where: { id: service_id },
      select: { projectId: true },
    });
    if (!connection || connection.projectId !== project_id) {
      return NextResponse.json({ success: false, error: 'Service not found' }, { status: 404 });
    }

    const deleted = await deleteProjectService(service_id);
    if (!deleted) {
      return NextResponse.json({ success: false, error: 'Service not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Service disconnected' });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    console.error('[API] Failed to delete project service:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete project service',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

export const DELETE = withAuth(deleteHandler);

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
