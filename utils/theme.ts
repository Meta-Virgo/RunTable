export const themeRgb = (token: string, alpha = 1) =>
  `rgb(var(--theme-${token}) / ${alpha})`;
