import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  uid: "customer",
  roles: [] as string[],
  failDelete: false,
  pendingDelete: false,
  threads: [] as {
    id: string;
    kind: string;
    order_id: string | null;
    status: string;
    updated_at: string;
    display_name: string;
    last_message: string;
    unread: boolean;
  }[],
}));
vi.mock("@/lib/auth", () => ({
  useAuth: () => ({ session: { user: { id: mocks.uid } }, roles: mocks.roles, loading: false }),
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: React.PropsWithChildren<{ to: string }>) => <a href={to}>{children}</a>,
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: mocks.rpc,
    from: () => {
      const query = {
        select: () => query,
        eq: () => query,
        order: () => query,
        limit: () => Promise.resolve({ data: [], error: null }),
      };
      return query;
    },
    channel: () => {
      const channel = { on: () => channel, subscribe: () => channel };
      return channel;
    },
    removeChannel: vi.fn(),
  },
}));
import { FloatingSupport, SupportInbox } from "@/components/SupportChat";

const clients: QueryClient[] = [];
function mount(withBadge = false) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  clients.push(client);
  return render(
    <QueryClientProvider client={client}>
      <SupportInbox admin={mocks.roles.includes("admin")} />
      {withBadge && <FloatingSupport />}
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  Element.prototype.scrollIntoView = vi.fn();
  mocks.uid = "customer";
  mocks.roles = [];
  mocks.failDelete = false;
  mocks.pendingDelete = false;
  mocks.threads = [
    {
      id: "first",
      kind: "customer_admin",
      order_id: null,
      status: "open",
      updated_at: "2026-10-28T12:00:00Z",
      display_name: "Josh",
      last_message: "Hello",
      unread: true,
    },
    {
      id: "second",
      kind: "order_rider",
      order_id: "order-id",
      status: "resolved",
      updated_at: "2026-10-27T12:00:00Z",
      display_name: "Duck",
      last_message: "Thanks",
      unread: false,
    },
  ];
  mocks.rpc.mockImplementation(async (fn: string, args?: { _conversation: string }) => {
    if (fn === "list_support_conversations") return { data: [...mocks.threads], error: null };
    if (fn === "delete_support_conversation") {
      if (mocks.pendingDelete) return new Promise(() => {});
      if (mocks.failDelete) return { data: null, error: { message: "Database unavailable" } };
      mocks.threads = mocks.threads.filter((t) => t.id !== args?._conversation);
    }
    return { data: null, error: null };
  });
});
afterEach(() => {
  cleanup();
  for (const client of clients.splice(0)) client.clear();
});
async function openDelete(name = "Josh") {
  fireEvent.click(await screen.findByRole("button", { name: `Delete conversation with ${name}` }));
  return screen.findByRole("dialog", { name: "Delete conversation from your inbox?" });
}

describe("personal inbox deletion", () => {
  it.each(["customer", "rider", "admin"])(
    "allows %s to confirm deletion of an inbox entry",
    async (role) => {
      mocks.uid = role;
      mocks.roles = role === "customer" ? [] : [role];
      mount();
      const dialog = await openDelete();
      expect(dialog).toHaveTextContent("from your inbox only");
      expect(dialog).toHaveTextContent("A new message or opening the chat again brings it back");
      expect(mocks.rpc).not.toHaveBeenCalledWith("delete_support_conversation", expect.anything());
      fireEvent.click(within(dialog).getByRole("button", { name: "Delete for me" }));
      await waitFor(() =>
        expect(
          screen.queryByRole("button", { name: "Delete conversation with Josh" }),
        ).not.toBeInTheDocument(),
      );
      expect(mocks.rpc).toHaveBeenCalledWith("delete_support_conversation", {
        _conversation: "first",
      });
      expect(
        screen.getByRole("button", { name: "Delete conversation with Duck" }),
      ).toBeInTheDocument();
    },
  );
  it("cancel leaves the conversation and makes no delete request", async () => {
    mount();
    const dialog = await openDelete();
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Delete conversation with Josh" }),
    ).toBeInTheDocument();
    expect(mocks.rpc).not.toHaveBeenCalledWith("delete_support_conversation", expect.anything());
  });
  it("keeps the thread on failure and allows a successful retry", async () => {
    mocks.failDelete = true;
    mount();
    const dialog = await openDelete();
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete for me" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Could not delete");
    expect(
      screen.getByRole("button", { name: "Delete conversation with Josh", hidden: true }),
    ).toBeInTheDocument();
    mocks.failDelete = false;
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete for me" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
  it("closes the active chat after deletion from its toolbar and removes unread count", async () => {
    mount(true);
    expect(await screen.findByText("Support (1)")).toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: /^Josh/ }));
    expect(await screen.findByRole("textbox", { name: "Message" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Delete conversation" }));
    fireEvent.click(
      within(await screen.findByRole("dialog")).getByRole("button", { name: "Delete for me" }),
    );
    await waitFor(() =>
      expect(screen.queryByRole("textbox", { name: "Message" })).not.toBeInTheDocument(),
    );
    expect(screen.getByText("Select a conversation")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Chat support" })).toBeInTheDocument(),
    );
  });
  it("deleting another entry preserves the active conversation and supports resolved entries", async () => {
    mount();
    fireEvent.click(await screen.findByRole("button", { name: /^Josh/ }));
    const dialog = await openDelete("Duck");
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete for me" }));
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "Delete conversation with Duck" }),
      ).not.toBeInTheDocument(),
    );
    expect(screen.getByRole("textbox", { name: "Message" })).toBeInTheDocument();
    expect(mocks.rpc).toHaveBeenCalledWith("delete_support_conversation", {
      _conversation: "second",
    });
  });
  it("prevents repeat confirmation while a request is pending", async () => {
    mocks.pendingDelete = true;
    mount();
    const dialog = await openDelete();
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete for me" }));
    await waitFor(() =>
      expect(within(dialog).getByRole("button", { name: "Deleting…" })).toBeDisabled(),
    );
    expect(within(dialog).getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(
      mocks.rpc.mock.calls.filter(([fn]) => fn === "delete_support_conversation"),
    ).toHaveLength(1);
  });
});
