const express = require("express");
const router = express.Router();
const {handlePorfile, updateProfilePic, getProfileInfo, updateProfileInfo} = require("../../controllers/profileControllers");
const requireAuth = require("../../middleware/auth");


router.get("/profile", handlePorfile);
router.put("/updateProfilePic", requireAuth, updateProfilePic)
router.get("/profileInfo", requireAuth, getProfileInfo)
router.put("/updateProfileInfo", requireAuth, updateProfileInfo)


module.exports = router;
