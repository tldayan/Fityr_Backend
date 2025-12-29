const whitelist = ["http://localhost:3000"];

const corsOptions = {
origin: (origin, callback) => {
    callback(null, true);
  },
  credentials: true,
  optionsSuccessStatus: 200,
  maxAge: 28800, 
};



/* const corsOptions = {
  origin: true,  // Allow all origins
  credentials: true,
  optionsSuccessStatus: 200,
}; */

module.exports = corsOptions;
