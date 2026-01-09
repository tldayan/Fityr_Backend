const whitelist = [
  "http://localhost:3000", 
  "https://fityr.xyz",
  "https://www.fityr.xyz"
];


const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || whitelist.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
  maxAge: 28800, 
};

module.exports = corsOptions;
