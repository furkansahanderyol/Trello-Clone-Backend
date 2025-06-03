import Redis from 'ioredis';
import { createClient, RedisClientType } from 'redis';

const redis = new Redis({
  host: 'localhost',
  port: 6379,
  password: process.env.REDIS_PASSWORD,
});

export const redisClient: RedisClientType = createClient({
  url: process.env.REDIS_URL,
});

redisClient.on('error', (err) => console.error('Redis error:', err));

redisClient.connect();

export default redis;
