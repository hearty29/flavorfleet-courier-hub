import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { StreamPlayer } from "@/components/tournaments/TournamentStream";
import {
  emptyStream,
  streamEmbedUrl,
  validateStream,
  validStreamUrl,
} from "@/lib/tournament-stream";
afterEach(cleanup);
const video = "https://www.youtube.com/watch?v=abcdefghijk";
describe("tournament broadcasts", () => {
  it.each([
    "https://youtu.be/abcdefghijk?si=token",
    "https://www.youtube.com/live/abcdefghijk?feature=share",
    video,
  ])("embeds supported YouTube links using a fixed privacy host: %s", (url) => {
    expect(streamEmbedUrl("youtube", url)).toBe(
      "https://www.youtube-nocookie.com/embed/abcdefghijk",
    );
  });
  it.each([
    "javascript:alert(1)",
    "https://youtube.com.evil.test/watch?v=abcdefghijk",
    "https://evil.test/abcdefghijk",
    "https://www.youtube.com/@channel/live",
    "https://user:password@youtube.com/watch?v=abcdefghijk",
    "https://www.youtube.com/watch?v=short",
  ])("rejects unsafe or non-video links: %s", (url) => {
    expect(validStreamUrl("youtube", url)).toBe(false);
    expect(streamEmbedUrl("youtube", url)).toBeNull();
  });
  it("validates platform, replay and removal", () => {
    expect(validStreamUrl("facebook", "https://www.facebook.com/Roadside/videos/123456789/")).toBe(
      true,
    );
    expect(validStreamUrl("facebook", "https://www.facebook.com/share/v/Abc123/")).toBe(true);
    expect(validStreamUrl("facebook", video)).toBe(false);
    expect(() =>
      validateStream({
        ...emptyStream,
        platform: "youtube",
        url: video,
        replay_url: "https://evil.test",
      }),
    ).toThrow("replay");
    expect(validateStream({ ...emptyStream, url: video })).toEqual(emptyStream);
  });
  it("loads video only after a click and provides a direct-watch fallback", () => {
    const { container } = render(
      <StreamPlayer
        title="Doubles Cup"
        stream={{ ...emptyStream, platform: "youtube", status: "live", url: video }}
      />,
    );
    expect(container.querySelector("iframe")).toBeNull();
    expect(screen.getByRole("link", { name: "Watch Live on YouTube" })).toHaveAttribute(
      "href",
      video,
    );
    fireEvent.click(screen.getByRole("button", { name: "Load video" }));
    expect(screen.getByTitle("Doubles Cup · Live on YouTube")).toHaveAttribute(
      "src",
      "https://www.youtube-nocookie.com/embed/abcdefghijk",
    );
  });
  it("switches to replay when ended and clears the player when its URL changes", () => {
    const stream = {
      ...emptyStream,
      platform: "youtube" as const,
      status: "ended" as const,
      url: video,
      replay_url: "https://youtu.be/12345678901",
    };
    const { container, rerender } = render(<StreamPlayer title="Cup" stream={stream} />);
    expect(screen.getByRole("link", { name: "Watch replay on YouTube" })).toHaveAttribute(
      "href",
      stream.replay_url,
    );
    fireEvent.click(screen.getByRole("button", { name: "Load replay" }));
    expect(container.querySelector("iframe")).not.toBeNull();
    rerender(
      <StreamPlayer
        title="Cup"
        stream={{ ...stream, replay_url: "https://youtu.be/12345678902" }}
      />,
    );
    expect(container.querySelector("iframe")).toBeNull();
    rerender(<StreamPlayer title="Cup" stream={emptyStream} />);
    expect(container).toBeEmptyDOMElement();
  });
});
