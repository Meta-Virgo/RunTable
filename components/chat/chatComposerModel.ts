export function canShowAiAssistant(input: { isKP: boolean; isVip: boolean }) {
  return input.isKP && input.isVip;
}
