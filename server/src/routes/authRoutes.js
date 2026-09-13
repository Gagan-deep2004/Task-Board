const express = require('express');
const router = express.Router();

//Object Destructuring & Import: This imports the authController.js file you looked at earlier and extracts just the register and login functions out of it so they can be assigned to routes.
const { register, login } = require('../controllers/authController');


//call function when this POST request are triggered to this path
router.post('/register', register);
router.post('/login', login);

module.exports = router;


//router acts as a modular, mini-application just for handling routes. Instead of cluttering your main server file with every single route in your application, you can group related routes into their own file using a router, and then plug (or "mount") that router into your main app later.
