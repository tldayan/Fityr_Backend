const db = require("../mysqlDb");
const stytchClient = require("../config/stytchClient");

// SIGN UP
const handleUsername = async(req,res) => {

 const { username } = req.body;
 
  const [existing] = await db.query("SELECT * FROM users WHERE username = ?", [username]);
  if (existing.length > 0) return res.json({ available: false });
  res.json({ available: true });

}


const handleSignUp = async (req, res) => {
  const { email, password, username, session_token } = req.body;

  if (!email || !password || !username || !session_token) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const [existingUsers] = await db.query("SELECT * FROM users WHERE email = ?", [email]);
    if (existingUsers.length > 0) {
      return res.status(400).json({ error: "User already exists" });
    }

  
    const response = await stytchClient.passwords.sessions.reset({
      password,
      session_token,
      session_duration_minutes: 60,
    });

    console.log("✅ Stytch password reset response:", response);
const stytchUserId = response.user_id;
    await stytchClient.users.update({
      user_id: stytchUserId,
      name: {
        first_name: username,
        last_name: "",
      },
      trusted_metadata: { username, profile_pic: undefined }, 
    });

    console.log("✅ Stytch user updated with username");

    await db.query(
      "INSERT INTO users (stytch_user_id, username, email, created_at) VALUES (?, ?, ?, NOW())",
      [response.user_id, username, email]
    );

    res.cookie("stytch_session_jwt", response.session_jwt, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 60 * 60 * 1000, // 1 hr
    });


   res.status(201).json({
  success: true,
  message: "User created successfully",
  user: {
    id: response.user_id, 
    username,
    email,
    profile_pic: null,
    first_name: username,
    last_name: "",
    created_at: new Date().toISOString(),
    stytch_user_id: response.user_id
  },
});


  } catch (err) {
    console.error("Signup error:", err);
    const msg = err.error_message || err.message || "Signup failed";
    res.status(400).json({ error: msg });
  }
};

// =========================
// LOGIN
// =========================
const handleLogin = async (req, res) => {
  const { session_jwt, stytch_user_id } = req.body;

  if (!session_jwt || !stytch_user_id) {
    return res.status(400).json({ error: "Missing session_jwt or user_id" });
  }

  try {
    const verifyResp = await stytchClient.sessions.authenticateJwt({ session_jwt });

    const [existingUser] = await db.query("SELECT * FROM users WHERE stytch_user_id = ?", [stytch_user_id]);
    if (!existingUser.length) {
      return res.status(404).json({ error: "User not found" });
    }

    res.cookie("stytch_session_jwt", session_jwt, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 60 * 60 * 1000,
    });

    res.status(200).json({
      success: true,
      message: "Login successful",
      user: existingUser[0],
    });
  } catch (err) {
    console.error("JWT verification failed:", err);
    res.status(401).json({ error: "Invalid or expired session." });
  }
};


const handleLogout = (req,res) => {
  res.clearCookie("stytch_session_jwt", { path: "/", httpOnly: true, secure: true, sameSite: "strict" });
  res.status(200).json({ message: "Logged out" });
}


module.exports = {
  handleLogin,
  handleSignUp,
  handleUsername,
  handleLogout
};
