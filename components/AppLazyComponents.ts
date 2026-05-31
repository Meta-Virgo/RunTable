import { lazy } from "react";

export const Home = lazy(() =>
  import("./Home").then((module) => ({ default: module.Home }))
);

export const Sidebar = lazy(() =>
  import("./Sidebar").then((module) => ({ default: module.Sidebar }))
);

export const ChatArea = lazy(() =>
  import("./ChatArea").then((module) => ({ default: module.ChatArea }))
);

export const Dashboard = lazy(() =>
  import("./Dashboard").then((module) => ({ default: module.Dashboard }))
);

export const MusicPlayer = lazy(() =>
  import("./MusicPlayer").then((module) => ({ default: module.MusicPlayer }))
);

export const ModuleModal = lazy(() =>
  import("./Modals").then((module) => ({ default: module.ModuleModal }))
);

export const CharacterModal = lazy(() =>
  import("./Modals").then((module) => ({ default: module.CharacterModal }))
);

export const StatusModal = lazy(() =>
  import("./Modals").then((module) => ({ default: module.StatusModal }))
);

export const StoryModal = lazy(() =>
  import("./Modals").then((module) => ({ default: module.StoryModal }))
);

export const ConclusionModal = lazy(() =>
  import("./Modals").then((module) => ({ default: module.ConclusionModal }))
);

export const LiveKitRoom = lazy(() =>
  import("@livekit/components-react").then((module) => ({
    default: module.LiveKitRoom,
  }))
);

export const RoomAudioRenderer = lazy(() =>
  import("@livekit/components-react").then((module) => ({
    default: module.RoomAudioRenderer,
  }))
);

export const StartAudio = lazy(() =>
  import("@livekit/components-react").then((module) => ({
    default: module.StartAudio,
  }))
);
