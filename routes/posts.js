const express = require("express");
const router = express.Router();
const { createPost, getPosts, handlePostVote } = require("../controllers/postControllers");
const { createComment, getComments, getCommentReplies, handleCommentVote } = require("../controllers/commentControllers");
const requireAuth = require("../middleware/auth");
const optionalAuth = require("../middleware/optionalAuth");


router.get("/", optionalAuth, getPosts);     
router.get("/:id", optionalAuth, getPosts); 


router.get("/:postId/comments", optionalAuth, getComments);
router.get("/comments/:commentId/replies", getCommentReplies);


router.post("/", requireAuth, createPost);
router.patch("/:id/vote", requireAuth, handlePostVote);


router.post("/:postId/comments", requireAuth, createComment);
router.patch("/:commentId/comments/vote", requireAuth, handleCommentVote);

module.exports = router;
