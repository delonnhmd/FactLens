// PHASE 3 STEP 19
// Local developer-only Supabase test user cleanup script.

import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local", override: false, quiet: true });
loadEnv({ path: ".env", override: false, quiet: true });

const TEST_USERS = Array.from({ length: 10 }, (_, index) => {
  const playerNumber = index + 1;

  return {
    email: `delonnhmd${playerNumber}@gmail.com`,
    username: `player${playerNumber}`,
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

async function deleteTestUser({ email, username }) {
  const existingUser = await findUserByEmail(email);

  if (!existingUser) {
    console.log(`Skipped missing user: ${username}`);

    const { error: profileDeleteError } = await supabase.from("profiles").delete().eq("username", username);

    if (profileDeleteError) {
      throw new Error(`Could not clean profile ${username}: ${profileDeleteError.message}`);
    }

    return;
  }

  const { error } = await supabase.auth.admin.deleteUser(existingUser.id);

  if (error) {
    throw new Error(`Could not delete auth user ${username}: ${error.message}`);
  }

  console.log(`Deleted auth user: ${username}`);

  const { error: profileDeleteError } = await supabase.from("profiles").delete().eq("username", username);

  if (profileDeleteError) {
    throw new Error(`Could not clean profile ${username}: ${profileDeleteError.message}`);
  }

  console.log(`Profile removed: ${username}`);
}

async function main() {
  for (const testUser of TEST_USERS) {
    await deleteTestUser(testUser);
  }

  console.log("Done. 10 test users removed.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
