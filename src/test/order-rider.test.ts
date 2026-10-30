import { describe, expect, it, vi } from "vitest";
import { loadAssignedRider } from "../lib/order-rider";

describe("customer rider assignment", () => {
  it("returns the accepting rider's name for the customer's order", async () => {
    const fetchRider = vi.fn().mockResolvedValue({
      data: [{ full_name: "Jessie Cabrera" }],
      error: null,
    });
    expect(await loadAssignedRider({ id: "order-1", rider_id: "rider-1" }, fetchRider)).toBe(
      "Jessie Cabrera",
    );
    expect(fetchRider).toHaveBeenCalledWith("order-1");
  });

  it("does not show a rider before acceptance", async () => {
    const fetchRider = vi.fn();
    expect(await loadAssignedRider({ id: "order-1", rider_id: null }, fetchRider)).toBeNull();
    expect(fetchRider).not.toHaveBeenCalled();
  });

  it("propagates access errors instead of exposing an identity", async () => {
    const fetchRider = vi
      .fn()
      .mockResolvedValue({ data: null, error: { message: "not authorized" } });
    await expect(
      loadAssignedRider({ id: "order-1", rider_id: "rider-1" }, fetchRider),
    ).rejects.toThrow("not authorized");
  });
});
