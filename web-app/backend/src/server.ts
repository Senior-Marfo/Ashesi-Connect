import 'dotenv/config';
import mongoose from 'mongoose';
import { loadConfig } from './config.js';
import { createApp } from './http/app.js';
import { createMongoRepositories } from './repositories/mongo.js';

async function start(): Promise<void> {
  const config = loadConfig();
  if (!config.mongodbUri) throw new Error('MONGODB_URI is required');
  await mongoose.connect(config.mongodbUri);

  const app = createApp({
    config,
    repositories: createMongoRepositories(),
    isHealthy: () => mongoose.connection.readyState === 1
  });
  const server = app.listen(config.port, () => {
    console.log(JSON.stringify({ level: 'info', message: 'API listening', port: config.port }));
  });

  const shutdown = () => {
    server.close(() => { void mongoose.disconnect().then(() => process.exit(0)); });
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

start().catch(error => {
  console.error(error);
  process.exit(1);
});
