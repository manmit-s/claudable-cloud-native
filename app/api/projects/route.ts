/**
 * Projects API Routes
 * GET /api/projects - Get all projects (authenticated)
 * POST /api/projects - Create new project (authenticated)
 */

import { NextRequest } from 'next/server';
import { getAllProjects, createProject } from '@/lib/services/project';
import type { CreateProjectInput } from '@/types/backend';
import { serializeProjects, serializeProject } from '@/lib/serializers/project';
import { getDefaultModelForCli, normalizeModelId } from '@/lib/constants/cliModels';
import { createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/utils/api-response';
import { withAuth } from '@/lib/middleware/auth';

/**
 * GET /api/projects
 * Get all projects list for authenticated user
 */
async function getProjectsHandler(request: NextRequest, userId: string) {
  try {
    const projects = await getAllProjects(userId);
    return createSuccessResponse(serializeProjects(projects));
  } catch (error) {
    return handleApiError(error, 'API', 'Failed to fetch projects');
  }
}

/**
 * POST /api/projects
 * Create new project for authenticated user
 */
async function createProjectHandler(request: NextRequest, userId: string) {
  try {
    const body = await request.json();
    const preferredCli = String(body.preferredCli || body.preferred_cli || 'claude').toLowerCase();
    const requestedModel = body.selectedModel || body.selected_model;

    const input: CreateProjectInput = {
      project_id: body.project_id,
      name: body.name,
      initialPrompt: body.initialPrompt || body.initial_prompt,
      preferredCli,
      selectedModel: normalizeModelId(preferredCli, requestedModel ?? getDefaultModelForCli(preferredCli)),
      description: body.description,
    };

    // Validation
    if (!input.project_id || !input.name) {
      return createErrorResponse('project_id and name are required', undefined, 400);
    }

    const project = await createProject(input, userId);
    return createSuccessResponse(serializeProject(project), 201);
  } catch (error) {
    return handleApiError(error, 'API', 'Failed to create project');
  }
}

export const GET = withAuth(getProjectsHandler);
export const POST = withAuth(createProjectHandler);

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
