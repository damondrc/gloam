import { describe, expect, it } from "vitest";
import {
  BOX,
  buildRidge,
  buildSkyline,
  GLAZING,
  HAZE,
  HORIZON_SHARE,
  pinePath,
  RIDGE,
  RIDGE_SEED,
  RIDGE_SEEDS,
  SKYLINE,
  SKYLINE_SEED,
  SKYLINE_SEEDS,
} from "./horizon";
import type { Building, Detail, Pine } from "./horizon";
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

/** Polygon points back into numbers, for the checks that are about geometry. */
const parse = (list: string): { x: number; y: number }[] =>
  list.split(" ").map((pair) => {
    const [x, y] = pair.split(",").map(Number);
    return { x, y };
  });

/** The box a detail takes up, whichever of the three shapes it is. */
function extent(detail: Detail): { left: number; right: number; top: number; bottom: number } {
  if (detail.shape === "rect") {
    return {
      left: detail.x,
      right: detail.x + detail.width,
      top: detail.y,
      bottom: detail.y + detail.height,
    };
  }
  if (detail.shape === "circle") {
    return {
      left: detail.cx - detail.r,
      right: detail.cx + detail.r,
      top: detail.cy - detail.r,
      bottom: detail.cy + detail.r,
    };
  }
  const pts = parse(detail.points);
  return {
    left: Math.min(...pts.map((p) => p.x)),
    right: Math.max(...pts.map((p) => p.x)),
    top: Math.min(...pts.map((p) => p.y)),
    bottom: Math.max(...pts.map((p) => p.y)),
  };
}

/** Which way a facade is glazed, read back off the size of its windows. */
const glazingOf = (width: number) =>
  Object.values(GLAZING).find((g) => g.width === width)!;

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

    it("is drawn in three planes", () => {
      expect(planes).toHaveLength(3);
    });

    describe.each(planes.map((p, i) => [i, p] as const))(
      "plane %i",
      (_, blocks) => {
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

        it("keeps every roof inside the box and above the street", () => {
          for (const b of blocks) {
            expect(b.y).toBeGreaterThanOrEqual(0);
            expect(b.y).toBeLessThan(BOX.base);
            expect(b.width).toBeGreaterThan(0);
          }
        });

        it("varies in height", () => {
          const roofs = blocks.map((b) => b.y);
          expect(Math.max(...roofs) - Math.min(...roofs)).toBeGreaterThan(3);
        });

        // A roof takes up the top of a building, never more than the top.
        it("starts every facade under its roof and well above the ground", () => {
          for (const b of blocks) {
            expect(b.eaves).toBeGreaterThanOrEqual(b.y);
            expect(b.eaves).toBeLessThan(BOX.height - 4);
          }
        });

        // The outline is the building: whatever its roof does, it has to stay
        // over its own plot and reach the bottom edge. It tops out where `y`
        // says, or lower when the roof is drawn as a detail — a dome is — and
        // never higher, because the culling hides things behind that line.
        it("draws every silhouette over its own plot, down to the bottom edge", () => {
          for (const b of blocks) {
            const pts = parse(b.outline);
            expect(pts[0].y).toBe(BOX.height);
            expect(pts[pts.length - 1].y).toBe(BOX.height);
            for (const p of pts) {
              expect(p.x).toBeGreaterThanOrEqual(b.x - 0.01);
              expect(p.x).toBeLessThanOrEqual(b.x + b.width + 0.01);
              expect(p.y).toBeLessThanOrEqual(BOX.height);
            }
            const top = Math.min(...pts.map((p) => p.y));
            expect(top).toBeGreaterThanOrEqual(b.y - 0.01);
            expect(top).toBeLessThanOrEqual(b.eaves + 0.01);
          }
        });

        // Half a pixel of grace, for a beam that overhangs its own posts.
        it("stands everything on a roof over the building it belongs to", () => {
          for (const b of blocks) {
            for (const detail of b.details) {
              const box = extent(detail);
              expect(box.left).toBeGreaterThan(b.x - 0.5);
              expect(box.right).toBeLessThan(b.x + b.width + 0.5);
              expect(box.top).toBeGreaterThanOrEqual(0);
              // On the roof, not on the wall: everything up there clears the
              // eaves, and nothing reaches the ground.
              expect(box.top).toBeLessThan(b.eaves);
              expect(box.bottom).toBeLessThanOrEqual(BOX.height);
            }
          }
        });

        it("keeps every window inside the facade it belongs to", () => {
          for (const b of blocks) {
            for (const w of b.windows) {
              expect(w.x).toBeGreaterThan(b.x);
              expect(w.x + w.width).toBeLessThan(b.x + b.width);
              expect(w.y).toBeGreaterThan(b.eaves);
              expect(w.y + w.height).toBeLessThan(BOX.height);
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

        it("glazes one building one way", () => {
          for (const b of blocks) {
            expect(new Set(b.windows.map((w) => w.width)).size).toBeLessThanOrEqual(1);
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

      it("makes the near blocks the wide ones", () => {
        const widest = planes.map(
          (p) => p.reduce((sum, b) => sum + b.width, 0) / p.length
        );
        expect(widest[0]).toBeLessThan(widest[1]);
        expect(widest[1]).toBeLessThan(widest[2]);
      });

      it("stands the distant blocks up rather than laying them out", () => {
        for (const blocks of planes.slice(0, 2)) {
          const upright = blocks.filter((b) => BOX.height - b.y > b.width);
          expect(upright.length).toBeGreaterThan(blocks.length / 2);
        }
      });

      it("gives the silhouette real relief", () => {
        const heights = all.map((b) => BOX.height - b.y);
        expect(Math.max(...heights) - Math.min(...heights)).toBeGreaterThan(8);
      });
    });

    /**
     * What 1.2 changed, pinned from both sides. The city used to be a row of
     * rectangles, so most roofs have to be something else; and the fix for
     * that must not become the next thing wrong with it, so what stands on
     * the roofs is counted too.
     */
    describe("the roofline", () => {
      it("is not a row of boxes", () => {
        const shaped = all.filter((b) => b.eaves > b.y);
        expect(shaped.length).toBeGreaterThan(all.length * 0.4);
      });

      // An average, on purpose. One roof with a tank, an aerial and a pergola
      // is a roof somebody lives under; every roof like that is a pattern,
      // and a pattern is what the eye stops on.
      it("keeps the rooftops quiet", () => {
        const shapes = all.reduce((n, b) => n + b.details.length, 0);
        expect(shapes / all.length).toBeLessThan(2.5);
      });

      it("glazes the city more than one way", () => {
        const sizes = new Set(all.flatMap((b) => b.windows.map((w) => w.width)));
        expect(sizes.size).toBeGreaterThan(1);
      });

      // A tree stands in an alley of the nearest plane: on the street, and
      // not growing through anybody's wall.
      it("stands every tree in a gap, on the street", () => {
        const near = planes[planes.length - 1];
        for (const tree of city.trees) {
          expect(tree.cy + tree.r).toBeGreaterThanOrEqual(BOX.base);
          expect(tree.cy - tree.r).toBeGreaterThan(0);
          for (const b of near) {
            expect(tree.cx > b.x && tree.cx < b.x + b.width).toBe(false);
          }
        }
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
              expect(w.y + w.height).toBeLessThanOrEqual(BOX.base);
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
                  w.x + w.width > front.x && w.x < front.x + front.width;
                expect(overlapsX && w.y + w.height > front.y).toBe(false);
              }
            }
          }
        });
      });

      /**
       * The near plane is the one nothing stands in front of, so its facades
       * are glazed for as far down as a row still fits. It used to say "roof
       * to pavement", which was true of a tower; a house under a gable has
       * room for one row or two, and what matters is that no facade stops
       * with a whole row's worth of wall left under it.
       */
      it("glazes the near facades for as far down as a row fits", () => {
        const near = planes[planes.length - 1];
        for (const b of near) {
          if (b.windows.length === 0) continue;
          const g = glazingOf(b.windows[0].width);
          const lowest = Math.max(...b.windows.map((w) => w.y)) + g.height;
          expect(BOX.height - g.bottom - lowest).toBeLessThan(g.pitchY);
        }
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

      it("leaves a handful burning at the end of a break", () => {
        expect(night(0.22)).toBeGreaterThan(windows.length / 12);
        expect(night(0.22)).toBeLessThan(night(1) / 2);
      });

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

      it("is a sensible number of windows", () => {
        expect(windows.length).toBeGreaterThan(80);
        expect(windows.length).toBeLessThan(320);
      });

      it("burns at a spread of brightnesses, none of them invisible", () => {
        const burn = windows.map((w) => w.burn);
        expect(Math.min(...burn)).toBeGreaterThan(0.2);
        expect(Math.max(...burn)).toBeLessThanOrEqual(1);
        expect(Math.max(...burn) - Math.min(...burn)).toBeGreaterThan(0.3);
      });

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

  it("has three ranges", () => {
    expect(RIDGE.layers).toHaveLength(3);
  });

  describe.each(RIDGE_SEEDS)("seed %i", (seed) => {
    const layers = buildRidge(seed).layers;
    const lines = layers.map((layer) => parse(layer.outline));

    /** How high a range stands at x, between the samples either side. */
    const heightAt = (line: { x: number; y: number }[], x: number): number => {
      const inner = line.slice(1, -1);
      const i = inner.findIndex((p) => p.x >= x);
      // Past either end, a tree stands on the last slope there is.
      if (i === -1) return inner[inner.length - 1].y;
      if (i === 0) return inner[0].y;
      const a = inner[i - 1];
      const b = inner[i];
      return a.y + ((b.y - a.y) * (x - a.x)) / (b.x - a.x);
    };

    /**
     * How much of the frame's width a range has trees along, counting two
     * trees closer than a few pixels as the same stand.
     */
    const wooded = (trees: readonly Pine[]): number => {
      const spans = trees
        .map((t) => [Math.max(0, t.x - t.spread), Math.min(BOX.width, t.x + t.spread)])
        .filter(([from, to]) => to > from)
        .sort((a, b) => a[0] - b[0]);
      let total = 0;
      let end = -Infinity;
      for (const [from, to] of spans) {
        total += from - end < 4 ? Math.max(0, to - end) : to - from;
        end = Math.max(end, to);
      }
      return total / BOX.width;
    };

    it("closes each range against the bottom corners", () => {
      for (const points of lines) {
        expect(points[0].y).toBe(BOX.height);
        expect(points[points.length - 1].y).toBe(BOX.height);
      }
    });

    it("covers the frame and overshoots both edges", () => {
      for (const points of lines) {
        expect(points[0].x).toBeLessThan(0);
        expect(points[points.length - 1].x).toBeGreaterThan(BOX.width);
      }
    });

    it("keeps every summit inside the box", () => {
      for (const points of lines) {
        for (const { y } of points) {
          expect(y).toBeGreaterThanOrEqual(0);
          expect(y).toBeLessThanOrEqual(BOX.height);
        }
      }
    });

    it("keeps every range clear of the ground it stands on", () => {
      for (const points of lines) {
        const ys = points.slice(1, -1).map((p) => p.y);
        expect(Math.max(...ys)).toBeLessThanOrEqual(BOX.base + 8);
      }
    });

    it("puts the far range above the near ones", () => {
      const top = lines.map((points) => Math.min(...points.map((p) => p.y)));
      expect(top[0]).toBeLessThan(top[1]);
      expect(top[1]).toBeLessThan(top[2]);
    });

    /**
     * This replaced a test that said summits and cols alternate, which was a
     * description of the zigzag the ranges used to be: a point up, a point
     * down, and a ruler between them. A range is a line now, and what can be
     * said about a line is that it is sampled finely enough to look like one
     * and never jumps.
     */
    it("is a line rather than a handful of corners", () => {
      for (const points of lines) {
        const ys = points.slice(1, -1).map((p) => p.y);
        expect(ys.length).toBeGreaterThan(BOX.width / 2);
        for (let i = 1; i < ys.length; i += 1) {
          expect(Math.abs(ys[i] - ys[i - 1])).toBeLessThan(3.5);
        }
      }
    });

    it("has more than one summit and more than one col", () => {
      for (const points of lines) {
        const ys = points.slice(1, -1).map((p) => p.y);
        let turns = 0;
        for (let i = 1; i < ys.length - 1; i += 1) {
          if ((ys[i] - ys[i - 1]) * (ys[i + 1] - ys[i]) < 0) turns += 1;
        }
        expect(turns).toBeGreaterThan(6);
      }
    });

    describe("the trees", () => {
      it("leaves the far range bare", () => {
        expect(layers[0].trees).toHaveLength(0);
      });

      it("grows some on the nearest range", () => {
        expect(layers[2].trees.length).toBeGreaterThan(0);
      });

      /**
       * The reason trees come in stands. Planted from end to end they were
       * the busiest thing in the widget, and two members of the cast were
       * dropped for coming out that way. Every seed the app can show has to
       * leave a good part of its nearest slope alone.
       */
      it("leaves a good part of every range bare", () => {
        for (const layer of layers) {
          expect(wooded(layer.trees)).toBeLessThan(0.6);
        }
      });

      it("keeps the distant trees smaller than the near ones", () => {
        const tallest = (trees: readonly Pine[]): number =>
          Math.max(0, ...trees.map((t) => t.height));
        if (layers[1].trees.length > 0) {
          expect(tallest(layers[1].trees)).toBeLessThan(tallest(layers[2].trees));
        }
      });

      // A tree whose foot is above the slope is a tree in the air, and on a
      // steep slope the downhill corner is the one that gets there first.
      it("sinks every foot into the slope it stands on", () => {
        layers.forEach((layer, i) => {
          for (const tree of layer.trees) {
            expect(tree.base).toBeGreaterThanOrEqual(heightAt(lines[i], tree.x - tree.spread) - 0.05);
            expect(tree.base).toBeGreaterThanOrEqual(heightAt(lines[i], tree.x + tree.spread) - 0.05);
            expect(tree.base - tree.height).toBeGreaterThan(0);
            expect(tree.height).toBeGreaterThan(0);
            expect(tree.spread).toBeLessThan(tree.height);
          }
        });
      });
    });
  });
});

describe("pinePath", () => {
  it("draws nothing for a bare range", () => {
    expect(pinePath([])).toBe("");
  });

  it("draws one closed shape to a tree", () => {
    const trees: Pine[] = [
      { x: 10, base: 20, height: 4, spread: 1.2 },
      { x: 14, base: 21, height: 3, spread: 1 },
    ];
    const path = pinePath(trees);

    expect(path.match(/M/g)).toHaveLength(2);
    expect(path.match(/Z/g)).toHaveLength(2);
    // The tip of the first: directly over its trunk, its whole height up.
    expect(path.startsWith("M10.00,16.00")).toBe(true);
  });
});

/**
 * Where the mist starts and ends has to describe the planes it is laid over:
 * a gradient that ran out above the summits, or began below the street, would
 * be a flat colour with a comment saying otherwise.
 */
describe("the haze", () => {
  it.each(Object.entries(HAZE))("fades each %s plane downward, inside the box", (_, planes) => {
    for (const [from, to] of Object.values(planes)) {
      expect(from).toBeGreaterThanOrEqual(0);
      expect(to).toBeGreaterThan(from);
      expect(to).toBeLessThanOrEqual(BOX.height);
    }
  });

  it("starts the nearer plane's lower than the farther one's", () => {
    for (const planes of Object.values(HAZE)) {
      expect(planes.mid[0]).toBeGreaterThan(planes.far[0]);
    }
  });
});
