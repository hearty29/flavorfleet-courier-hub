export type TournamentStream = {
  platform: "none" | "youtube" | "facebook";
  status: "scheduled" | "live" | "ended";
  url: string;
  replay_url: string;
};
export const emptyStream: TournamentStream = {
  platform: "none",
  status: "scheduled",
  url: "",
  replay_url: "",
};

// Accept video links only. Embed URLs are constructed here, never supplied as HTML.
const youtubeVideo =
  /^https:\/\/(?:(?:www\.)?youtube\.com\/(?:watch\?v=|live\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{11})(?:[?&][A-Za-z0-9_.~%=&+-]*)?$/;
const facebookVideo =
  /^https:\/\/(?:(?:www|m|web)\.)?facebook\.com\/(?:[A-Za-z0-9_.-]+\/videos\/[0-9]+\/?|watch\/?\?v=[0-9]+|video\.php\?v=[0-9]+|share\/v\/[A-Za-z0-9]+\/?)(?:[?&][A-Za-z0-9_.~%=&+-]*)?$/;
export function validStreamUrl(platform: string, url: string) {
  return (
    url.length <= 2048 &&
    (platform === "youtube" ? youtubeVideo : platform === "facebook" ? facebookVideo : /$a/).test(
      url,
    )
  );
}
export function validateStream(stream: TournamentStream): TournamentStream {
  if (stream.platform === "none") return { ...emptyStream };
  const value = { ...stream, url: stream.url.trim(), replay_url: stream.replay_url.trim() };
  if (!validStreamUrl(value.platform, value.url))
    throw new Error("Enter a valid HTTPS video link for the selected platform.");
  if (value.replay_url && !validStreamUrl(value.platform, value.replay_url))
    throw new Error("The replay must be a valid video link for the selected platform.");
  return value;
}
export function streamEmbedUrl(platform: string, url: string) {
  if (!validStreamUrl(platform, url)) return null;
  if (platform === "youtube")
    return `https://www.youtube-nocookie.com/embed/${youtubeVideo.exec(url)![1]}`;
  return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=false&width=1280`;
}
