import { resetAndSeedDatabase } from './seed/reset-and-seed';

async function globalSetup() {
  console.log('🏁 Starting E2E Global Setup...');
  try {
    await resetAndSeedDatabase();
    console.log('✨ E2E Global Setup completed successfully!');
  } catch (error) {
    console.error('❌ E2E Global Setup failed:', error);
    process.exit(1);
  }
}

export default globalSetup;
