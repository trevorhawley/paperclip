/** Default titles a chat thread carries until its first message names it. */
export function isDefaultChatTitle(title: string): boolean {
  return title === "New chat" || title.startsWith("Chat with ");
}

/** A short, readable thread title from the person's first message. */
export function deriveChatTitle(body: string, max = 60): string | null {
  const text = body
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_`~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!text || text.startsWith("/")) return null;
  const sentence = text.split(/(?<=[.!?])\s/)[0] ?? text;
  if (sentence.length <= max) return sentence.replace(/[.!?]+$/, "");
  const cut = sentence.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return `${(space > max / 2 ? cut.slice(0, space) : cut).replace(/[,;:]+$/, "")}…`;
}
