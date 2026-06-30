import type { NextApiRequest, NextApiResponse } from 'next';
import { WebSocketServer, type WebSocket } from 'ws';
import type { IncomingMessage, Server as HTTPServer } from 'http';
import type { Socket } from 'net';
import { ensureHeartbeat, websocketManager } from '@/lib/server/websocket-manager';
import { createSupabaseServerClientWithToken } from '@/lib/supabase/server';
import { verifyProjectOwnership } from '@/lib/middleware/auth';
import { prisma } from '@/lib/db/client';

type NextApiResponseWithSocket = NextApiResponse & {
  socket: Socket & {
    server: HTTPServer & {
      wss?: WebSocketServer;
      __ws_initialized__?: boolean;
    };
  };
};

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponseWithSocket) {
  // If the browser initiates the WebSocket handshake it sends an Upgrade request.
  // The actual upgrade is handled in the server.on('upgrade') listener,
  // so we must not attempt to write a normal HTTP response here.
  const isWebsocketUpgrade = req.headers.upgrade?.toLowerCase() === 'websocket';

  // For warm-up requests, verify authentication
  if (!isWebsocketUpgrade) {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Missing or invalid Authorization header' });
        return;
      }

      const token = authHeader.replace('Bearer ', '');
      const supabase = createSupabaseServerClientWithToken(token);
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (error || !user) {
        res.status(401).json({ error: 'Invalid or expired token' });
        return;
      }

      // Check project ownership if projectId is provided in query
      const projectId = req.query.projectId;
      if (typeof projectId === 'string') {
        const isOwner = await verifyProjectOwnership(projectId, user.id);
        if (!isOwner) {
          res.status(403).json({ error: 'Forbidden: You do not own this project' });
          return;
        }
      }
    } catch (err) {
      console.error('WS Warmup authentication error:', err);
      res.status(500).json({ error: 'Authentication check failed' });
      return;
    }
  }

  // Initialize a shared WebSocket server on the underlying HTTP server once.
  const baseSocket = res.socket as any;
  if (!baseSocket?.server) {
    res.status(500).send('Socket server unavailable');
    return;
  }

  const server = baseSocket.server as typeof baseSocket.server & {
    wss?: WebSocketServer;
    __ws_initialized__?: boolean;
  };

  if (!server.__ws_initialized__) {
    const wss = new WebSocketServer({ noServer: true });

    const handleConnection = (websocket: WebSocket, request: IncomingMessage) => {
      const requestUrl = new URL(request.url ?? '', 'http://localhost');
      const segment = requestUrl.pathname.split('/').filter(Boolean).pop();
      const rawProjectId = segment ? decodeURIComponent(segment.split('?')[0]) : null;

      if (!rawProjectId) {
        websocket.close(1008, 'Project ID required');
        return;
      }

      const connectionToken = requestUrl.searchParams.get('token') || request.headers.authorization?.replace('Bearer ', '');
      if (!connectionToken) {
        console.warn(`[WS] Connection rejected: No auth token for project ${rawProjectId}`);
        websocket.close(4001, 'Unauthorized: Token required');
        return;
      }

      (async () => {
        try {
          const supabase = createSupabaseServerClientWithToken(connectionToken);
          const { data: { user }, error } = await supabase.auth.getUser(connectionToken);
          if (error || !user) {
            console.warn(`[WS] Connection rejected: Invalid auth token for project ${rawProjectId}`);
            websocket.close(4001, 'Unauthorized: Invalid token');
            return;
          }

          const project = await prisma.project.findUnique({
            where: { id: rawProjectId },
            select: { userId: true },
          });

          if (!project) {
            console.warn(`[WS] Connection rejected: Project ${rawProjectId} not found`);
            websocket.close(4004, 'Project not found');
            return;
          }

          if (project.userId !== user.id) {
            console.warn(`[WS] Connection rejected: User ${user.id} does not own project ${rawProjectId}`);
            websocket.close(4003, 'Forbidden: You do not own this project');
            return;
          }

          console.log(`[WS] Connection authorized: User ${user.id} for project ${rawProjectId}`);
          websocketManager.addConnection(rawProjectId, websocket as any);
        } catch (err) {
          console.error('[WS] Auth error during connection handler:', err);
          websocket.close(1011, 'Internal auth error');
        }
      })();
    };

    wss.on('connection', handleConnection);

    // Attach a single upgrade listener to the HTTP server
    server.on('upgrade', (request: IncomingMessage, socket: Socket, head: Buffer) => {
      try {
        const upgradeUrl = new URL(request.url ?? '', 'http://localhost');

        // Only handle our WS endpoint: /api/ws/<projectId>
        if (!upgradeUrl.pathname.startsWith('/api/ws/')) {
          return; // Let Next.js handle other upgrades (HMR, etc.)
        }

        wss.handleUpgrade(request, socket, head, (websocket: WebSocket) => {
          wss.emit('connection', websocket, request);
        });
      } catch {
        try {
          socket.destroy();
        } catch {
          // Ignore socket destroy failures
        }
      }
    });

    server.wss = wss;
    server.__ws_initialized__ = true;
    ensureHeartbeat();
  }

  // When the browser initiates the WebSocket handshake it sends an Upgrade request.
  // The actual upgrade is handled in the server.on('upgrade') listener above,
  // so we must not attempt to write a normal HTTP response here.
  if (req.headers.upgrade?.toLowerCase() === 'websocket') {
    return;
  }

  // This API route is only used to ensure the server is initialized.
  // Respond with a simple 200 so the client knows the endpoint exists.
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.status(200).json({ ok: true });
}
