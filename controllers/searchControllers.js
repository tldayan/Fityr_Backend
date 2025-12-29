const db = require("../mysqlDb");

const getSearch = async (req, res) => {
  try {
    const searchTerm = req.query.searchTerm;
    const type = req.query.type ?? "users";

    console.log("Received searchTerm:", searchTerm, "type:", type);

    if (!searchTerm || searchTerm.trim() === "") {
      return res.status(400).json({ message: "Missing search term" });
    }

    const [users] = await db.query(
      "SELECT id, username, profile_pic, created_at FROM users WHERE username LIKE ? LIMIT 10",
      [`%${searchTerm}%`]
    );
    console.log("Users results:", users);

    const [posts] = await db.query(
      `SELECT 
         posts.id,
         posts.title,
         posts.description,
         posts.created_at,
         users.username
       FROM posts
       JOIN users ON posts.user_id = users.id
       WHERE posts.title LIKE ? OR posts.description LIKE ?
       LIMIT 10`,
      [`%${searchTerm}%`, `%${searchTerm}%`]
    );
    console.log("Posts results:", posts);

    if (type === "users") {
      res.json({ users: users.map(u => ({ ...u, type: "users" })) });
    } else {
      res.json({ posts: posts.map(p => ({ ...p, type: "posts" })) });
    }

  } catch (err) {
    console.error("Search error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = { getSearch };
