const db = require("../psqlDb");

const getComments = async (req, res) => {
  const post_id = req.params.postId;
  let { page = 1, limit = 10, repliesLimit = 3 } = req.query;

  page = Number(page);
  limit = Number(limit);
  repliesLimit = Number(repliesLimit);
  const offset = (page - 1) * limit;

  let userId = null;

  if (req.user?.stytch_user_id) {
    const { rows } = await db.query(
      "SELECT id FROM users WHERE stytch_user_id = $1",
      [req.user.stytch_user_id]
    );
    userId = rows[0]?.id ?? null;
  }

  const totalResult = await db.query(
    "SELECT COUNT(*) FROM comments WHERE post_id = $1 AND parent_id IS NULL",
    [post_id]
  );

  const total = parseInt(totalResult.rows[0].count, 10);

  const commentsResult = await db.query(
    `
    SELECT c.*,
           u.username,
           u.profile_pic,
           u.id AS user_id,
           (SELECT COUNT(*) FROM comments r WHERE r.parent_id = c.id) AS "totalReplies"
    FROM comments c
    LEFT JOIN users u ON c.user_id = u.id
    WHERE c.post_id = $1 AND c.parent_id IS NULL
    ORDER BY c.created_at DESC
    LIMIT $2 OFFSET $3
    `,
    [post_id, limit, offset]
  );

  const comments = commentsResult.rows;

  for (const comment of comments) {
    const repliesResult = await db.query(
      `
      SELECT r.*, u.username, u.profile_pic, u.id AS user_id
      FROM comments r
      LEFT JOIN users u ON r.user_id = u.id
      WHERE r.parent_id = $1
      ORDER BY r.created_at DESC
      LIMIT $2
      `,
      [comment.id, repliesLimit]
    );

    comment.replies = repliesResult.rows;

    if (userId) {
      const voteResult = await db.query(
        "SELECT vote FROM comment_votes WHERE user_id = $1 AND comment_id = $2",
        [userId, comment.id]
      );
      comment.userVote = voteResult.rows[0]?.vote ?? null;
    } else {
      comment.userVote = null;
    }

    for (const reply of comment.replies) {
      if (userId) {
        const replyVoteResult = await db.query(
          "SELECT vote FROM comment_votes WHERE user_id = $1 AND comment_id = $2",
          [userId, reply.id]
        );
        reply.userVote = replyVoteResult.rows[0]?.vote ?? null;
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

    if (!comment?.trim()) {
      return res.status(400).json({ message: "Comment required" });
    }

    const sanitizedComment = comment.trim().slice(0, 500);
    const parentId = parent_id ? Number(parent_id) : null;

    const userResult = await db.query(
      "SELECT id, username, profile_pic FROM users WHERE stytch_user_id = $1",
      [req.user.stytch_user_id]
    );

    if (!userResult.rows.length) {
      return res.status(400).json({ error: "User not found" });
    }

    const userId = userResult.rows[0].id;

    const insertResult = await db.query(
      `
      INSERT INTO comments (comment, post_id, user_id, parent_id)
      VALUES ($1, $2, $3, $4)
      RETURNING id
      `,
      [sanitizedComment, postId, userId, parentId]
    );

    const newCommentId = insertResult.rows[0].id;

    const newCommentResult = await db.query(
      `
      SELECT c.*, u.username, u.profile_pic, u.id AS user_id
      FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.id = $1
      `,
      [newCommentId]
    );

    res.status(201).json({
      success: true,
      comment: newCommentResult.rows[0],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};


const getCommentReplies = async (req, res) => {
  const { commentId } = req.params;
  let { page = 1, limit = 10, repliesCount = 0 } = req.query;

  page = Number(page);
  limit = Number(limit);
  repliesCount = Number(repliesCount);

  const offset = repliesCount + (page - 1) * limit;

  const totalResult = await db.query(
    "SELECT COUNT(*) FROM comments WHERE parent_id = $1",
    [commentId]
  );

  const total = parseInt(totalResult.rows[0].count, 10);

  const repliesResult = await db.query(
    `
    SELECT r.*, u.username, u.profile_pic, u.id AS user_id
    FROM comments r
    LEFT JOIN users u ON r.user_id = u.id
    WHERE r.parent_id = $1
    ORDER BY r.created_at DESC
    LIMIT $2 OFFSET $3
    `,
    [commentId, limit, offset]
  );

  res.json({
    data: repliesResult.rows,
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
  const { voteType } = req.body; // "upvote" | "downvote" | null
  const { stytch_user_id } = req.user;

  if (!commentId || voteType === undefined) {
    return res.status(400).json({
      message: "commentId and voteType are required",
    });
  }

  try {

    const userResult = await db.query(
      "SELECT id FROM users WHERE stytch_user_id = $1",
      [stytch_user_id]
    );

    if (!userResult.rows.length) {
      return res.status(401).json({ message: "User not found" });
    }

    const userId = userResult.rows[0].id;


    const existingResult = await db.query(
      "SELECT vote FROM comment_votes WHERE user_id = $1 AND comment_id = $2",
      [userId, commentId]
    );

    const currentVote = existingResult.rows[0]?.vote ?? null;

  
    if (voteType === null || currentVote === voteType) {
      if (currentVote !== null) {
        await db.query(
          "DELETE FROM comment_votes WHERE user_id = $1 AND comment_id = $2",
          [userId, commentId]
        );

        await db.query(
          `
          UPDATE comments
          SET vote = vote ${currentVote === "upvote" ? "- 1" : "+ 1"}
          WHERE id = $1
          `,
          [commentId]
        );
      }

      return res.json({
        success: true,
        userVote: null,
        message: "Vote removed",
      });
    }


    if (currentVote === null) {
      await db.query(
        `
        INSERT INTO comment_votes (user_id, comment_id, vote)
        VALUES ($1, $2, $3)
        `,
        [userId, commentId, voteType]
      );

      await db.query(
        `
        UPDATE comments
        SET vote = vote ${voteType === "upvote" ? "+ 1" : "- 1"}
        WHERE id = $1
        `,
        [commentId]
      );

      return res.json({
        success: true,
        userVote: voteType,
        message: "Vote added",
      });
    }

    await db.query(
      `
      UPDATE comment_votes
      SET vote = $1
      WHERE user_id = $2 AND comment_id = $3
      `,
      [voteType, userId, commentId]
    );

    await db.query(
      `
      UPDATE comments
      SET vote = vote ${voteType === "upvote" ? "+ 2" : "- 2"}
      WHERE id = $1
      `,
      [commentId]
    );

    return res.json({
      success: true,
      userVote: voteType,
      message: "Vote switched",
    });
  } catch (err) {
    console.error("❌ Comment vote error:", err);
    return res.status(500).json({ error: err.message });
  }
};



module.exports = { getComments, createComment, getCommentReplies, handleCommentVote};
