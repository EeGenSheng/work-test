import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

try {
  const count = await pool.query('SELECT COUNT(*) as cnt FROM rate_set_support_item_price');
  console.log('Price rows:', count.rows[0].cnt);
  
  const prices = await pool.query('SELECT * FROM rate_set_support_item_price LIMIT 3');
  console.log('Sample prices:', prices.rows);
  
  const categories = await pool.query('SELECT COUNT(*) as cnt FROM rate_set_category');
  console.log('Category rows:', categories.rows[0].cnt);
  
  const items = await pool.query('SELECT COUNT(*) as cnt FROM rate_set_support_item');
  console.log('Support item rows:', items.rows[0].cnt);
} catch (err) {
  console.error('Error:', err.message);
} finally {
  await pool.end();
  process.exit(0);
}
