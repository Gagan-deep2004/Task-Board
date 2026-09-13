const { verifyJwt } = require('../utils/jwt');

module.exports = function (req, res, next) {
  const token = req.header('Authorization');
  if (!token) return res.status(401).json({ error: 'Access Denied: No token provided' });

  try {
    // Clients send tokens as "Bearer <token>" - strip the prefix.
    req.user = verifyJwt(token.replace('Bearer ', ''));
    next();
  } catch (err) {
    res.status(400).json({ error: 'Invalid Token' });
  }
};
