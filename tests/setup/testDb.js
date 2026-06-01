'use strict';

const fs = require('fs');
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');

let replSet;

const getMongoBinaryOptions = () => {
  const systemBinary = '/opt/homebrew/bin/mongod';
  if (fs.existsSync(systemBinary)) {
    return { systemBinary, version: '8.2.7' };
  }

  return {};
};

const connectTestDb = async () => {
  replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1 },
    binary: getMongoBinaryOptions(),
  });

  const uri = replSet.getUri('freightflow_test');
  process.env.MONGODB_URI = uri;

  await mongoose.connect(uri);
  await Promise.all(
    Object.values(mongoose.connection.models).map((model) => model.syncIndexes())
  );
};

const clearTestDb = async () => {
  const collections = await mongoose.connection.db.collections();
  await Promise.all(collections.map((collection) => collection.deleteMany({})));
};

const disconnectTestDb = async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }

  if (replSet) {
    await replSet.stop();
    replSet = null;
  }
};

module.exports = {
  clearTestDb,
  connectTestDb,
  disconnectTestDb,
};
