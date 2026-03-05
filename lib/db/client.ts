import { neon } from '@neondatabase/serverless'

// Neon serverless PostgreSQL client
// Uses DATABASE_URL environment variable
export const sql = neon(process.env.DATABASE_URL!)
