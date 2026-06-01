'use strict';

const http = require('http');
const app = require('../../src/app');
const { initSocket } = require('../../src/services/socketService');
const { getIO, clearIO } = require('../../src/utils/getIO');

let server;

const startTestServer = async () => {
  server = http.createServer(app);
  initSocket(server);

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

  const { port } = server.address();
  return {
    app,
    server,
    baseUrl: `http://127.0.0.1:${port}`,
  };
};

const stopTestServer = async () => {
  const io = getIO();
  if (io) {
    await new Promise((resolve) => io.close(resolve));
    clearIO();
  }

  if (server?.listening) {
    await new Promise((resolve) => server.close(resolve));
  }

  server = null;
};

module.exports = {
  startTestServer,
  stopTestServer,
};
