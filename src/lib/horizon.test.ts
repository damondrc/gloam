import { describe, expect, it } from "vitest";
import {
  BOX,
  buildRidge,
  buildSkyline,
  HORIZON_SHARE,
  RIDGE,
  SKYLINE,
  WINDOW,
} from "./horizon";
import type { Building } from "./horizon";
import { NORMAL_SIZE } from "./layout";

/**
 * These are generated shapes, so there is nothing to check them against by
 * eye at review time. What is worth pinning is the handful of properties that
 * make the difference between a city and a pile of rectangles — and the one
 * that matters most, which is that it is the *same* city every time.
 */

const SEEDS = [7, 377_342, 1, 90_001];

/**
 * The constraint the whole thing is carved out of, and the one an edit is
 * most likely to give away a pixel at a time.
 *
 * Asserted against the widget's real height rather than against a number
 * repeated here, so that growing the frame does not quietly grow the horizon
 * with it.
 */
describe("the budget", () => {
  it("keeps the whole horizon inside the last quarter of the widget", () => {
    expect(HORIZON_SHARE).toBeLessThanOrEqual(0.25);
  });

  // Published to CSS and read by the water band, the silhouettes and the
  // reflection alike. If it ever stops describing the box, three things go
  // out of tune at once and only one of them is obvious.
  it("is the share of the frame the box actually takes", () => {
    expect(HORIZON_SHARE).toBeCloseTo(BOX.height / NORMAL_SIZE.height, 10);
  });

  // Low enough to be a floor for the gaps rather than a band for the rest to
  // stand on, which is what it was the first time and what made it look like
  // two pictures stacked.
  it("keeps the ground under a third of that", () => {
    expect((BOX.height - BOX.base) / BOX.height).toBeLessThan(0.34);
  });
});

describe("buildSkyline", () => {
  // The whole reason for a seeded generator rather than a random one. A
  // skyline that rearranged itself between launches would be the opposite of
  // ambient, and this is the test that keeps it from ever doing so.
  it.each(SEEDS)("gives the same city every time for seed %i", (seed) => {
    expect(buildSkyline(seed)).toEqual(buildSkyline(seed));
  });

  it("gives different cities for different seeds", () => {
    expect(buildSkyline(7)).not.toEqual(buildSkyline(8));
  });

  it("is the seed in the module, not something rolled at import", () => {
    expect(SKYLINE).toEqual(buildSkyline(7));
  });

  describe.each(SEEDS)("seed %i", (seed) => {
    const city: readonly Building[] = buildSkyline(seed);

    // Cut off at both edges rather than ending on them: a skyline whose last
    // building finishes flush with the frame reads as a diagram of a city.
    it("runs past both edges of the frame", () => {
      expect(city[0].x).toBeLessThan(0);
      const last = city[city.length - 1];
      expect(last.x + last.width).toBeGreaterThan(BOX.width);
    });

    it("leaves no gap the frame could show through", () => {
      for (let i = 1; i < city.length; i += 1) {
        expect(city[i].x).toBeGreaterThanOrEqual(
          city[i - 1].x + city[i - 1].width
        );
      }
    });

    // Which is a quarter of the widget and no more. The sky is the clock, so
    // the sky is what has to dominate the frame.
    it("keeps every roof inside the box", () => {
      for (const b of city) {
        expect(b.y).toBeGreaterThanOrEqual(0);
        expect(b.y).toBeLessThan(BOX.base);
        expect(b.width).toBeGreaterThan(0);
      }
    });

    // Taller than they are wide, or the city is a row of sheds.
    it("stands the blocks up rather than laying them out", () => {
      const upright = city.filter((b) => BOX.height - b.y > b.width);
      expect(upright.length).toBeGreaterThan(city.length / 2);
    });

    // Not one height, and not a staircase. A row of equal towers is a fence.
    it("varies in height", () => {
      const heights = city.map((b) => BOX.height - b.y);
      expect(Math.max(...heights) - Math.min(...heights)).toBeGreaterThan(8);
    });

    // Whole windows, not windows whose right-hand edge is on the sky. The
    // size is not stored per window, so the check has to bring it along.
    it("keeps every window inside the building it belongs to", () => {
      for (const b of city) {
        for (const w of b.windows) {
          expect(w.x).toBeGreaterThan(b.x);
          expect(w.x + WINDOW.width).toBeLessThan(b.x + b.width);
          expect(w.y).toBeGreaterThan(b.y);
        }
      }
    });

    // The whole facade is glazed, roof to pavement, so a lit block reads as a
    // building rather than as a strip of lights near its roof.
    it("glazes the facade all the way down", () => {
      for (const b of city) {
        for (const w of b.windows) {
          expect(w.y + WINDOW.height).toBeLessThan(BOX.height);
        }
      }

      // The bottom row of the tallest block sits near the pavement, not a
      // third of the way up it. One row's worth of margin, no more.
      const tallest = [...city].sort((a, b) => a.y - b.y)[0];
      const lowest = Math.max(...tallest.windows.map((w) => w.y));
      expect(BOX.height - lowest).toBeLessThan(2 * WINDOW.pitchY);
    });

    it("does not stack one window on another", () => {
      for (const b of city) {
        const seen = new Set<string>();
        for (const w of b.windows) {
          const cell = `${w.x.toFixed(2)}:${w.y.toFixed(2)}`;
          expect(seen.has(cell)).toBe(false);
          seen.add(cell);
        }
      }
    });

    it("hangs every mast off the roof it belongs to", () => {
      for (const b of city) {
        if (!b.mast) continue;
        expect(b.mast.y).toBeLessThan(b.y);
        expect(b.mast.x).toBeGreaterThan(b.x);
        expect(b.mast.x + b.mast.width).toBeLessThan(b.x + b.width);
        expect(b.mast.y).toBeGreaterThanOrEqual(0);
      }
    });

    /**
     * The three facts the lighting depends on, stated as behaviour rather than
     * as numbers, because the numbers are a look and the behaviour is the
     * idea: a city is never entirely dark, never entirely lit, and fills in
     * between the two as the sky does.
     */
    describe("the lights", () => {
      const thresholds = city.flatMap((b) => b.windows.map((w) => w.threshold));

      const litAt = (night: number): number =>
        thresholds.filter((t) => t < night).length;

      it("has some already burning in full daylight", () => {
        expect(litAt(0)).toBeGreaterThan(0);
      });

      it("still has some dark at the darkest the sky gets", () => {
        expect(litAt(1)).toBeLessThan(thresholds.length);
      });

      it("fills in rather than switching on at once", () => {
        expect(litAt(0.35)).toBeGreaterThan(litAt(0));
        expect(litAt(0.7)).toBeGreaterThan(litAt(0.35));
        expect(litAt(1)).toBeGreaterThan(litAt(0.7));
      });

      // Enough to read as a city rather than as a few dots, few enough that
      // the frame is not carrying a thousand nodes it does not need.
      it("is a sensible number of windows", () => {
        expect(thresholds.length).toBeGreaterThan(80);
        expect(thresholds.length).toBeLessThan(320);
      });

      // A lit facade where every square is the same strength is a grid. The
      // brightness is most of what stops it being one, so it has to actually
      // vary — and never fall to something too faint to have been drawn.
      it("burns at a spread of brightnesses, none of them invisible", () => {
        const burn = city.flatMap((b) => b.windows.map((w) => w.burn));

        expect(Math.min(...burn)).toBeGreaterThan(0.2);
        expect(Math.max(...burn)).toBeLessThanOrEqual(1);
        expect(Math.max(...burn) - Math.min(...burn)).toBeGreaterThan(0.3);
      });
    });
  });
});

describe("buildRidge", () => {
  it.each(SEEDS)("gives the same range every time for seed %i", (seed) => {
    expect(buildRidge(seed)).toEqual(buildRidge(seed));
  });

  it("is the seed in the module, not something rolled at import", () => {
    expect(RIDGE).toEqual(buildRidge(377_342));
  });

  // Depth is the point: one silhouette is a jagged border, three at different
  // distances is a landscape.
  it("has three ranges", () => {
    expect(RIDGE.layers).toHaveLength(3);
  });

  describe.each(SEEDS)("seed %i", (seed) => {
    const layers = buildRidge(seed).layers;

    const parse = (points: string): { x: number; y: number }[] =>
      points.split(" ").map((pair) => {
        const [x, y] = pair.split(",").map(Number);
        return { x, y };
      });

    // Against the bottom of the frame, not against a waterline. There is no
    // band underneath any more: the ranges are the ground.
    it("closes each range against the bottom corners", () => {
      for (const layer of layers) {
        const points = parse(layer);
        expect(points[0].y).toBe(BOX.height);
        expect(points[points.length - 1].y).toBe(BOX.height);
      }
    });

    it("covers the frame and overshoots both edges", () => {
      for (const layer of layers) {
        const points = parse(layer);
        expect(points[0].x).toBeLessThan(0);
        expect(points[points.length - 1].x).toBeGreaterThan(BOX.width);
      }
    });

    it("keeps every summit inside the box", () => {
      for (const layer of layers) {
        for (const { y } of parse(layer)) {
          expect(y).toBeGreaterThanOrEqual(0);
          expect(y).toBeLessThanOrEqual(BOX.height);
        }
      }
    });

    // Every col above the street, or the range is buried in its own ground
    // and there is nothing left to see of it.
    it("keeps every range clear of the ground it stands on", () => {
      for (const layer of layers) {
        const ys = parse(layer)
          .slice(1, -1)
          .map((p) => p.y);
        expect(Math.max(...ys)).toBeLessThan(BOX.base + 8);
      }
    });

    // Distance drawn the way it behaves: the far range is the tallest in the
    // frame, and each nearer one sits lower. Without this the layers cross and
    // the depth reads as noise.
    it("puts the far range above the near ones", () => {
      const top = layers.map((layer) =>
        Math.min(...parse(layer).map((p) => p.y))
      );
      expect(top[0]).toBeLessThan(top[1]);
      expect(top[1]).toBeLessThan(top[2]);
    });

    // The alternation is what makes a peak a peak rather than rolling ground.
    it("alternates summits and cols", () => {
      for (const layer of layers) {
        // Drop the two closing corners, which are not part of the line.
        const ys = parse(layer)
          .slice(1, -1)
          .map((p) => p.y);

        for (let i = 1; i < ys.length - 1; i += 1) {
          const isSummit = ys[i] < ys[i - 1];
          expect(ys[i] < ys[i + 1]).toBe(isSummit);
        }
      }
    });
  });
});
