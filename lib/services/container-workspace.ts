import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';
import { findAvailablePort } from '@/lib/utils/ports';
import { PREVIEW_CONFIG } from '@/lib/config/constants';

const execAsync = promisify(exec);

const lastActivityMap = new Map<string, number>();

export function updateWorkspaceActivity(projectId: string): void {
  lastActivityMap.set(projectId, Date.now());
  console.log(`[ContainerWorkspace] Updated last activity for project ${projectId}`);
}

const PREVIEW_FALLBACK_PORT_START = PREVIEW_CONFIG?.FALLBACK_PORT_START ?? 3100;
const PREVIEW_FALLBACK_PORT_END = PREVIEW_CONFIG?.FALLBACK_PORT_END ?? 3200;
const PREVIEW_MAX_PORT = 65535;

function resolvePreviewBounds(): { start: number; end: number } {
  const envStartRaw = Number.parseInt(process.env.PREVIEW_PORT_START || '', 10);
  const envEndRaw = Number.parseInt(process.env.PREVIEW_PORT_END || '', 10);

  const start = Number.isInteger(envStartRaw)
    ? Math.max(1, envStartRaw)
    : PREVIEW_FALLBACK_PORT_START;

  let end = Number.isInteger(envEndRaw)
    ? Math.min(PREVIEW_MAX_PORT, envEndRaw)
    : PREVIEW_FALLBACK_PORT_END;

  if (end < start) {
    end = Math.min(start + (PREVIEW_FALLBACK_PORT_END - PREVIEW_FALLBACK_PORT_START), PREVIEW_MAX_PORT);
  }

  return { start, end };
}

export async function isWorkspaceRunning(projectId: string): Promise<boolean> {
  try {
    const { stdout } = await execAsync(`docker inspect -f "{{.State.Running}}" claudable-ws-${projectId}`);
    return stdout.trim() === 'true';
  } catch {
    return false;
  }
}

export async function startWorkspace(projectId: string, anthropicApiKey: string): Promise<string> {
  const containerName = `claudable-ws-${projectId}`;
  
  // Check if container already exists
  try {
    const { stdout } = await execAsync(`docker inspect -f "{{.State.Running}}" ${containerName}`);
    if (stdout.trim() === 'true') {
      updateWorkspaceActivity(projectId);
      return containerName;
    }
    // If it exists but is not running, start it
    await execAsync(`docker start ${containerName}`);
    updateWorkspaceActivity(projectId);
    return containerName;
  } catch (err) {
    // Container does not exist, proceed to create it
  }

  const projectsDir = process.env.PROJECTS_DIR || './data/projects';
  const projectsDirAbsolute = path.isAbsolute(projectsDir)
    ? projectsDir
    : path.resolve(process.cwd(), projectsDir);
  const localProjectPath = path.join(projectsDirAbsolute, projectId);

  // Ensure project directory exists locally on the orchestrator filesystem
  await fs.mkdir(localProjectPath, { recursive: true });

  // Resolve the path to pass to the host Docker daemon for sibling bind mounting
  const hostProjectsDir = process.env.HOST_PROJECTS_DIR || projectsDirAbsolute;
  const projectPathOnHost = path.isAbsolute(hostProjectsDir)
    ? path.join(hostProjectsDir, projectId)
    : path.join(path.resolve(process.cwd(), hostProjectsDir), projectId);

  // Allocate an available preview port
  const bounds = resolvePreviewBounds();
  const hostPort = await findAvailablePort(bounds.start, bounds.end);

  const baseUrl = process.env.ANTHROPIC_BASE_URL || '';
  const baseUrlEnv = baseUrl ? `-e ANTHROPIC_BASE_URL="${baseUrl}"` : '';

  // Run the container:
  // - Binds project folder to /workspace
  // - Exposes port 3000 mapped to hostPort
  const cmd = `docker run -d --name ${containerName} -e ANTHROPIC_API_KEY="${anthropicApiKey}" ${baseUrlEnv} -p ${hostPort}:3000 -v "${projectPathOnHost}":/workspace claudable-workspace:latest`;
  console.log(`[ContainerWorkspace] Starting container with command: ${cmd}`);
  await execAsync(cmd);

  updateWorkspaceActivity(projectId);
  return containerName;
}

export async function stopWorkspace(projectId: string): Promise<void> {
  const containerName = `claudable-ws-${projectId}`;
  lastActivityMap.delete(projectId);
  try {
    await execAsync(`docker stop ${containerName}`);
    await execAsync(`docker rm ${containerName}`);
    console.log(`[ContainerWorkspace] Stopped and removed container ${containerName}`);
  } catch (err) {
    console.warn(`[ContainerWorkspace] Failed to stop/remove container ${containerName}:`, err);
  }
}

export async function getWorkspacePort(projectId: string): Promise<number | null> {
  const containerName = `claudable-ws-${projectId}`;
  try {
    const { stdout } = await execAsync(`docker inspect --format="{{(index (index .NetworkSettings.Ports \\"3000/tcp\\") 0).HostPort}}" ${containerName}`);
    const port = parseInt(stdout.trim(), 10);
    return Number.isInteger(port) ? port : null;
  } catch {
    return null;
  }
}

export async function executeInWorkspace(
  projectId: string,
  prompt: string,
  model?: string,
  sessionId?: string,
  maxTokens?: number,
  onEvent?: (event: any) => void
): Promise<void> {
  const containerName = `claudable-ws-${projectId}`;
  
  // Make sure workspace is running
  const running = await isWorkspaceRunning(projectId);
  if (!running) {
    throw new Error(`Workspace container ${containerName} is not running`);
  }

  updateWorkspaceActivity(projectId);

  const args = [
    'exec',
    containerName,
    'node',
    '/runner/runner.js',
    '--prompt', prompt,
    '--dir', '/workspace'
  ];

  if (model) {
    args.push('--model', model);
  }
  if (sessionId) {
    args.push('--session-id', sessionId);
  }
  if (maxTokens) {
    args.push('--max-tokens', String(maxTokens));
  }

  console.log(`[ContainerWorkspace] Executing runner in container ${containerName}`);
  const child = spawn('docker', args);

  let stdoutBuffer = '';
  child.stdout.on('data', (data) => {
    stdoutBuffer += data.toString();
    const lines = stdoutBuffer.split('\n');
    stdoutBuffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const parsed = JSON.parse(trimmed);
        onEvent?.(parsed);
      } catch (err) {
        console.warn('[WorkspaceExec] Failed to parse stdout line:', trimmed, err);
      }
    }
  });

  let stderrBuffer = '';
  child.stderr.on('data', (data) => {
    const str = data.toString();
    stderrBuffer += str;
    console.error(`[WorkspaceExec][stderr] ${str.trim()}`);
  });

  return new Promise((resolve, reject) => {
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Docker exec failed with exit status ${code}. Stderr: ${stderrBuffer}`));
      }
    });
    child.on('error', (err) => {
      reject(err);
    });
  });
}

export async function startPreviewInWorkspace(projectId: string): Promise<void> {
  const containerName = `claudable-ws-${projectId}`;
  // Run Next.js dev server inside container in the background (-d)
  const cmd = `docker exec -d -w /workspace ${containerName} npm run dev -- --port 3000`;
  console.log(`[ContainerWorkspace] Starting dev server: ${cmd}`);
  await execAsync(cmd);
  updateWorkspaceActivity(projectId);
}

export async function stopPreviewInWorkspace(projectId: string): Promise<void> {
  const containerName = `claudable-ws-${projectId}`;
  console.log(`[ContainerWorkspace] Stopping dev server in container ${containerName}`);
  try {
    await execAsync(`docker exec ${containerName} pkill -f "next-dev"`);
  } catch {}
  try {
    await execAsync(`docker exec ${containerName} pkill -f "next"`);
  } catch {}
}

export async function archiveWorkspace(projectId: string): Promise<any> {
  const containerName = `claudable-ws-${projectId}`;
  
  // Make sure workspace is running
  const running = await isWorkspaceRunning(projectId);
  if (!running) {
    throw new Error(`Workspace container ${containerName} is not running`);
  }

  const args = [
    'exec',
    containerName,
    'tar',
    '-cz',
    '-C',
    '/workspace',
    '.'
  ];

  console.log(`[ContainerWorkspace] Archiving workspace in container ${containerName}`);
  const child = spawn('docker', args);
  return child.stdout;
}

export async function initializeActiveContainers(): Promise<void> {
  try {
    const { stdout } = await execAsync(`docker ps --filter "name=claudable-ws-" --format "{{.Names}}"`);
    const names = stdout.split('\n').map(n => n.trim()).filter(Boolean);
    const now = Date.now();
    for (const name of names) {
      const projectId = name.replace('claudable-ws-', '');
      if (projectId && !lastActivityMap.has(projectId)) {
        console.log(`[ContainerWorkspace] Discovered running container: ${name}, registering activity tracking.`);
        lastActivityMap.set(projectId, now);
      }
    }
  } catch (err) {
    console.error('[ContainerWorkspace] Failed to auto-initialize running containers list:', err);
  }
}

// Start container activity auto-discovery
initializeActiveContainers().catch(console.error);

const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_IDLE_TIME_MS = 30 * 60 * 1000;   // 30 minutes

setInterval(async () => {
  console.log('[ContainerWorkspace] Checking for idle container cleanup...');
  const now = Date.now();
  for (const [projectId, lastActive] of lastActivityMap.entries()) {
    if (now - lastActive > MAX_IDLE_TIME_MS) {
      console.log(`[ContainerWorkspace] Container claudable-ws-${projectId} has been idle for > 30 mins. stopping...`);
      lastActivityMap.delete(projectId);
      await stopWorkspace(projectId);
    }
  }
}, CLEANUP_INTERVAL_MS).unref();
