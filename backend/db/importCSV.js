// backend/db/importCSV.js
const fs = require('fs');
const csv = require('csv-parser');
const db = require('./database');

async function importCSVData(filePath) {
  console.log('Starting CSV import...');
  const customers = new Set();

  const dbType = process.env.DB_TYPE || 'sqlite';
  let customerSql;
  let messageSql;

  if (dbType === 'postgres') {
    console.log('Detected Postgres, using ON CONFLICT.');
    customerSql = 'INSERT INTO customers (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING';
    // ## FIX: Removed 'status' from the INSERT, changed params from 5 to 4 ##
    messageSql = 'INSERT INTO messages (customer_id, message_body, "timestamp", is_from_customer, urgency_level) VALUES ($1, $2, $3, 1, $4) ON CONFLICT DO NOTHING';
  } else {
    console.log('Detected SQLite, using INSERT OR IGNORE.');
    customerSql = 'INSERT OR IGNORE INTO customers (user_id) VALUES (?)';
    // ## FIX: Removed 'status' from the INSERT ##
    messageSql = 'INSERT OR IGNORE INTO messages (customer_id, message_body, "timestamp", is_from_customer, urgency_level) VALUES (?, ?, ?, 1, ?)';
  }
  
  const urgentKeywords = [
    'loan', 'approval', 'disbursed', 'urgent', 'help', 
    'immediate', 'rejected', 'denied', 'payment', 
    'batch number', 'validate', 'review', 'crb', 
    'clearance', 'pay'
  ];

  const allRows = [];
  
  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row) => allRows.push(row)) // Collect all rows
      .on('end', async () => {
        console.log(`CSV file read. ${allRows.length} rows to process.`);
        
        try {
          await db.initPromise; 

          for (const row of allRows) {
            // #############
            // ## THE FIX: Use correct header 'User ID' ##
            // #############
            if (row['User ID']) { 
              customers.add(row['User ID']);
              await db.run(customerSql, [row['User ID']]);
            }
          }
          console.log(`Found and processed ${customers.size} unique customers.`); 

          for (const row of allRows) {
            // #############
            // ## THE FIX: Use correct headers 'Message Body' and 'Timestamp (UTC)' ##
            // #############
            const lower = row['Message Body'] ? row['Message Body'].toLowerCase() : '';
            const isUrgent = urgentKeywords.some(k => lower.includes(k));
            const urgency = isUrgent ? 'high' : 'normal';
            
            // #############
            // ## THE FIX: Check for correct headers and remove 'row.status' ##
            // #############
            if (row['User ID'] && row['Message Body'] && row['Timestamp (UTC)']) { 
              await db.run(messageSql, [
                row['User ID'], 
                row['Message Body'], 
                new Date(row['Timestamp (UTC)']).toISOString(), 
                urgency // 'row.status' removed
              ]);
            }
          }
          console.log('All messages imported.');
          resolve(); 
        } catch (err) {
          reject(err); 
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
    // We intentionally do not call db.close() so the process can continue
  } catch (err) {
    console.error('Error during import process:', err);
    process.exit(1); 
  }
})();