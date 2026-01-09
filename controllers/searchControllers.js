const db = require("../psqlDb");

const getSearch = async (req, res) => {
  try {
    const searchTerm = req.query.searchTerm;
    const type = req.query.type ?? "users";

    console.log("Received searchTerm:", searchTerm, "type:", type);

    if (!searchTerm || searchTerm.trim() === "") {
      return res.status(400).json({ message: "Missing search term" });
    }

    const usersQuery = `
      SELECT
        id,
        username,
        profile_pic,
        created_at
      FROM users
      WHERE username ILIKE $1
      LIMIT 10
    `;

    const { rows: users } = await db.query(usersQuery, [
      `%${searchTerm}%`,
    ]);

    console.log("Users results:", users);


    const postsQuery = `
    SELECT
      posts.id,
      posts.title,
      posts.description,
      posts.created_at,
      users.username,
      COALESCE(
        array_agg(post_images.image_url)
        FILTER (WHERE post_images.image_url IS NOT NULL),
        '{}'
      ) AS images
    FROM posts
    JOIN users ON posts.user_id = users.id
    LEFT JOIN post_images ON post_images.post_id = posts.id
    WHERE posts.title ILIKE $1
      OR posts.description ILIKE $1
    GROUP BY posts.id, users.username
    LIMIT 10
  `;


    const { rows: posts } = await db.query(postsQuery, [
      `%${searchTerm}%`,
    ]);

    console.log("Posts results:", posts);

    if (type === "users") {
      return res.json({
        users: users.map(u => ({ ...u, type: "users" })),
      });
    }

    return res.json({
      posts: posts.map(p => ({ ...p, type: "posts" })),
    });

  } catch (err) {
    console.error("Search error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = { getSearch };
