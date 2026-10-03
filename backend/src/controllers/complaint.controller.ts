import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import {
  createComplaint,
  getMyComplaints,
  getComplaintById,
  verifyComplaintResolution,
  withdrawComplaint,
} from "../services/complaint.service";

export async function withdrawComplaintController(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    if (!req.user) {
      return res.status(401).json({
        message: "Authentication required",
      });
    }

    const { id } = req.params;

    await withdrawComplaint(id, req.user.userId);

    return res.status(200).json({
      message: "Complaint withdrawn",
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "COMPLAINT_NOT_FOUND") {
        return res.status(404).json({
          message: "Complaint not found",
        });
      }

      if (error.message === "NOT_WITHDRAWABLE") {
        return res.status(409).json({
          message:
            "This complaint can no longer be withdrawn — work on it has already started",
        });
      }
    }

    console.error("Withdraw complaint error:", error);

    return res.status(500).json({
      message:
        "Something went wrong while withdrawing the complaint",
    });
  }
}
import {
  uploadImage,
  uploadAudio,
} from "../services/image.service";
import { analyzeCivicIssue } from "../services/gemini.service";
import { createFieldReport } from "../services/complaint.service";

interface UploadedFiles {
  image?: Express.Multer.File[];
  images?: Express.Multer.File[];
  audio?: Express.Multer.File[];
}

function collectReportFiles(req: AuthenticatedRequest) {
  const files = (req.files || {}) as UploadedFiles;

  const images = [
    ...(files.image || []),
    ...(files.images || []),
  ].slice(0, 5);

  return { images, audio: files.audio?.[0] };
}

async function uploadReportMedia(
  images: Express.Multer.File[],
  audio?: Express.Multer.File
) {
  const photos: string[] = [];

  for (const file of images) {
    photos.push(await uploadImage(file.buffer));
  }

  let audioUrl: string | undefined;

  if (audio) {
    audioUrl = await uploadAudio(audio.buffer);
  }

  return { photos, audioUrl };
}

export async function createComplaintController(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    if (!req.user) {
      return res.status(401).json({
        message: "Authentication required",
      });
    }

    const { images, audio } = collectReportFiles(req);

    if (images.length === 0) {
      return res.status(400).json({
        message: "At least one photo is required",
      });
    }

    const {
      description,
      latitude,
      longitude,
      isEmergency,
    } = req.body;

    if (
      latitude === undefined ||
      longitude === undefined
    ) {
      return res.status(400).json({
        message:
          "Latitude and longitude are required",
      });
    }

    const { photos, audioUrl } =
      await uploadReportMedia(images, audio);

    let aiResult = {
      title: "Civic Issue",
      category: "OTHER",
      severity: "MEDIUM",
      confidence: 0,
    };

    try {
      aiResult = await analyzeCivicIssue(
        images[0].buffer,
        images[0].mimetype,
        description
      );
    } catch (error) {
      console.error(
        "Gemini analysis failed. Using fallback classification:",
        error
      );
    }

    const complaint = await createComplaint({
      citizenId: req.user.userId,
      imageUrl: photos[0],
      photos,
      audioUrl,
      isEmergency: isEmergency === "true",
      description,
      latitude: Number(latitude),
      longitude: Number(longitude),

      title: aiResult.title,
      category: aiResult.category,
      severity: aiResult.severity,
      aiConfidence: aiResult.confidence,
    });

    console.log(
      "STEP 7: Complaint created:",
      complaint.id
    );

    return res.status(201).json({
      message:
        "Complaint submitted successfully",
      complaint,
      ai: aiResult,
    });
  } catch (error) {
    console.error(
      "========== CREATE COMPLAINT FAILED =========="
    );

    console.error(error);

    if (error instanceof Error) {
      console.error(
        "Message:",
        error.message
      );

      console.error(
        "Stack:",
        error.stack
      );
    }

    console.error(
      "=============================================="
    );

    return res.status(500).json({
      message:
        "Something went wrong while creating the complaint",
    });
  }
}

export async function createAnonymousComplaintController(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const { images, audio } = collectReportFiles(req);

    if (images.length === 0) {
      return res.status(400).json({
        message: "At least one photo is required",
      });
    }

    const {
      description,
      latitude,
      longitude,
      isEmergency,
    } = req.body;

    if (
      latitude === undefined ||
      longitude === undefined
    ) {
      return res.status(400).json({
        message: "Latitude and longitude are required",
      });
    }

    const { photos, audioUrl } =
      await uploadReportMedia(images, audio);

    let aiResult = {
      title: "Civic Issue",
      category: "OTHER",
      severity: "MEDIUM",
      confidence: 0,
    };

    try {
      aiResult = await analyzeCivicIssue(
        images[0].buffer,
        images[0].mimetype,
        description
      );
    } catch (error) {
      console.error(
        "Gemini analysis failed. Using fallback classification:",
        error
      );
    }

    const complaint = await createComplaint({
      citizenId: null,
      imageUrl: photos[0],
      photos,
      audioUrl,
      isEmergency: isEmergency === "true",
      description,
      latitude: Number(latitude),
      longitude: Number(longitude),

      title: aiResult.title,
      category: aiResult.category,
      severity: aiResult.severity,
      aiConfidence: aiResult.confidence,
    });

    return res.status(201).json({
      message: "Complaint submitted successfully",
      complaint,
      ai: aiResult,
    });
  } catch (error) {
    console.error("Create anonymous complaint error:", error);

    return res.status(500).json({
      message:
        "Something went wrong while creating the complaint",
    });
  }
}

export async function createFieldReportController(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    if (!req.user) {
      return res.status(401).json({
        message: "Authentication required",
      });
    }

    const { images } = collectReportFiles(req);

    if (images.length === 0) {
      return res.status(400).json({
        message: "At least one photo is required",
      });
    }

    const {
      title,
      category,
      severity,
      description,
      latitude,
      longitude,
    } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({
        message: "A title is required",
      });
    }

    if (
      latitude === undefined ||
      longitude === undefined
    ) {
      return res.status(400).json({
        message: "Latitude and longitude are required",
      });
    }

    const { photos } = await uploadReportMedia(images);

    const issue = await createFieldReport({
      authorityId: req.user.userId,
      title: title.trim(),
      category: category || "OTHER",
      severity: severity || "MEDIUM",
      description,
      latitude: Number(latitude),
      longitude: Number(longitude),
      imageUrl: photos[0],
      photos,
    });

    return res.status(201).json({
      message:
        "Field report logged and assigned to you",
      issue,
    });
  } catch (error) {
    console.error("Create field report error:", error);

    return res.status(500).json({
      message:
        "Something went wrong while logging the field report",
    });
  }
}

export async function getMyComplaintsController(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    if (!req.user) {
      return res.status(401).json({
        message: "Authentication required",
      });
    }

    const complaints = await getMyComplaints(
      req.user.userId
    );

    return res.status(200).json({
      complaints,
    });
  } catch (error) {
    console.error(
      "Get complaints error:",
      error
    );

    return res.status(500).json({
      message:
        "Something went wrong while fetching complaints",
    });
  }
}

export async function getComplaintByIdController(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    if (!req.user) {
      return res.status(401).json({
        message: "Authentication required",
      });
    }

    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        message: "Complaint ID is required",
      });
    }

    const complaint = await getComplaintById(
      id,
      req.user.userId
    );

    if (!complaint) {
      return res.status(404).json({
        message: "Complaint not found",
      });
    }

    return res.status(200).json({
      complaint,
    });
  } catch (error) {
    console.error(
      "Get complaint error:",
      error
    );

    return res.status(500).json({
      message:
        "Something went wrong while fetching the complaint",
    });
  }
}

export async function verifyComplaintResolutionController(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    if (!req.user) {
      return res.status(401).json({
        message: "Authentication required",
      });
    }

    const { complaintId } = req.params;
    const { approved, note, stars } = req.body;

    if (!complaintId) {
      return res.status(400).json({
        message: "Complaint ID is required",
      });
    }

    if (typeof approved !== "boolean") {
      return res.status(400).json({
        message:
          "Approved must be true or false",
      });
    }

    if (
      stars !== undefined &&
      (!Number.isInteger(stars) ||
        stars < 1 ||
        stars > 5)
    ) {
      return res.status(400).json({
        message: "Rating must be 1 to 5 stars",
      });
    }

    const issue = await verifyComplaintResolution(
      complaintId,
      req.user.userId,
      approved,
      note,
      stars
    );

    return res.status(200).json({
      message: approved
        ? "Complaint resolution verified successfully"
        : "Complaint reopened successfully",
      issue,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (
        error.message ===
        "COMPLAINT_NOT_FOUND"
      ) {
        return res.status(404).json({
          message: "Complaint not found",
        });
      }

      if (
        error.message ===
        "INVALID_STATUS"
      ) {
        return res.status(409).json({
          message:
            "Complaint is not ready for verification",
        });
      }
    }

    console.error(
      "Verify complaint resolution error:",
      error
    );

    return res.status(500).json({
      message:
        "Something went wrong while verifying the resolution",
    });
  }
}