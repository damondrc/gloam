import { describe, expect, it } from "vitest";
import {
  BOX,
  buildRidge,
  buildSkyline,
  HORIZON_SHARE,
  RIDGE,
  RIDGE_SEED,
  RIDGE_SEEDS,
  SKYLINE,
  SKYLINE_SEED,
  SKYLINE_SEEDS,
  WINDOW,
} from "./horizon";
import type { Building } from "./horizon";
import { NORMAL_SIZE } from "./layout";

/**
 * These are generated shapes, so there is nothing to check them against by
 * eye at review time. What is worth pinning is the handful of properties that
 * make the difference between a city and a pile of rectangles.
 *
 * It used to also pin that it was the *same* city every time. It is not any
 * more: one is drawn from a short cast at launch. So the seeds under test are
 * no longer a few chosen for the test — they are every seed the app can
 * actually show, and each of them has to hold up on its own. A cast member
 * that fails here is one somebody would eventually have opened the widget and
 * found.
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

/**
 * The cast is authorship, so it is small, deliberate, and rolled exactly once.
 */
describe("the cast", () => {
  it.each([
    ["skyline", SKYLINE_SEEDS],
    ["ridge", RIDGE_SEEDS],
  ])("keeps the %s list short enough to have been looked at", (_, seeds) => {
    expect(seeds.length).toBeGreaterThan(1);
    expect(seeds.length).toBeLessThanOrEqual(8);
  });

  it.each([
    ["skyline", SKYLINE_SEEDS],
    ["ridge", RIDGE_SEEDS],
  ])("has no %s seed twice", (_, seeds) => {
    expect(new Set(seeds).size).toBe(seeds.length);
  });

  it("draws the city from the cast rather than from the whole range", () => {
    expect(SKYLINE_SEEDS).toContain(SKYLINE_SEED);
  });

  it("draws the range from the cast rather than from the whole range", () => {
    expect(RIDGE_SEEDS).toContain(RIDGE_SEED);
  });

  /**
   * The roll happens at import and the result is held. The horizon is switched
   * in the panel and switched back, and the component mounts and unmounts with
   * it; if either of these were a getter the city would change under somebody
   * in the middle of choosing it.
   */
  it("holds the city it drew rather than rolling again", () => {
    expect(SKYLINE).toEqual(buildSkyline(SKYLINE_SEED));
    expect(SKYLINE).toEqual(SKYLINE);
  });

  it("holds the range it drew rather than rolling again", () => {
    expect(RIDGE).toEqual(buildRidge(RIDGE_SEED));
  });
});

describe("buildSkyline", () => {
  // Still the reason for a seeded generator rather than a random one: what a
  // seed names has to be one city, not a family of them.
  it.each(SKYLINE_SEEDS)("gives the same city every time for seed %i", (seed) => {
    expect(buildSkyline(seed)).toEqual(buildSkyline(seed));
  });

  it("gives different cities for different seeds", () => {
    expect(buildSkyline(7)).not.toEqual(buildSkyline(8));
  });

  describe.each(SKYLINE_SEEDS)("seed %i", (seed) => {
    const city = buildSkyline(seed);
    const planes = city.planes;
    const all: readonly Building[] = planes.flat();

    // One silhouette is a shape; three at three distances is depth, and depth
    // is the only thing that made this stop reading as a jagged border.
    it("is drawn in three planes", () => {
      expect(planes).toHaveLength(3);
    });

    describe.each(planes.map((p, i) => [i, p] as const))(
      "plane %i",
      (_, blocks) => {
        // Cut off at both edges rather than ending on them: a skyline whose
        // last building finishes flush with the frame reads as a diagram.
        it("runs past both edges of the frame", () => {
          expect(blocks[0].x).toBeLessThan(0);
          const last = blocks[blocks.length - 1];
          expect(last.x + last.width).toBeGreaterThan(BOX.width);
        });

        it("does not lay one block over its own neighbour", () => {
          for (let i = 1; i < blocks.length; i += 1) {
            expect(blocks[i].x).toBeGreaterThanOrEqual(
              blocks[i - 1].x + blocks[i - 1].width
            );
          }
        });

        // Which is a quarter of the widget and no more. The sky is the clock,
        // so the sky is what has to dominate the frame.
        it("keeps every roof inside the box and above the street", () => {
          for (const b of blocks) {
            expect(b.y).toBeGreaterThanOrEqual(0);
            expect(b.y).toBeLessThan(BOX.base);
            expect(b.width).toBeGreaterThan(0);
          }
        });

        // Not one height, and not a staircase. A row of equal roofs is a fence.
        it("varies in height", () => {
          const roofs = blocks.map((b) => b.y);
          expect(Math.max(...roofs) - Math.min(...roofs)).toBeGreaterThan(3);
        });

        it("hangs every mast off the roof it belongs to", () => {
          for (const b of blocks) {
            if (!b.mast) continue;
            expect(b.mast.y).toBeLessThan(b.y);
            expect(b.mast.x).toBeGreaterThan(b.x);
            expect(b.mast.x + b.mast.width).toBeLessThan(b.x + b.width);
            expect(b.mast.y).toBeGreaterThanOrEqual(0);
          }
        });

        // Whole windows, not windows whose right-hand edge is on the sky. The
        // size is not stored per window, so the check has to bring it along.
        it("keeps every window inside the building it belongs to", () => {
          for (const b of blocks) {
            for (const w of b.windows) {
              expect(w.x).toBeGreaterThan(b.x);
              expect(w.x + WINDOW.width).toBeLessThan(b.x + b.width);
              expect(w.y).toBeGreaterThan(b.y);
              expect(w.y + WINDOW.height).toBeLessThan(BOX.height);
            }
          }
        });

        it("does not stack one window on another", () => {
          for (const b of blocks) {
            const seen = new Set<string>();
            for (const w of b.windows) {
              const cell = `${w.x.toFixed(2)}:${w.y.toFixed(2)}`;
              expect(seen.has(cell)).toBe(false);
              seen.add(cell);
            }
          }
        });
      }
    );

    /**
     * Depth, stated as the arrangement that produces it rather than as the
     * colours that show it. Planes that crossed would read as noise however
     * they were painted.
     */
    describe("the arrangement", () => {
      it("puts the far plane above the near ones", () => {
        const highest = planes.map((p) => Math.min(...p.map((b) => b.y)));
        expect(highest[0]).toBeLessThan(highest[1]);
        expect(highest[1]).toBeLessThan(highest[2]);
      });

      // Distance is not only colour: a far plane is narrower and more crowded
      // per inch of frame, which is most of why it reads as far.
      it("makes the near blocks the wide ones", () => {
        const widest = planes.map(
          (p) => p.reduce((sum, b) => sum + b.width, 0) / p.length
        );
        expect(widest[0]).toBeLessThan(widest[1]);
        expect(widest[1]).toBeLessThan(widest[2]);
      });

      // The two behind stand up rather than lying down; the near plane is
      // exempt on purpose, because a block filling the bottom of the frame is
      // the near side of the street rather than a shed.
      it("stands the distant blocks up rather than laying them out", () => {
        for (const blocks of planes.slice(0, 2)) {
          const upright = blocks.filter((b) => BOX.height - b.y > b.width);
          expect(upright.length).toBeGreaterThan(blocks.length / 2);
        }
      });

      // Whole-silhouette relief, which is what someone actually sees. Each
      // plane on its own is allowed to be a narrow band of roofs.
      it("gives the silhouette real relief", () => {
        const heights = all.map((b) => BOX.height - b.y);
        expect(Math.max(...heights) - Math.min(...heights)).toBeGreaterThan(8);
      });
    });

    /**
     * The culling contract. Whatever draws this should be able to walk the
     * windows and trust that every one of them is visible, so the invariant
     * belongs here rather than in the component.
     */
    describe("the windows that were kept", () => {
      it("leaves none of them buried under the street", () => {
        for (const blocks of planes.slice(0, -1)) {
          for (const b of blocks) {
            for (const w of b.windows) {
              expect(w.y + WINDOW.height).toBeLessThanOrEqual(BOX.base);
            }
          }
        }
      });

      it("leaves none of them behind a block in front", () => {
        planes.forEach((blocks, i) => {
          const nearer = planes.slice(i + 1).flat();
          for (const b of blocks) {
            for (const w of b.windows) {
              for (const front of nearer) {
                const overlapsX =
                  w.x + WINDOW.width > front.x && w.x < front.x + front.width;
                expect(overlapsX && w.y + WINDOW.height > front.y).toBe(false);
              }
            }
          }
        });
      });

      /**
       * The near plane is the one nothing stands in front of, so it is the one
       * that has to be glazed roof to pavement: a lit block whose lights stop
       * a third of the way up reads as a strip of light rather than a
       * building.
       */
      it("glazes the near facades all the way down", () => {
        const near = planes[planes.length - 1];
        const tallest = [...near].sort((a, b) => a.y - b.y)[0];
        const lowest = Math.max(...tallest.windows.map((w) => w.y));
        expect(BOX.height - lowest).toBeLessThan(2 * WINDOW.pitchY);
      });
    });

    /**
     * The shape of an evening, stated as behaviour rather than as numbers,
     * because the numbers are a look and the behaviour is the idea: a city
     * fills in while the sun goes down, is at its fullest when it has just
     * gone, and empties through the night down to the few that never go out.
     *
     * The version before this one compared a single threshold against the star
     * field. Stars only ever get brighter, so the city only ever got busier
     * and was at its most awake at the very end of a break. These are the
     * tests that would have caught it.
     */
    describe("the evening", () => {
      const windows = all.flatMap((b) => b.windows);

      /** How many are lit at a given point of the sky's two curves. */
      const lit = (evening: number, awake: number): number =>
        windows.filter((w) => evening >= w.wakes && awake >= w.sleeps).length;

      /** Sunset, from the sun still up to the moment it has gone. */
      const dusk = (evening: number): number => lit(evening, 1);

      /** The break, from the top of the night to the end of it. */
      const night = (awake: number): number => lit(1, awake);

      it("has some already burning in full daylight", () => {
        expect(dusk(0)).toBeGreaterThan(0);
      });

      it("fills in rather than switching on at once", () => {
        expect(dusk(0.35)).toBeGreaterThan(dusk(0));
        expect(dusk(0.7)).toBeGreaterThan(dusk(0.35));
        expect(dusk(1)).toBeGreaterThan(dusk(0.7));
      });

      it("still has some dark when the sun has gone", () => {
        expect(dusk(1)).toBeLessThan(windows.length);
      });

      // The whole point of the change. Anything later than this is the city
      // going to bed, and a peak anywhere else means it is running backwards.
      it("is at its fullest the moment the sun has set", () => {
        const peak = dusk(1);
        for (const e of [0, 0.25, 0.5, 0.75, 1]) expect(dusk(e)).toBeLessThanOrEqual(peak);
        for (const a of [1, 0.75, 0.5, 0.25, 0]) expect(night(a)).toBeLessThanOrEqual(peak);
      });

      it("empties rather than switching off at once", () => {
        expect(night(0.6)).toBeLessThan(night(1));
        expect(night(0.35)).toBeLessThan(night(0.6));
        expect(night(0.22)).toBeLessThan(night(0.35));
      });

      // A break ends on a city that is asleep, not on one that was abandoned.
      it("leaves a handful burning at the end of a break", () => {
        expect(night(0.22)).toBeGreaterThan(windows.length / 12);
        expect(night(0.22)).toBeLessThan(night(1) / 2);
      });

      // Nothing goes out. The last frame of a break is still a city.
      it("keeps some lit however far the night runs", () => {
        expect(night(0)).toBeGreaterThan(0);
      });

      /**
       * The two halves of an evening are not each other's reverse. If a
       * bedtime were derived from a switch-on the night would replay the
       * sunset backwards, which is a rewind rather than a city.
       */
      it("does not put them to bed in the order they woke", () => {
        const woke = windows.filter((w) => w.wakes > 0 && w.sleeps > 0);
        const mean = (xs: number[]): number =>
          xs.reduce((a, b) => a + b, 0) / xs.length;

        const ws = woke.map((w) => w.wakes);
        const ss = woke.map((w) => w.sleeps);
        const mw = mean(ws);
        const ms = mean(ss);

        const cov = mean(woke.map((_, i) => (ws[i] - mw) * (ss[i] - ms)));
        const sd = (xs: number[], m: number): number =>
          Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));

        expect(Math.abs(cov / (sd(ws, mw) * sd(ss, ms)))).toBeLessThan(0.25);
      });

      // Enough to read as a city rather than as a few dots, few enough that
      // the frame is not carrying a thousand nodes it does not need. Three
      // glazed planes generate roughly twice this; the rest are culled.
      it("is a sensible number of windows", () => {
        expect(windows.length).toBeGreaterThan(80);
        expect(windows.length).toBeLessThan(320);
      });

      // A lit facade where every square is the same strength is a grid. The
      // brightness is most of what stops it being one, so it has to actually
      // vary — and never fall to something too faint to have been drawn.
      it("burns at a spread of brightnesses, none of them invisible", () => {
        const burn = windows.map((w) => w.burn);

        expect(Math.min(...burn)).toBeGreaterThan(0.2);
        expect(Math.max(...burn)).toBeLessThanOrEqual(1);
        expect(Math.max(...burn) - Math.min(...burn)).toBeGreaterThan(0.3);
      });

      // Distance takes the lights with it, or the depth the colours bought is
      // handed straight back: brightness reads as nearness more strongly than
      // hue does.
      it("dims with distance", () => {
        const brightest = planes.map((p) =>
          Math.max(...p.flatMap((b) => b.windows.map((w) => w.burn)))
        );
        expect(brightest[0]).toBeLessThan(brightest[1]);
        expect(brightest[1]).toBeLessThan(brightest[2]);
      });
    });
  });
});

describe("buildRidge", () => {
  it.each(RIDGE_SEEDS)("gives the same range every time for seed %i", (seed) => {
    expect(buildRidge(seed)).toEqual(buildRidge(seed));
  });

  // Depth is the point: one silhouette is a jagged border, three at different
  // distances is a landscape.
  it("has three ranges", () => {
    expect(RIDGE.layers).toHaveLength(3);
  });

  describe.each(RIDGE_SEEDS)("seed %i", (seed) => {
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
