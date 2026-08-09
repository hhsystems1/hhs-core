import { Pool } from 'pg';

// Using a global variable to prevent multiple pool creations during Next.js Hot Module Replacement (HMR)
const globalForPg = global as unknown as { pool: Pool };

export const pool = globalForPg.pool || new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

if (process.env.NODE_ENV !== 'production') globalForPg.pool = pool;

export default pool;
