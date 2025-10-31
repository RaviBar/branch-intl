const fs = require('fs'); // Corrected fs import
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
    customerSql = 'INSERT INTO customers (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING';
    messageSql = 'INSERT INTO messages (customer_id, message_body, "timestamp", is_from_customer, status, urgency_level) VALUES ($1, $2, $3, 1, $4, $5)';
  } else {
    customerSql = 'INSERT OR IGNORE INTO customers (user_id) VALUES (?)';
    messageSql = 'INSERT INTO messages (customer_id, message_body, "timestamp", is_from_customer, status, urgency_level) VALUES (?, ?, ?, 1, ?, ?)';
  }
  
  const urgentKeywords = [
    'loan', 'approval', 'disbursed', 'urgent', 'help', 
    'immediate', 'rejected', 'denied', 'payment', 
    'batch number', 'validate', 'review', 'crb', 
    'clearance', 'pay'
  ];

  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row) => {
        // Collect data in a function to be processed
        // This is a simplified way to handle stream pauses
        // but for this script, we can process row by row.
        // Let's assume the db.run is fast enough or we'll await it.
        // This part is tricky. A better way is to not pause the stream
        // but to process rows in batches, or await each one.
        // Let's await each one for simplicity.
        
        // We'll create a processing function to use async/await
        async function processRow(row) {
          try {
            if (row.customer_id) {
              customers.add(row.customer_id);
            }

            const lower = row.message_body ? row.message_body.toLowerCase() : '';
            const isUrgent = urgentKeywords.some(k => lower.includes(k));
            const urgency = isUrgent ? 'high' : 'normal';

            if (row.customer_id && row.message_body && row.timestamp && row.status) {
              // Insert customer first (or ignore if exists)
              await db.run(customerSql, [row.customer_id]);
              
              // Insert the message with the calculated urgency level
              await db.run(messageSql, [
                row.customer_id, 
                row.message_body, 
                new Date(row.timestamp).toISOString(), // Ensure timestamp is in ISO format
                row.status, 
                urgency // This is the 'high' or 'normal' value
              ]);
            }
          } catch (err) {
            console.error('Error processing row:', err.message, 'Row:', row);
            // Don't stop the whole import, just log the error
          }
        }
        // We must chain this in the 'data' event
        return processRow(row);
      })
      .on('end', async () => {
        console.log(`CSV file processed. Found ${customers.size} unique customers.`);
        resolve(); // Resolve the promise when done
      })
      .on('error', (err) => {
        console.error('Error reading CSV file:', err);
        reject(err); // Reject the promise on error
      });
  });
}

const filePath = process.argv[2];
if (!filePath) {
  console.error('CSV file not found. Please provide the correct path.');
  console.log('Usage: node importCSV.js <path-to-csv-file>');
} else {
  // Wait for the DB to be ready before importing
  db.initPromise.then(() => {
    importCSVData(filePath)
      .then(() => {
        console.log('CSV Import completed.');
        db.close(); // Close DB connection
      })
      .catch(err => {
        console.error('Error importing CSV data:', err);
        db.close(); // Close DB connection on error
      });
  }).catch(err => {
    console.error("Database connection failed, cannot import CSV.", err);
  });
}