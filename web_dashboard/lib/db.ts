import { Pool } from 'pg';

// Pool kết nối logcontentdb
export const contentPool = new Pool({
  host:     process.env.CONTENT_DB_HOST     || 'localhost',
  port:     Number(process.env.CONTENT_DB_PORT) || 5432,
  database: process.env.CONTENT_DB_NAME     || 'logcontentdb',
  user:     process.env.CONTENT_DB_USER     || 'postgres',
  password: process.env.CONTENT_DB_PASSWORD || 'huytit2004',
  max: 5,
  idleTimeoutMillis: 30000,
});

// Pool kết nối logsearchdb
export const searchPool = new Pool({
  host:     process.env.SEARCH_DB_HOST     || 'localhost',
  port:     Number(process.env.SEARCH_DB_PORT) || 5432,
  database: process.env.SEARCH_DB_NAME     || 'logsearchdb',
  user:     process.env.SEARCH_DB_USER     || 'postgres',
  password: process.env.SEARCH_DB_PASSWORD || 'huytit2004',
  max: 5,
  idleTimeoutMillis: 30000,
});
