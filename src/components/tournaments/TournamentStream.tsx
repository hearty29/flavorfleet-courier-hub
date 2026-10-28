import { useState } from "react";
import { ExternalLink, Video } from "lucide-react";
import { emptyStream, streamEmbedUrl, type TournamentStream } from "@/lib/tournament-stream";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function StreamEditor({
  value,
  onChange,
}: {
  value: TournamentStream;
  onChange: (value: TournamentStream) => void;
}) {
  return (
    <fieldset className="space-y-3 rounded-xl border p-4">
      <legend className="px-1 font-semibold">Tournament live stream</legend>
      <p className="text-sm text-muted-foreground">
        Start your broadcast in the Facebook or YouTube phone app, then paste its public video link
        here. No stream key or password is needed.
      </p>
      <div>
        <Label htmlFor="stream-platform">Video platform</Label>
        <select
          id="stream-platform"
          value={value.platform}
          onChange={(e) =>
            onChange({ ...emptyStream, platform: e.target.value as TournamentStream["platform"] })
          }
          className="h-10 w-full rounded-md border bg-background px-2"
        >
          <option value="none">No broadcast</option>
          <option value="youtube">YouTube</option>
          <option value="facebook">Facebook</option>
        </select>
      </div>
      {value.platform !== "none" && (
        <>
          <div>
            <Label htmlFor="stream-url">Broadcast video link</Label>
            <Input
              id="stream-url"
              type="url"
              required
              maxLength={2048}
              value={value.url}
              onChange={(e) => onChange({ ...value, url: e.target.value })}
              placeholder={
                value.platform === "youtube"
                  ? "https://www.youtube.com/watch?v=…"
                  : "https://www.facebook.com/Page/videos/…"
              }
            />
            <p className="mt-1 text-xs text-muted-foreground">
              {value.platform === "youtube"
                ? "Use a watch, live, or youtu.be video link."
                : "Use a video permalink, watch link, or share/v link. Share links may require opening Facebook directly."}
            </p>
          </div>
          <div>
            <Label htmlFor="stream-status">Broadcast status</Label>
            <select
              id="stream-status"
              value={value.status}
              onChange={(e) =>
                onChange({ ...value, status: e.target.value as TournamentStream["status"] })
              }
              className="h-10 w-full rounded-md border bg-background px-2"
            >
              <option value="scheduled">Scheduled</option>
              <option value="live">Live</option>
              <option value="ended">Ended</option>
            </select>
            <p className="mt-1 text-xs text-muted-foreground">
              Update this manually when the broadcast starts or ends.
            </p>
          </div>
          <div>
            <Label htmlFor="stream-replay">Replay video link (optional)</Label>
            <Input
              id="stream-replay"
              type="url"
              maxLength={2048}
              value={value.replay_url}
              onChange={(e) => onChange({ ...value, replay_url: e.target.value })}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Use a link from the same platform. Shown after the broadcast ends; otherwise the
              original video is used.
            </p>
          </div>
        </>
      )}
    </fieldset>
  );
}

export function StreamPlayer({
  stream,
  title,
}: {
  stream?: TournamentStream | undefined;
  title: string;
}) {
  const [loaded, setLoaded] = useState<string | null>(null);
  if (!stream || stream.platform === "none") return null;
  const url = stream.status === "ended" && stream.replay_url ? stream.replay_url : stream.url;
  const embed = streamEmbedUrl(stream.platform, url);
  if (!embed) return null;
  const platform = stream.platform === "youtube" ? "YouTube" : "Facebook";
  const label =
    stream.status === "live" ? "Live" : stream.status === "ended" ? "Replay" : "Scheduled";
  return (
    <section
      aria-label="Tournament broadcast"
      className="space-y-4 rounded-2xl border bg-card p-5 md:p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-lg font-bold">
          <Video className="size-5" />
          Tournament broadcast
        </h3>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${stream.status === "live" ? "bg-red-100 text-red-800" : "bg-secondary text-secondary-foreground"}`}
        >
          {label} · {platform}
        </span>
      </div>
      {loaded === embed ? (
        <iframe
          key={embed}
          title={`${title} · ${label} on ${platform}`}
          src={embed}
          className="aspect-video w-full rounded-xl border-0 bg-black"
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      ) : (
        <div className="grid aspect-video place-content-center gap-3 rounded-xl bg-ink p-5 text-center text-ink-foreground">
          <Video className="mx-auto size-8" />
          <p>
            {stream.status === "scheduled"
              ? "Broadcast scheduled. Check back at tournament time."
              : stream.status === "ended"
                ? "Watch the tournament replay."
                : "Follow the tournament live."}
          </p>
          <Button variant="secondary" onClick={() => setLoaded(embed)}>
            Load {label === "Replay" ? "replay" : "video"}
          </Button>
          <p className="text-xs opacity-80">Loads content from {platform}.</p>
        </div>
      )}
      <Button asChild variant="outline">
        <a href={url} target="_blank" rel="noopener noreferrer">
          <ExternalLink className="size-4" />
          {stream.status === "ended"
            ? "Watch replay"
            : stream.status === "live"
              ? "Watch Live"
              : "Open broadcast"}{" "}
          on {platform}
        </a>
      </Button>
      <p className="text-xs text-muted-foreground">
        If the video is unavailable here, open it directly. Visibility, embedding permissions and
        livestream eligibility are controlled by {platform}. Broadcast status is set by the
        organizer.
      </p>
    </section>
  );
}
