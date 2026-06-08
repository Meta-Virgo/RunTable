import type { Dispatch, SetStateAction } from "react";
import {
  buildClearedRoomSessionState,
  type ClearedRoomSessionState,
} from "./roomSessionModel";

export type RoomSessionState = ClearedRoomSessionState;

type RoomSessionStateAction =
  | { type: "replace"; state: RoomSessionState }
  | { type: "patch"; patch: Partial<RoomSessionState> }
  | {
      type: "set-characters";
      update: SetStateAction<RoomSessionState["characters"]>;
    }
  | { type: "set-logs"; update: SetStateAction<RoomSessionState["logs"]> }
  | {
      type: "set-module-info";
      update: SetStateAction<RoomSessionState["moduleInfo"]>;
    }
  | {
      type: "set-active-character";
      update: SetStateAction<RoomSessionState["activeCharId"]>;
    }
  | {
      type: "apply-module-settings";
      moduleInfo: RoomSessionState["moduleInfo"];
      roomPassword?: string;
    };

function applyStateUpdate<T>(previous: T, update: SetStateAction<T>) {
  return typeof update === "function"
    ? (update as (value: T) => T)(previous)
    : update;
}

export function createInitialRoomSessionState(): RoomSessionState {
  return buildClearedRoomSessionState();
}

export function roomSessionReducer(
  state: RoomSessionState,
  action: RoomSessionStateAction
): RoomSessionState {
  switch (action.type) {
    case "replace":
      return action.state;
    case "patch":
      return { ...state, ...action.patch };
    case "set-characters":
      return {
        ...state,
        characters: applyStateUpdate(state.characters, action.update),
      };
    case "set-logs":
      return {
        ...state,
        logs: applyStateUpdate(state.logs, action.update),
      };
    case "set-module-info":
      return {
        ...state,
        moduleInfo: applyStateUpdate(state.moduleInfo, action.update),
      };
    case "set-active-character":
      return {
        ...state,
        activeCharId: applyStateUpdate(state.activeCharId, action.update),
      };
    case "apply-module-settings":
      return {
        ...state,
        moduleInfo: action.moduleInfo,
        roomPassword:
          action.roomPassword === undefined
            ? state.roomPassword
            : action.roomPassword,
      };
    default:
      return state;
  }
}

export interface RoomSessionStateDispatchers {
  replace: (state: RoomSessionState) => void;
  patch: (patch: Partial<RoomSessionState>) => void;
  replaceCharacters: (
    update: SetStateAction<RoomSessionState["characters"]>
  ) => void;
  replaceLogs: (update: SetStateAction<RoomSessionState["logs"]>) => void;
  updateModuleInfo: (
    update: SetStateAction<RoomSessionState["moduleInfo"]>
  ) => void;
  selectActiveCharacter: Dispatch<SetStateAction<string>>;
  applyModuleSettings: (
    moduleInfo: RoomSessionState["moduleInfo"],
    roomPassword?: string
  ) => void;
}

export function createRoomSessionStateDispatchers(
  dispatch: Dispatch<RoomSessionStateAction>
): RoomSessionStateDispatchers {
  return {
    replace: (state) => dispatch({ type: "replace", state }),
    patch: (patch) => dispatch({ type: "patch", patch }),
    replaceCharacters: (update) =>
      dispatch({ type: "set-characters", update }),
    replaceLogs: (update) => dispatch({ type: "set-logs", update }),
    updateModuleInfo: (update) =>
      dispatch({ type: "set-module-info", update }),
    selectActiveCharacter: (update) =>
      dispatch({ type: "set-active-character", update }),
    applyModuleSettings: (moduleInfo, roomPassword) =>
      dispatch({
        type: "apply-module-settings",
        moduleInfo,
        roomPassword,
      }),
  };
}
