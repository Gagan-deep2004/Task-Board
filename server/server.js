const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const http = require('http');
const multer = require('multer');
require('dotenv').config();

const app = express();
const httpServer = http.createServer(app);

// Middleware to parse JSON body
app.use(cors());
app.use(express.json());

// Import routes
const authRoutes = require('./src/routes/authRoutes');
const boardRoutes = require('./src/routes/boardRoutes');

// Hook up routes to your Express app
app.use('/api/auth', authRoutes);
app.use('/api/boards', boardRoutes);

// Turns Multer's file-too-large/wrong-type errors into JSON instead of
// falling through to Express's default HTML error page.
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError || err?.message?.startsWith('Unsupported file type')) {
    return res.status(400).json({ error: err.message });
  }
  next(err);
});

//Connect to the Database
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('Successfully connected to MongoDB!'))
  .catch((err) => console.error('MongoDB connection error:', err));

const { initSockets } = require('./src/sockets');
initSockets(httpServer)
  .then((io) => app.set('io', io))
  .catch((err) => console.error('Failed to initialize sockets:', err));

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
