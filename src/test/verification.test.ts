import { describe, expect, it } from "vitest";
import { ID_TYPES, validateUpload, verificationSubmission } from "@/lib/verification";

describe("Verification upload rules", () => {
  it("accepts an ID up to 10MB but rejects anything larger", () => {
    expect(validateUpload({ type: "application/pdf", size: 10 * 1024 * 1024 }, "id")).toBeNull();
    expect(
      validateUpload({ type: "application/pdf", size: 10 * 1024 * 1024 + 1 }, "id"),
    ).not.toBeNull();
  });
  it("accepts images and PDFs as IDs and rejects other files", () => {
    expect(validateUpload({ type: "image/jpeg", size: 123 }, "id")).toBeNull();
    expect(validateUpload({ type: "application/pdf", size: 123 }, "id")).toBeNull();
    expect(validateUpload({ type: "text/plain", size: 123 }, "id")).not.toBeNull();
  });
  it("accepts only images for profile photos", () => {
    expect(validateUpload({ type: "image/png", size: 123 }, "photo")).toBeNull();
    expect(validateUpload({ type: "application/pdf", size: 123 }, "photo")).not.toBeNull();
  });
  it("offers the three requested ID types", () => {
    expect(ID_TYPES).toEqual(["School ID", "National ID", "Passport"]);
  });
  it("saves a submitted ID path with pending status", () => {
    expect(verificationSubmission("user", "user/document.pdf", "Passport")).toMatchObject({
      user_id: "user",
      id_document_path: "user/document.pdf",
      id_type: "Passport",
      id_verification_status: "pending",
    });
    expect(() => verificationSubmission("user", "user/document.pdf", "Other")).toThrow();
    expect(() => verificationSubmission("user", "user/document.pdf", "Driver's License")).toThrow();
    for (const type of ID_TYPES)
      expect(verificationSubmission("user", "user/document.pdf", type).id_type).toBe(type);
  });
});
