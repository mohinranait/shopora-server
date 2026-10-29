import multer from "multer";
import type { Request, Response, NextFunction } from "express";

/**
 * Set up Multer for handling file uploads in memory buffer
 * Allows streaming directly to Cloudinary without persisting to disk
 */
const storage = multer.memoryStorage();

export const upload = multer({
  storage: storage,
  limits: {
    fileSize: 15 * 1024 * 1024, // 15MB limit per image
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

/**
 * Flexible single file upload middleware that accepts ANY field name
 * (e.g. 'file', 'image', 'picture', 'avatar') without throwing MulterError: Unexpected file field.
 * Attaches the first uploaded file to `req.file`.
 */
export const uploadSingleAny = (req: Request, res: Response, next: NextFunction) => {
  upload.any()(req, res, (err) => {
    if (err) return next(err);
    if (req.files && Array.isArray(req.files) && req.files.length > 0) {
      req.file = req.files[0];
    }
    next();
  });
};

/**
 * Flexible multiple files upload middleware that accepts ANY field name
 * (e.g. 'images', 'files', 'file')
 */
export const uploadMultipleAny = (req: Request, res: Response, next: NextFunction) => {
  upload.any()(req, res, (err) => {
    if (err) return next(err);
    if (req.files && Array.isArray(req.files) && req.files.length > 0 && !req.file) {
      req.file = req.files[0];
    }
    next();
  });
};
