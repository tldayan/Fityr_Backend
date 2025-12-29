
const db = require("../mysqlDb");


const getUserProfile = async (req, res) => {
  try {
    const { username } = req.params;

    if (!username) {
      return res.status(400).json({ message: "Username is required" });
    }

    const q = `
      SELECT
        id,
        username,
        email,
        created_at,
        bio,
        gender,
        profile_pic,
        first_name,
        last_name
      FROM users
      WHERE username = ?
    `;

    const [rows] = await db.query(q, [username]);

    if (rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const user = rows[0];


    return res.status(200).json({
      id: user.id,
      username: user.username,
      email: user.email,
      createdAt: user.created_at,
      firstName: user.first_name,
      lastName: user.last_name,
      bio: user.bio,
      gender: user.gender,
      profilePic: user.profile_pic,
    });
  } catch (error) {
    console.error("getUserProfile error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};



/* const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms)); */

const getUserContent = async (req, res) => {
/*     await sleep(5000); */
  const { contentType, username } = req.query;
  let { page = 1, limit = 10 } = req.query;
console.log(contentType, username)
  page = Number(page);
  limit = Number(limit);
  const offset = (page - 1) * limit;

      const stytchUserId = req.user?.stytch_user_id;
    let loggedInUserId = null;

    if (stytchUserId) {
      const [userRow] = await db.query(
        "SELECT id FROM users WHERE stytch_user_id = ?",
        [stytchUserId]
      );
      if (userRow.length > 0) loggedInUserId = userRow[0].id;
    }

  try {
    if (contentType === "posts") {
      const [countResult] = await db.query(
        `
        SELECT COUNT(*) AS total
        FROM posts
        JOIN users ON users.id = posts.user_id
        WHERE users.username = ?
        `,
        [username]
      );

      const total = countResult[0].total;
      const totalPages = Math.ceil(total / limit);

     const query = `
      SELECT 
        posts.id,
        posts.title,
        posts.description,
        posts.created_at,
        users.username,
        (SELECT COUNT(*) FROM comments WHERE comments.post_id = posts.id) AS commentCount,
        (SELECT COUNT(*) FROM post_votes WHERE post_votes.post_id = posts.id) AS vote,
        ${loggedInUserId ? "pv.vote" : "NULL"} AS userVote
      FROM posts
      JOIN users ON users.id = posts.user_id
      ${loggedInUserId
        ? "LEFT JOIN post_votes pv ON pv.post_id = posts.id AND pv.user_id = ?"
        : ""
      }
      WHERE users.username = ?
      ORDER BY posts.created_at DESC
      LIMIT ? OFFSET ?
    `;


      const params = loggedInUserId
        ? [loggedInUserId, username, limit, offset]
        : [username, limit, offset];

      const [posts] = await db.query(query, params);

      return res.json({
        data: posts,
        meta: {
          total,
          page,
          limit,
          totalPages,
        },
      });
    }

    if (contentType === "comments") {
      // 1️⃣ Count total comments by user
      const [countResult] = await db.query(
        `
        SELECT COUNT(*) AS total
        FROM comments
        JOIN users ON users.id = comments.user_id
        WHERE users.username = ?
        `,
        [username]
      );

      const total = countResult[0].total;
      const totalPages = Math.ceil(total / limit);

      const query = `
        SELECT
          comments.id,
          comments.comment,
          comments.created_at,
          comments.updated_at,
          comments.vote,
          comments.parent_id,
          posts.id AS postId,
          posts.title AS postTitle,
          users.username,
          ${loggedInUserId ? "cv.vote" : "NULL"} AS userVote
        FROM comments
        JOIN users ON users.id = comments.user_id
        JOIN posts ON posts.id = comments.post_id
        ${loggedInUserId
          ? "LEFT JOIN comment_votes cv ON cv.comment_id = comments.id AND cv.user_id = ?"
          : ""
        }
        WHERE users.username = ?
        ORDER BY comments.created_at DESC
        LIMIT ? OFFSET ?
      `;

      const params = loggedInUserId
        ? [loggedInUserId, username, limit, offset]
        : [username, limit, offset];

      const [comments] = await db.query(query, params);

      return res.json({
        data: comments,
        meta: {
          total,
          page,
          limit,
          totalPages,
        },
      });
    }

    if (contentType === "events") {
      const [countResult] = await db.query(
        `
        SELECT COUNT(*) AS total
        FROM events
        JOIN users ON users.id = events.host_id
        WHERE users.username = ?
        `,
        [username]
      );

      const total = countResult[0].total;
      const totalPages = Math.ceil(total / limit);

      const query = `
        SELECT
          events.id,
          events.event_name,
          events.event_description,
          events.event_start_time,
          events.event_end_time,
          events.location,
          events.participants,
          events.image_url,
          events.created_at,
          events.updated_at,
          users.username AS hostUsername
        FROM events
        JOIN users ON users.id = events.host_id
        WHERE users.username = ?
        ORDER BY events.event_start_time DESC
        LIMIT ? OFFSET ?
      `;

      const params = [username, limit, offset];

      const [events] = await db.query(query, params);

      return res.json({
        data: events,
        meta: {
          total,
          page,
          limit,
          totalPages,
        },
      });
    }


    return res.status(400).json({ error: "Invalid content type" });
  } catch (err) {
    console.error("getUserContent error:", err);
    res.status(500).json({ error: "Server error" });
  }
};


module.exports = { getUserContent, getUserProfile };
