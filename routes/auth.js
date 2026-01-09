const express = require("express");
const router = express.Router();
const { handleLogin, handleSignUp, handleUsername, handleLogout , checkPasswordStrength} = require("../controllers/authControllers");


router.post("/checkusername", handleUsername);

router.post("/checkPasswordStrength", checkPasswordStrength);
// Login
router.post("/login", handleLogin);

router.post("/logout", handleLogout)
// Sign up
router.post("/signup", handleSignUp);


module.exports = router;
