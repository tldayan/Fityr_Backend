const express = require("express");
const router = express.Router();
const { handleLogin, handleSignUp, handleUsername, handleLogout } = require("../controllers/authControllers");


router.post("/checkusername", handleUsername);
// Login
router.post("/login", handleLogin);

router.post("/logout", handleLogout)
// Sign up
router.post("/signup", handleSignUp);

// Refresh token
/* router.post("/refresh", handleRefresh);

// Magic link authentication
router.get("/authenticate", handleAuthenticate); */

module.exports = router;
