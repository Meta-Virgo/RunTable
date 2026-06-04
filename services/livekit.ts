import { Character } from "../types";

interface VoiceTokenRequest {
  accessToken: string;
  roomId: string;
  activeCharId: string;
  participantName: string;
}

interface VoiceTokenResponse {
  token?: string;
  error?: string;
  code?: string;
}

const VOICE_ERROR_MESSAGES: Record<string, string> = {
  missing_fields: "语音房间参数缺失，请重新进入房间。",
  server_misconfigured: "语音服务暂未配置完成，请联系管理员。",
  missing_authorization: "登录状态已失效，请重新登录后再进入语音房。",
  unauthorized: "登录状态已失效，请重新登录后再进入语音房。",
  voice_room_not_available: "当前房间不是语音房，或语音房已不可用。",
  keeper_only: "只有房主可以守秘人身份进入语音房。",
  character_not_in_room: "当前角色不属于这个房间，请重新选择角色。",
  origin_not_allowed: "当前站点来源未被语音接口允许。",
  method_not_allowed: "语音接口请求方式不正确。",
  invalid_json: "语音请求格式错误，请刷新页面后重试。",
};

export function getVoiceParticipantName(
  activeCharId: string,
  userNickname: string,
  characters: Character[]
) {
  if (activeCharId === "pc") {
    return userNickname || "守秘人";
  }

  return (
    characters.find((character) => character.id === activeCharId)?.name ||
    "未知用户"
  );
}

export async function ensureMicrophonePermission() {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("当前浏览器不支持麦克风访问，请使用最新版 Chrome、Edge 或 Safari。");
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((track) => track.stop());
  } catch (error) {
    const name = error instanceof DOMException ? error.name : "";
    if (name === "NotAllowedError" || name === "PermissionDeniedError") {
      throw new Error("麦克风权限被拒绝，请在浏览器地址栏允许麦克风后重试。");
    }
    if (name === "NotFoundError" || name === "DevicesNotFoundError") {
      throw new Error("没有找到可用麦克风，请检查设备连接。");
    }
    throw new Error(
      error instanceof Error ? error.message : "无法访问麦克风，请检查浏览器权限。"
    );
  }
}

export async function requestVoiceToken({
  accessToken,
  roomId,
  activeCharId,
  participantName,
}: VoiceTokenRequest) {
  const response = await fetch("/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      roomName: roomId,
      participantName,
      characterId: activeCharId,
    }),
  });

  const text = await response.text();
  let data: VoiceTokenResponse = {};
  if (text) {
    try {
      data = JSON.parse(text) as VoiceTokenResponse;
    } catch {
      data = { error: text };
    }
  }

  if (!response.ok || !data.token) {
    const message =
      (data.code && VOICE_ERROR_MESSAGES[data.code]) ||
      data.error ||
      "无法加入语音房间，请稍后重试。";
    throw new Error(message);
  }

  return data.token;
}
