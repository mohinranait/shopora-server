import multer from "multer";

/**
 * Set up Multer for handling file uploads in memory buffer
 * Allows streaming directly to Cloudinary without persisting to disk
 */
const storage = multer.memoryStorage();

export const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit per image
  },
  fileFilter: (_req, file, cb) => {
    // Validate image mimetype
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files (jpeg, png, webp, gif, svg, etc.) are allowed!"));
    }
  },
});
