const express = require("express");
const router = express.Router();
const { uploadEventBanner, uploadProfilePicture } = require("../../controllers/awsControllers");
const requireAuth = require("../../middleware/auth");


router.post("/uploadEventBanner", uploadEventBanner)
router.post("/uploadProfilePic",requireAuth, uploadProfilePicture)


module.exports = router;