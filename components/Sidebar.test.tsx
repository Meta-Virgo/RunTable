import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { Sidebar } from "./Sidebar";
import type { RoomMemberPanelItem } from "../services/roomMembers";

vi.mock("@livekit/components-react", () => ({
  useIsSpeaking: () => false,
  useLocalParticipant: () => ({
    localParticipant: { setMicrophoneEnabled: vi.fn() },
    isMicrophoneEnabled: false,
  }),
  useParticipants: () => [],
}));

const members: RoomMemberPanelItem[] = [
  {
    userId: "keeper-1",
    role: "keeper",
    status: "active",
    isOnline: true,
    canKick: false,
    kickUserId: null,
    displayName: "Keeper",
    roleLabel: "Keeper",
    characterId: null,
    characterName: null,
  },
  {
    userId: "player-1",
    role: "player",
    status: "active",
    isOnline: false,
    canKick: true,
    kickUserId: "player-1",
    displayName: "Player One",
    roleLabel: "Player",
    characterId: null,
    characterName: null,
  },
  {
    userId: "observer-1",
    role: "observer",
    status: "active",
    isOnline: false,
    canKick: true,
    kickUserId: "observer-1",
    displayName: "Observer",
    roleLabel: "Observer",
    characterId: null,
    characterName: null,
  },
];

const renderSidebar = (
  isKP: boolean,
  roomType: "text" | "voice" = "text"
) =>
  renderToStaticMarkup(
    <Sidebar
      isOpen
      setIsOpen={vi.fn()}
      view="main"
      setView={vi.fn()}
      activeCharId="pc"
      setActiveCharId={vi.fn()}
      characters={[]}
      onOpenStatusEdit={vi.fn()}
      onKickMember={vi.fn()}
      isMobile={false}
      isKP={isKP}
      roomMemberItems={members}
      kpOnline
      roomType={roomType}
      userNickname="Keeper"
      isVoiceConnected={false}
    />
  );

describe("Sidebar room member display", () => {
  it.each(["text", "voice"] as const)(
    "does not render the duplicate member panel for keepers in %s rooms",
    (roomType) => {
      const html = renderSidebar(true, roomType);

      expect(html).not.toContain("Player One");
      expect(html).not.toContain("Observer");
      expect(html).not.toContain("房间成员");
      expect(html).not.toContain('aria-label="Kick Player One"');
    }
  );

  it("does not render member panel controls for non-keepers", () => {
    const html = renderSidebar(false);

    expect(html).not.toContain("Player One");
    expect(html).not.toContain('aria-label="Kick Player One"');
  });
});
