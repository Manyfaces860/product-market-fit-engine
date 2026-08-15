import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env') });

import { clerkClient } from '@clerk/nextjs/server';

async function test() {
  console.log("clerkClient type:", typeof clerkClient);
  console.log("clerkClient keys/properties:", Object.keys(clerkClient || {}));
  
  try {
    // Try both calling it as a function and accessing it directly
    if (typeof clerkClient === 'function') {
      const client = (clerkClient as any)();
      console.log("clerkClient() return type:", typeof client);
      if (client instanceof Promise) {
        const resolved = await client;
        console.log("Resolved clerkClient() keys:", Object.keys(resolved || {}));
      } else {
        console.log("Resolved clerkClient() keys (sync):", Object.keys(client || {}));
      }
    } else {
      console.log("clerkClient is an object, users collection matches:", !!(clerkClient as any).users);
    }
  } catch (err: any) {
    console.error("Test execution failed:", err?.message || err);
  }
}

test();