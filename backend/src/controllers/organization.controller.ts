import { Request, Response } from "express";
import {
  createDepartment,
  getDepartments,
  createWard,
  getWards,
  getAuthorities,
  getCategoryRules,
  setCategoryRule,
} from "../services/organization.service";

const VALID_RULE_CATEGORIES = [
  "ROAD_DAMAGE",
  "STREETLIGHT",
  "GARBAGE",
  "WATER_LEAKAGE",
  "DRAINAGE",
  "OTHER",
];

export async function getCategoryRulesController(
  _req: Request,
  res: Response
) {
  try {
    const rules = await getCategoryRules();

    return res.status(200).json({ rules });
  } catch (error) {
    console.error("Get rules error:", error);

    return res.status(500).json({
      message: "Something went wrong while fetching rules",
    });
  }
}

export async function setCategoryRuleController(
  req: Request,
  res: Response
) {
  try {
    const { category, departmentId } = req.body;

    if (
      !category ||
      !VALID_RULE_CATEGORIES.includes(category)
    ) {
      return res.status(400).json({
        message: "A valid issue category is required",
      });
    }

    const rule = await setCategoryRule(
      category,
      departmentId || null
    );

    return res.status(200).json({
      message: rule
        ? "Rule saved"
        : "Rule removed",
      rule,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "DEPARTMENT_NOT_FOUND"
    ) {
      return res.status(404).json({
        message: "Department not found",
      });
    }

    console.error("Set rule error:", error);

    return res.status(500).json({
      message: "Something went wrong while saving the rule",
    });
  }
}

// ─────────────────────────────────────────────
// DEPARTMENTS
// ─────────────────────────────────────────────

export async function createDepartmentController(
  req: Request,
  res: Response
) {
  try {
    const { name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        message: "Department name is required",
      });
    }

    const department = await createDepartment(name.trim());

    return res.status(201).json({
      message: "Department created successfully",
      department,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "DEPARTMENT_ALREADY_EXISTS"
    ) {
      return res.status(409).json({
        message: "A department with this name already exists",
      });
    }

    console.error("Create department error:", error);

    return res.status(500).json({
      message: "Something went wrong while creating the department",
    });
  }
}

export async function getDepartmentsController(
  _req: Request,
  res: Response
) {
  try {
    const departments = await getDepartments();

    return res.status(200).json({
      departments,
    });
  } catch (error) {
    console.error("Get departments error:", error);

    return res.status(500).json({
      message: "Something went wrong while fetching departments",
    });
  }
}

// ─────────────────────────────────────────────
// WARDS
// ─────────────────────────────────────────────

export async function createWardController(
  req: Request,
  res: Response
) {
  try {
    const { name, code } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        message: "Ward name is required",
      });
    }

    if (!code || !code.trim()) {
      return res.status(400).json({
        message: "Ward code is required",
      });
    }

    const ward = await createWard(
      name.trim(),
      code.trim()
    );

    return res.status(201).json({
      message: "Ward created successfully",
      ward,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "WARD_ALREADY_EXISTS"
    ) {
      return res.status(409).json({
        message: "A ward with this code already exists",
      });
    }

    console.error("Create ward error:", error);

    return res.status(500).json({
      message: "Something went wrong while creating the ward",
    });
  }
}

export async function getWardsController(
  _req: Request,
  res: Response
) {
  try {
    const wards = await getWards();

    return res.status(200).json({
      wards,
    });
  } catch (error) {
    console.error("Get wards error:", error);

    return res.status(500).json({
      message: "Something went wrong while fetching wards",
    });
  }
}

export async function getAuthoritiesController(
  _req: Request,
  res: Response
) {
  try {
    const authorities =
      await getAuthorities();

    return res.status(200).json({
      authorities,
    });
  } catch (error) {
    console.error(
      "Get authorities error:",
      error
    );

    return res.status(500).json({
      message:
        "Something went wrong while fetching authorities",
    });
  }
}