const Database = require('better-sqlite3');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

function initDb() {
    // Create stores table
    db.prepare(`
        CREATE TABLE IF NOT EXISTS stores (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            lat REAL,
            lng REAL
        )
    `).run();

    // Migration: Add lat/lng to stores if they don't exist
    const tableInfo = db.prepare("PRAGMA table_info(stores)").all();
    const hasLat = tableInfo.some(col => col.name === 'lat');
    if (!hasLat) {
        console.log('[DB] Migrating stores table to include coordinates...');
        db.prepare("ALTER TABLE stores ADD COLUMN lat REAL").run();
        db.prepare("ALTER TABLE stores ADD COLUMN lng REAL").run();

        // Update default stores with coordinates near center
        db.prepare("UPDATE stores SET lat = ?, lng = ? WHERE name = ?").run(-38.0055, -57.5426, 'Central Store');
        db.prepare("UPDATE stores SET lat = ?, lng = ? WHERE name = ?").run(-37.9850, -57.5600, 'North Branch');
    }

    // Create users table
    db.prepare(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            password TEXT NOT NULL,
            is_admin BOOLEAN DEFAULT 0,
            store_id INTEGER,
            FOREIGN KEY (store_id) REFERENCES stores(id)
        )
    `).run();

    // Check if seeding is needed
    const storeCount = db.prepare('SELECT COUNT(*) as count FROM stores').get();
    if (storeCount.count === 0) {
        console.log('[DB] Seeding stores...');
        const insertStore = db.prepare('INSERT INTO stores (name, lat, lng) VALUES (?, ?, ?)');
        insertStore.run('Central Store', -38.0055, -57.5426);
        insertStore.run('North Branch', -37.9850, -57.5600);
    }

    const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();
    if (userCount.count === 0) {
        console.log('[DB] Seeding users...');
        const insertUser = db.prepare(`
            INSERT INTO users (username, password, is_admin, store_id) 
            VALUES (?, ?, ?, ?)
        `);

        const centralStoreId = db.prepare('SELECT id FROM stores WHERE name = ?').get('Central Store').id;
        const northBranchId = db.prepare('SELECT id FROM stores WHERE name = ?').get('North Branch').id;

        // Admin
        insertUser.run(
            process.env.ADMIN_USERNAME || 'admin',
            process.env.ADMIN_PASSWORD || 'adminpass',
            1,
            centralStoreId
        );

        // Riders
        insertUser.run('rider1', 'password123', 0, centralStoreId);
        insertUser.run('rider2@example.com', 'password123', 0, northBranchId);
    }
}

initDb();

module.exports = db;
