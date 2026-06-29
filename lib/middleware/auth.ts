/**
 * Auth Middleware for API Routes
 * Provides authentication and authorization helpers for Next.js API routes
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest, createSupabaseServerClient } from '@/lib/supabase/client';
import { prisma } from '@/lib/db/client';

export class AuthError extends Error {
  constructor(
    message: string,
    public statusCode: number = 401
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

/**
 * Extract and verify the user from the request
 * Returns the user ID if authenticated, throws AuthError if not
 */
export async function getAuthenticatedUserId(request: NextRequest): Promise<string> {
  const authHeader = request.headers.get('Authorization');
  
  if (!authHeader?.startsWith('Bearer ')) {
    throw new AuthError('Missing or invalid Authorization header', 401);
  }

  const token = authHeader.replace('Bearer ', '');
  
  try {
    const supabase = createSupabaseServerClient();
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      throw new AuthError('Invalid or expired token', 401);
    }

    // Upsert user in our database (sync from Supabase Auth)
    await prisma.user.upsert({
      where: { id: user.id },
      update: { 
        email: user.email!,
        updatedAt: new Date(),
      },
      create: { 
        id: user.id,
        email: user.email!,
      },
    });

    return user.id;
  } catch (error) {
    if (error instanceof AuthError) throw error;
    throw new AuthError('Authentication failed', 401);
  }
}

/**
 * Optional authentication - returns user ID if present, null otherwise
 */
export async function getOptionalUserId(request: NextRequest): Promise<string | null> {
  try {
    return await getAuthenticatedUserId(request);
  } catch {
    return null;
  }
}

/**
 * Middleware wrapper for API route handlers
 * Automatically handles authentication and injects userId
 */
export function withAuth<T extends any[]>(
  handler: (request: NextRequest, userId: string, ...args: T) => Promise<NextResponse>
) {
  return async (request: NextRequest, ...args: T): Promise<NextResponse> => {
    try {
      const userId = await getAuthenticatedUserId(request);
      return await handler(request, userId, ...args);
    } catch (error) {
      if (error instanceof AuthError) {
        return NextResponse.json(
          { error: error.message },
          { status: error.statusCode }
        );
      }
      console.error('Auth middleware error:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  };
}

/**
 * Middleware wrapper for optional authentication
 */
export function withOptionalAuth<T extends any[]>(
  handler: (request: NextRequest, userId: string | null, ...args: T) => Promise<NextResponse>
) {
  return async (request: NextRequest, ...args: T): Promise<NextResponse> => {
    try {
      const userId = await getOptionalUserId(request);
      return await handler(request, userId, ...args);
    } catch (error) {
      console.error('Optional auth middleware error:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  };
}

/**
 * Verify that the user owns the project
 */
export async function verifyProjectOwnership(
  projectId: string,
  userId: string
): Promise<boolean> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { userId: true },
  });

  return project?.userId === userId;
}

/**
 * Get project with ownership verification
 * Throws if project not found or user doesn't own it
 */
export async function getProjectWithOwnership(
  projectId: string,
  userId: string
) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });

  if (!project) {
    throw new AuthError('Project not found', 404);
  }

  if (project.userId !== userId) {
    throw new AuthError('Forbidden: You do not own this project', 403);
  }

  return project;
}