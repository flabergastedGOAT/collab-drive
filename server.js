const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');

const dev = process.env.NODE_ENV !== 'production';
process.env.NODE_ENV = dev ? 'development' : 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  const io = new Server(server, {
    path: '/api/socket',
    addTrailingSlash: false,
  });

  io.on('connection', (socket) => {
    socket.on('join', (spaceId) => {
      if (spaceId) socket.join(`space:${spaceId}`);
    });
    socket.on('leave', (spaceId) => {
      if (spaceId) socket.leave(`space:${spaceId}`);
    });
  });

  global.io = io;

  const port = process.env.PORT || 3000;
  server.listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`);
  });
});
