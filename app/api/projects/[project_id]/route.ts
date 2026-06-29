/**
 * Single Project API Routes
 * GET /api/projects/[project_id] - Retrieve project (authenticated)
 * PUT /api/projects/[project_id] - Update project (authenticated)
 * DELETE /api/projects/[project_id] - Delete project (authenticated)
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getProjectById,
  updateProject,
  deleteProject,
} from '@/lib/services/project';
import type { UpdateProjectInput } from '@/types/backend';
import { serializeProject } from '@/lib/serializers/project';
import { withAuth } from '@/lib/middleware/auth';

interface RouteContext {
  params: Promise<{ project_id: string }>;
}

/**
 * GET /api/projects/[project_id]
 * Retrieve specific project
 */
async function getProjectHandler(
  request: NextRequest,
  userId: string,
  { params }: RouteContext
) {
  try {
    const { project_id } = await params;
    const project = await getProjectById(project_id, userId);

    if (!project) {
      return NextResponse.json(
        { success: false, error: 'Project not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: serializeProject(project) });
  } catch (error) {
    console.error('[API] Failed to get project:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch project',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/projects/[project_id]
 * Update project
 */
async function updateProjectHandler(
  request: NextRequest,
  userId: string,
  { params }: RouteContext
) {
  try {
    const { project_id } = await params;
    const body = await request.json();

    const input: UpdateProjectInput = {
      name: body.name,
      description: body.description,
      status: body.status,
      previewUrl: body.previewUrl,
      previewPort: body.previewPort,
      preferredCli: body.preferredCli,
      selectedModel: body.selectedModel,
      settings: body.settings,
    };

    const project = await updateProject(project_id, input, userId);
    return NextResponse.json({ success: true, data: serializeProject(project) });
  } catch (error) {
    console.error('[API] Failed to update project:', error);

    // Distinguish between different error types
    if (error instanceof Error) {
      if (error.message.includes('not found') || error.message.includes('access denied')) {
        return NextResponse.json(
          { success: false, error: 'Project not found' },
          { status: 404 }
        );
      }
      if (error.message.includes('Forbidden')) {
        return NextResponse.json(
          { success: false, error: 'Forbidden: You do not own this project' },
          { status: 403 }
        );
      }
      if (error.message.includes('validation') || error.message.includes('invalid')) {
        return NextResponse.json(
          { success: false, error: 'Invalid input', message: error.message },
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update project',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/projects/[project_id]
 * Delete project
 */
async function deleteProjectHandler(
  request: NextRequest,
  userId: string,
  { params }: RouteContext
) {
  try {
    const { project_id } = await params;
    await deleteProject(project_id, userId);

    return NextResponse.json({
      success: true,
      message: 'Project deleted successfully',
    });
  } catch (error) {
    console.error('[API] Failed to delete project:', error);
    if (error instanceof Error && (error.message.includes('not found') || error.message.includes('access denied'))) {
      return NextResponse.json(
        { success: false, error: 'Project not found' },
        { status: 404 }
      );
    }
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete project',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export const GET = withAuth(getProjectHandler);
export const PUT = withAuth(updateProjectHandler);
export const DELETE = withAuth(deleteProjectHandler);

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
