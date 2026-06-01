'use strict';

const { createClient } = require('redis');
const IORedis = require('ioredis');
const logger = require('./logger');

let redisClient = null;
const managedClients = new Set();

const getRedisUrl = () => process.env.REDIS_URL;

const reconnectStrategy = (retries) => {
  const delay = Math.min(100 + retries * 100, 3000);
  logger.warn({ retries, delay }, 'Redis reconnect scheduled');
  return delay;
};

const buildRedisClient = () => {
  const url = getRedisUrl();
  if (!url) {
    throw new Error('REDIS_URL is required for Redis-backed infrastructure.');
  }

  const client = createClient({
    url,
    socket: {
      reconnectStrategy,
    },
  });

  client.on('error', (error) => {
    logger.error({ err: error }, 'Redis client error');
  });

  client.on('connect', () => {
    logger.info('Redis client connected');
  });

  client.on('ready', () => {
    logger.info('Redis client ready');
  });

  client.on('end', () => {
    logger.warn('Redis client disconnected');
  });

  return client;
};

const getRedisClient = () => {
  if (!redisClient) {
    redisClient = buildRedisClient();
  }

  return redisClient;
};

const connectRedis = async () => {
  const client = getRedisClient();
  if (!client.isOpen) {
    await client.connect();
  }

  await client.ping();
  return client;
};

const createRedisDuplicate = async () => {
  const duplicate = getRedisClient().duplicate();
  managedClients.add(duplicate);

  duplicate.on('error', (error) => {
    logger.error({ err: error }, 'Redis duplicate client error');
  });

  await duplicate.connect();
  return duplicate;
};

const createIORedisConnection = () => {
  const url = getRedisUrl();
  if (!url) {
    throw new Error('REDIS_URL is required for BullMQ connections.');
  }

  const connection = new IORedis(url, {
    enableReadyCheck: true,
    maxRetriesPerRequest: null,
    retryStrategy(times) {
      const delay = Math.min(100 + times * 100, 3000);
      logger.warn({ retries: times, delay }, 'BullMQ Redis reconnect scheduled');
      return delay;
    },
  });

  connection.on('error', (error) => {
    logger.error({ err: error }, 'BullMQ Redis connection error');
  });

  managedClients.add(connection);
  return connection;
};

const getRedisReadiness = async () => {
  try {
    const client = getRedisClient();
    if (!client.isOpen) {
      return {
        ready: false,
        state: 'closed',
        urlConfigured: Boolean(getRedisUrl()),
      };
    }

    const pong = await client.ping();
    return {
      ready: pong === 'PONG',
      state: client.isReady ? 'ready' : 'open',
      urlConfigured: Boolean(getRedisUrl()),
    };
  } catch (error) {
    return {
      ready: false,
      state: 'error',
      urlConfigured: Boolean(getRedisUrl()),
      error: error.message,
    };
  }
};

const disconnectRedis = async () => {
  const closeTasks = [];

  for (const client of managedClients) {
    closeTasks.push(
      Promise.resolve()
        .then(async () => {
          if (typeof client.quit === 'function') {
            await client.quit();
          } else if (typeof client.disconnect === 'function') {
            client.disconnect();
          }
        })
        .catch((error) => {
          logger.warn({ err: error }, 'Redis managed client shutdown failed');
        })
    );
  }
  managedClients.clear();

  if (redisClient?.isOpen) {
    closeTasks.push(
      redisClient.quit().catch((error) => {
        logger.warn({ err: error }, 'Redis singleton shutdown failed');
      })
    );
  }

  await Promise.all(closeTasks);
  redisClient = null;
};

module.exports = {
  connectRedis,
  createIORedisConnection,
  createRedisDuplicate,
  disconnectRedis,
  getRedisClient,
  getRedisReadiness,
};
