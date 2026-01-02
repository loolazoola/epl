import { createClient } from "@supabase/supabase-js";
import { Database } from "@/types/database";

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export type User = Database["public"]["Tables"]["users"]["Row"];
export type UserInsert = Database["public"]["Tables"]["users"]["Insert"];
export type UserUpdate = Database["public"]["Tables"]["users"]["Update"];

/**
 * Create a new user profile with zero points
 */
export async function createUserProfile(userData: {
  email: string;
  name: string;
  avatar_url?: string | null;
}): Promise<{ user: User | null; error: string | null }> {
  try {
    const insertData = {
      email: userData.email,
      name: userData.name,
      avatar_url: userData.avatar_url || null,
      total_points: 0, // Initialize with zero points as per requirement 1.3
    }

    const { data, error } = await (supabase as any)
      .from("users")
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error("Error creating user profile:", error);
      return { user: null, error: error.message };
    }

    return { user: data, error: null };
  } catch (error) {
    console.error("Unexpected error creating user profile:", error);
    return { user: null, error: "Failed to create user profile" };
  }
}

/**
 * Retrieve user profile by email
 */
export async function getUserProfileByEmail(
  email: string
): Promise<{ user: User | null; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("email", email)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        // User not found
        return { user: null, error: null };
      }
      console.error("Error fetching user profile:", error);
      return { user: null, error: error.message };
    }

    return { user: data, error: null };
  } catch (error) {
    console.error("Unexpected error fetching user profile:", error);
    return { user: null, error: "Failed to fetch user profile" };
  }
}

/**
 * Retrieve user profile by ID
 */
export async function getUserProfileById(
  userId: string
): Promise<{ user: User | null; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("id", userId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        // User not found
        return { user: null, error: null };
      }
      console.error("Error fetching user profile:", error);
      return { user: null, error: error.message };
    }

    return { user: data, error: null };
  } catch (error) {
    console.error("Unexpected error fetching user profile:", error);
    return { user: null, error: "Failed to fetch user profile" };
  }
}

/**
 * Update user profile information
 */
export async function updateUserProfile(
  userId: string,
  updates: UserUpdate
): Promise<{ user: User | null; error: string | null }> {
  try {
    const updateData = {
      ...updates,
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await (supabase as any)
      .from("users")
      .update(updateData)
      .eq("id", userId)
      .select()
      .single();

    if (error) {
      console.error("Error updating user profile:", error);
      return { user: null, error: error.message };
    }

    return { user: data, error: null };
  } catch (error) {
    console.error("Unexpected error updating user profile:", error);
    return { user: null, error: "Failed to update user profile" };
  }
}

/**
 * Update user's total points
 */
export async function updateUserPoints(
  userId: string,
  pointsToAdd: number
): Promise<{ user: User | null; error: string | null }> {
  try {
    // First get current points
    const { user: currentUser, error: fetchError } = await getUserProfileById(userId);
    
    if (fetchError || !currentUser) {
      return { user: null, error: fetchError || "User not found" };
    }

    const newTotalPoints = currentUser.total_points + pointsToAdd;

    const updateData = {
      total_points: newTotalPoints,
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await (supabase as any)
      .from("users")
      .update(updateData)
      .eq("id", userId)
      .select()
      .single();

    if (error) {
      console.error("Error updating user points:", error);
      return { user: null, error: error.message };
    }

    return { user: data, error: null };
  } catch (error) {
    console.error("Unexpected error updating user points:", error);
    return { user: null, error: "Failed to update user points" };
  }
}

/**
 * Get or create user profile (used during authentication)
 */
export async function getOrCreateUserProfile(userData: {
  email: string;
  name: string;
  avatar_url?: string | null;
}): Promise<{ user: User | null; error: string | null; isNewUser: boolean }> {
  try {
    // First try to get existing user
    const { user: existingUser, error: fetchError } = await getUserProfileByEmail(userData.email);
    
    if (fetchError) {
      return { user: null, error: fetchError, isNewUser: false };
    }

    if (existingUser) {
      // Update existing user's name and avatar if they've changed
      const needsUpdate = 
        existingUser.name !== userData.name || 
        existingUser.avatar_url !== userData.avatar_url;

      if (needsUpdate) {
        const { user: updatedUser, error: updateError } = await updateUserProfile(
          existingUser.id,
          {
            name: userData.name,
            avatar_url: userData.avatar_url || undefined,
          }
        );

        if (updateError) {
          return { user: null, error: updateError, isNewUser: false };
        }

        return { user: updatedUser, error: null, isNewUser: false };
      }

      return { user: existingUser, error: null, isNewUser: false };
    }

    // Create new user
    const { user: newUser, error: createError } = await createUserProfile(userData);
    
    if (createError) {
      return { user: null, error: createError, isNewUser: false };
    }

    return { user: newUser, error: null, isNewUser: true };
  } catch (error) {
    console.error("Unexpected error in getOrCreateUserProfile:", error);
    return { user: null, error: "Failed to get or create user profile", isNewUser: false };
  }
}