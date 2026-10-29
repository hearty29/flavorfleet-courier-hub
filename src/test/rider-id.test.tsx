import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ComponentType } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  eligible: false,
  record: null as null | {
    id_type: string;
    id_document_path: string;
    id_verification_status: string;
  },
  statusError: false,
  saveError: false,
  upload: vi.fn(),
  remove: vi.fn(),
  insert: vi.fn(),
  save: vi.fn(),
  error: vi.fn(),
  signed: vi.fn(),
}));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({ options }),
  Link: ({ children, to }: React.PropsWithChildren<{ to: string }>) => <a href={to}>{children}</a>,
}));
vi.mock("@/lib/auth", () => ({
  useAuth: () => ({ session: { user: { id: "test-owner" } }, roles: [] }),
}));
vi.mock("@/components/RiderProfilePhoto", () => ({
  RiderProfilePhoto: () => <div>Profile picture saved</div>,
  riderPhotoQuery: () => ({
    queryKey: ["rider-photo", "test-owner"],
    queryFn: async () => ({ hasPhoto: true }),
  }),
}));
vi.mock("sonner", () => ({ toast: { error: mocks.error, success: vi.fn() } }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: async () => ({
      data: mocks.eligible,
      error: mocks.statusError ? new Error("Status unavailable") : null,
    }),
    storage: {
      from: () => ({ upload: mocks.upload, remove: mocks.remove, createSignedUrl: mocks.signed }),
    },
    from: (table: string) => {
      const query = {
        select: () => query,
        eq: () => query,
        order: async () => ({ data: [], error: null }),
        maybeSingle: async () => ({ data: mocks.record, error: null }),
        insert: mocks.insert,
        upsert: async (payload: typeof mocks.record) => {
          mocks.save(payload);
          if (mocks.saveError) return { error: new Error("ID save failed") };
          mocks.record = payload;
          mocks.eligible = true;
          return { error: null };
        },
      };
      if (table === "rider_applications") return query;
      return query;
    },
  },
}));
import { Route } from "@/routes/_authenticated/apply-rider";
import { RiderIdReview } from "@/components/RiderIdUpload";
const clients: QueryClient[] = [];
function mount(component?: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  clients.push(client);
  const Apply = Route.options.component as ComponentType;
  return render(
    <QueryClientProvider client={client}>{component ?? <Apply />}</QueryClientProvider>,
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.eligible = false;
  mocks.record = null;
  mocks.statusError = false;
  mocks.saveError = false;
  mocks.upload.mockResolvedValue({ error: null });
  mocks.remove.mockResolvedValue({ error: null });
  mocks.insert.mockResolvedValue({ error: null });
  mocks.signed.mockResolvedValue({
    data: { signedUrl: "https://example.invalid/private-id" },
    error: null,
  });
});
afterEach(() => {
  cleanup();
  clients.forEach((c) => c.clear());
  clients.length = 0;
});

it("requires ID despite an existing profile photo, including a forced submit", async () => {
  mount();
  const submit = await screen.findByRole("button", { name: "Submit application" });
  expect(submit).toBeDisabled();
  expect(screen.getByLabelText("ID type")).toHaveTextContent("School ID");
  expect(screen.getByLabelText("ID type")).not.toHaveTextContent("Driver's License");
  fireEvent.submit(submit.closest("form")!);
  await waitFor(() =>
    expect(mocks.error).toHaveBeenCalledWith(
      "Upload a School ID, National ID, Passport or Government ID before applying.",
    ),
  );
  expect(mocks.insert).not.toHaveBeenCalled();
});
it.each(["School ID", "National ID", "Passport", "Government ID"])(
  "uploads %s privately as pending before application submission",
  async (type) => {
    mount();
    await screen.findByRole("button", { name: "Submit application" });
    fireEvent.change(screen.getByLabelText("ID type"), { target: { value: type } });
    fireEvent.change(screen.getByLabelText("ID document"), {
      target: { files: [new File(["synthetic"], "id.pdf", { type: "application/pdf" })] },
    });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Submit application" })).toBeEnabled(),
    );
    expect(mocks.upload).toHaveBeenCalledWith(
      expect.stringMatching(/^test-owner\/.+\.pdf$/),
      expect.any(File),
      { contentType: "application/pdf", upsert: false },
    );
    expect(mocks.save).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "test-owner",
        id_type: type,
        id_verification_status: "pending",
      }),
    );
    fireEvent.submit(screen.getByRole("button", { name: "Submit application" }).closest("form")!);
    await waitFor(() => expect(mocks.insert).toHaveBeenCalled());
  },
);
it("keeps rejected IDs from enabling submission", async () => {
  mocks.record = {
    id_type: "Passport",
    id_document_path: "test-owner/id.pdf",
    id_verification_status: "rejected",
  };
  mount();
  expect(await screen.findByText("rejected")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Submit application" })).toBeDisabled();
});
it("fails closed if ID status cannot be checked", async () => {
  mocks.statusError = true;
  mount();
  await screen.findByText("ID status unavailable");
  expect(screen.getByRole("button", { name: "Submit application" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Retry ID status" })).toBeInTheDocument();
});
it("cleans up an uploaded file when saving the verification fails", async () => {
  mocks.saveError = true;
  mount();
  await screen.findByRole("button", { name: "Submit application" });
  fireEvent.change(screen.getByLabelText("ID type"), { target: { value: "School ID" } });
  fireEvent.change(screen.getByLabelText("ID document"), {
    target: { files: [new File(["test"], "id.jpg", { type: "image/jpeg" })] },
  });
  await screen.findByText("ID save failed");
  expect(mocks.remove).toHaveBeenCalledWith([expect.stringMatching(/^test-owner\//)]);
  expect(screen.getByRole("button", { name: "Submit application" })).toBeDisabled();
});
it("rejects unsupported file types before uploading", async () => {
  mount();
  await screen.findByRole("button", { name: "Submit application" });
  fireEvent.change(screen.getByLabelText("ID type"), { target: { value: "Passport" } });
  fireEvent.change(screen.getByLabelText("ID document"), {
    target: { files: [new File(["test"], "id.txt", { type: "text/plain" })] },
  });
  expect(await screen.findByRole("alert")).toHaveTextContent("Choose a JPG");
  expect(mocks.upload).not.toHaveBeenCalled();
});
it("admin review opens the private ID using a short-lived signed URL", async () => {
  mocks.record = {
    id_type: "School ID",
    id_document_path: "test-owner/school.pdf",
    id_verification_status: "pending",
  };
  mocks.eligible = true;
  const open = vi.spyOn(window, "open").mockImplementation(() => null);
  mount(<RiderIdReview userId="test-owner" />);
  fireEvent.click(await screen.findByRole("button", { name: "View private ID" }));
  await waitFor(() => expect(mocks.signed).toHaveBeenCalledWith("test-owner/school.pdf", 60));
  expect(open).toHaveBeenCalledWith(
    "https://example.invalid/private-id",
    "_blank",
    "noopener,noreferrer",
  );
  open.mockRestore();
});
