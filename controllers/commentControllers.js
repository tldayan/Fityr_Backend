const db = require("../mysqlDb");

const getComments = async (req, res) => {
  const post_id = req.params.postId;
  let { page = 1, limit = 10, repliesLimit = 3 } = req.query;

  page = parseInt(page, 10);
  limit = parseInt(limit, 10);
  repliesLimit = parseInt(repliesLimit, 10);
  const offset = (page - 1) * limit;

  
  let userId = null;
  if (req.user?.stytch_user_id) {
    const [userRows] = await db.query(
      "SELECT id FROM users WHERE stytch_user_id = ?",
      [req.user.stytch_user_id]
    );
    userId = userRows.length ? userRows[0].id : null;
  }


  const [[{ total }]] = await db.query(
    "SELECT COUNT(*) AS total FROM comments WHERE post_id = ? AND parent_id IS NULL",
    [post_id]
  );


  const [comments] = await db.query(
    `
      SELECT c.*,
             u.username,
             u.profile_pic,
             u.id AS user_id,
             (SELECT COUNT(*) FROM comments r WHERE r.parent_id = c.id) AS totalReplies
      FROM comments c
      LEFT JOIN users u ON c.user_id = u.id
      WHERE c.post_id = ? AND c.parent_id IS NULL
      ORDER BY c.created_at DESC
      LIMIT ? OFFSET ?
    `,
    [post_id, limit, offset]
  );


  for (let comment of comments) {

    const [replies] = await db.query(
      `
        SELECT r.*, u.username, u.profile_pic, u.id AS user_id
        FROM comments r
        LEFT JOIN users u ON r.user_id = u.id
        WHERE r.parent_id = ?
        ORDER BY r.created_at DESC
        LIMIT ?
      `,
      [comment.id, repliesLimit]
    );
    comment.replies = replies;


    if (userId) {
      const [voteRows] = await db.query(
        "SELECT vote FROM comment_votes WHERE user_id = ? AND comment_id = ?",
        [userId, comment.id]
      );
      comment.userVote = voteRows.length ? voteRows[0].vote : null;
    } else {
      comment.userVote = null;
    }


    for (let reply of replies) {
      if (userId) {
        const [replyVoteRows] = await db.query(
          "SELECT vote FROM comment_votes WHERE user_id = ? AND comment_id = ?",
          [userId, reply.id]
        );
        reply.userVote = replyVoteRows.length ? replyVoteRows[0].vote : null;
      } else {
        reply.userVote = null;
      }
    }
  }

  res.json({
    data: comments,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  });
};





const createComment = async (req, res) => {
  try {
    const { postId } = req.params;
    const { comment, parent_id } = req.body;

    if (!postId || !comment || !comment.trim()) {
      return res.status(400).json({ message: "Post ID and non-empty comment are required" });
    }


    const sanitizedComment = comment.trim().slice(0, 500);


    const stytchUserId = req.user.stytch_user_id;
    const [userRows] = await db.query(
      "SELECT id, username, profile_pic FROM users WHERE stytch_user_id = ?",
      [stytchUserId]
    );

    if (userRows.length === 0) {
      return res.status(400).json({ error: "User not found" });
    }

    const { id: userId } = userRows[0];


    const [postRows] = await db.query("SELECT id FROM posts WHERE id = ?", [postId]);
    if (postRows.length === 0) {
      return res.status(400).json({ error: "Post not found" });
    }


    const parentIdNumber = parent_id != null ? Number(parent_id) : null;


    if (parentIdNumber != null) {
      const [parentRows] = await db.query("SELECT id FROM comments WHERE id = ?", [parentIdNumber]);
      if (parentRows.length === 0) {
        return res.status(400).json({ error: "Parent comment not found" });
      }
    }

   
    const [result] = await db.query(
      `INSERT INTO comments (comment, post_id, user_id, parent_id) VALUES (?, ?, ?, ?)`,
      [sanitizedComment, postId, userId, parentIdNumber]
    );

   
    const [newCommentRows] = await db.query(
      `
      SELECT 
        c.id, 
        c.comment, 
        c.post_id, 
        c.parent_id, 
        c.created_at, 
        c.updated_at, 
        c.vote, 
        u.id AS user_id, 
        u.username, 
        u.profile_pic
      FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.id = ?
      `,
      [result.insertId]
    );

    const newComment = newCommentRows[0];


    const message = parentIdNumber != null ? "Reply created successfully" : "Comment created successfully";

    return res.status(201).json({
      success: true,
      message,
      comment: newComment,
    });
  } catch (err) {
    console.error("❌ Insert error:", err);
    return res.status(500).json({ error: err.message });
  }
};


/* const handleVote = (req,res) => {

  const {commentId} = req.params

  


} */

const getCommentReplies = async (req, res) => {
  const commentId = req.params.commentId;


  let { page, limit, repliesCount } = req.query;
  console.log(repliesCount)

  page = parseInt(page, 10);
  limit = parseInt(limit, 10);
  repliesCount = parseInt(repliesCount, 10);


  if (isNaN(page) || page < 1) page = 1;
  if (isNaN(limit) || limit < 1) limit = 10;
  if (isNaN(repliesCount) || repliesCount < 0) repliesCount = 0;

  const offset = repliesCount + (page - 1) * limit;


  const [[{ total }]] = await db.query(
    "SELECT COUNT(*) AS total FROM comments WHERE parent_id = ?",
    [commentId]
  );


  const [replies] = await db.query(
    `
      SELECT r.*, u.username, u.profile_pic, u.id AS user_id
      FROM comments r
      LEFT JOIN users u ON r.user_id = u.id
      WHERE r.parent_id = ?
      ORDER BY r.created_at DESC
      LIMIT ? OFFSET ?
    `,
    [commentId, limit, offset]
  );

  return res.json({
    data: replies,
    meta: {
      total: total - repliesCount,
      page,
      limit,
      totalPages: Math.ceil((total - repliesCount) / limit),
    },
  });
};

const handleCommentVote = async (req, res) => {
  const commentId = req.params.commentId || req.query.commentId;
  const { voteType } = req.body; 
  const { stytch_user_id } = req.user;

  console.log(voteType, commentId)

  if (!commentId || voteType === undefined) {
    return res.status(400).json({ message: "commentId and voteType required" });
  }

  try {
   
    const [userRows] = await db.query(
      "SELECT id FROM users WHERE stytch_user_id = ?",
      [stytch_user_id]
    );

    if (userRows.length === 0) {
      return res.status(401).json({ message: "User not found" });
    }

    const userId = userRows[0].id;


    const [existing] = await db.query(
      "SELECT vote FROM comment_votes WHERE user_id = ? AND comment_id = ?",
      [userId, commentId]
    );

    const currentVote = existing.length ? existing[0].vote : null;


    if (voteType === null || currentVote === voteType) {
      if (currentVote !== null) {
        await db.query(
          "DELETE FROM comment_votes WHERE user_id = ? AND comment_id = ?",
          [userId, commentId]
        );

   
        await db.query(
          `UPDATE comments
           SET vote = vote ${currentVote === "upvote" ? "- 1" : "+ 1"}
           WHERE id = ?`,
          [commentId]
        );
      }

      return res.json({
        success: true,
        userVote: null,
        message: "Vote removed"
      });
    }

   
    if (currentVote === null) {
      await db.query(
        "INSERT INTO comment_votes (user_id, comment_id, vote) VALUES (?, ?, ?)",
        [userId, commentId, voteType]
      );

      await db.query(
        `UPDATE comments
         SET vote = vote ${voteType === "upvote" ? "+ 1" : "- 1"}
         WHERE id = ?`,
        [commentId]
      );

      return res.json({
        success: true,
        userVote: voteType,
        message: "Vote added"
      });
    }


    await db.query(
      "UPDATE comment_votes SET vote = ? WHERE user_id = ? AND comment_id = ?",
      [voteType, userId, commentId]
    );

    await db.query(
      `UPDATE comments
       SET vote = vote ${voteType === "upvote" ? "+ 2" : "- 2"}
       WHERE id = ?`,
      [commentId]
    );

    res.json({
      success: true,
      userVote: voteType,
      message: "Vote switched"
    });

  } catch (err) {
    console.error("Comment vote error:", err);
    res.status(500).json({ error: err.message });
  }
};




module.exports = { getComments, createComment, getCommentReplies, handleCommentVote};
