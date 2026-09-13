const jwt = require('jsonwebtoken');

// Shared between the HTTP verifyToken middleware and the Socket.io auth
// middleware so token verification only lives in one place.
function verifyJwt(token) {
  return jwt.verify(token, process.env.JWT_SECRET);
}

module.exports = { verifyJwt };
