const stytchClient = require("../config/stytchClient");

const requireAuth = async (req, res, next) => {
  try {
    const sessionJwt = req.cookies.stytch_session_jwt;

    if (!sessionJwt) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const authRes = await stytchClient.sessions.authenticateJwt({ session_jwt: sessionJwt });

    if (!authRes?.session?.user_id) {
      return res.status(401).json({ error: "Invalid session object" });
    }

    req.user = {
      stytch_user_id: authRes.session.user_id,
      email: null, 
    };

    console.log("✅ Authenticated user:", req.user);
    next();
  } catch (err) {
    console.error("Auth middleware error:", err);
    return res.status(401).json({ error: "Invalid or expired session" });
  }
};

module.exports = requireAuth;
