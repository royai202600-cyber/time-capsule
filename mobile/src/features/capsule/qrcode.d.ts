// Kazuhiko Arase's qrcode-generator 1.4.4 (MIT), vendored in this folder.
declare const qrcode: (type: number, correction: "L" | "M" | "Q" | "H") => {
  addData: (data: string) => void;
  make: () => void;
  getModuleCount: () => number;
  isDark: (row: number, column: number) => boolean;
};
export default qrcode;
