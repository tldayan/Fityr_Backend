const express = require("express");
const router = express.Router();
const { uploadEventBanner, uploadProfilePicture, uploadPostImages, } = require("../../controllers/awsControllers");
const requireAuth = require("../../middleware/auth");


router.post("/uploadEventBanner", uploadEventBanner)
router.post("/uploadProfilePic",requireAuth, uploadProfilePicture)
router.post("/uploadPostImages",requireAuth, uploadPostImages)


module.exports = router;