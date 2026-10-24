import { WebSocketServer } from 'ws';
import { Logger } from '@nestjs/common';

export class CollabWsAdapter {
  private readonly wss: WebSocketServer;

  private readonly logger = new Logger(CollabWsAdapter.name);

  constructor() {
    // The first sync of a page is one message with the whole Yjs document (1.2 MB for a
    // 400 KB test page, 0.34 MB with deflate). No context takeover: no zlib state is kept
    // per connection. HTTP_COMPRESSION=false turns it off with the HTTP compression.
    this.wss = new WebSocketServer({
      noServer: true,
      perMessageDeflate:
        process.env.HTTP_COMPRESSION === 'false'
          ? false
          : {
              threshold: 1024,
              zlibDeflateOptions: { level: 3 },
              serverNoContextTakeover: true,
              clientNoContextTakeover: true,
            },
    });
  }

  handleUpgrade(path: string, httpServer: any) {
    httpServer.on('upgrade', (request: any, socket: any, head: any) => {
      try {
        const baseUrl = 'ws://' + request.headers.host + '/';
        const pathname = new URL(request.url, baseUrl).pathname;

        if (pathname === path) {
          this.wss.handleUpgrade(request, socket, head, (ws) => {
            this.wss.emit('connection', ws, request);
          });
        } else if (pathname === '/socket.io/') {
          return;
        } else {
          socket.destroy();
        }
      } catch (err) {
        socket.end('HTTP/1.1 400\r\n' + (err as Error).message);
      }
    });

    return this.wss;
  }

  public close() {
    try {
      this.wss.close();
    } catch (err) {
      this.logger.error('Failed to close WebSocket server', err);
    }
  }

  public destroy() {
    try {
      this.wss.close();
      this.wss.clients.forEach((client) => {
        client.terminate();
      });
    } catch (err) {
      this.logger.error('Failed to destroy WebSocket server', err);
    }
  }
}
