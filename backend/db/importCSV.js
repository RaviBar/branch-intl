const fs = require('fs');
const csv = require('csv-parser');
const db = require('./database');

async function importCSVData(filePath) {
  console.log('Starting CSV import...');
  const customers = new Set();

  // Determine DB type for correct SQL syntax
  const dbType = process.env.DB_TYPE || 'sqlite';
  let customerSql;
  let messageSql;

  if (dbType === 'postgres') {
    console.log('Detected Postgres, using ON CONFLICT.');
    customerSql = 'INSERT INTO customers (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING';
    messageSql = 'INSERT INTO messages (customer_id, message_body, "timestamp", is_from_customer, status, urgency_level) VALUES ($1, $2, $3, 1, $4, $5) ON CONFLICT DO NOTHING';
  } else {
    console.log('Detected SQLite, using INSERT OR IGNORE.');
    customerSql = 'INSERT OR IGNORE INTO customers (user_id) VALUES (?)';
    messageSql = 'INSERT OR IGNORE INTO messages (customer_id, message_body, "timestamp", is_from_customer, status, urgency_level) VALUES (?, ?, ?, 1, ?, ?)';
  }
  
  const urgentKeywords = [
    'loan', 'approval', 'disbursed', 'urgent', 'help', 
    'immediate', 'rejected', 'denied', 'payment', 
    'batch number', 'validate', 'review', 'crb', 
    'clearance', 'pay'
  ];

  const allRows = [];
  
  // New Promise-based approach to read stream first
  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row) => allRows.push(row)) // Collect all rows
      .on('end', async () => {
        console.log(`CSV file read. ${allRows.length} rows to process.`);
        
        try {
          // Ensure DB is initialized
          await db.initPromise; 

          for (const row of allRows) {
            // #############
            // ## THE FIX ##
            // #############
            if (row.user_id) { // Changed from customer_id
              customers.add(row.user_id);
              // Insert customer first
              await db.run(customerSql, [row.user_id]); // Changed from customer_id
            }
          }
          console.log(`Found and processed ${customers.size} unique customers.`); // This will now show 55

          for (const row of allRows) {
            const lower = row.message_body ? row.message_body.toLowerCase() : '';
            const isUrgent = urgentKeywords.some(k => lower.includes(k));
            const urgency = isUrgent ? 'high' : 'normal';
            
            // #############
            // ## THE FIX ##
            // #############
            if (row.user_id && row.message_body && row.timestamp && row.status) { // Changed from customer_id
              // Insert the message
              await db.run(messageSql, [
                row.user_id, // Changed from customer_id
                row.message_body, 
                new Date(row.timestamp).toISOString(), 
                row.status, 
                urgency
              ]);
            }
          }
          console.log('All messages imported.');
          resolve(); // Resolve the promise when all DB operations are done
        } catch (err) {
          reject(err); // Reject if any DB operation fails
        }
      })
      .on('error', (err) => {
        console.error('Error reading CSV file:', err);
        reject(err);
      });
  });
}

// Main execution
(async () => {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error('CSV file not found. Please provide the correct path.');
    console.log('Usage: node importCSV.js <path-to-csv-file>');
    process.exit(1); 
  }

  try {
    await db.initPromise; 
    console.log('Database connection ready.');
    
    await importCSVData(filePath);
    
    console.log('CSV Import completed successfully.');
  } catch (err) {
    console.error('Error during import process:', err);
    process.exit(1); 
  } finally {
    if (db) db.close(); 
  }
})();