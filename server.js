const express = require("express");
const { exec } = require("child_process");
const fs = require("fs");
const multer = require("multer");
const app = express();
app.use(express.json());

const storage = multer.diskStorage({
  destination: "/var/www/videos/",
  filename: (req, file, cb) => { cb(null, file.originalname); }
});
const upload = multer({ storage: storage });

function downloadVideo(url, dest) {
  return new Promise((resolve, reject) => {
    const fileIdMatch = url.match(/id=([^&]+)/);
    if (!fileIdMatch) { reject(new Error('Keine Google Drive ID gefunden')); return; }
    const fileId = fileIdMatch[1];
    const cmd = `gdown "${fileId}" -O "${dest}"`;
    exec(cmd, (error, stdout, stderr) => {
      if (error) { reject(new Error(stderr)); return; }
      resolve();
    });
  });
}

app.post("/upload", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Keine Datei" });
  res.json({ success: true, filename: req.file.filename, url: "http://168.119.172.100:3000/videos/" + req.file.filename });
});

app.post("/merge", async (req, res) => {
  const { video1_url, video2_url, output_name } = req.body;
  if (!video1_url || !output_name) return res.status(400).json({ error: "Parameter fehlen" });
  const v1 = "/tmp/" + output_name + "_part1.mp4";
  const v2 = "/var/www/videos/schlussteil.mp4";
  const out = "/var/www/videos/" + output_name + ".mp4";
  try {
    await downloadVideo(video1_url, v1);
    const cmd = `ffmpeg -i "${v1}" -i "${v2}" -filter_complex "[0:v]scale=1280:720[v0];[v0][0:a][1:v][1:a]concat=n=2:v=1:a=1[v][a]" -map "[v]" -map "[a]" -c:v libx264 -c:a aac -y "${out}"`;
    exec(cmd, (error, stdout, stderr) => {
      fs.unlink(v1, () => {});
      if (error) return res.status(500).json({ error: stderr });
res.json({ success: true, video_url: "https://videos.prozessanker.de/videos/" + output_name + ".mp4" });
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.use("/videos", express.static("/var/www/videos"));
app.listen(3000, () => console.log("FFmpeg Service laeuft auf Port 3000"));
