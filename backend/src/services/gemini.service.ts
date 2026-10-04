import { GoogleGenAI } from "@google/genai";
import { BRAND } from "../config/brand";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const ISSUE_CATEGORIES = [
  "POTHOLE",
  "GARBAGE",
  "STREETLIGHT",
  "WATER_LEAK",
  "DRAINAGE",
  "ROAD_DAMAGE",
  "TRAFFIC",
  "OTHER",
];

const ISSUE_SEVERITIES = [
  "LOW",
  "MEDIUM",
  "HIGH",
  "CRITICAL",
];

const classificationSchema = {
  type: "object",
  properties: {
    title: {
      type: "string",
      description:
        "A short, clear title describing the civic issue.",
    },

    category: {
      type: "string",
      enum: ISSUE_CATEGORIES,
      description:
        "The most appropriate civic issue category.",
    },

    severity: {
      type: "string",
      enum: ISSUE_SEVERITIES,
      description:
        "The severity of the civic issue.",
    },

    confidence: {
      type: "number",
      description:
        "Confidence in the classification from 0 to 1.",
    },
  },

  required: [
    "title",
    "category",
    "severity",
    "confidence",
  ],
};

async function generateGeminiResponse(
  imageBase64: string,
  mimeType: string,
  prompt: string
) {
  const maxAttempts = 3;

  for (
    let attempt = 1;
    attempt <= maxAttempts;
    attempt++
  ) {
    try {
      return await ai.models.generateContent({
        model: "gemini-3.7-flash",

        contents: [
          {
            role: "user",
            parts: [
              {
                text: prompt,
              },
              {
                inlineData: {
                  mimeType,
                  data: imageBase64,
                },
              },
            ],
          },
        ],

        config: {
          responseMimeType: "application/json",
          responseSchema: classificationSchema,
        },
      });
    } catch (error: any) {
      const status = error?.status;

      if (
        status !== 503 ||
        attempt === maxAttempts
      ) {
        throw error;
      }

      console.log(
        `Gemini temporarily unavailable. Retrying (${attempt}/${maxAttempts})...`
      );

      await new Promise((resolve) =>
        setTimeout(
          resolve,
          attempt * 2000
        )
      );
    }
  }

  throw new Error("GEMINI_REQUEST_FAILED");
}

export async function analyzeCivicIssue(
  imageBuffer: Buffer,
  mimeType: string,
  description?: string
) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error(
      "GEMINI_API_KEY_NOT_CONFIGURED"
    );
  }

  const imageBase64 =
    imageBuffer.toString("base64");

  const prompt = `
You are ${BRAND.name} AI, an AI system that analyzes civic complaints.

Analyze the provided image and optional citizen description.

Identify the most likely civic issue and classify it.

Rules:
- Focus only on civic/public infrastructure problems.
- Do not invent details that cannot reasonably be inferred.
- Choose the most appropriate category from the allowed categories.
- Choose severity based on the visible seriousness and potential public impact.
- Confidence must be between 0 and 1.
- Keep the title short and useful for a government authority.

Allowed categories:
${ISSUE_CATEGORIES.join(", ")}

Allowed severity levels:
${ISSUE_SEVERITIES.join(", ")}

Citizen description:
${description || "No description provided."}
`;

  const response =
    await generateGeminiResponse(
      imageBase64,
      mimeType,
      prompt
    );

  if (!response.text) {
    throw new Error(
      "GEMINI_EMPTY_RESPONSE"
    );
  }

  const result = JSON.parse(
    response.text
  );

  return {
    title: result.title,
    category: result.category,
    severity: result.severity,
    confidence: Math.max(
      0,
      Math.min(
        1,
        Number(result.confidence)
      )
    ),
  };
}