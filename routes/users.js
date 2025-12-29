const express = require("express");
const router = express.Router();
const { getUserContent, getUserProfile} = require("../controllers/usersControllers");


router.get("/usersContent", getUserContent);      
router.get("/:username", getUserProfile);      


module.exports = router;
