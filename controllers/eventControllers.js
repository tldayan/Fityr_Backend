const db = require("../mysqlDb");


const getEvents = async (req, res) => {
  let { page = 1, limit = 10, sort } = req.query;
  const {id} = req.params || req.query

  console.log(page, limit, sort)

  page = parseInt(page, 10);
  limit = parseInt(limit, 10);
  const offset = (page - 1) * limit;

  try {

    if(id) {

      console.log(id)

      const eventResult = await db.query(
        "SELECT events.*, users.username FROM events JOIN users ON events.host_id = users.id WHERE events.id = ?",
        [id]
      );

      if (eventResult.length === 0) {
        return res.status(404).json({ message: "Event not found" });
      }

      const event = eventResult[0]


      return res.json(event)
    }


    const orderBy = sort === "old" ? "ASC" : "DESC";


    const [countResult] = await db.query("SELECT COUNT(*) AS total FROM events");
    const total = countResult[0].total;
    const totalPages = Math.ceil(total / limit);


    const query = `
      SELECT 
        events.*,
        users.username
      FROM events
      JOIN users ON events.host_id = users.id
      ORDER BY events.created_at ${orderBy}
      LIMIT ? OFFSET ?
    `;

    const [results] = await db.query(query, [limit, offset]);

    return res.json({
      data: results,
      meta: { total, page, limit, totalPages },
    });

  } catch (err) {
    console.error("Get events error:", err);
    return res.status(500).json({ error: err.message });
  }
};


const getParticipants = async (req, res) => {
  console.log("participant get came");
  try {
    const { id } = req.params;

    const [rows] = await db.query(
      `
      SELECT 
        u.stytch_user_id as user_id,
        u.username,
        u.profile_pic
      FROM event_participants ep
      INNER JOIN users u ON ep.user_id = u.id
      WHERE ep.event_id = ?
      `
      [id]
    );

    return res.json({
      success: true,
      data: rows,
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
    const { id } = req.params || req.query;
    const { stytch_user_id } = req.user; 

    console.log(id, stytch_user_id)

    if (!id) {
      return res.status(400).json({ message: "Event ID missing" });
    }

    if (!stytch_user_id) {
      return res.status(401).json({ message: "User not authenticated" });
    }


    const [userRows] = await db.query(
      "SELECT id FROM users WHERE stytch_user_id = ?",
      [stytch_user_id]
    );

    if (userRows.length === 0) {
      return res.status(404).json({ message: "User not found in DB" });
    }

    const userId = userRows[0].id;


    const [eventRows] = await db.query(
      "SELECT * FROM events WHERE id = ?",
      [id]
    );

    if (eventRows.length === 0) {
      return res.status(404).json({ message: "Event not found" });
    }

    const event = eventRows[0];


    if (event.max_participants && event.participants >= event.max_participants) {
      return res.status(400).json({ message: "Event is full" });
    }

 
    const [existing] = await db.query(
      "SELECT * FROM event_participants WHERE event_id = ? AND user_id = ?",
      [id, userId]
    );

    if (existing.length > 0) {
      return res.status(400).json({ message: "You already joined this event" });
    }


    await db.query(
      "INSERT INTO event_participants (event_id, user_id) VALUES (?, ?)",
      [id, userId]
    );


    await db.query(
      "UPDATE events SET participants = participants + 1 WHERE id = ?",
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
    const { id } = req.params || req.query; 
    const { stytch_user_id } = req.user;

    if (!id) {
      return res.status(400).json({ message: "Event ID missing" });
    }

    if (!stytch_user_id) {
      return res.status(401).json({ message: "User not authenticated" });
    }


    const [userRows] = await db.query(
      "SELECT id FROM users WHERE stytch_user_id = ?",
      [stytch_user_id]
    );

    if (userRows.length === 0) {
      return res.status(404).json({ message: "User not found in DB" });
    }

    const userId = userRows[0].id;


    const [eventRows] = await db.query(
      "SELECT * FROM events WHERE id = ?",
      [id]
    );

    if (eventRows.length === 0) {
      return res.status(404).json({ message: "Event not found" });
    }

    const event = eventRows[0];


    if (event.host_id === userId) {
      return res.status(400).json({
        message: "Host cannot leave their own event"
      });
    }


    const [existing] = await db.query(
      "SELECT * FROM event_participants WHERE event_id = ? AND user_id = ?",
      [id, userId]
    );

    if (existing.length === 0) {
      return res.status(400).json({ message: "You have not joined this event" });
    }


    const [deleteResult] = await db.query(
      "DELETE FROM event_participants WHERE event_id = ? AND user_id = ?",
      [id, userId]
    );

    if (deleteResult.affectedRows > 0) {

      await db.query(
        "UPDATE events SET participants = participants - 1 WHERE id = ?",
        [id]
      );
    }

    return res.status(200).json({ message: "Successfully left event" });

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
      location
    } = req.body;



    
    const [users] = await db.execute(
      "SELECT id FROM users WHERE stytch_user_id = ?",
      [req.user.stytch_user_id]
    );

    if (!users.length) {
      return res.status(400).json({ ok: false, error: "User not found" });
    }

    const hostId = users[0].id;
    const locationString = JSON.stringify(location);

    const sql = `
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
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      eventName,
      eventDescription,
      eventStartTime,
      eventEndTime,
      hostId,
      locationString,
      eventBanner,
      1
    ];

    await db.execute(sql, values);

    res.json({ ok: true, message: "Event created successfully!" });
  } catch (err) {
    console.error("Error creating event:", err);
    res.status(500).json({ ok: false, error: "Server error creating event" });
  }
};


module.exports = { getEvents, getParticipants, attendEvent, leaveEvent, createEvent};
