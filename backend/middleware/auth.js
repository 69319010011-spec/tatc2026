const jwt = require('jsonwebtoken');
const pool = require('../db/pool');

// Verifies the JWT, then re-reads the admin row so that disabling an account
// or changing its role takes effect immediately instead of waiting for the
// token to expire.
async function authenticateAdmin(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'Missing token' });
  }

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  try {
    const r = await pool.query(
      'SELECT admin_id, name, role, is_active FROM admins WHERE admin_id = $1',
      [payload.admin_id]
    );
    const admin = r.rows[0];
    if (!admin || !admin.is_active) {
      return res.status(401).json({ error: 'Account disabled or not found' });
    }
    req.admin = { admin_id: admin.admin_id, name: admin.name, role: admin.role };
    next();
  } catch (err) {
    next(err);
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.admin || !roles.includes(req.admin.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

module.exports = { authenticateAdmin, requireRole };
