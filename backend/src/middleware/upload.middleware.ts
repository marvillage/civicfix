import multer from "multer";
import path from "path";

const storage = multer.memoryStorage();

const allowedImageTypes = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
];

const allowedExtensions = [
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
];

const fileFilter: multer.Options["fileFilter"] = (
  _req,
  file,
  cb
) => {
  const extension = path
    .extname(file.originalname)
    .toLowerCase();

  const validMimeType =
    allowedImageTypes.includes(file.mimetype);

  const validExtension =
    allowedExtensions.includes(extension);

  console.log(
    "Uploaded file:",
    file.originalname,
    file.mimetype,
    extension
  );

  if (validMimeType || validExtension) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed"));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

const allowedAudioTypes = [
  "audio/webm",
  "audio/ogg",
  "audio/mpeg",
  "audio/mp4",
  "audio/wav",
  "audio/x-m4a",
  "audio/aac",
];

const mediaFileFilter: multer.Options["fileFilter"] = (
  _req,
  file,
  cb
) => {
  if (file.fieldname === "audio") {
    if (
      allowedAudioTypes.includes(file.mimetype) ||
      file.mimetype.startsWith("audio/")
    ) {
      cb(null, true);
    } else {
      cb(new Error("Only audio files are allowed for voice notes"));
    }

    return;
  }

  const extension = path
    .extname(file.originalname)
    .toLowerCase();

  if (
    allowedImageTypes.includes(file.mimetype) ||
    allowedExtensions.includes(extension)
  ) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed"));
  }
};

// For report forms: up to 5 photos + one voice note.
export const reportUpload = multer({
  storage,
  fileFilter: mediaFileFilter,
  limits: {
    fileSize: 8 * 1024 * 1024,
  },
}).fields([
  { name: "image", maxCount: 1 },
  { name: "images", maxCount: 5 },
  { name: "audio", maxCount: 1 },
]);

export default upload;