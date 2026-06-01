'use strict';

const http = require('http');
const app = require('../../src/app');
const { initSocket } = require('../../src/services/socketService');
const { getIO, clearIO } = require('../../src/utils/getIO');

let server;
const servers = new Set();
const ios = new Map();

const startTestServer = async () => {
  const nextServer = http.createServer(app);
  const io = await initSocket(nextServer);

  await new Promise((resolve) => nextServer.listen(0, '127.0.0.1', resolve));

  server = nextServer;
  servers.add(nextServer);
  ios.set(nextServer, io);

  const { port } = nextServer.address();
  return {
    app,
    server: nextServer,
    baseUrl: `http://127.0.0.1:${port}`,
  };
};

const stopTestServer = async (targetServer = server) => {
  if (!targetServer) return;

  const io = ios.get(targetServer);
  if (io) {
    await new Promise((resolve) => io.close(resolve));
    if (getIO() === io) clearIO();
  }

  if (targetServer?.listening) {
    await new Promise((resolve) => targetServer.close(resolve));
  }

  ios.delete(targetServer);
  servers.delete(targetServer);
  server = [...servers].at(-1) || null;
};

module.exports = {
  startTestServer,
  stopTestServer,
};
