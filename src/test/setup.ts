// Test setup file
import { beforeAll, afterAll } from 'vitest'

beforeAll(() => {
  // Setup test environment
  // Note: NODE_ENV is read-only in some environments, so we skip setting it
  
  // Set up test environment variables
  process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321'
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'test-anon-key'
  process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key'
  process.env.NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET || 'test-secret'
  process.env.NEXTAUTH_URL = process.env.NEXTAUTH_URL || 'http://localhost:3000'
})

afterAll(() => {
  // Cleanup after tests
})