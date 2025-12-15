import { neon } from '@neondatabase/serverless';

// Create a SQL query function using tagged template literals
// The function will throw at runtime if DATABASE_URL is not set
const sql = neon(process.env.DATABASE_URL || 'postgresql://placeholder:placeholder@placeholder/placeholder');

export { sql };
