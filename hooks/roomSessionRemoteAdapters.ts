import { removeCharacterFromRoom } from "../services/characters";
import {
  addMessage,
  deleteMessage,
  deleteRoomMessages,
  fetchMessagesBefore,
  fetchMessagesPage,
  mapMessagesToLogs,
} from "../services/messages";
import { fetchRoomMembers } from "../services/roomMembers";
import {
  addRoomSystemMessage,
  concludeRoom,
  deleteRoom,
  fetchCurrentRoomMembership,
  fetchProfileNickname,
  fetchRoomById,
  fetchRoomCharacters,
  joinRoom as joinRoomRpc,
  kickRoomMember,
  setRoomPassword,
  updateRoomModule,
  updateRoomMusicState,
  updateRoomMusicUrl,
} from "../services/rooms";
import { getCurrentUser } from "../services/auth";
import { mapCharacterRow } from "../utils/characterMapper";
import { buildStoryReport } from "../utils/storyReport";

export function createRoomSessionRemoteAdapters() {
  return {
    join: {
      fetchRoomById,
      getCurrentUser,
      fetchCurrentRoomMembership,
      joinRoom: joinRoomRpc,
      fetchRoomCharacters,
      fetchRoomMembers,
      mapCharacterRow,
      fetchProfileNickname,
      addRoomSystemMessage,
    },
    restore: {
      getCurrentUser,
      fetchCurrentRoomMembership,
    },
    leaveMessage: {
      getCurrentUser,
      addMessage,
    },
    addLog: {
      addMessage,
    },
    deleteRoom: {
      deleteRoom,
    },
    clearChat: {
      deleteRoomMessages,
    },
    deleteMessage: {
      deleteMessage,
    },
    story: {
      fetchMessagesPage,
      mapMessagesToLogs,
      buildStoryReport,
    },
    removeCharacter: {
      kickRoomMember,
      removeCharacterFromRoom,
      addMessage,
    },
    kickMember: {
      kickRoomMember,
      addMessage,
    },
    conclude: {
      concludeRoom,
    },
    moduleSettings: {
      updateRoomModule,
      setRoomPassword,
    },
    musicUrl: {
      updateRoomMusicUrl,
    },
    musicState: {
      updateRoomMusicState,
    },
    olderLogs: {
      fetchMessagesBefore,
      mapMessagesToLogs,
    },
  };
}
