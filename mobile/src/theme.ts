export const C = {
  paper: "#F6F8FB",
  cream: "#F3E2BB",
  ink: "#16263F",
  blue: "#2F5D8A",
  lightBlue: "#5A8FD0",
  plum: "#6E2B3F",
  brass: "#C9A15A",
  wax: "#A3364F",
  line: "#D5DDE7",
  muted: "#748195",
  glass: "#DCE8F2",
  white: "#FFFFFF",
  wood: "#A87954",
};
export const serif = "NotoSerifTC";
export const sans = "NotoSansTC";
export const handwriting = "LXGWWenKaiTC";
export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };
export const radii = { sm: 8, md: 16, lg: 24, pill: 999 };
export const shadows = {
  card: {
    shadowColor: "#16263F",
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
};
export const motion = {
  spring: {
    soft: { damping: 18, stiffness: 160 },
    snappy: { damping: 22, stiffness: 320 },
    heavy: { damping: 14, stiffness: 120, mass: 1.4 },
  },
  fade: { quick: 160 },
  breathe: { duration: 3200, scale: 1.015, translateY: -2 },
};
