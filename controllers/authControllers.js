const db = require("../psqlDb");
const stytchClient = require("../config/stytchClient");

// =========================
// CHECK USERNAME AVAILABILITY
// =========================
const handleUsername = async (req, res) => {
  try {
    const { username } = req.body;

    const result = await db.query(
      "SELECT 1 FROM users WHERE username = $1",
      [username]
    );

    res.json({ available: result.rows.length === 0 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

// =========================
// SIGN UP
// =========================
const handleSignUp = async (req, res) => {
  console.log("SIGN UP REQ CAME");
  const { email, password, username, session_token } = req.body;

  if (!email || !password || !username) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
  
    const existingUsers = await db.query(
      "SELECT id FROM users WHERE email = $1",
      [email]
    );

    if (existingUsers.rows.length > 0) {
      return res.status(400).json({ error: "User already exists" });
    }

  
    const response = await stytchClient.passwords.sessions.reset({
      password: password,
      session_token: session_token,
       session_duration_minutes: 60
    });

    const stytchUserId = response.user_id;


    await stytchClient.users.update({
      user_id: stytchUserId,
      name: {
        first_name: username,
        last_name: "",
      },
      trusted_metadata: {
        username,
        profile_pic: null,
      },
    });


    await db.query(
      `
      INSERT INTO users (stytch_user_id, username, email, created_at)
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
      `,
      [stytchUserId, username, email]
    );


    res.status(201).json({
      success: true,
      message: "User created successfully",
      user: {
        stytch_user_id: stytchUserId,
        username,
        email,
        profile_pic: null,
        first_name: username,
        last_name: "",
        created_at: new Date().toISOString(),
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

    await stytchClient.sessions.authenticateJwt({ session_jwt });


    const result = await db.query(
      "SELECT * FROM users WHERE stytch_user_id = $1",
      [stytch_user_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.status(200).json({
      success: true,
      message: "Login successful",
      user: result.rows[0],
    });
  } catch (err) {
    console.error("JWT verification failed:", err);
    res.status(401).json({ error: "Invalid or expired session." });
  }
};

// =========================
// LOGOUT
// =========================
const handleLogout = async(req, res) => {

  try {
    const sessionJWT = req.cookies.stytch_session_jwt;
    const logout = await stytchClient.sessions.revoke({session_jwt: sessionJWT});
    console.log(logout)

  res.status(200).json({ message: "Logged out" });
  } catch (err) {
    console.error(err);
    res.status(400).end();
  }
};


const checkPasswordStrength = async (req, res) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ error: "Password is required" });
    }

    const result = await stytchClient.passwords.strengthCheck({
      password,
    });

    if (!result.valid_password) {
      const reasons = [];

      if (result.breached_password) {
        reasons.push("Password has appeared in a data breach");
      }

      if (result.feedback?.luds_requirements) {
        const luds = result.feedback.luds_requirements;

        if (luds.missing_characters > 0) {
          reasons.push(
            `Password needs ${luds.missing_characters} more characters`
          );
        }
        if (!luds.has_digit) reasons.push("Password must include a digit");
        if (!luds.has_lower_case)
          reasons.push("Password must include lowercase");
        if (!luds.has_upper_case)
          reasons.push("Password must include uppercase");
        if (!luds.has_symbol)
          reasons.push("Password must include a symbol");
      }

      if (result.feedback?.suggestions?.length > 0) {
        reasons.push(...result.feedback.suggestions);
      }

      if (result.feedback?.warning) {
        reasons.push(result.feedback.warning);
      }

      return res.status(400).json({
        error: reasons.join(", "),
      });

    }

    return res.status(200).json({
      valid: true,
      score: result.score,
    });
  } catch (err) {
    console.error("Password strength error:", err);
    return res.status(500).json({ error: "Password strength check failed" });
  }
};


module.exports = {
  handleLogin,
  handleSignUp,
  handleUsername,
  checkPasswordStrength,
  handleLogout,
};
