import { PrismaClient } from '@prisma/client';
import logger from 'pino';

const pino = logger();

const prisma = new PrismaClient({
  log: [
    {
      emit: 'event',
      level: 'query',
    },
    {
      emit: 'stdout',
      level: 'error',
    },
  ],
});

prisma.$on('query', (e: any) => {
  pino.debug(`Query: ${e.query} [${e.duration}ms]`);
});

export default prisma;
