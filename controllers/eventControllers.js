const db = require("../psqlDb");


const getEvents = async (req, res) => {
  let { page = 1, limit = 10, sort } = req.query;
  const id = req.params?.id || req.query?.id;

  page = Number(page);
  limit = Number(limit);
  const offset = (page - 1) * limit;

  try {
    if (id) {
      const eventResult = await db.query(
        `
        SELECT events.*, users.username
        FROM events
        JOIN users ON events.host_id = users.id
        WHERE events.id = $1
        `,
        [id]
      );

      if (!eventResult.rows.length) {
        return res.status(404).json({ message: "Event not found" });
      }

      return res.json(eventResult.rows[0]);
    }


    const orderBy = sort === "old" ? "ASC" : "DESC";

    const countResult = await db.query("SELECT COUNT(*) FROM events");
    const total = parseInt(countResult.rows[0].count, 10);
    const totalPages = Math.ceil(total / limit);

    const results = await db.query(
      `
      SELECT events.*, users.username
      FROM events
      JOIN users ON events.host_id = users.id
      ORDER BY events.created_at ${orderBy}
      LIMIT $1 OFFSET $2
      `,
      [limit, offset]
    );

    return res.json({
      data: results.rows,
      meta: { total, page, limit, totalPages },
    });
  } catch (err) {
    console.error("Get events error:", err);
    return res.status(500).json({ error: err.message });
  }
};


const getParticipants = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `
      SELECT 
        u.stytch_user_id AS user_id,
        u.username,
        u.profile_pic
      FROM event_participants ep
      JOIN users u ON ep.user_id = u.id
      WHERE ep.event_id = $1
      `,
      [id]
    );

    return res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error("Error fetching participants:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch participants",
    });
  }
};


const attendEvent = async (req, res) => {
  try {
    const id = req.params?.id || req.query?.id;
    const { stytch_user_id } = req.user;

    if (!id) return res.status(400).json({ message: "Event ID missing" });
    if (!stytch_user_id) return res.status(401).json({ message: "Unauthorized" });

    const userResult = await db.query(
      "SELECT id FROM users WHERE stytch_user_id = $1",
      [stytch_user_id]
    );

    if (!userResult.rows.length) {
      return res.status(404).json({ message: "User not found" });
    }

    const userId = userResult.rows[0].id;

    const eventResult = await db.query(
      "SELECT * FROM events WHERE id = $1",
      [id]
    );

    if (!eventResult.rows.length) {
      return res.status(404).json({ message: "Event not found" });
    }

    const event = eventResult.rows[0];

    if (
      event.max_participants &&
      event.participants >= event.max_participants
    ) {
      return res.status(400).json({ message: "Event is full" });
    }

    const existing = await db.query(
      `
      SELECT 1
      FROM event_participants
      WHERE event_id = $1 AND user_id = $2
      `,
      [id, userId]
    );

    if (existing.rows.length) {
      return res.status(400).json({ message: "Already joined" });
    }

    await db.query(
      `
      INSERT INTO event_participants (event_id, user_id)
      VALUES ($1, $2)
      `,
      [id, userId]
    );

    await db.query(
      `
      UPDATE events
      SET participants = participants + 1
      WHERE id = $1
      `,
      [id]
    );

    return res.status(201).json({ message: "Successfully joined event" });
  } catch (err) {
    console.error("Attend event error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};


const leaveEvent = async (req, res) => {
  try {
    const id = req.params?.id || req.query?.id;
    const { stytch_user_id } = req.user;

    if (!id) return res.status(400).json({ message: "Event ID missing" });

    const userResult = await db.query(
      "SELECT id FROM users WHERE stytch_user_id = $1",
      [stytch_user_id]
    );

    if (!userResult.rows.length) {
      return res.status(404).json({ message: "User not found" });
    }

    const userId = userResult.rows[0].id;

    const eventResult = await db.query(
      "SELECT * FROM events WHERE id = $1",
      [id]
    );

    if (!eventResult.rows.length) {
      return res.status(404).json({ message: "Event not found" });
    }

    if (eventResult.rows[0].host_id === userId) {
      return res.status(400).json({
        message: "Host cannot leave their own event",
      });
    }

    const deleteResult = await db.query(
      `
      DELETE FROM event_participants
      WHERE event_id = $1 AND user_id = $2
      `,
      [id, userId]
    );

    if (!deleteResult.rowCount) {
      return res.status(400).json({ message: "Not a participant" });
    }

    await db.query(
      `
      UPDATE events
      SET participants = participants - 1
      WHERE id = $1
      `,
      [id]
    );

    return res.json({ message: "Successfully left event" });
  } catch (err) {
    console.error("Leave event error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};


const createEvent = async (req, res) => {
  try {
    const {
      eventName,
      eventDescription,
      eventBanner,
      eventStartTime,
      eventEndTime,
      location,
    } = req.body;

    // 1️⃣ Validate required fields
    if (
      !eventName ||
      !eventDescription ||
      !eventBanner ||
      !eventStartTime ||
      !eventEndTime ||
      !location
    ) {
      return res.status(400).json({ error: "All event fields are required" });
    }

    // Optional: validate location is an object
    if (typeof location !== "object") {
      return res.status(400).json({ error: "Location must be an object" });
    }

    // 2️⃣ Find host user
    const userResult = await db.query(
      "SELECT id FROM users WHERE stytch_user_id = $1",
      [req.user.stytch_user_id]
    );

    if (!userResult.rows.length) {
      return res.status(400).json({ error: "User not found" });
    }

    const hostId = userResult.rows[0].id;

    // 3️⃣ Insert event
    await db.query(
      `
      INSERT INTO events (
        event_name,
        event_description,
        event_start_time,
        event_end_time,
        host_id,
        location,
        image_url,
        participants
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `,
      [
        eventName,
        eventDescription,
        eventStartTime,
        eventEndTime,
        hostId,
        JSON.stringify(location),
        eventBanner,
        1,
      ]
    );

    res.json({ ok: true, message: "Event created successfully!" });
  } catch (err) {
    console.error("Create event error:", err);
    res.status(500).json({ error: "Server error creating event" });
  }
};


module.exports = {
  getEvents,
  getParticipants,
  attendEvent,
  leaveEvent,
  createEvent,
};
