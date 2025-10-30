const { Pool } = require('pg');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class Database {
  constructor() {
    this.type = process.env.DB_TYPE || 'sqlite'; // 'sqlite' or 'postgres'
    this.connection = null;
    this.init();
  }

  init() {
    // User requested to ignore Postgres, so we'll force SQLite
    this.type = 'sqlite';
    this.initSQLite();
    
    // Original logic (commented out per your request)
    // if (this.type === 'postgres') {
    //   this.initPostgreSQL();
    // } else {
    //   this.initSQLite();
    // }
  }

  initPostgreSQL() {
    // This logic is now skipped
    this.connection = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'cs_messaging',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'password',
    });

    // Test connection
    this.connection.query('SELECT NOW()', (err, res) => {
      if (err) {
        console.error('PostgreSQL connection error:', err);
        console.log('Falling back to SQLite...');
        this.type = 'sqlite';
        this.initSQLite();
      } else {
        console.log('PostgreSQL connected successfully');
        this.createTables();
      }
    });
  }

  initSQLite() {
    const dbPath = path.join(__dirname, 'cs_messaging.db');
    this.connection = new sqlite3.Database(dbPath);
    console.log('SQLite connected successfully');
    this.createTables();
  }

  createTables() {
    if (this.type === 'postgres') {
      this.createPostgreSQLTables();
    } else {
      this.createSQLiteTables();
    }
  }

  createPostgreSQLTables() {
    // This logic is now skipped
    const schema = `
      -- Customers table
      CREATE TABLE IF NOT EXISTS customers (
        user_id INTEGER PRIMARY KEY,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Agents table
      CREATE TABLE IF NOT EXISTS agents (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        is_online BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Messages table
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        customer_id INTEGER NOT NULL REFERENCES customers(user_id),
        message_body TEXT NOT NULL,
        timestamp TIMESTAMP NOT NULL,
        is_from_customer BOOLEAN NOT NULL DEFAULT true,
        agent_id INTEGER REFERENCES agents(id),
        status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'assigned', 'responded')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        current_agent_id INTEGER REFERENCES agents(id),
        urgency_level VARCHAR(20) DEFAULT 'normal' CHECK (urgency_level IN ('normal', 'high'))
      );

      -- Indexes for better performance
      CREATE INDEX IF NOT EXISTS idx_messages_customer_id ON messages(customer_id);
      CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);
      CREATE INDEX IF NOT EXISTS idx_messages_status ON messages(status);
      CREATE INDEX IF NOT EXISTS idx_agents_online ON agents(is_online);
      CREATE INDEX IF NOT EXISTS idx_messages_current_agent ON messages(current_agent_id);
      CREATE INDEX IF NOT EXISTS idx_messages_urgency ON messages(urgency_level);
    `;

    this.connection.query(schema, (err) => {
      if (err) {
        console.error('Error creating PostgreSQL tables:', err);
      } else {
        console.log('PostgreSQL tables created successfully');
      }
    });
  }

  createSQLiteTables() {
    // [FIX] This schema is now CORRECT. It includes current_agent_id and urgency_level.
    const schema = `
      -- Customers table
      CREATE TABLE IF NOT EXISTS customers (
        user_id INTEGER PRIMARY KEY,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Agents table
      CREATE TABLE IF NOT EXISTS agents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        is_online BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Messages table
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER NOT NULL,
        message_body TEXT NOT NULL,
        timestamp DATETIME NOT NULL,
        is_from_customer BOOLEAN NOT NULL DEFAULT 1,
        agent_id INTEGER,
        current_agent_id INTEGER,                         -- <— This was missing
        urgency_level TEXT DEFAULT 'normal' CHECK (urgency_level IN ('normal','high')), -- <— This was missing
        status TEXT DEFAULT 'pending' CHECK (status IN ('pending','assigned','responded')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (customer_id) REFERENCES customers(user_id),
        FOREIGN KEY (agent_id) REFERENCES agents(id),
        FOREIGN KEY (current_agent_id) REFERENCES agents(id)
      );

      -- Create indexes
      CREATE INDEX IF NOT EXISTS idx_messages_customer_id ON messages(customer_id);
      CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);
      CREATE INDEX IF NOT EXISTS idx_messages_status ON messages(status);
      CREATE INDEX IF NOT EXISTS idx_agents_online ON agents(is_online);
      CREATE INDEX IF NOT EXISTS idx_messages_current_agent ON messages(current_agent_id);
      CREATE INDEX IF NOT EXISTS idx_messages_urgency ON messages(urgency_level);
    `;

    this.connection.exec(schema, (err) => {
      if (err) {
        console.error('Error creating SQLite tables:', err);
      } else {
        console.log('SQLite tables created successfully');
      }
    });
  }

  // Query method that works for both databases
  query(sql, params = []) {
    // Helper to fix PostgreSQL $1, $2 placeholders for SQLite
    const sqliteSql = this.type === 'sqlite' ? sql.replace(/\$\d+/g, '?') : sql;
    
    return new Promise((resolve, reject) => {
      if (this.type === 'postgres') {
        this.connection.query(sql, params, (err, result) => {
          if (err) reject(err);
          else resolve(result.rows);
        });
      } else {
        this.connection.all(sqliteSql, params, (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      }
    });
  }

  // Get single row
  get(sql, params = []) {
    // Helper to fix PostgreSQL $1, $2 placeholders for SQLite
    const sqliteSql = this.type === 'sqlite' ? sql.replace(/\$\d+/g, '?') : sql;

    return new Promise((resolve, reject) => {
      if (this.type === 'postgres') {
        this.connection.query(sql, params, (err, result) => {
          if (err) reject(err);
          else resolve(result.rows[0]);
        });
      } else {
        this.connection.get(sqliteSql, params, (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      }
    });
  }

  // Run query (for INSERT, UPDATE, DELETE)
  run(sql, params = []) {
    // Helper to fix PostgreSQL $1, $2 placeholders for SQLite
    const sqliteSql = this.type === 'sqlite' ? sql.replace(/\$\d+/g, '?') : sql;

    return new Promise((resolve, reject) => {
      if (this.type === 'postgres') {
        // Added RETURNING id to get the lastID for Postgres
        const pgSql = /INSERT/i.test(sql) ? `${sql} RETURNING id` : sql;
        this.connection.query(pgSql, params, (err, result) => {
          if (err) reject(err);
          else resolve({ lastID: result.rows[0]?.id || result.insertId, changes: result.rowCount });
        });
      } else {
        this.connection.run(sqliteSql, params, function(err) {
          if (err) reject(err);
          else resolve({ lastID: this.lastID, changes: this.changes });
        });
      }
    });
  }

  close() {
    if (this.connection) {
      if (this.type === 'postgres') {
        this.connection.end();
      } else {
        this.connection.close();
      }
    }
  }
}

module.exports = new Database();