const stytchClient = require("../config/stytchClient");

const optionalAuth = async (req, res, next) => {

  try {
 
    let sessionJwt = req.cookies?.stytch_session_jwt;

  
    if (!sessionJwt && req.headers.authorization) {
      const parts = req.headers.authorization.split(" ");
      if (parts.length === 2 && parts[0] === "Bearer") {
        sessionJwt = parts[1];
      }
    }

    if (!sessionJwt) return next();

    const authRes = await stytchClient.sessions.authenticateJwt({ session_jwt: sessionJwt });
    if (!authRes?.session?.user_id) return next(); 


    req.user = {
      stytch_user_id: authRes.session.user_id,
      email: null, 
    };

    console.log("✅ Optional auth user:", req.user);
    next();
  } catch (err) {
    console.error("Optional auth error:", err);
    next();
  }
};

module.exports = optionalAuth;
