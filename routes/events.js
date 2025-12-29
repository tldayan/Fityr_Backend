const express = require("express");
const router = express.Router();
const optionalAuth = require("../middleware/optionalAuth");
const { getEvents, getParticipants, attendEvent, leaveEvent, createEvent} = require("../controllers/eventControllers");
const requireAuth = require("../middleware/auth");


router.get("/", getEvents);      
router.get("/:id", getEvents);  

router.get("/:id/participants", getParticipants);

router.post("/:id/attendEvent",requireAuth, attendEvent)
router.post("/:id/leaveEvent",requireAuth, leaveEvent)
router.post("/createEvent",requireAuth, createEvent)


module.exports = router;
