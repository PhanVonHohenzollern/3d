// The Link form wraps to 4, 2 or 1 columns as the dock gets narrower; this is the dock height it
// needs at each width, including the dock insets.
export function linkPanelMinimumHeight(areaWidth: number): number {
  return areaWidth >= 990 ? 280 : areaWidth >= 550 ? 380 : 560;
}
