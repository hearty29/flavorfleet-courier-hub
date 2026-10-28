import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ComponentType } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  from: vi.fn(),
  clear: vi.fn(),
  navigate: vi.fn(),
  error: vi.fn(),
  profileUpdate: vi.fn(),
  orders: [] as Record<string, unknown>[],
  queryError: null as { message: string } | null,
}));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({ options }),
  useNavigate: () => mocks.navigate,
  Link: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));
vi.mock("@/lib/auth", () => ({
  useAuth: () => ({ session: { user: { id: "customer" } }, roles: ["admin"], loading: false }),
}));
vi.mock("@/lib/cart", () => ({
  useCart: () => ({
    items: [{ id: "dish", name: "Test dish", price: 99, quantity: 2 }],
    subtotal: 198,
    clear: mocks.clear,
    setQty: vi.fn(),
  }),
  peso: (value: number) => `₱${value.toFixed(2)}`,
  DELIVERY_FEE: 49,
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: mocks.rpc,
    from: mocks.from,
    channel: () => ({ on: () => ({ subscribe: () => ({}) }) }),
    removeChannel: vi.fn(),
  },
}));
vi.mock("sonner", () => ({ toast: { error: mocks.error, success: vi.fn() } }));
vi.mock("@/components/DeliveryProof", () => ({ DeliveryProofImage: () => null }));
vi.mock("@/components/SupportChat", () => ({ SupportInbox: () => null }));

import { Route as CheckoutRoute } from "@/routes/checkout";
import { Route as AdminRoute } from "@/routes/_authenticated/admin";

const clients: QueryClient[] = [];
function mount(Component: ComponentType) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  clients.push(client);
  return render(
    <QueryClientProvider client={client}>
      <Component />
    </QueryClientProvider>,
  );
}
function fillContact() {
  fireEvent.change(screen.getByLabelText("Full Name"), { target: { value: "Customer" } });
  fireEvent.change(screen.getByLabelText("Phone Number"), { target: { value: "09123" } });
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.orders = [];
  mocks.queryError = null;
  mocks.rpc.mockResolvedValue({ data: "new-order", error: null });
  mocks.profileUpdate.mockReturnValue({ eq: () => Promise.resolve({ error: null }) });
  mocks.from.mockImplementation((table: string) => {
    const result = {
      data: table === "orders" ? mocks.orders : table === "profiles" ? [] : [],
      error: table === "orders" ? mocks.queryError : null,
    };
    const query = {
      select: () => query,
      eq: () => query,
      order: () => query,
      limit: () => Promise.resolve(result),
      maybeSingle: () => Promise.resolve({ data: null }),
      then: (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve),
      update: mocks.profileUpdate,
    };
    return query;
  });
});
afterEach(() => {
  cleanup();
  clients.splice(0).forEach((client) => client.clear());
});

describe("checkout order types", () => {
  it("sends delivery details and includes the delivery fee", async () => {
    mount(CheckoutRoute.options.component as ComponentType);
    fillContact();
    fireEvent.change(screen.getByLabelText("Delivery Address"), { target: { value: "Home" } });
    expect(screen.getByText("₱247.00")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Place delivery order" }));
    await waitFor(() =>
      expect(mocks.rpc).toHaveBeenCalledWith(
        "place_order",
        expect.objectContaining({
          _order_type: "delivery",
          _payment: "cod",
          _address: "Home",
          _items: [{ id: "dish", quantity: 2 }],
        }),
      ),
    );
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith({ to: "/orders" }));
  });
  it("submits counter collection without an address or fee and preserves the saved address", async () => {
    mount(CheckoutRoute.options.component as ComponentType);
    fireEvent.click(screen.getByRole("button", { name: "Counter / Walk-in" }));
    fillContact();
    expect(screen.queryByLabelText("Delivery Address")).not.toBeInTheDocument();
    expect(screen.queryByText("Delivery fee")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Counter / Walk-in" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    fireEvent.click(screen.getByRole("button", { name: "Place counter order" }));
    await waitFor(() =>
      expect(mocks.rpc).toHaveBeenCalledWith(
        "place_order",
        expect.objectContaining({
          _order_type: "counter",
          _payment: "counter",
          _address: "Counter Pickup / Walk-in",
        }),
      ),
    );
    await waitFor(() => expect(mocks.clear).toHaveBeenCalled());
    expect(mocks.profileUpdate).toHaveBeenCalledWith({ phone: "09123", full_name: "Customer" });
  });
  it("completes checkout even if saving the profile fails after order placement", async () => {
    mocks.profileUpdate.mockReturnValueOnce({ eq: () => Promise.reject(new Error("Offline")) });
    mount(CheckoutRoute.options.component as ComponentType);
    fireEvent.click(screen.getByRole("button", { name: "Counter / Walk-in" }));
    fillContact();
    fireEvent.click(screen.getByRole("button", { name: "Place counter order" }));
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith({ to: "/orders" }));
    expect(mocks.clear).toHaveBeenCalled();
    expect(mocks.error).not.toHaveBeenCalled();
  });

  it("retains the cart and allows retry when the database rejects an order", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { message: "Migration required" } });
    mount(CheckoutRoute.options.component as ComponentType);
    fireEvent.click(screen.getByRole("button", { name: "Counter / Walk-in" }));
    fillContact();
    fireEvent.click(screen.getByRole("button", { name: "Place counter order" }));
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith("Migration required"));
    expect(mocks.clear).not.toHaveBeenCalled();
    expect(mocks.navigate).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Place counter order" })).toBeEnabled();
  });
});

describe("admin order types", () => {
  it("counts and filters customer orders, then claims a ready counter order", async () => {
    mocks.orders = [
      {
        id: "counter-order",
        order_type: "counter",
        status: "ready",
        customer_name: "Counter customer",
        total: 198,
        created_at: new Date().toISOString(),
        order_items: [],
      },
      {
        id: "delivery-order",
        order_type: "delivery",
        status: "pending",
        customer_name: "Delivery customer",
        total: 247,
        created_at: new Date().toISOString(),
        order_items: [],
      },
      {
        id: "claimed-order",
        order_type: "counter",
        status: "delivered",
        customer_name: "Claimed customer",
        total: 99,
        created_at: new Date().toISOString(),
        order_items: [],
      },
    ];
    mount(AdminRoute.options.component as ComponentType);
    fireEvent.click(await screen.findByRole("button", { name: "Counter / Walk-in (2)" }));
    expect(screen.getByText(/Counter customer/)).toBeInTheDocument();
    expect(screen.queryByText(/Delivery customer/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Claimed customer/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Mark Claimed" }));
    await waitFor(() =>
      expect(mocks.rpc).toHaveBeenCalledWith("admin_claim_counter_order", {
        _order: "counter-order",
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "All statuses" }));
    expect(screen.getByText(/Claimed customer/)).toBeInTheDocument();
    const claimedCard = screen.getByText(/Claimed customer/).closest("article")!;
    expect(
      within(claimedCard).queryByRole("button", { name: "Mark Claimed" }),
    ).not.toBeInTheDocument();
  });
  it("shows a load error instead of reporting an empty dashboard", async () => {
    mocks.queryError = { message: "Database unavailable" };
    mount(AdminRoute.options.component as ComponentType);
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load orders");
    expect(screen.queryByText(/No.*orders found/)).not.toBeInTheDocument();
  });
});
