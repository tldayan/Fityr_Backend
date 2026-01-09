const rateLimit = require("express-rate-limit");
const { ipKeyGenerator } = require("express-rate-limit");


const userRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, 
  keyGenerator: (req) => {
   
    if (req.user?.stytch_user_id) return req.user.stytch_user_id;

    return ipKeyGenerator(req);
  },
  handler: (req, res) => {
    return res.status(429).json({ error: "Too many requests, please slow down" });
  },
});

module.exports = userRateLimiter;
