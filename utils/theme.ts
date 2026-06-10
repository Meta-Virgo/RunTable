export const themeRgb = (token: string, alpha = 1) =>
  `rgb(var(--theme-${token}) / ${alpha})`;

export const themeHex = {
  primary: "#9396f7",
  accent: "#66b185",
  bg: "#3a3d50",
  raised: "#4f5265",
} as const;
