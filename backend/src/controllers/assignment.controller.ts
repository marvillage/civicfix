import { Request, Response } from "express";
import {
  createAssignment,
  acceptAssignment,
  startAssignment,
  resolveAssignment,
  addProgressUpdate,
  getMyAssignments,
  getAllAssignments,
} from "../services/assignment.service";
import { uploadImage } from "../services/image.service";

// PROGRESS UPDATE
export async function addProgressUpdateController(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    if (!req.user) {
      return res.status(401).json({
        message: "Authentication required",
      });
    }

    const { assignmentId } = req.params;
    const { note } = req.body;

    if (!note || !note.trim()) {
      return res.status(400).json({
        message: "A progress note is required",
      });
    }

    let imageUrl: string | undefined;

    if (req.file) {
      imageUrl = await uploadImage(
        req.file.buffer,
        "civicfix/progress"
      );
    }

    const entry = await addProgressUpdate(
      assignmentId,
      req.user.userId,
      note.trim(),
      imageUrl
    );

    return res.status(201).json({
      message: "Progress update posted",
      entry,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "ASSIGNMENT_NOT_FOUND") {
        return res.status(404).json({
          message: "Assignment not found",
        });
      }

      if (error.message === "NOT_ASSIGNED_AUTHORITY") {
        return res.status(403).json({
          message:
            "You are not the authority assigned to this issue",
        });
      }

      if (error.message === "INVALID_STATUS") {
        return res.status(400).json({
          message:
            "Progress updates can only be posted while work is in progress",
        });
      }
    }

    console.error("Progress update error:", error);

    return res.status(500).json({
      message:
        "Something went wrong while posting the progress update",
    });
  }
}

interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    role: string;
  };
}

// CREATE ASSIGNMENT
export async function createAssignmentController(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    if (!req.user) {
      return res.status(401).json({
        message: "Authentication required",
      });
    }

    const {
      issueId,
      authorityId,
      departmentId,
      wardId,
    } = req.body;

    if (!issueId || !authorityId) {
      return res.status(400).json({
        message: "issueId and authorityId are required",
      });
    }

    const assignment = await createAssignment({
      issueId,
      authorityId,
      departmentId,
      wardId,
    });

    return res.status(201).json({
      message: "Issue assigned successfully",
      assignment,
    });
  } catch (error) {
    console.error(
      "Create assignment error:",
      error
    );

    if (error instanceof Error) {
      if (error.message === "ISSUE_NOT_FOUND") {
        return res.status(404).json({
          message: "Issue not found",
        });
      }

      if (error.message === "INVALID_AUTHORITY") {
        return res.status(400).json({
          message: "Invalid authority",
        });
      }

      if (error.message === "DEPARTMENT_NOT_FOUND") {
        return res.status(404).json({
          message: "Department not found",
        });
      }

      if (error.message === "WARD_NOT_FOUND") {
        return res.status(404).json({
          message: "Ward not found",
        });
      }
    }

    return res.status(500).json({
      message: "Something went wrong while assigning the issue",
    });
  }
}

// ACCEPT ASSIGNMENT
export async function acceptAssignmentController(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    if (!req.user) {
      return res.status(401).json({
        message: "Authentication required",
      });
    }

    const { assignmentId } = req.params;

    const assignment = await acceptAssignment(
      assignmentId,
      req.user.userId
    );

    return res.status(200).json({
      message: "Assignment accepted successfully",
      assignment,
    });
  } catch (error) {
    console.error(
      "Accept assignment error:",
      error
    );

    if (error instanceof Error) {
      if (error.message === "ASSIGNMENT_NOT_FOUND") {
        return res.status(404).json({
          message: "Assignment not found",
        });
      }

      if (error.message === "NOT_ASSIGNED_AUTHORITY") {
        return res.status(403).json({
          message:
            "You are not the authority assigned to this issue",
        });
      }

      if (error.message === "ALREADY_ACCEPTED") {
        return res.status(400).json({
          message: "Assignment has already been accepted",
        });
      }
    }

    return res.status(500).json({
      message:
        "Something went wrong while accepting the assignment",
    });
  }
}

// START ASSIGNMENT
export async function startAssignmentController(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    if (!req.user) {
      return res.status(401).json({
        message: "Authentication required",
      });
    }

    const { assignmentId } = req.params;

    const issue = await startAssignment(
      assignmentId,
      req.user.userId
    );

    return res.status(200).json({
      message: "Work started successfully",
      issue,
    });
  } catch (error) {
    console.error(
      "Start assignment error:",
      error
    );

    if (error instanceof Error) {
      if (error.message === "ASSIGNMENT_NOT_FOUND") {
        return res.status(404).json({
          message: "Assignment not found",
        });
      }

      if (error.message === "NOT_ASSIGNED_AUTHORITY") {
        return res.status(403).json({
          message:
            "You are not the authority assigned to this issue",
        });
      }

      if (error.message === "ASSIGNMENT_NOT_ACCEPTED") {
        return res.status(400).json({
          message:
            "Assignment must be accepted before starting work",
        });
      }

      if (error.message === "INVALID_STATUS") {
        return res.status(400).json({
          message:
            "Issue cannot be started in its current status",
        });
      }
    }

    return res.status(500).json({
      message:
        "Something went wrong while starting the assignment",
    });
  }
}

// RESOLVE ASSIGNMENT
export async function resolveAssignmentController(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    if (!req.user) {
      return res.status(401).json({
        message: "Authentication required",
      });
    }

    const { assignmentId } = req.params;
    const { note } = req.body;

    let resolutionImageUrl: string | undefined;

    if (req.file) {
      resolutionImageUrl = await uploadImage(
        req.file.buffer,
        "civicfix/resolutions"
      );
    }

    const assignment = await resolveAssignment(
      assignmentId,
      req.user.userId,
      note,
      resolutionImageUrl
    );

    return res.status(200).json({
      message: "Issue resolved successfully",
      assignment,
    });
  } catch (error) {
    console.error(
      "Resolve assignment error:",
      error
    );

    if (error instanceof Error) {
      if (error.message === "ASSIGNMENT_NOT_FOUND") {
        return res.status(404).json({
          message: "Assignment not found",
        });
      }

      if (error.message === "NOT_ASSIGNED_AUTHORITY") {
        return res.status(403).json({
          message:
            "You are not the authority assigned to this issue",
        });
      }

      if (error.message === "ASSIGNMENT_NOT_ACCEPTED") {
        return res.status(400).json({
          message:
            "Assignment must be accepted before resolving",
        });
      }

      if (error.message === "INVALID_STATUS") {
        return res.status(400).json({
          message:
            "Issue must be in progress before it can be resolved",
        });
      }
    }

    return res.status(500).json({
      message:
        "Something went wrong while resolving the assignment",
    });
  }
}

// GET MY ASSIGNMENTS
export async function getMyAssignmentsController(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    if (!req.user) {
      return res.status(401).json({
        message: "Authentication required",
      });
    }

    const assignments = await getMyAssignments(
      req.user.userId
    );

    return res.status(200).json({
      assignments,
    });
  } catch (error) {
    console.error(
      "Get my assignments error:",
      error
    );

    return res.status(500).json({
      message:
        "Something went wrong while fetching assignments",
    });
  }
}

// GET ALL ASSIGNMENTS — ADMIN
export async function getAllAssignmentsController(
  _req: AuthenticatedRequest,
  res: Response
) {
  try {
    const assignments = await getAllAssignments();

    return res.status(200).json({
      assignments,
    });
  } catch (error) {
    console.error(
      "Get all assignments error:",
      error
    );

    return res.status(500).json({
      message:
        "Something went wrong while fetching assignments",
    });
  }
}