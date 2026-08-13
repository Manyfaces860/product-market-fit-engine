import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env') });

import { clerkClient } from '@clerk/nextjs/server';

const TARGET_USER_ID = 'user_3GrnnHQd2g7XpULXr77bN4gtR0G';

async function run() {
  console.log(`[Clerk Test] Retrieving Clerk user profile for: ${TARGET_USER_ID}...`);
  try {
    const clerk = await clerkClient();
    const user = await clerk.users.getUser(TARGET_USER_ID);
    console.log("SUCCESS! User retrieved from Clerk:");
    console.log(`- Name: ${user.firstName} ${user.lastName}`);
    console.log(`- Email Addresses:`, user.emailAddresses.map(e => e.emailAddress));
  } catch (err: any) {
    console.error("FAILED to retrieve user from Clerk:", err?.message || err);
  }
}

run();