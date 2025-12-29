
const db = require("../mysqlDb");


const createPost = async (req, res) => {
  const { title, description } = req.body;

  if (!title || !description) {
    return res.status(400).json({ message: "Title and description are required." });
  }

  const stytchUserId = req.user.stytch_user_id;

  try { 

    const [rows] = await db.query("SELECT id FROM users WHERE stytch_user_id = ?", [stytchUserId]);
    if (rows.length === 0) {
      return res.status(400).json({ error: "User not found" });
    }
    const userId = rows[0].id;


    const [result] = await db.query(
      "INSERT INTO posts (title, description, user_id) VALUES (?, ?, ?)",
      [title, description, userId]
    );


    res.status(201).json({
      success: true,
      message: "Post created successfully",
      post: { id: result.insertId, title, description, user_id: userId },
    });
  } catch (err) {
    console.error("Insert error:", err);
    res.status(500).json({ error: err.message });
  }
};


const getPosts = async (req, res) => {
  const postId = req.params.id || req.query.id;
  let { page = 1, limit = 10, sort } = req.query;

  page = parseInt(page, 10);
  limit = parseInt(limit, 10);
  const offset = (page - 1) * limit;

  try {

    const stytchUserId = req.user?.stytch_user_id;
    let loggedInUserId = null;

    if (stytchUserId) {
      const [userRow] = await db.query(
        "SELECT id FROM users WHERE stytch_user_id = ?",
        [stytchUserId]
      );
      if (userRow.length > 0) loggedInUserId = userRow[0].id;
    }

    if (postId) {
      const query = `
        SELECT 
          posts.*, 
          users.username,
          (SELECT COUNT(*) FROM comments WHERE comments.post_id = posts.id) AS commentCount,
          ${loggedInUserId ? "pv.vote" : "NULL"} AS userVote
        FROM posts
        JOIN users ON posts.user_id = users.id
        ${loggedInUserId ? "LEFT JOIN post_votes pv ON pv.post_id = posts.id AND pv.user_id = ?" : ""}
        WHERE posts.id = ?
      `;
      const params = loggedInUserId ? [loggedInUserId, postId] : [postId];
      const [results] = await db.query(query, params);

      if (results.length === 0) {
        return res.status(404).json({ message: "Post not found" });
      }

      return res.json(results[0]);
    }

    const orderBy = sort === "old" ? "ASC" : "DESC";

    const [countResult] = await db.query("SELECT COUNT(*) as total FROM posts");
    const total = countResult[0].total;
    const totalPages = Math.ceil(total / limit);

    const query = `
      SELECT 
        posts.*, 
        users.username,
        (SELECT COUNT(*) FROM comments WHERE comments.post_id = posts.id) AS commentCount,
        ${loggedInUserId ? "pv.vote" : "NULL"} AS userVote
      FROM posts
      JOIN users ON posts.user_id = users.id
      ${loggedInUserId ? "LEFT JOIN post_votes pv ON pv.post_id = posts.id AND pv.user_id = ?" : ""}
      ORDER BY posts.created_at ${orderBy}
      LIMIT ? OFFSET ?
    `;

    const params = loggedInUserId ? [loggedInUserId, limit, offset] : [limit, offset];
    const [results] = await db.query(query, params);

    return res.json({
      data: results,
      meta: { total, page, limit, totalPages },
    });
  } catch (err) {
    console.error("Get posts error:", err);
    return res.status(500).json({ error: err.message });
  }
};





const handlePostVote = async (req, res) => {

  const postId = req.params.id || req.query.id;
  const { voteType } = req.body;
  const { stytch_user_id } = req.user;


  if (!postId || voteType === undefined) {
    return res.status(400).json({ message: "postId and voteType required" });
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
      "SELECT vote FROM post_votes WHERE user_id = ? AND post_id = ?",
      [userId, postId]
    );

    let currentVote = existing.length ? existing[0].vote : null;

    if (voteType === null) {
      if (currentVote !== null) {
        await db.query(
          "DELETE FROM post_votes WHERE user_id = ? AND post_id = ?",
          [userId, postId]
        );

        await db.query(
          `UPDATE posts
           SET vote = vote ${currentVote === "upvote" ? "- 1" : "+ 1"}
           WHERE id = ?`,
          [postId]
        );
      }

      return res.json({
        success: true,
        userVote: null,
        message: "Vote removed"
      });
    }


    if (currentVote === voteType) {
      await db.query(
        "DELETE FROM post_votes WHERE user_id = ? AND post_id = ?",
        [userId, postId]
      );


      await db.query(
        `UPDATE posts
         SET vote = vote ${voteType === "upvote" ? "- 1" : "+ 1"}
         WHERE id = ?`,
        [postId]
      );

      return res.json({
        success: true,
        userVote: null,
        message: "Vote removed"
      });
    }

  
    if (currentVote === null) {
      await db.query(
        "INSERT INTO post_votes (user_id, post_id, vote) VALUES (?, ?, ?)",
        [userId, postId, voteType]
      );

      await db.query(
        `UPDATE posts
         SET vote = vote ${voteType === "upvote" ? "+ 1" : "- 1"}
         WHERE id = ?`,
        [postId]
      );

      return res.json({
        success: true,
        userVote: voteType,
        message: "Vote added"
      });
    }


    await db.query(
      "UPDATE post_votes SET vote = ? WHERE user_id = ? AND post_id = ?",
      [voteType, userId, postId]
    );

    await db.query(
      `UPDATE posts
       SET vote = vote ${voteType === "upvote" ? "+ 2" : "- 2"}
       WHERE id = ?`,
      [postId]
    );

    res.json({
      success: true,
      userVote: voteType,
      message: "Vote switched"
    });

  } catch (err) {
    console.error("Vote error:", err);
    res.status(500).json({ error: err.message });
  }
};


module.exports = { createPost, getPosts, handlePostVote };
