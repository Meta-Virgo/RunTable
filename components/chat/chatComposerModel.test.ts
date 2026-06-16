import { describe, expect, it } from "vitest";
import { canShowAiAssistant } from "./chatComposerModel";

describe("chat composer model", () => {
  it("shows the AI assistant entry only to VIP keepers", () => {
    expect(canShowAiAssistant({ isKP: true, isVip: true })).toBe(true);
    expect(canShowAiAssistant({ isKP: true, isVip: false })).toBe(false);
    expect(canShowAiAssistant({ isKP: false, isVip: true })).toBe(false);
    expect(canShowAiAssistant({ isKP: false, isVip: false })).toBe(false);
  });
});
