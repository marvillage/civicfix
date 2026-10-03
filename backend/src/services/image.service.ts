import cloudinary from "../lib/cloudinary";

export async function uploadImage(
  buffer: Buffer,
  folder = "civicfix/complaints"
): Promise<string> {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "image",
      },
      (error, result) => {
        if (error || !result) {
          reject(error ?? new Error("Image upload failed"));
          return;
        }

        resolve(result.secure_url);
      }
    );

    uploadStream.end(buffer);
  });
}

// Cloudinary stores audio under the "video" resource type.
export async function uploadAudio(
  buffer: Buffer,
  folder = "civicfix/voice-notes"
): Promise<string> {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "video",
      },
      (error, result) => {
        if (error || !result) {
          reject(error ?? new Error("Audio upload failed"));
          return;
        }

        resolve(result.secure_url);
      }
    );

    uploadStream.end(buffer);
  });
}