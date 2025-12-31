import { describe, it, expect, afterEach, vi } from "vitest";
import * as fc from "fast-check";

// Feature: premier-league-prediction-game, Property 1: User Authentication and Profile Management
// **Validates: Requirements 1.2, 1.3, 1.4, 1.5**

// Mock environment variables first
vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co');
vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'test-anon-key');
vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role-key');

// Mock the Supabase module before importing anything else
vi.mock("@supabase/supabase-js", () => {
  const mockSupabaseClient = {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(),
        })),
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(),
          })),
        })),
      })),
      delete: vi.fn(() => ({
        in: vi.fn(),
      })),
    })),
  };

  return {
    createClient: vi.fn(() => mockSupabaseClient),
  };
});

// Mock the Supabase configuration module
vi.mock("@/lib/supabase", () => {
  const mockSupabaseClient = {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(),
        })),
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(),
          })),
        })),
      })),
      delete: vi.fn(() => ({
        in: vi.fn(),
      })),
    })),
  };

  return {
    supabase: mockSupabaseClient,
    createServerClient: vi.fn(() => mockSupabaseClient),
  };
});

// Import after mocking
import { 
  createUserProfile, 
  getUserProfileByEmail, 
  getUserProfileById,
  updateUserProfile,
  getOrCreateUserProfile 
} from "@/lib/user";
import { createClient } from "@supabase/supabase-js";

// Get the mocked client
const mockSupabaseClient = createClient("mock-url", "mock-key");

// Test data cleanup
const testEmails: string[] = [];

afterEach(async () => {
  // Reset mocks
  vi.clearAllMocks();
  testEmails.length = 0;
});

// Generators for property-based testing
const emailArbitrary = fc.emailAddress();
const nameArbitrary = fc.string({ minLength: 1, maxLength: 100 });
const avatarUrlArbitrary = fc.oneof(
  fc.constant(undefined),
  fc.webUrl()
);

const userDataArbitrary = fc.record({
  email: emailArbitrary,
  name: nameArbitrary,
  avatar_url: avatarUrlArbitrary,
});

// Mock user data generator
const mockUserArbitrary = fc.record({
  id: fc.uuid(),
  email: emailArbitrary,
  name: nameArbitrary,
  avatar_url: avatarUrlArbitrary,
  total_points: fc.constant(0),
  created_at: fc.date().map(d => d.toISOString()),
  updated_at: fc.date().map(d => d.toISOString()),
});

describe("User Authentication and Profile Management Properties", () => {
  describe("Property 1: User Authentication and Profile Management", () => {
    it("should create user profile with all required fields and zero points", async () => {
      await fc.assert(
        fc.asyncProperty(userDataArbitrary, mockUserArbitrary, async (userData, mockUser) => {
          testEmails.push(userData.email);

          // Mock successful user creation
          const mockInsertResponse = {
            data: { ...mockUser, ...userData, total_points: 0 },
            error: null,
          };

          // Setup mock chain
          const mockSingle = vi.fn().mockResolvedValueOnce(mockInsertResponse);
          const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
          const mockInsert = vi.fn().mockReturnValue({ select: mockSelect });
          const mockFrom = vi.fn().mockReturnValue({ insert: mockInsert });
          
          mockSupabaseClient.from = mockFrom;

          // Test user creation (Requirements 1.2, 1.3)
          const { user: createdUser, error: createError } = await createUserProfile(userData);
          
          expect(createError).toBeNull();
          expect(createdUser).not.toBeNull();
          expect(createdUser!.email).toBe(userData.email);
          expect(createdUser!.name).toBe(userData.name);
          expect(createdUser!.avatar_url).toBe(userData.avatar_url);
          expect(createdUser!.total_points).toBe(0); // Requirement 1.3: Initialize with zero points
          expect(createdUser!.id).toBeDefined();
          expect(createdUser!.created_at).toBeDefined();
          expect(createdUser!.updated_at).toBeDefined();

          // Verify the insert was called with correct data
          expect(mockFrom).toHaveBeenCalledWith("users");
          expect(mockInsert).toHaveBeenCalledWith({
            email: userData.email,
            name: userData.name,
            avatar_url: userData.avatar_url || null,
            total_points: 0,
          });
        }),
        { numRuns: 20 } // Reduced runs for faster testing
      );
    });

    it("should retrieve user profile by email correctly", async () => {
      await fc.assert(
        fc.asyncProperty(userDataArbitrary, mockUserArbitrary, async (userData, mockUser) => {
          testEmails.push(userData.email);

          // Mock successful user retrieval
          const mockSelectResponse = {
            data: { ...mockUser, ...userData },
            error: null,
          };

          // Setup mock chain
          const mockSingle = vi.fn().mockResolvedValueOnce(mockSelectResponse);
          const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
          const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
          const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });
          
          mockSupabaseClient.from = mockFrom;

          // Test user retrieval by email (Requirement 1.4: Store user information)
          const { user: retrievedByEmail, error: emailError } = await getUserProfileByEmail(userData.email);
          
          expect(emailError).toBeNull();
          expect(retrievedByEmail).not.toBeNull();
          expect(retrievedByEmail!.email).toBe(userData.email);
          expect(retrievedByEmail!.name).toBe(userData.name);

          // Verify the select was called with correct parameters
          expect(mockFrom).toHaveBeenCalledWith("users");
          expect(mockEq).toHaveBeenCalledWith("email", userData.email);
        }),
        { numRuns: 20 }
      );
    });

    it("should handle user profile updates correctly", async () => {
      await fc.assert(
        fc.asyncProperty(
          mockUserArbitrary,
          nameArbitrary,
          avatarUrlArbitrary,
          async (existingUser, newName, newAvatarUrl) => {
            testEmails.push(existingUser.email);

            // Mock successful user update
            const updatedUser = {
              ...existingUser,
              name: newName,
              avatar_url: newAvatarUrl,
              updated_at: new Date().toISOString(),
            };

            const mockUpdateResponse = {
              data: updatedUser,
              error: null,
            };

            // Setup mock chain
            const mockSingle = vi.fn().mockResolvedValueOnce(mockUpdateResponse);
            const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
            const mockEq = vi.fn().mockReturnValue({ select: mockSelect });
            const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
            const mockFrom = vi.fn().mockReturnValue({ update: mockUpdate });
            
            mockSupabaseClient.from = mockFrom;

            // Update user profile
            const { user: updatedUserResult, error: updateError } = await updateUserProfile(
              existingUser.id,
              {
                name: newName,
                avatar_url: newAvatarUrl,
              }
            );

            expect(updateError).toBeNull();
            expect(updatedUserResult).not.toBeNull();
            expect(updatedUserResult!.id).toBe(existingUser.id);
            expect(updatedUserResult!.email).toBe(existingUser.email); // Email should not change
            expect(updatedUserResult!.name).toBe(newName);
            expect(updatedUserResult!.avatar_url).toBe(newAvatarUrl);
            expect(updatedUserResult!.total_points).toBe(existingUser.total_points); // Points should remain unchanged

            // Verify the update was called with correct parameters
            expect(mockFrom).toHaveBeenCalledWith("users");
            expect(mockEq).toHaveBeenCalledWith("id", existingUser.id);
          }
        ),
        { numRuns: 20 }
      );
    });

    it("should handle getOrCreateUserProfile for new users correctly", async () => {
      await fc.assert(
        fc.asyncProperty(userDataArbitrary, mockUserArbitrary, async (userData, mockUser) => {
          testEmails.push(userData.email);

          // Mock user not found (new user scenario) followed by successful creation
          const mockNotFoundResponse = {
            data: null,
            error: { code: "PGRST116" }, // Not found error
          };

          const mockCreateResponse = {
            data: { ...mockUser, ...userData, total_points: 0 },
            error: null,
          };

          // Setup mock chain for getUserProfileByEmail (not found)
          const mockSingleSelect = vi.fn().mockResolvedValueOnce(mockNotFoundResponse);
          const mockEqSelect = vi.fn().mockReturnValue({ single: mockSingleSelect });
          const mockSelectChain = vi.fn().mockReturnValue({ eq: mockEqSelect });

          // Setup mock chain for createUserProfile (success)
          const mockSingleInsert = vi.fn().mockResolvedValueOnce(mockCreateResponse);
          const mockSelectInsert = vi.fn().mockReturnValue({ single: mockSingleInsert });
          const mockInsert = vi.fn().mockReturnValue({ select: mockSelectInsert });

          const mockFrom = vi.fn()
            .mockReturnValueOnce({ select: mockSelectChain }) // First call for getUserProfileByEmail
            .mockReturnValueOnce({ insert: mockInsert }); // Second call for createUserProfile
            
          mockSupabaseClient.from = mockFrom;

          // Test with new user (should create)
          const { user: newUser, error: newError, isNewUser } = await getOrCreateUserProfile(userData);
          
          expect(newError).toBeNull();
          expect(newUser).not.toBeNull();
          expect(isNewUser).toBe(true); // Should be new user
          expect(newUser!.email).toBe(userData.email);
          expect(newUser!.name).toBe(userData.name);
          expect(newUser!.avatar_url).toBe(userData.avatar_url);
          expect(newUser!.total_points).toBe(0); // Requirement 1.3: Initialize with zero points
        }),
        { numRuns: 20 }
      );
    });

    it("should maintain data consistency properties", async () => {
      await fc.assert(
        fc.asyncProperty(userDataArbitrary, mockUserArbitrary, async (userData, mockUser) => {
          testEmails.push(userData.email);

          const consistentUser = { ...mockUser, ...userData, total_points: 0 };

          // Mock all operations to return consistent data
          const mockResponse = { data: consistentUser, error: null };

          // Setup mocks for all three operations
          const mockSingle1 = vi.fn().mockResolvedValueOnce(mockResponse);
          const mockSelect1 = vi.fn().mockReturnValue({ single: mockSingle1 });
          const mockInsert = vi.fn().mockReturnValue({ select: mockSelect1 });

          const mockSingle2 = vi.fn().mockResolvedValueOnce(mockResponse);
          const mockEq2 = vi.fn().mockReturnValue({ single: mockSingle2 });
          const mockSelect2 = vi.fn().mockReturnValue({ eq: mockEq2 });

          const mockSingle3 = vi.fn().mockResolvedValueOnce(mockResponse);
          const mockEq3 = vi.fn().mockReturnValue({ single: mockSingle3 });
          const mockSelect3 = vi.fn().mockReturnValue({ eq: mockEq3 });

          const mockFrom = vi.fn()
            .mockReturnValueOnce({ insert: mockInsert }) // createUserProfile
            .mockReturnValueOnce({ select: mockSelect2 }) // getUserProfileByEmail
            .mockReturnValueOnce({ select: mockSelect3 }); // getUserProfileById
            
          mockSupabaseClient.from = mockFrom;

          // Create user
          const { user: user1 } = await createUserProfile(userData);
          expect(user1).not.toBeNull();

          // Retrieve by email
          const { user: user2 } = await getUserProfileByEmail(userData.email);
          expect(user2).not.toBeNull();

          // Retrieve by ID
          const { user: user3 } = await getUserProfileById(user1!.id);
          expect(user3).not.toBeNull();

          // All should have consistent data
          expect(user1!.email).toBe(userData.email);
          expect(user2!.email).toBe(userData.email);
          expect(user3!.email).toBe(userData.email);
          expect(user1!.name).toBe(userData.name);
          expect(user2!.name).toBe(userData.name);
          expect(user3!.name).toBe(userData.name);
          expect(user1!.total_points).toBe(0); // Always zero for new users
          expect(user2!.total_points).toBe(0);
          expect(user3!.total_points).toBe(0);
        }),
        { numRuns: 20 }
      );
    });
  });
});