const db = require("../psqlDb");


const createPost = async (req, res) => {
  const { title, description } = req.body;

  if (!title || !description) {
    return res.status(400).json({
      message: "Title and description are required.",
    });
  }

  try {
    const userResult = await db.query(
      "SELECT id FROM users WHERE stytch_user_id = $1",
      [req.user.stytch_user_id]
    );

    if (!userResult.rows.length) {
      return res.status(400).json({ error: "User not found" });
    }

    const userId = userResult.rows[0].id;

    const insertResult = await db.query(
      `
      INSERT INTO posts (title, description, user_id)
      VALUES ($1, $2, $3)
      RETURNING id
      `,
      [title, description, userId]
    );

    res.status(201).json({
      success: true,
      message: "Post created successfully",
      post: {
        id: insertResult.rows[0].id,
        title,
        description,
        user_id: userId,
      },
    });
  } catch (err) {
    console.error("Insert error:", err);
    res.status(500).json({ error: err.message });
  }
};


const getPosts = async (req, res) => {
  const postId = req.params?.id || req.query?.id;
  let { page = 1, limit = 10, sort } = req.query;

  page = Number(page);
  limit = Number(limit);
  const offset = (page - 1) * limit;

  try {
    let loggedInUserId = null;

    if (req.user?.stytch_user_id) {
      const userResult = await db.query(
        "SELECT id FROM users WHERE stytch_user_id = $1",
        [req.user.stytch_user_id]
      );
      loggedInUserId = userResult.rows[0]?.id ?? null;
    }


    if (postId) {
      const query = `
        SELECT 
          posts.*,
          users.username,
          (SELECT COUNT(*) FROM comments WHERE comments.post_id = posts.id) AS "commentCount",
          ${loggedInUserId ? "pv.vote" : "NULL"} AS "userVote"
        FROM posts
        JOIN users ON posts.user_id = users.id
        ${loggedInUserId
          ? "LEFT JOIN post_votes pv ON pv.post_id = posts.id AND pv.user_id = $1"
          : ""}
        WHERE posts.id = $${loggedInUserId ? 2 : 1}
      `;

      const params = loggedInUserId
        ? [loggedInUserId, postId]
        : [postId];

      const result = await db.query(query, params);

      if (!result.rows.length) {
        return res.status(404).json({ message: "Post not found" });
      }

      return res.json(result.rows[0]);
    }


    const orderBy = sort === "old" ? "ASC" : "DESC";

    const countResult = await db.query("SELECT COUNT(*) FROM posts");
    const total = parseInt(countResult.rows[0].count, 10);
    const totalPages = Math.ceil(total / limit);

    const query = `
      SELECT 
        posts.*,
        users.username,
        (SELECT COUNT(*) FROM comments WHERE comments.post_id = posts.id) AS "commentCount",
        ${loggedInUserId ? "pv.vote" : "NULL"} AS "userVote"
      FROM posts
      JOIN users ON posts.user_id = users.id
      ${loggedInUserId
        ? "LEFT JOIN post_votes pv ON pv.post_id = posts.id AND pv.user_id = $1"
        : ""}
      ORDER BY posts.created_at ${orderBy}
      LIMIT $${loggedInUserId ? 2 : 1}
      OFFSET $${loggedInUserId ? 3 : 2}
    `;

    const params = loggedInUserId
      ? [loggedInUserId, limit, offset]
      : [limit, offset];

    const results = await db.query(query, params);

    res.json({
      data: results.rows,
      meta: { total, page, limit, totalPages },
    });
  } catch (err) {
    console.error("Get posts error:", err);
    res.status(500).json({ error: err.message });
  }
};


const handlePostVote = async (req, res) => {
  const postId = req.params?.id || req.query?.id;
  const { voteType } = req.body;
  const { stytch_user_id } = req.user;

  if (!postId || voteType === undefined) {
    return res.status(400).json({
      message: "postId and voteType required",
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
      "SELECT vote FROM post_votes WHERE user_id = $1 AND post_id = $2",
      [userId, postId]
    );

    const currentVote = existingResult.rows[0]?.vote ?? null;

    if (voteType === null || currentVote === voteType) {
      if (currentVote !== null) {
        await db.query(
          "DELETE FROM post_votes WHERE user_id = $1 AND post_id = $2",
          [userId, postId]
        );

        await db.query(
          `
          UPDATE posts
          SET vote = vote ${currentVote === "upvote" ? "- 1" : "+ 1"}
          WHERE id = $1
          `,
          [postId]
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
        INSERT INTO post_votes (user_id, post_id, vote)
        VALUES ($1, $2, $3)
        `,
        [userId, postId, voteType]
      );

      await db.query(
        `
        UPDATE posts
        SET vote = vote ${voteType === "upvote" ? "+ 1" : "- 1"}
        WHERE id = $1
        `,
        [postId]
      );

      return res.json({
        success: true,
        userVote: voteType,
        message: "Vote added",
      });
    }


    await db.query(
      `
      UPDATE post_votes
      SET vote = $1
      WHERE user_id = $2 AND post_id = $3
      `,
      [voteType, userId, postId]
    );

    await db.query(
      `
      UPDATE posts
      SET vote = vote ${voteType === "upvote" ? "+ 2" : "- 2"}
      WHERE id = $1
      `,
      [postId]
    );

    res.json({
      success: true,
      userVote: voteType,
      message: "Vote switched",
    });
  } catch (err) {
    console.error("Vote error:", err);
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  createPost,
  getPosts,
  handlePostVote,
};
