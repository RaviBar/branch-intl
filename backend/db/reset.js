const db = require('./database');

async function resetDatabase() {
  console.log('Attempting to reset database...');
  try {
    const dbType = process.env.DB_TYPE || 'sqlite';
    if (dbType !== 'postgres') {
      console.log('Not a Postgres database. Aborting reset.');
      return;
    }
    
    const sql = 'TRUNCATE TABLE messages, customers, agents RESTART IDENTITY;';
    
    // We must wait for the init promise to be resolved
    await db.initPromise; 
    await db.query(sql); // Use query, which is in our database.js file
    
    console.log('SUCCESS: Database reset successfully!');
    console.log('All messages, customers, and agents have been deleted.');
  } catch (err) {
    console.error('Error resetting database:', err);
  } finally {
    // Close the connection so the script can exit
    if (db) db.close();
  }
}

resetDatabase();