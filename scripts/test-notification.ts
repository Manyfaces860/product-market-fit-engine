import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environmental configuration variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { sendDirectTestEmail } from '../src/lib/resend';

async function run() {
  const targetEmail = 'manyfaces860@gmail.com';
  
  console.log('----------------------------------------------------');
  console.log('🚀 P-X1 LIVE EMAIL NOTIFICATION INTEGRATION TEST');
  console.log('----------------------------------------------------');
  console.log(`Target: ${targetEmail}`);
  console.log(`Key Present: ${process.env.RESEND_API_KEY ? '✅ Yes' : '❌ No'}\n`);

  try {
    await sendDirectTestEmail(targetEmail);
    console.log('\n----------------------------------------------------');
    console.log('✅ TEST DISPATCH SUCCESSFUL!');
    console.log('----------------------------------------------------');
    console.log('👉 Crucial Resend Sandbox Notice:');
    console.log('Because we are using onboarding@resend.dev (the free sandbox sender),');
    console.log('Resend requires that you add the recipient email "mynewdbdatabase@gmail.com"');
    console.log('as a verified testing recipient in your Resend dashboard under "Audiences" or "Testing Recipients"!');
    console.log('Otherwise, Resend will reject with a 403 Forbidden error.');
    console.log('----------------------------------------------------');
  } catch (error: any) {
    console.log('\n----------------------------------------------------');
    console.error('❌ TEST DISPATCH FAILED!');
    console.log('----------------------------------------------------');
    console.error(`Error details: ${error?.message || error}`);
    console.log('----------------------------------------------------');
  }
}

run();
