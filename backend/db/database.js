const sqlite3 = require('sqlite3').verbose();
const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');

class Database {
  constructor() {
    this.type = process.env.DB_TYPE || 'sqlite';
    this.connection = null;
    // Call init, but don't await it here.
    this.initPromise = this.init();
  }

  async init() {
    if (this.type === 'postgres') {
      await this.initPostgreSQL();
    } else {
      await this.initSQLite();
    }
  }

  async initPostgreSQL() {
    const connectionConfig = {};

    if (process.env.DATABASE_URL) {
      connectionConfig.connectionString = process.env.DATABASE_URL;
      if (process.env.NODE_ENV === 'production') {
        connectionConfig.ssl = { rejectUnauthorized: false };
      }
    } else {
      connectionConfig.host = process.env.DB_HOST;
      connectionConfig.port = process.env.DB_PORT;
      connectionConfig.database = process.env.DB_NAME;
      connectionConfig.user = process.env.DB_USER;
      connectionConfig.password = process.env.DB_PASSWORD;
    }

    this.connection = new Pool(connectionConfig);

    this.connection.on('error', (err, client) => {
      console.error('Unexpected error on idle client', err);
      process.exit(-1);
    });

    try {
      console.log('PostgreSQL pool created. Attempting to create tables...');
      // Use the pool to run the query, it will manage the client
      await this.createTables(); 
      console.log('Database table check/creation complete.');
    } catch (err) {
      console.error('Error during database initialization:', err);
    }
  }

  async initSQLite() {
    return new Promise((resolve, reject) => {
      let dbPath;
      if (process.env.NODE_ENV === 'production') {
        const dbDir = '/var/data'; 
        if (!fs.existsSync(dbDir)) {
          fs.mkdirSync(dbDir, { recursive: true });
        }
        dbPath = path.join(dbDir, 'cs_messaging.db');
        console.log(`Production mode: Using database at ${dbPath}`);
      } else {
        dbPath = path.join(__dirname, 'cs_messaging.db');
        console.log(`Development mode: Using database at ${dbPath}`);
      }

      this.connection = new sqlite3.Database(dbPath, async (err) => {
        if (err) {
          console.error('Error opening SQLite database:', err);
          return reject(err);
        }

        console.log('SQLite connected successfully');
        try {
          await this.createTables();
          console.log('Database table check/creation complete.');
          resolve();
        } catch (createErr) {
          console.error('Error creating SQLite tables:', createErr);
          reject(createErr);
        }
      });
    });
  }

  createTables() {
    if (this.type === 'postgres') {
      return this.createPostgreSQLTables();
    } else {
      return this.createSQLiteTables();
    }
  }

  createPostgreSQLTables() {
    const schema = `
      CREATE TABLE IF NOT EXISTS customers ( user_id INTEGER PRIMARY KEY, created_at TIMESTAMPTZ DEFAULT NOW() );
      CREATE TABLE IF NOT EXISTS agents ( id SERIAL PRIMARY KEY, name TEXT NOT NULL, is_online BOOLEAN DEFAULT false, created_at TIMESTAMPTZ DEFAULT NOW() );
      CREATE TABLE IF NOT EXISTS messages ( id SERIAL PRIMARY KEY, customer_id INTEGER NOT NULL, message_body TEXT NOT NULL, "timestamp" TIMESTAMPTZ NOT NULL, is_from_customer BOOLEAN NOT NULL DEFAULT true, agent_id INTEGER, current_agent_id INTEGER, urgency_level TEXT DEFAULT 'normal' CHECK (urgency_level IN ('normal','high')), status TEXT DEFAULT 'pending' CHECK (status IN ('pending','assigned','responded')), created_at TIMESTAMPTZ DEFAULT NOW(), FOREIGN KEY (customer_id) REFERENCES customers(user_id), FOREIGN KEY (agent_id) REFERENCES agents(id), FOREIGN KEY (current_agent_id) REFERENCES agents(id) );
      CREATE INDEX IF NOT EXISTS idx_messages_customer_id ON messages(customer_id);
      CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages("timestamp");
      CREATE INDEX IF NOT EXISTS idx_messages_status ON messages(status);
      CREATE INDEX IF NOT EXISTS idx_messages_current_agent ON messages(current_agent_id);
      CREATE INDEX IF NOT EXISTS idx_messages_urgency ON messages(urgency_level);
      CREATE INDEX IF NOT EXISTS idx_agents_online ON agents(is_online);
    `;
    return this.connection.query(schema).then(res => {
      console.log('PostgreSQL tables created successfully');
    }).catch(err => {
      console.error('Error creating PostgreSQL tables:', err);
      throw err;
    });
  }

  createSQLiteTables() {
    return new Promise((resolve, reject) => {
      const schema = `
        CREATE TABLE IF NOT EXISTS customers ( user_id INTEGER PRIMARY KEY, created_at DATETIME DEFAULT CURRENT_TIMESTAMP );
        CREATE TABLE IF NOT EXISTS agents ( id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, is_online BOOLEAN DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP );
        CREATE TABLE IF NOT EXISTS messages ( id INTEGER PRIMARY KEY AUTOINCREMENT, customer_id INTEGER NOT NULL, message_body TEXT NOT NULL, "timestamp" DATETIME NOT NULL, is_from_customer BOOLEAN NOT NULL DEFAULT 1, agent_id INTEGER, current_agent_id INTEGER, urgency_level TEXT DEFAULT 'normal' CHECK (urgency_level IN ('normal','high')), status TEXT DEFAULT 'pending' CHECK (status IN ('pending','assigned','responded')), created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (customer_id) REFERENCES customers(user_id), FOREIGN KEY (agent_id) REFERENCES agents(id), FOREIGN KEY (current_agent_id) REFERENCES agents(id) );
        CREATE INDEX IF NOT EXISTS idx_messages_customer_id ON messages(customer_id);
        CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages("timestamp");
        CREATE INDEX IF NOT EXISTS idx_messages_status ON messages(status);
        CREATE INDEX IF NOT EXISTS idx_messages_current_agent ON messages(current_agent_id);
        CREATE INDEX IF NOT EXISTS idx_messages_urgency ON messages(urgency_level);
        CREATE INDEX IF NOT EXISTS idx_agents_online ON agents(is_online);
      `;
      this.connection.exec(schema, (err) => {
        if (err) {
          console.error('Error creating SQLite tables:', err);
          return reject(err);
        }
        console.log('SQLite tables created successfully');
        resolve();
      });
    });
  }

  // Helper function to replace ? with $1, $2, etc.
  sqlToPg(sql) {
    let i = 0;
    return sql.replace(/\?/g, () => `$${++i}`);
  }

  async query(sql, params = []) {
    await this.initPromise; // Ensure init is finished
    if (this.type === 'postgres') {
      const pgSql = this.sqlToPg(sql);
      return this.connection.query(pgSql, params).then(res => res.rows);
    } else {
      return new Promise((resolve, reject) => {
        this.connection.all(sql, params, (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });
    }
  }

  async get(sql, params = []) {
    await this.initPromise; // Ensure init is finished
    if (this.type === 'postgres') {
      const pgSql = this.sqlToPg(sql);
      return this.connection.query(pgSql, params).then(res => res.rows[0]);
    } else {
      return new Promise((resolve, reject) => {
        this.connection.get(sql, params, (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });
    }
  }

  async run(sql, params = []) {
    await this.initPromise; // Ensure init is finished
    if (this.type === 'postgres') {
      let pgSql = this.sqlToPg(sql);
      if (pgSql.trim().toUpperCase().startsWith('INSERT') && !pgSql.includes('RETURNING')) {
        pgSql = pgSql + ' RETURNING id';
      }
      return this.connection.query(pgSql, params)
        .then(res => ({
          lastID: res.rows[0] ? res.rows[0].id : null,
          changes: res.rowCount,
        }));
    } else {
      return new Promise((resolve, reject) => {
        this.connection.run(sql, params, function(err) {
          if (err) reject(err);
          else resolve({ lastID: this.lastID, changes: this.changes });
        });
      });
    }
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