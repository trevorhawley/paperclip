export interface MemoryPreviewSession {
  id: string;
  title: string;
  date: string;
  platform?: string;
  model?: string;
  project?: string;
  summary: string;
  decisions?: string[];
  actionItems?: string[];
  openQuestions?: string[];
  chatUrl?: string;
}

export const memoryPreviewSessions: MemoryPreviewSession[] = [
  {
    id: "6bf503a5-092b-4fd9-a74c-dff0cd11fbb6",
    title: "Planning a community garden",
    date: "2026-11-24",
    platform: "ChatGPT",
    project: "Community garden",
    summary: "Explored plot layouts, water access and a volunteer schedule. A small pilot would let the group measure demand before adding more plots.",
    decisions: ["Start with four shared beds."],
    actionItems: ["Check water access with the site coordinator.", "Ask volunteers about weekend availability."],
    openQuestions: ["Which site has reliable shade?"],
  },
  {
    id: "05a32c80-3c44-48e9-8dcb-82c1c695f538",
    title: "Notes on learning SQL",
    date: "2026-11-22",
    platform: "Claude",
    summary: "Worked through how outer joins preserve unmatched records and how a filter can change that behavior.",
    chatUrl: "https://example.com/sample-conversation",
  },
];
