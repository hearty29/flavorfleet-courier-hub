import { describe, it, expect } from "vitest";
import { canParticipateInChat, validateChatMessage } from "../lib/support-chat";

describe("private support chats", () => {
  it("allows a customer and admin, not another customer, in a customer support thread", () => {
    expect(canParticipateInChat("customer_admin", "customer", "customer", null, null, false)).toBe(
      true,
    );
    expect(canParticipateInChat("customer_admin", "other", "customer", null, null, false)).toBe(
      false,
    );
    expect(canParticipateInChat("customer_admin", "admin", "customer", null, null, true)).toBe(
      true,
    );
  });
  it("allows a rider and admin, not another rider, in rider support", () => {
    expect(canParticipateInChat("rider_admin", "rider", "rider", null, null, false)).toBe(true);
    expect(canParticipateInChat("rider_admin", "other", "rider", null, null, false)).toBe(false);
    expect(canParticipateInChat("rider_admin", "admin", "rider", null, null, true)).toBe(true);
  });
  it("limits order chat to the customer, current assigned rider, and admins", () => {
    expect(
      canParticipateInChat("order_rider", "customer", "customer", "customer", "rider", false),
    ).toBe(true);
    expect(
      canParticipateInChat("order_rider", "rider", "customer", "customer", "rider", false),
    ).toBe(true);
    expect(
      canParticipateInChat("order_rider", "old-rider", "customer", "customer", "rider", false),
    ).toBe(false);
    expect(
      canParticipateInChat("order_rider", "admin", "customer", "customer", "rider", true),
    ).toBe(true);
  });
  it("rejects blank and oversized messages", () => {
    expect(() => validateChatMessage("  ")).toThrow();
    expect(validateChatMessage(" Hello ")).toBe("Hello");
    expect(validateChatMessage("a".repeat(2000))).toHaveLength(2000);
    expect(() => validateChatMessage("a".repeat(2001))).toThrow();
  });
});
