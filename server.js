require("dotenv").config();
const express = require("express");
const app = express();
const db = require("./mysqlDb");
const postRoutes = require("./routes/posts");
const eventRoutes = require("./routes/events");
const searchRoutes = require("./routes/search");
const authRoutes = require("./routes/auth");
const cors = require("cors");
const corsOptions = require("./config/corsOption");
const cookieParser = require("cookie-parser");
const awsRoutes  = require("./routes/protectedRoutes/aws")
const profileRoutes  = require("./routes/protectedRoutes/profile")
const usersRoutes  = require("./routes/users")

app.use(express.json()); 
app.use(cors(corsOptions));
app.use(cookieParser());


// PUBLIC ROUTES
app.use("/aws", awsRoutes);
app.use("/posts", postRoutes);
app.use("/events", eventRoutes);
app.use("/", searchRoutes);
app.use("/auth", authRoutes);
app.use("/profile", profileRoutes)
app.use("/users", usersRoutes)


const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
