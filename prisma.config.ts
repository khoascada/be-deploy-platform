import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    // ERD generation does not connect to the database, but Prisma 7 still
    // expects a datasource URL to be configured outside schema.prisma.
    url:
      process.env['DATABASE_URL'] ??
      'postgresql://user:pass@localhost:5432/db?schema=public',
  },
});
