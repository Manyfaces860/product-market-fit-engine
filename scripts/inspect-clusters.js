const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.resolve(process.cwd(), '.env') });

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB = process.env.MONGODB_DB_TEST || 'p-x1';

async function run() {
  if (!MONGODB_URI) {
    console.error("MONGODB_URI env is missing!");
    return;
  }

  const client = new MongoClient(MONGODB_URI);
  try {
    await client.connect();
    const db = client.db(MONGODB_DB);
    const clusters = await db.collection('clusters').find({}).toArray();
    console.log('--- Active Database Problem Groups & Co-Signers ---');
    clusters.forEach(c => {
      console.log(`Cluster ID: ${c.id}`);
      console.log(`- Title: "${c.canonicalText}"`);
      console.log(`- Co-Signers (userIds):`, c.userIds || []);
      console.log(`- Member Count: ${c.memberCount}`);
      console.log('--------------------------------------------------');
    });
  } catch (err) {
    console.error(err);
  } finally {
    await client.close();
  }
}

run();