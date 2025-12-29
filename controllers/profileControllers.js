const { s3, DeleteObjectCommand } = require("../config/s3Client");
const stytchClient = require("../config/stytchClient");
const db = require("../mysqlDb");

async function getAuthenticatedUser(req) {
    const sessionToken = req.session.StytchSessionToken;
    if (!sessionToken) {
      return null;
    }

    const resp = await stytchClient.sessions.authenticate({session_token: sessionToken});
    if (resp.status_code !== 200) {
      console.log('Session invalid or expired');
      req.session.StytchSessionToken = undefined;
      return null;
    }

    req.session.StytchSessionToken = resp.session_token;
    return resp.user;
}


const handlePorfile = async(req, res) => {

    const user = await getAuthenticatedUser(req);
    if (user) {
      res.send(`Hello, ${user.emails[0].email}!`);
      return;
    }

    res.send("Log in to view this page");

}


const getProfileInfo = async(req,res) => {
  try {
    const stytchUserId = req.user.stytch_user_id;

    const q = `
      SELECT
        username,
        email,
        first_name,
        last_name,
        profile_pic,
        gender,
        bio
      FROM users
      WHERE stytch_user_id = ?
    `;

    const [rows] = await db.query(q, [stytchUserId]);

    if(rows.length === 0) {
      return res.status(404).json({message: "User not found"});
    }

    const user = rows[0];

    return res.status(200).json({
      username: user.username,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      bio: user.bio, 
      gender: user.gender,
      profilePic: user.profile_pic
    });

  } catch (err) {
    return res.status(500).json({ message: "Failed to fetch profile info" });
  }
}


const updateProfileInfo = async(req,res) => {
  
  try {
    console.log(req.body)

    const {
      username,
      firstName,
      lastName,
      gender,
      bio,
      profilePic
    } = req.body;

    const stytchUserId = req.user.stytch_user_id;

        const sql = `
        UPDATE users
          SET
          username = ?,
          first_name = ?,
          last_name = ?,
          gender = ?,
          bio = ?,
          profile_pic = ?
        WHERE stytch_user_id = ?
      `;

    await db.execute(sql, [ username, firstName, lastName, gender, bio, profilePic, stytchUserId ]);
    res.status(200).json({ message: "Profile updated successfully" });

  } catch (error) {
    console.error(error); res.status(500).json({ message: "Failed to update profile" }); 
  }

}




const updateProfilePic = async (req, res) => {
  try {
    const { profilePic } = req.body;
    const stytchUserId = req.user.stytch_user_id;

    const stytchUser = await stytchClient.users.get({
      user_id: stytchUserId,
    });

    const oldProfilePic = stytchUser?.trusted_metadata?.profilePic ?? null;

    if (profilePic === null) {
      await db.query(
        "UPDATE users SET profile_pic = NULL WHERE stytch_user_id = ?",
        [stytchUserId]
      );

      if (oldProfilePic) {
        const key = new URL(oldProfilePic).pathname.substring(1);
        await s3.send(
          new DeleteObjectCommand({
            Bucket: "fitness-project-tldayan",
            Key: key,
          })
        );
      }

      await stytchClient.users.update({
        user_id: stytchUserId,
        trusted_metadata: { profilePic: null },
      });


    } else {
 
      if (oldProfilePic) {
        const key = new URL(oldProfilePic).pathname.substring(1);
        await s3.send(
          new DeleteObjectCommand({
            Bucket: "fitness-project-tldayan",
            Key: key,
          })
        );
      }

      await db.query(
        "UPDATE users SET profile_pic = ? WHERE stytch_user_id = ?",
        [profilePic, stytchUserId]
      );

      await stytchClient.users.update({
        user_id: stytchUserId,
        trusted_metadata: { profilePic },
      });
    }

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update profile picture" });
  }
};




module.exports = {handlePorfile, updateProfilePic, getProfileInfo, updateProfileInfo}