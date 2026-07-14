import * as SQLite from 'expo-sqlite';

let db;

export const initDatabase = async () => {
  try {
    db = await SQLite.openDatabaseAsync('aqualedger.db');
    await createTables();
    await seedInitialData();
    console.log('Database initialized successfully');
    return db;
  } catch (error) {
    console.error('Database initialization error:', error);
    throw error;
  }
};

export const getDatabase = () => {
  if (!db) {
    throw new Error('Database not initialized');
  }
  return db;
};

const createTables = async () => {
  const queries = [
    // Plant Settings
    `CREATE TABLE IF NOT EXISTS plant_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plant_name TEXT,
      balance REAL DEFAULT 0,
      last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

    // Transactions
    `CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT CHECK(type IN ('cashin', 'cashout', 'sale', 'purchase', 'expense', 'salary', 'withdrawal', 'order_payment')),
      amount REAL,
      person_name TEXT,
      description TEXT,
      transaction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      reference_id INTEGER,
      reference_type TEXT,
      reversed INTEGER DEFAULT 0,
      reversal_id INTEGER DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

    // Raw Items
    `CREATE TABLE IF NOT EXISTS raw_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE,
      unit TEXT,
      stock_quantity REAL DEFAULT 0,
      min_stock REAL DEFAULT 0,
      purchase_price REAL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

    // Ready Items
    `CREATE TABLE IF NOT EXISTS ready_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE,
      selling_price REAL,
      stock_quantity INTEGER DEFAULT 0,
      min_stock INTEGER DEFAULT 0,
      production_cost REAL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

    // Ready Item Components
    `CREATE TABLE IF NOT EXISTS ready_item_components (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ready_item_id INTEGER,
      raw_item_id INTEGER,
      quantity_required REAL,
      FOREIGN KEY (ready_item_id) REFERENCES ready_items(id),
      FOREIGN KEY (raw_item_id) REFERENCES raw_items(id)
    )`,

    // Raw Purchases
    `CREATE TABLE IF NOT EXISTS raw_purchases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      raw_item_id INTEGER,
      quantity REAL,
      total_cost REAL,
      payment_status TEXT CHECK(payment_status IN ('paid', 'pending', 'partial')),
      paid_amount REAL DEFAULT 0,
      supplier_name TEXT,
      purchase_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (raw_item_id) REFERENCES raw_items(id)
    )`,

    // Raw Purchase Transactions
    `CREATE TABLE IF NOT EXISTS raw_purchase_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      purchase_id INTEGER,
      amount REAL,
      payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      notes TEXT,
      FOREIGN KEY (purchase_id) REFERENCES raw_purchases(id)
    )`,

    // Production Orders
    `CREATE TABLE IF NOT EXISTS production_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ready_item_id INTEGER,
      quantity INTEGER,
      status TEXT CHECK(status IN ('pending', 'in_progress', 'completed', 'cancelled')),
      order_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      completed_date TIMESTAMP,
      notes TEXT,
      FOREIGN KEY (ready_item_id) REFERENCES ready_items(id)
    )`,

    // Production Order Transactions
    `CREATE TABLE IF NOT EXISTS production_order_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      production_order_id INTEGER,
      raw_item_id INTEGER,
      quantity_used REAL,
      transaction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (production_order_id) REFERENCES production_orders(id),
      FOREIGN KEY (raw_item_id) REFERENCES raw_items(id)
    )`,

    // Sales
    `CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_name TEXT,
      total_amount REAL,
      paid_amount REAL DEFAULT 0,
      payment_status TEXT CHECK(payment_status IN ('paid', 'pending', 'partial')),
      sale_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      notes TEXT,
      reversed INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

    // Sale Items
    `CREATE TABLE IF NOT EXISTS sale_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER,
      ready_item_id INTEGER,
      quantity INTEGER,
      unit_price REAL,
      total_price REAL,
      FOREIGN KEY (sale_id) REFERENCES sales(id),
      FOREIGN KEY (ready_item_id) REFERENCES ready_items(id)
    )`,

    // Sale Transactions
    `CREATE TABLE IF NOT EXISTS sale_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER,
      amount REAL,
      payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      notes TEXT,
      FOREIGN KEY (sale_id) REFERENCES sales(id)
    )`,

    // Orders
    `CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_number TEXT UNIQUE,
      customer_name TEXT,
      order_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      delivery_date TIMESTAMP,
      status TEXT CHECK(status IN ('pending', 'ready', 'delivered', 'cancelled')),
      total_amount REAL,
      paid_amount REAL DEFAULT 0,
      payment_status TEXT CHECK(payment_status IN ('paid', 'pending', 'partial')),
      delivery_employee_id INTEGER,
      delivery_commission REAL DEFAULT 0,
      delivery_notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (delivery_employee_id) REFERENCES employees(id)
    )`,

    // Order Items
    `CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER,
      ready_item_id INTEGER,
      quantity INTEGER,
      unit_price REAL,
      total_price REAL,
      FOREIGN KEY (order_id) REFERENCES orders(id),
      FOREIGN KEY (ready_item_id) REFERENCES ready_items(id)
    )`,

    // Order Transactions
    `CREATE TABLE IF NOT EXISTS order_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER,
      amount REAL,
      payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      notes TEXT,
      FOREIGN KEY (order_id) REFERENCES orders(id)
    )`,

    // Employees
    `CREATE TABLE IF NOT EXISTS employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      phone TEXT,
      address TEXT,
      position TEXT,
      salary REAL,
      is_active INTEGER DEFAULT 1,
      hire_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      termination_date TIMESTAMP,
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

    // Employee Payments
    `CREATE TABLE IF NOT EXISTS employee_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER,
      amount REAL,
      payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      payment_type TEXT CHECK(payment_type IN ('salary', 'commission', 'advance', 'bonus')),
      notes TEXT,
      FOREIGN KEY (employee_id) REFERENCES employees(id)
    )`,

    // Vehicles
    `CREATE TABLE IF NOT EXISTS vehicles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      registration_number TEXT,
      vehicle_type TEXT,
      status TEXT CHECK(status IN ('active', 'maintenance', 'inactive')),
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

    // Vehicle Expenses
    `CREATE TABLE IF NOT EXISTS vehicle_expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vehicle_id INTEGER,
      expense_type TEXT,
      amount REAL,
      description TEXT,
      expense_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      notes TEXT,
      FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)
    )`,

    // Other Expenses
    `CREATE TABLE IF NOT EXISTS other_expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT,
      amount REAL,
      category TEXT,
      expense_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

    // Withdrawals
    `CREATE TABLE IF NOT EXISTS withdrawals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT,
      amount REAL,
      reason TEXT,
      withdrawal_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      reversed INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

    // Loans
    `CREATE TABLE IF NOT EXISTS loans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_name TEXT,
      reference_type TEXT CHECK(reference_type IN ('sale', 'order')),
      reference_id INTEGER,
      total_amount REAL,
      paid_amount REAL DEFAULT 0,
      status TEXT CHECK(status IN ('active', 'paid', 'overdue')),
      due_date TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

    // Loan Payments
    `CREATE TABLE IF NOT EXISTS loan_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      loan_id INTEGER,
      amount REAL,
      payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      notes TEXT,
      FOREIGN KEY (loan_id) REFERENCES loans(id)
    )`
  ];

  for (const query of queries) {
    try {
      await db.execAsync(query);
    } catch (error) {
      console.error('Error creating table:', error);
      throw error;
    }
  }
};

const seedInitialData = async () => {
  // Check if plant settings exist
  const settings = await db.getFirstAsync('SELECT * FROM plant_settings LIMIT 1');
  
  if (!settings) {
    await db.runAsync(
      'INSERT INTO plant_settings (plant_name, balance) VALUES (?, ?)',
      ['Aqua Water Plant', 0]
    );
  }

  // Check if sample raw items exist
  const rawItems = await db.getAllAsync('SELECT * FROM raw_items LIMIT 1');
  
  if (rawItems.length === 0) {
    const sampleRaw = [
      ['Bottle Caps', 'pieces', 1000, 500, 2],
      ['Labels', 'pieces', 500, 200, 1],
      ['1L Plastic Bottles', 'pieces', 800, 300, 5],
      ['1.5L Plastic Bottles', 'pieces', 600, 200, 7],
      ['Packaging Boxes', 'pieces', 200, 50, 10]
    ];

    for (const item of sampleRaw) {
      await db.runAsync(
        'INSERT INTO raw_items (name, unit, stock_quantity, min_stock, purchase_price) VALUES (?, ?, ?, ?, ?)',
        item
      );
    }
  }

  // Check if sample ready items exist
  const readyItems = await db.getAllAsync('SELECT * FROM ready_items LIMIT 1');
  
  if (readyItems.length === 0) {
    const sampleReady = [
      ['1L Water Bottle', 20, 100, 30, 8],
      ['1.5L Water Bottle', 30, 80, 25, 12],
      ['500ml Water Bottle', 15, 150, 50, 6]
    ];

    for (const item of sampleReady) {
      await db.runAsync(
        'INSERT INTO ready_items (name, selling_price, stock_quantity, min_stock, production_cost) VALUES (?, ?, ?, ?, ?)',
        item
      );
    }
  }

  // Check if sample employees exist
  const employees = await db.getAllAsync('SELECT * FROM employees LIMIT 1');
  
  if (employees.length === 0) {
    const sampleEmployees = [
      ['Ahmed Khan', '0300-1234567', 'Loralai', 'Manager', 50000, 1],
      ['Usman Ali', '0300-7654321', 'Loralai', 'Driver', 25000, 1],
      ['Sara Bibi', '0300-9876543', 'Loralai', 'Sales Person', 20000, 1]
    ];

    for (const emp of sampleEmployees) {
      await db.runAsync(
        'INSERT INTO employees (name, phone, address, position, salary, is_active) VALUES (?, ?, ?, ?, ?, ?)',
        emp
      );
    }
  }
};