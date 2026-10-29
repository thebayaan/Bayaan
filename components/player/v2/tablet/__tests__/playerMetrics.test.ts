// @ai-generated
import {
  nowPlayingArtSize,
  nowPlayingColumnWidth,
  playerPageMargin,
} from '../playerMetrics';

describe('iPad player metrics', () => {
  it('uses the page margin of each window class', () => {
    expect(playerPageMargin(834)).toBe(24);
    expect(playerPageMargin(1032)).toBe(32);
    expect(playerPageMargin(1366)).toBe(40);
  });

  // The table in listening/02, Surface 3.
  it.each([
    ['mini landscape', 1133, 744, 453, 324],
    ['11" landscape', 1194, 834, 478, 414],
    ['13" portrait', 1024, 1366, 410, 346],
    ['13" landscape', 1366, 1024, 520, 420],
  ])('sizes the column and artwork on %s', (_, w, h, column, art) => {
    expect(nowPlayingColumnWidth(w)).toBe(column);
    expect(nowPlayingArtSize(column, playerPageMargin(w), h)).toBe(art);
  });

  it('keeps the column between 380 and 520', () => {
    expect(nowPlayingColumnWidth(900)).toBe(380);
    expect(nowPlayingColumnWidth(2000)).toBe(520);
  });

  it('never returns a negative artwork size', () => {
    expect(nowPlayingArtSize(380, 32, 300)).toBe(0);
  });
});
