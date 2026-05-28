// PHASE 3 STEP 19
// Local developer-only Supabase test user seed script.

import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local", override: false, quiet: true });
loadEnv({ path: ".env", override: false, quiet: true });

const PASSWORD = "Test123456!";
const TEST_USERS = Array.from({ length: 10 }, (_, index) => {
  const playerNumber = index + 1;

  return {
    email: `delonnhmd${playerNumber}@gmail.com`,
    username: `player${playerNumber}`,
    displayName: `Player ${playerNumber}`,
  };
});

const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error("Missing SUPABASE_URL. You can use EXPO_PUBLIC_SUPABASE_URL as a fallback.");
}

if (!serviceRoleKey) {
  throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY. Never use EXPO_PUBLIC_SUPABASE_ANON_KEY for this script.");
}

if (serviceRoleKey === process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) {
  throw new Error("SUPABASE_SERVICE_ROLE_KEY must not be the public anon key.");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

function isExistingUserError(error) {
  const message = error.message.toLowerCase();

  return (
    message.includes("already") ||
    message.includes("registered") ||
    message.includes("exists")
  );
}

async function findUserByEmail(email) {
  const normalizedEmail = email.toLowerCase();
  let page = 1;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 1000,
    });

    if (error) {
      throw new Error(`Could not list Supabase users: ${error.message}`);
    }

    const user = data.users.find((candidate) => candidate.email?.toLowerCase() === normalizedEmail);

    if (user) {
      return user;
    }

    if (data.users.length < 1000) {
      return null;
    }

    page += 1;
  }
}

async function createOrUpdateAuthUser({ email, username, displayName }) {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: {
      username,
      displayName,
    },
  });

  if (!error) {
    console.log(`Created auth user: ${username}`);
    return data.user;
  }

  if (!isExistingUserError(error)) {
    throw new Error(`Could not create auth user ${username}: ${error.message}`);
  }

  const existingUser = await findUserByEmail(email);

  if (!existingUser) {
    throw new Error(`Auth user ${username} already exists, but could not be found by email.`);
  }

  const { data: updatedUserData, error: updateError } = await supabase.auth.admin.updateUserById(existingUser.id, {
    password: PASSWORD,
    email_confirm: true,
    user_metadata: {
      ...(existingUser.user_metadata ?? {}),
      username,
      displayName,
    },
  });

  if (updateError) {
    throw new Error(`Could not update existing auth user ${username}: ${updateError.message}`);
  }

  console.log(`Skipped existing user: ${username}`);
  return updatedUserData.user;
}

async function upsertProfile(authUser, { username, displayName }) {
  const { error } = await supabase.from("profiles").upsert(
    {
      id: authUser.id,
      username,
      display_name: displayName,
      verified: true,
      reputation_score: 0,
      votes_cast: 0,
      accuracy_rate: 0,
      trust_tier: "regular",
      trust_weight_override: 1.0,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );

  if (error) {
    throw new Error(`Could not upsert profile ${username}: ${error.message}`);
  }

  console.log(`Profile ready: ${username}`);
}

async function main() {
  for (const testUser of TEST_USERS) {
    const authUser = await createOrUpdateAuthUser(testUser);
    await upsertProfile(authUser, testUser);
  }

  console.log("Done. 10 test users ready.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
