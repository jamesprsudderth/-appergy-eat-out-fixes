/*
 * Shared Schema
 *
 * Canonical data types shared between client and server.
 * Will be expanded with Drizzle ORM schemas for PostgreSQL.
 */

export interface User {
  id: string;
  username: string;
  email?: string;
  createdAt?: string;
}

export interface InsertUser {
  username: string;
  email?: string;
}
