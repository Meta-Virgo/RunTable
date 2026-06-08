import type { Log } from "../types";
import type { RoomStoryResult } from "./roomSessionModel";

type FetchMessagesPage = (
  roomId: string,
  page: number,
  batchSize: number
) => Promise<{ data?: any[] | null; error?: any }>;

type MapMessagesToLogs = (
  messages: any[],
  currentUserId?: string
) => Promise<Log[]>;

interface BuildRoomStoryInput {
  roomId: string | null;
  currentUserId?: string;
  fetchMessagesPage: FetchMessagesPage;
  mapMessagesToLogs: MapMessagesToLogs;
  buildStoryReport: (logs: Log[]) => string;
  batchSize?: number;
}

export async function buildRoomStory({
  roomId,
  currentUserId,
  fetchMessagesPage,
  mapMessagesToLogs,
  buildStoryReport,
  batchSize = 1000,
}: BuildRoomStoryInput): Promise<RoomStoryResult> {
  if (!roomId) return { ok: false };

  try {
    const messages = await fetchAllRoomStoryMessages({
      roomId,
      batchSize,
      fetchMessagesPage,
    });
    const logs = await mapMessagesToLogs(messages, currentUserId);

    return { ok: true, story: buildStoryReport(logs) };
  } catch (error) {
    console.error("Error generating story:", error);
    return { ok: false, message: "生成战报失败，请重试。" };
  }
}

export async function fetchAllRoomStoryMessages({
  roomId,
  batchSize,
  fetchMessagesPage,
}: {
  roomId: string;
  batchSize: number;
  fetchMessagesPage: FetchMessagesPage;
}) {
  const messages: any[] = [];
  let page = 0;

  while (true) {
    const { data, error } = await fetchMessagesPage(roomId, page, batchSize);
    if (error) throw error;

    if (!data || data.length === 0) break;

    messages.push(...data);
    page += 1;

    if (data.length < batchSize) break;
  }

  return messages;
}
