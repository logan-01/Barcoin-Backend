import express, { Request, Response } from "express";
import multer from "multer";
import { cloudinary } from "../lib/cloudinary/config";

// Types
interface CloudinaryUploadResult {
  public_id: string;
  secure_url: string;
  [key: string]: any;
}

const uploadRouter = express.Router();
const folderName = "Barcoin/Profile_Image";

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

uploadRouter.post(
  "/",
  upload.single("file"),
  async (req: Request, res: Response) => {
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({ error: "File not found" });
      }

      const result = await new Promise<CloudinaryUploadResult>(
        (resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            { folder: folderName },
            (error, result) => {
              if (error) reject(error);
              else resolve(result as CloudinaryUploadResult);
            }
          );
          uploadStream.end(file.buffer);
        }
      );

      return res.status(200).json({
        publicId: result.public_id,
        publicUrl: result.secure_url,
      });
    } catch (error) {
      console.error("Upload image failed", error);
      return res.status(500).json({ error: "Upload image failed" });
    }
  }
);

export default uploadRouter;
