import { describe, expect, it } from "vitest";
import { deliveryProofPath, requireDeliveryProof, requireRiderPhoto } from "@/lib/delivery-photos";

describe("required rider and delivery photos", () => {
  it("requires a saved profile photo before applying or accepting", () => {
    expect(() => requireRiderPhoto(false)).toThrow();
    expect(() => requireRiderPhoto(true)).not.toThrow();
  });
  it("requires proof belonging to the accepting rider and this order", () => {
    expect(() => requireDeliveryProof(null, "rider", "order")).toThrow();
    expect(() => requireDeliveryProof("other/order/photo.jpg", "rider", "order")).toThrow();
    expect(() => requireDeliveryProof("rider/other/photo.jpg", "rider", "order")).toThrow();
    expect(requireDeliveryProof("rider/order/photo.jpg", "rider", "order")).toBe(
      "rider/order/photo.jpg",
    );
  });
  it("allows an image proof up to 10MB but rejects PDFs and oversized photos", () => {
    expect(
      deliveryProofPath("rider", "order", { type: "image/jpeg", size: 10 * 1024 * 1024 }),
    ).toMatch(/^rider\/order\/.+\.jpg$/);
    expect(() =>
      deliveryProofPath("rider", "order", { type: "application/pdf", size: 100 }),
    ).toThrow();
    expect(() =>
      deliveryProofPath("rider", "order", { type: "image/jpeg", size: 10 * 1024 * 1024 + 1 }),
    ).toThrow();
  });
});
