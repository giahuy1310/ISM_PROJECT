const PALETTE = ['#101b30', '#6EB5C0', '#006C84', '#C67D58', '#afc9ea', '#cbdcf5'];

export function shipModeColor(shipModeId: number): string {
  const idx = Math.abs(shipModeId) % PALETTE.length;
  return PALETTE[idx] ?? PALETTE[0];
}
