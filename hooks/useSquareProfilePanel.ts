import { useMemo, useState } from "react";
import type { GameHistory, Profile } from "../types";
import {
  fetchCharactersByIds,
  fetchKpHistory,
  fetchPlayerHistory,
  fetchProfileById,
} from "../services/squareProfileRepository";
import {
  fetchSquareProfilePanelData,
  type SquarePlayerHistoryItem,
  type SquareProfileHistoryTab,
} from "../services/squareProfileModel";

export function useSquareProfilePanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [historyTab, setHistoryTab] =
    useState<SquareProfileHistoryTab>("player");
  const [historyLoading, setHistoryLoading] = useState(false);
  const [kpHistory, setKpHistory] = useState<GameHistory[]>([]);
  const [playerHistory, setPlayerHistory] = useState<SquarePlayerHistoryItem[]>(
    []
  );

  const repository = useMemo(
    () => ({
      fetchProfileById,
      fetchKpHistory,
      fetchPlayerHistory,
      fetchCharactersByIds,
    }),
    []
  );

  const openProfile = async (userId: string) => {
    setHistoryLoading(true);

    try {
      const result = await fetchSquareProfilePanelData({
        userId,
        repository,
      });

      if (result) {
        setSelectedProfile(result.profile);
        setKpHistory(result.kpHistory);
        setPlayerHistory(result.playerHistory);
        setIsOpen(true);
      }
    } finally {
      setHistoryLoading(false);
    }
  };

  const closeProfile = () => {
    setIsOpen(false);
  };

  return {
    isOpen,
    selectedProfile,
    historyTab,
    setHistoryTab,
    historyLoading,
    kpHistory,
    playerHistory,
    openProfile,
    closeProfile,
  };
}
