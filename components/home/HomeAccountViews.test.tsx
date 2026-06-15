import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { HomeAccountViews } from "./HomeAccountViews";

const baseProps = {
  messageCenterPane: "square" as const,
  onSelectMessageCenterPane: vi.fn(),
  settingsSection: "profile" as const,
  setSettingsSection: vi.fn(),
  currentUserId: "user-1",
  userCode: 10001,
  userNickname: "Yolo",
  userBio: "Keeper",
  userAvatar: null,
  userCreatedAt: "2026-06-01T00:00:00.000Z",
  isVip: false,
  kpHistory: [],
  playerHistory: [],
  editNickname: "Yolo",
  setEditNickname: vi.fn(),
  editBio: "Keeper",
  setEditBio: vi.fn(),
  editAvatar: null,
  setEditAvatar: vi.fn(),
  newPassword: "",
  setNewPassword: vi.fn(),
  confirmNewPassword: "",
  setConfirmNewPassword: vi.fn(),
  loading: false,
  notifications: [],
  unreadCount: 0,
  socialMessageCount: 0,
  myCharacters: [],
  onMarkNotificationRead: vi.fn(),
  onDeleteNotification: vi.fn(),
  onRefreshNotifications: vi.fn(),
  onLoginRequest: vi.fn(),
  onJoinRoom: vi.fn(),
  onSaveProfile: vi.fn(),
  onResetProfile: vi.fn(),
  onChangePassword: vi.fn(),
  onShowHistory: vi.fn(),
};

describe("HomeAccountViews", () => {
  it("renders profile as a standalone page", () => {
    const html = renderToStaticMarkup(
      <HomeAccountViews {...baseProps} activeTab="profile" />
    );

    expect(html).toContain("个人中心");
    expect(html).toContain("UID: 10001");
    expect(html).not.toContain("消息中心");
    expect(html).not.toContain("设置");
    expect(html).not.toContain("登出");
  });

  it("renders messages and settings as separate account pages", () => {
    const messagesHtml = renderToStaticMarkup(
      <HomeAccountViews {...baseProps} activeTab="notifications" />
    );
    const settingsHtml = renderToStaticMarkup(
      <HomeAccountViews {...baseProps} activeTab="settings" />
    );

    expect(messagesHtml).toContain("消息中心");
    expect(messagesHtml).toContain("私信与邀请");
    expect(messagesHtml).not.toContain("个人中心");
    expect(messagesHtml).not.toContain("设置");

    expect(settingsHtml).toContain("设置");
    expect(settingsHtml).toContain("个人资料");
    expect(settingsHtml).toContain("密码与安全");
    expect(settingsHtml).not.toContain("消息中心");
    expect(settingsHtml).not.toContain("登出");
  });
});
