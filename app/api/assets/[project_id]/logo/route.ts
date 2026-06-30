import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { withAuth, getProjectWithOwnership, AuthError } from '@/lib/middleware/auth';

interface RouteContext {
  params: Promise<{ project_id: string }>;
}

const PROJECTS_DIR = process.env.PROJECTS_DIR || './data/projects';
const PROJECTS_DIR_ABSOLUTE = path.isAbsolute(PROJECTS_DIR)
  ? PROJECTS_DIR
  : path.resolve(process.cwd(), PROJECTS_DIR);

async function postHandler(request: NextRequest, userId: string, { params }: RouteContext) {
  try {
    const { project_id } = await params;
    await getProjectWithOwnership(project_id, userId);

    const body = await request.json();
    const b64 = typeof body?.b64_png === 'string' ? body.b64_png : null;
    if (!b64) {
      return NextResponse.json({ success: false, error: 'b64_png is required' }, { status: 400 });
    }

    const buffer = Buffer.from(b64, 'base64');
    const assetsPath = path.join(PROJECTS_DIR_ABSOLUTE, project_id, 'assets');
    await fs.mkdir(assetsPath, { recursive: true });
    const logoPath = path.join(assetsPath, 'logo.png');
    await fs.writeFile(logoPath, buffer);

    return NextResponse.json({ success: true, path: 'assets/logo.png' });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    console.error('[Assets Logo] Failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to save logo',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

export const POST = withAuth(postHandler);

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
