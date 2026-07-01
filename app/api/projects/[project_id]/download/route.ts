import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthError, getProjectWithOwnership } from '@/lib/middleware/auth';
import { isWorkspaceRunning, startWorkspace, archiveWorkspace } from '@/lib/services/container-workspace';
import { uploadProjectArchive, getDownloadUrl } from '@/lib/services/storage';
import { prisma } from '@/lib/db/client';
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';

interface RouteContext {
  params: Promise<{ project_id: string }>;
}

async function getHandler(
  request: NextRequest,
  userId: string,
  { params }: RouteContext
) {
  let tempPath = '';
  try {
    const { project_id } = await params;

    // 1. Verify project ownership
    const project = await getProjectWithOwnership(project_id, userId);

    // 2. Ensure container is running
    const running = await isWorkspaceRunning(project_id);
    if (!running) {
      console.log(`[Download] Container claudable-ws-${project_id} is not running. Starting it...`);
      const apiKey = process.env.ANTHROPIC_API_KEY || '';
      await startWorkspace(project_id, apiKey);
    }

    // 3. Setup temporary file path on host
    const projectsDir = process.env.PROJECTS_DIR || './data/projects';
    const projectsDirAbsolute = path.isAbsolute(projectsDir)
      ? projectsDir
      : path.resolve(process.cwd(), projectsDir);
    
    // Ensure data/projects exists
    await fsp.mkdir(projectsDirAbsolute, { recursive: true });

    const archiveName = `${project.name.replace(/[^a-zA-Z0-9_-]/g, '_')}_${Date.now()}.tar.gz`;
    tempPath = path.join(projectsDirAbsolute, `temp_${project_id}_${Date.now()}.tar.gz`);

    // 4. Archive container workspace filesystem to temporary file
    console.log(`[Download] Archiving workspace to temporary file: ${tempPath}`);
    const tarStream = await archiveWorkspace(project_id);
    const writeStream = fs.createWriteStream(tempPath);

    await pipeline(tarStream, writeStream);

    // Get archive size in bytes
    const stats = await fsp.stat(tempPath);
    const sizeBytes = stats.size;

    // 5. Upload to Supabase Storage
    console.log(`[Download] Uploading archive of size ${sizeBytes} bytes to Supabase Storage...`);
    const uploadStream = fs.createReadStream(tempPath);
    const storagePath = await uploadProjectArchive(project_id, uploadStream, archiveName);

    // 6. Record metadata in ProjectFile table
    console.log(`[Download] Recording ProjectFile metadata in database...`);
    await prisma.projectFile.create({
      data: {
        projectId: project_id,
        userId: userId,
        storagePath: storagePath,
        fileName: archiveName,
        mimeType: 'application/gzip',
        sizeBytes: sizeBytes,
        archiveType: 'snapshot',
      },
    });

    // 7. Get signed download URL
    const signedUrl = await getDownloadUrl(storagePath);

    // 8. Stream the file directly in response
    const responseStream = fs.createReadStream(tempPath);
    const webStream = Readable.toWeb(responseStream);

    // Clean up temporary file after sending response
    responseStream.on('close', () => {
      fsp.unlink(tempPath).catch((err) => {
        console.warn(`[Download] Failed to delete temp file ${tempPath}:`, err);
      });
    });

    return new Response(webStream as any, {
      headers: {
        'Content-Type': 'application/gzip',
        'Content-Disposition': `attachment; filename="${archiveName}"`,
        'X-Signed-Download-Url': signedUrl, // Include the signed URL in header just in case
      },
    });
  } catch (error) {
    if (tempPath) {
      fsp.unlink(tempPath).catch(() => {});
    }

    if (error instanceof AuthError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    console.error('[API] Failed to download project archive:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to download project archive',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export const GET = withAuth(getHandler);
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
