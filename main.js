(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);

  // ---------- UI ----------
  const measuresEl = $("measures");
  const tempoEl = $("tempo");
  const tempoValEl = $("tempoVal");
  const restsEl = $("rests");
  const restsValEl = $("restsVal");
  const allowTripletsEl = $("allowTriplets");
  const allow8thsEl = $("allow8ths");
  const allow16thsEl = $("allow16ths");
  const regenBtn = $("regen");
  const playBtn = $("play");
  const stopBtn = $("stop");
  const statusEl = $("status");
  const errorEl = $("error");
  const scoreEl = $("score");
  const scoreWrapEl = $("scoreWrap");

  function syncSliderFill(input) {
    const min = Number(input.min || 0);
    const max = Number(input.max || 100);
    const val = Number(input.value || 0);
    const pct = max === min ? 0 : ((val - min) / (max - min)) * 100;
    input.style.setProperty("--bg-pos", `0 0 / ${pct}% 100%`);
  }

  function setStatus(msg, mode = "ok") {
    const textEl = statusEl?.querySelector?.(".statusText");
    if (textEl) textEl.textContent = msg;
    else statusEl.textContent = msg;

    statusEl.classList.remove("statusChip--ok", "statusChip--play", "statusChip--warn");
    statusEl.classList.add(
      mode === "play" ? "statusChip--play" :
      mode === "warn" ? "statusChip--warn" :
      "statusChip--ok"
    );
  }
  function showError(err) {
    errorEl.hidden = false;
    errorEl.textContent = String(err && err.stack ? err.stack : err);
  }
  function clearError() {
    errorEl.hidden = true;
    errorEl.textContent = "";
  }

  // ---------- VexFlow guard ----------
  function VF() {
    if (window.Vex && window.Vex.Flow) return window.Vex.Flow;
    throw new Error("VexFlow did not load. Check your internet / CDN.");
  }

  // --- Triplet tile icon (VexFlow -> canvas) ---
  // --- Rhythm tile icons (VexFlow -> canvas), NO STAFF LINES / NO BARLINES ---
  function renderRhythmIcon(canvasId, recipe) {
    try {
      const flow = VF();
      const c = $(canvasId);
      if (!(c instanceof HTMLCanvasElement)) return;

      const W = c.width || 160;
      const H = c.height || 90;

      const renderer = new flow.Renderer(c, flow.Renderer.Backends.CANVAS);
      renderer.resize(W, H);

      const ctx = renderer.getContext();
      ctx.setFont("Arial", 10, "");

      const raw = ctx.context || ctx;
      raw.clearRect(0, 0, W, H);
      raw.fillStyle = "#000";
      raw.strokeStyle = "#000";

      // Make a stave used ONLY for spacing, but do NOT draw it.
      // Also make it "invisible" so even if something tries to draw, it won't show.
      const stave = new flow.Stave(10, 18, W - 20);
      stave.setStyle?.({ strokeStyle: "rgba(0,0,0,0)", fillStyle: "rgba(0,0,0,0)" });
      stave.setContext(ctx);

      // Build notes
      const notes = recipe.notes.map((n) => {
        const isRest = !!n.rest;
        const dur = n.dur + (isRest ? "r" : "");
        const sn = new flow.StaveNote({
          clef: "percussion",
          keys: isRest ? ["b/4"] : ["c/5"],
          duration: dur,
        });

        if (isRest) sn.setKeyLine(0, 3);

        const dots = Number(n.dots || 0);
        if (dots > 0) {
          for (let i = 0; i < dots; i++) {
            if (flow.Dot?.buildAndAttach) flow.Dot.buildAndAttach([sn], { all: true });
            else if (sn.addDotToAll) sn.addDotToAll();
            else if (sn.addDot) sn.addDot(0);
          }
        }

        sn.setStemDirection(flow.Stem.UP).setStemLength(26);
        sn.setContext(ctx);
        sn.setStave?.(stave);
        return sn;
      });

      const voice = new flow.Voice({ num_beats: recipe.num_beats, beat_value: recipe.beat_value })
        .setStrict(false);
      voice.addTickables(notes);
      voice.setContext?.(ctx);
      voice.setStave?.(stave);

      const formatter = new flow.Formatter();
      formatter.joinVoices([voice]);

      // Format into the *icon* width (not “toStave” since we’re not drawing it)
      formatter.format([voice], W - 30);

      // Optional beam
      let beamObj = null;
      if (recipe.beam) {
        beamObj = new flow.Beam(notes, false);
        beamObj.setBeamDirection?.(flow.Stem.UP);
      }

      // Optional tuplet
      let tupletObj = null;
      if (recipe.tuplet) {
        tupletObj = new flow.Tuplet(notes, {
          num_notes: recipe.tuplet.num_notes,
          notes_occupied: recipe.tuplet.notes_occupied,
          bracketed: true,
          ratioed: false,
        });
      }

      // Draw just the musical elements (no stave)
      voice.draw(ctx, stave);
      beamObj?.setContext(ctx).draw();
      tupletObj?.setContext(ctx).draw();
    } catch (e) {
      console.warn("Icon render failed:", canvasId, e);
    }
  }

  function safeRenderAllIcons() {
    // 8ths: 2x 8th (1 beat)
    renderRhythmIcon("eighthIcon", {
      num_beats: 1, beat_value: 4,
      beam: true,
      notes: [{ dur: "8" }, { dur: "8" }],
    });

    // 16ths: 4x 16th (1 beat)
    renderRhythmIcon("sixteenthIcon", {
      num_beats: 1, beat_value: 4,
      beam: true,
      notes: [{ dur: "16" }, { dur: "16" }, { dur: "16" }, { dur: "16" }],
    });



    // triplets: 3x 8th in the time of 2 8ths (1 beat = 2/4 in VF terms here)
    renderRhythmIcon("tripletIcon", {
      num_beats: 2, beat_value: 4,
      beam: true,
      tuplet: { num_notes: 3, notes_occupied: 2 },
      notes: [{ dur: "8" }, { dur: "8" }, { dur: "8" }],
    });
  }

  // --- Scratch VF context (required for dotted modifiers during width calc) ---
  let _scratchVFContext = null;
  function getScratchVFContext(flow) {
    if (_scratchVFContext) return _scratchVFContext;
    const c = document.createElement("canvas");
    c.width = 32; c.height = 32;
    const r = new flow.Renderer(c, flow.Renderer.Backends.CANVAS);
    r.resize(32, 32);
    _scratchVFContext = r.getContext();
    _scratchVFContext.setFont("Arial", 10, "");
    return _scratchVFContext;
  }

  // ---------- Rhythm model ----------
  function chance(pct) {
    return Math.random() * 100 < pct;
  }

  function pickBeatPattern({ restPct, allow8ths, allow16ths, allowTriplets }) {
    // We are NOT changing any rhythm rules — only which families can be selected.

    // Weighted pool (quarter is always allowed as a safe fallback)
    const pool = [
      { id: "q", w: 0.18 },
    ];
    if (allow8ths)     pool.push({ id: "8s", w: 0.38 });
    if (allow16ths)    pool.push({ id: "16s", w: 0.34 });
    if (allowTriplets) pool.push({ id: "8t", w: 0.20 });

    // pick from pool
    const totalW = pool.reduce((s, x) => s + x.w, 0) || 1;
    let r = Math.random() * totalW;
    let choice = pool[0].id;
    for (const item of pool) {
      r -= item.w;
      if (r <= 0) { choice = item.id; break; }
    }

    const make = (dur, beats, dots = 0) => ({
      kind: chance(restPct) ? "rest" : "note",
      dur, dots, beats,
    });

    if (choice === "q") return [make("q", 1)];
    if (choice === "8s") return [make("8", 0.5), make("8", 0.5)];
    if (choice === "16s") return [make("16", 0.25), make("16", 0.25), make("16", 0.25), make("16", 0.25)];

    // Triplets unchanged
    const t = [make("8", 1 / 3), make("8", 1 / 3), make("8", 1 / 3)];
    t._tuplet = { num_notes: 3, notes_occupied: 2 };
    return t;
  }

  // --- Rest absorption (beat-level) ---
  function durFromBeats(beats) {
    const eps = 1e-6;
    if (Math.abs(beats - 1) < eps) return "q";
    if (Math.abs(beats - 0.5) < eps) return "8";
    if (Math.abs(beats - 0.25) < eps) return "16";
    return null;
  }

  // --- Normalize beats into your preferred spellings ---
  function normalizeSixteenthGridBeat(beat) {
    const eps = 1e-6;
    if (!beat || beat._tuplet) return beat;

    const N = (dur, beats, dots = 0) => ({ kind: "note", dur, beats, dots });
    const R = (dur, beats, dots = 0) => ({ kind: "rest", dur, beats, dots });

    const is16r = (e) =>
      e &&
      e.kind === "rest" &&
      e.dur === "16" &&
      Math.abs((e.beats ?? 0) - 0.25) < eps &&
      Number(e.dots || 0) === 0;

    const isPlain8 = (e) =>
      e &&
      (e.kind === "note" || e.kind === "rest") &&
      e.dur === "8" &&
      Math.abs((e.beats ?? 0) - 0.5) < eps &&
      Number(e.dots || 0) === 0;

    // NEW: Fix the 3-token version you screenshotted: 16r 16r 8  -> 8r 8
    if (beat.length === 3 && is16r(beat[0]) && is16r(beat[1]) && isPlain8(beat[2])) {
      return [R("8", 0.5), beat[2].kind === "note" ? N("8", 0.5) : R("8", 0.5)];
    }
    // (symmetry) 8 16r 16r -> 8 8r
    if (beat.length === 3 && isPlain8(beat[0]) && is16r(beat[1]) && is16r(beat[2])) {
      return [beat[0].kind === "note" ? N("8", 0.5) : R("8", 0.5), R("8", 0.5)];
    }

    // Only touch "four 16th slots" beats
    if (beat.length !== 4) return beat;
    for (const e of beat) {
      if (e.dur !== "16") return beat;
      if (Math.abs((e.beats ?? 0) - 0.25) > eps) return beat;
      if (Number(e.dots || 0) !== 0) return beat;
    }

    const pat = beat.map((e) => (e.kind === "note" ? "n" : "r")).join("");

    // Your image rules:
    if (pat === "rnrr") return [R("16", 0.25), N("8", 0.75, 1)];
    if (pat === "rrrn") return [R("8", 0.75, 1), N("16", 0.25)];
    if (pat === "nrrn") return [N("8", 0.75, 1), N("16", 0.25)];
    if (pat === "nnrr") return [N("16", 0.25), N("16", 0.25), R("8", 0.5)];
    if (pat === "rrnn") return [R("8", 0.5), N("8", 0.5)];
    if (pat === "nrrr") return [N("q", 1)];

    return beat;
  }

  // NEW: catch 16r 16r 8  (and 8r 16 16) even when beat isn't 4 tokens
  function normalizeEighthRestEighth(beat) {
    const eps = 1e-6;
    if (!beat || beat._tuplet) return beat;

    const N = (dur, beats, dots = 0) => ({ kind: "note", dur, beats, dots });
    const R = (dur, beats, dots = 0) => ({ kind: "rest", dur, beats, dots });

    const is16r = (e) => e && e.kind === "rest" && e.dur === "16" && Math.abs((e.beats ?? 0) - 0.25) < eps && !e.dots;
    const is16n = (e) => e && e.kind === "note" && e.dur === "16" && Math.abs((e.beats ?? 0) - 0.25) < eps && !e.dots;
    const is8r  = (e) => e && e.kind === "rest" && e.dur === "8"  && Math.abs((e.beats ?? 0) - 0.5)  < eps && !e.dots;

    const out = beat.map((e) => ({ ...e }));

    // 16r 16r X  -> 8r X
    if (out.length >= 2 && is16r(out[0]) && is16r(out[1])) {
      out.splice(0, 2, R("8", 0.5));
    }

    // X 16r 16r  -> X 8r
    const L = out.length;
    if (L >= 2 && is16r(out[L - 2]) && is16r(out[L - 1])) {
      out.splice(L - 2, 2, R("8", 0.5));
    }

    // 8r 16 16 -> 8r 8
    if (out.length === 3 && is8r(out[0]) && is16n(out[1]) && is16n(out[2])) {
      return [out[0], N("8", 0.5)];
    }

    return out;
  }

  function absorbRestsInBeat(beat) {    // Skip tuplets entirely
    if (beat && beat._tuplet) return beat;

    const out = beat.map((e) => ({ ...e }));

    for (let i = 0; i < out.length; i++) {
      const e = out[i];
      if (e.kind !== "note") continue;

      // Sum consecutive rests after this note
      let j = i + 1;
      let restSum = 0;
      let hasDottedRest = false;
      while (j < out.length && out[j].kind === "rest") {
        if (out[j].dots) hasDottedRest = true;
        restSum += out[j].beats;
        j++;
      }
      if (restSum <= 0) continue;

      const total = e.beats + restSum;
      const newDur = durFromBeats(total);

      // RULE: 16th + dotted-8th REST (0.25 + 0.75) => quarter note
      if (hasDottedRest && newDur === "q") {
        e.beats = 1;
        e.dur = "q";
        e.dots = 0;
        out.splice(i + 1, j - (i + 1)); // remove absorbed rests
        continue;
      }

      // Otherwise keep the old behavior (don’t absorb dotted rests)
      if (!hasDottedRest && (newDur === "8" || newDur === "q")) {
        e.beats = total;
        e.dur = newDur;
        out.splice(i + 1, j - (i + 1)); // remove absorbed rests
      }
    }

    return out;
  }



  function collapseAllRestBeatToQuarter(beat) {
    if (!beat || beat.length === 0) return beat;
    if (!beat.every((e) => e.kind === "rest")) return beat;
    // Whole beat silent -> plain quarter rest (no tuplet)
    return [{ kind: "rest", dur: "q", beats: 1 }];
  }

  function mergeTripletBeatClean(beat) {
  if (!beat || !beat._tuplet) return beat;

  const pat = beat.map((e) => (e.kind === "note" ? "n" : "r")).join("");

  // r r r -> quarter rest (drop tuplet entirely)
  if (pat === "rrr") return [{ kind: "rest", dur: "q", beats: 1 }];

  // n r r -> quarter note (drop tuplet entirely)
  if (pat === "nrr") return [{ kind: "note", dur: "q", beats: 1 }];

  // r n r -> 8th rest, then quarter note (KEEP tuplet)
  if (pat === "rnr") {
    const out = [
      { kind: "rest", dur: "8", beats: 1 / 3 },
      { kind: "note", dur: "q", beats: 2 / 3 },
    ];
    out._tuplet = beat._tuplet;
    return out;
  }

  // r r n -> quarter rest, then 8th note (KEEP tuplet)
  if (pat === "rrn") {
    const out = [
      { kind: "rest", dur: "q", beats: 2 / 3 },
      { kind: "note", dur: "8", beats: 1 / 3 },
    ];
    out._tuplet = beat._tuplet;
    return out;
  }

  // n r n -> quarter note, then 8th note (KEEP tuplet)
  if (pat === "nrn") {
    const out = [
      { kind: "note", dur: "q", beats: 2 / 3 },
      { kind: "note", dur: "8", beats: 1 / 3 },
    ];
    out._tuplet = beat._tuplet;
    return out;
  }

  return beat;
}


  function generateExercise({ measures, restPct, allow8ths, allow16ths, allowTriplets }) {
    const out = [];
    for (let m = 0; m < measures; m++) {
      const beats = [];
      for (let b = 0; b < 4; b++) {
        let beat = pickBeatPattern({ restPct, allow8ths, allow16ths, allowTriplets });
        beat = normalizeSixteenthGridBeat(beat);
        beat = normalizeEighthRestEighth(beat);
        beat = absorbRestsInBeat(beat);
        beat = normalizeEighthRestEighth(beat);
        beat = collapseAllRestBeatToQuarter(beat);
        beat = mergeTripletBeatClean(beat);
        beats.push(beat);
      }
      out.push({ beats });
    }
    return out;
  }

  // ---------- Convert to VexFlow notes ----------
  function makeStaveNote(flow, elem) {
    const isRest = elem.kind === "rest";

    // Base durations only: "q" | "8" | "16"  (dots are attached as modifiers)
    const base = elem.dur;
    const duration = isRest ? (base + "r") : base;

    const note = new flow.StaveNote({
      clef: "percussion",
      keys: isRest ? ["b/4"] : ["c/5"],
      duration,
    });

    if (isRest) note.setKeyLine(0, 3);

    const dots = Math.max(0, Number(elem.dots || 0));
    if (dots > 0) {
      if (flow.Dot && typeof flow.Dot.buildAndAttach === "function") {
        for (let i = 0; i < dots; i++) flow.Dot.buildAndAttach([note], { all: true });
      } else if (typeof note.addDotToAll === "function") {
        for (let i = 0; i < dots; i++) note.addDotToAll();
      } else if (typeof note.addDot === "function") {
        for (let i = 0; i < dots; i++) note.addDot(0);
      }
    }

    note.setStemDirection(flow.Stem.UP).setStemLength(35);
    return note;
  }

  function buildMeasure(flow, measureModel) {
    const notes = [];
    const tuplets = [];
    const beams = [];

    for (let beatIdx = 0; beatIdx < 4; beatIdx++) {
      const beat = measureModel.beats[beatIdx];
      const vfNotes = beat.map((e) => makeStaveNote(flow, e));
      notes.push(...vfNotes);

      const isTripletBeat = !!beat._tuplet;

      // tag triplet rests using the MODEL (reliable)
      if (isTripletBeat) {
        for (let i = 0; i < beat.length; i++) {
          if (beat[i]?.kind === "rest") vfNotes[i].__tripletRest = true;
        }
      }

      if (isTripletBeat) {
        for (let i = 0; i < vfNotes.length; i++) {
          const n = vfNotes[i];
          if (n && typeof n.isRest === "function" && n.isRest()) {
            n.setKeyLine?.(0, 3);     // same line you use elsewhere
            n.setYShift?.(-6);        // if it moves the wrong way, flip to +6
          }
        }
      }

      if (isTripletBeat) {
        tuplets.push(new flow.Tuplet(vfNotes, {
          ...beat._tuplet,
          bracketed: true,
          ratioed: false,
        }));
      }

      // ---- PRO BEAMING (Option B) ----
      // 1) Normal 8ths / 16ths: beam contiguous groups within the beat,
      //    never across rests, never across beat boundaries.
      let group = [];
      let groupDur = null; // "8" or "16"

      function flushGroup() {
        if (group.length >= 2) {
          group.forEach((n) => n.setStemDirection(flow.Stem.UP));
          flow.Beam.generateBeams(group, {
            stem_direction: flow.Stem.UP,
            maintain_stem_directions: true,
          }).forEach((b) => {
            if (b.setBeamDirection) b.setBeamDirection(flow.Stem.UP);
            beams.push(b);
          });
        }
        group = [];
        groupDur = null;
      }

      for (let i = 0; i < beat.length; i++) {
        const elem = beat[i];
        const note = vfNotes[i];

        const isNote = elem.kind === "note";
        const isTuplet = !!beat._tuplet; // whole beat is tuplet
        const isBeamable8 = !isTuplet && elem.dur === "8";   // allow dotted 8ths to beam
        const isBeamable16 = !isTuplet && elem.dur === "16";

        if (isNote && (isBeamable8 || isBeamable16)) {
          if (!groupDur) groupDur = elem.dur; // "8" or "16"
          group.push(note);
        } else {
          flushGroup(); // rest, quarter, or tuplet breaks the beam
        }
      }
      flushGroup(); // end of beat

      // 2) Triplet beaming: contiguous tuplet notes only (no beams across rests).
      if (isTripletBeat) {
        let tripGroup = [];

        function flushTripGroup() {
          if (tripGroup.length >= 2) {
            tripGroup.forEach((n) => n.setStemDirection(flow.Stem.UP));
            const beam = new flow.Beam(tripGroup, false);
            if (beam.setBeamDirection) beam.setBeamDirection(flow.Stem.UP);
            beams.push(beam);
          }
          tripGroup = [];
        }

        for (let i = 0; i < beat.length; i++) {
          const elem = beat[i];
          const note = vfNotes[i];

          if (elem.kind === "note" && elem.dur === "8") {
            tripGroup.push(note);
          } else {
            flushTripGroup(); // rest in the triplet breaks the beam
          }
        }
        flushTripGroup();
      }
      // ---- END PRO BEAMING ----
    }

    // Force all beams to render as "up"
    beams.forEach((b) => {
      if (b && b.setBeamDirection) b.setBeamDirection(flow.Stem.UP);
    });

    return { notes, beams, tuplets };
  }

  // ---------- Rendering ----------
  let currentExercise = null;

  function packMeasure(flow, measureModel, isFirstMeasure = false) {
    const pack = buildMeasure(flow, measureModel);

    const voice = new flow.Voice({ num_beats: 4, beat_value: 4 });
voice.setStrict(false);
voice.addTickables(pack.notes);

const BASE = 170;

    const PER_NOTE = 18;                    // each tickable needs room
    const PER_TUPLET = 26;                  // bracket/number room
    const firstPad = isFirstMeasure ? 70 : 0;

    const minW = BASE
      + pack.notes.length * PER_NOTE
      + pack.tuplets.length * PER_TUPLET
      + firstPad;

    return { ...pack, voice, minW: Math.ceil(minW) };
  }

  function estimateMeasureMinWidth(measureModel) {
    // Simple spacing heuristic: more noteheads/flags/tuplets => wider measure
    let elems = 0;
    let sixteenths = 0;
    let tripletBeats = 0;

    for (const beat of measureModel.beats) {
      elems += beat.length;
      sixteenths += beat.filter((e) => e.dur === "16").length;

      const isTripletBeat = beat.length === 3 && beat.every((e) => e.dur === "8t");
      if (isTripletBeat) tripletBeats += 1;
    }

    // Tuned for your rhythm set (q / 8 / 16 / 8t)
    const BASE = 150;                 // clef/time padding-ish (even though only first has it)
    const PER_ELEM = 16;              // each note/rest needs horizontal room
    const PER_16 = 6;                 // extra room for double-flags & tighter beams
    const PER_TRIPLET_BEAT = 14;      // tuplet bracket/number slug
    return BASE + elems * PER_ELEM + sixteenths * PER_16 + tripletBeats * PER_TRIPLET_BEAT;
  }

  function render(exercise) {
    const flow = VF();

    if (!(scoreEl instanceof HTMLCanvasElement)) {
      throw new Error(`Expected <canvas id="score"> but found <${scoreEl?.tagName?.toLowerCase()}>.`);
    }

    // Layout
    const totalMeasures = exercise.length;

    const packs = exercise.map((mm, i) => packMeasure(flow, mm, i === 0));

    // Base canvas width from container (cap at 1200; scoreWrap can scroll)
    const rectW = Math.floor(scoreWrapEl.getBoundingClientRect().width || 0);
    const MIN_CANVAS_W = 600;
    const MAX_CANVAS_W = 1200;

    const marginX = 20;
    const marginY = 18;
    const lineGap = 150;

    // Prefer 4 per line (only drop if we still can't fit even after widening to 1200)
    const PREFERRED_PER_LINE = 4;
    const MIN_MEASURE_W = 210;

    let wrapW = Math.max(MIN_CANVAS_W, Math.min(MAX_CANVAS_W, rectW - 24));
    let usableW = wrapW - marginX * 2;

    function maxLineMinSum(mpl) {
      let maxSum = 0;
      for (let start = 0; start < totalMeasures; start += mpl) {
        const end = Math.min(totalMeasures, start + mpl);
        let sum = 0;
        for (let i = start; i < end; i++) sum += packs[i].minW;
        if (sum > maxSum) maxSum = sum;
      }
      return maxSum;
    }

    let measuresPerLine = Math.min(PREFERRED_PER_LINE, totalMeasures);

    function tryWidenToFit(mpl) {
      const needed = maxLineMinSum(mpl);
      if (needed <= usableW) return true;

      // Try widening canvas up to MAX_CANVAS_W to keep mpl (scoreWrap will scroll if needed)
      const desiredWrap = Math.min(MAX_CANVAS_W, needed + marginX * 2);
      if (desiredWrap > wrapW) {
        wrapW = desiredWrap;
        usableW = wrapW - marginX * 2;
      }
      return needed <= usableW;
    }

    while (measuresPerLine > 1) {
      if ((usableW / measuresPerLine) < MIN_MEASURE_W) { measuresPerLine--; continue; }
      if (!tryWidenToFit(measuresPerLine)) { measuresPerLine--; continue; }
      break;
    }

    const lines = Math.ceil(totalMeasures / measuresPerLine);
    const height = marginY * 2 + lines * lineGap;

    // Scale down to fit the visible wrapper (prevents clipping on small screens)
    const wrapBoxW = Math.floor(scoreWrapEl.getBoundingClientRect().width || 0);
    const displayW = Math.max(320, wrapBoxW - 24); // scoreWrap padding(12*2)
    const scale = Math.min(1, displayW / wrapW);

    const physW = Math.max(1, Math.floor(wrapW * scale));
    const physH = Math.max(1, Math.floor(height * scale));

    const renderer = new flow.Renderer(scoreEl, flow.Renderer.Backends.CANVAS);
    renderer.resize(physW, physH);

    // Make the element match the drawing buffer
    scoreEl.style.width = physW + "px";
    scoreEl.style.height = physH + "px";

    const ctx = renderer.getContext();
    ctx.setFont("Arial", 10, "");

    // Clear canvas FIRST (use physical dimensions)
    if (ctx && ctx.clearRect) ctx.clearRect(0, 0, physW, physH);
    if (ctx && ctx.context && ctx.context.clearRect) ctx.context.clearRect(0, 0, physW, physH);

    // Force black ink (use the real canvas context)
    const raw = ctx.context || ctx;
    if (raw) {
      raw.fillStyle = "#000";
      raw.strokeStyle = "#000";
      raw.save();
      raw.scale(scale, scale);
    }

setStatus(`Generated ${exercise.length} measures.`);

    let m = 0;
    for (let line = 0; line < lines; line++) {
      const y = marginY + line * lineGap;

      // Compute this line's measure widths (min widths + distribute leftover space)
      const lineStart = m;
      const lineEnd = Math.min(totalMeasures, lineStart + measuresPerLine);

      const mins = [];
      let sumMin = 0;
      for (let i = lineStart; i < lineEnd; i++) {
        const w = packs[i].minW;
        mins.push(w);
        sumMin += w;
      }

      // If we have extra room on the line, distribute it proportional to min width
      const extra = Math.max(0, usableW - sumMin);
      const widths = mins.slice();
      if (extra > 0) {
        const weightSum = sumMin || 1;
        for (let i = 0; i < widths.length; i++) {
          widths[i] = Math.floor(widths[i] + (extra * (mins[i] / weightSum)));
        }
        // Fix rounding leftovers so total == usableW
        let diff = usableW - widths.reduce((a, b) => a + b, 0);
        let k = 0;
        while (diff > 0) { widths[k % widths.length]++; diff--; k++; }
      }

      let x = marginX;

      for (let col = 0; col < widths.length; col++) {
        if (m >= totalMeasures) break;

        const w = widths[col];
        const stave = new flow.Stave(x, y, w);
        if (stave.setStyle) stave.setStyle({ strokeStyle: "#000", fillStyle: "#000" });
        // Default is a standard 5-line staff, so no need to override.
        // stave.setNumLines(5);

        if (m === 0 && line === 0 && col === 0) {
          stave.addClef("percussion").addTimeSignature("4/4");
        }

        stave.setContext(ctx).draw();

        const pack = packs[m];
        const { beams, tuplets, voice } = pack;

        // Make VF4 formatter happy: everything must know its ctx + stave
        if (voice.setContext) voice.setContext(ctx);
        if (voice.setStave) voice.setStave(stave);

        pack.notes.forEach((n) => {
          n.setContext(ctx);
          if (n.setStave) n.setStave(stave);
        });

        // force triplet rests to sit on the same line as normal rests
        const TRIPLET_REST_NUDGE_PX = 0; // set to 4 or 6 if still too high
        pack.notes.forEach((n) => {
          if (!n?.__tripletRest) return;
          const y = (typeof stave.getYForLine === "function" ? stave.getYForLine(3) : null);
          if (y != null && typeof n.setYs === "function") n.setYs([y + TRIPLET_REST_NUDGE_PX]);
        });

        const formatter = new flow.Formatter();

        // Format using the *real* note area inside this stave (prevents overflow)
        if (typeof formatter.formatToStave === "function") {
          formatter.formatToStave([voice], stave);
        } else {
          const startX = typeof stave.getNoteStartX === "function" ? stave.getNoteStartX() : (x + 20);
          const endX   = typeof stave.getNoteEndX === "function"   ? stave.getNoteEndX()   : (x + w - 20);
          const avail = Math.max(60, (endX - startX) - 10);
          formatter.format([voice], avail);
        }

        // Force triplet rests to sit like normal rests (AFTER formatting, BEFORE draw)
        const TRIPLET_REST_LINE = 3;    // your normal rest line
        const TRIPLET_REST_NUDGE = 6;   // +down (try 4, 6, 8)

        pack.notes.forEach((n) => {
          if (!n?.__tripletRest) return;

          // force staff lines
          n.setKeyLine?.(0, TRIPLET_REST_LINE);

          // hard override y
          const y = (typeof stave.getYForLine === "function")
            ? stave.getYForLine(TRIPLET_REST_LINE) + TRIPLET_REST_NUDGE
            : null;

          if (y != null) {
            if (typeof n.setYs === "function") n.setYs([y]);
            else n.ys = [y]; // fallback
          }

          // extra fallback used by some VF builds
          if (n.render_options) n.render_options.y_shift = TRIPLET_REST_NUDGE;
        });

        voice.draw(ctx, stave);
        beams.forEach((b) => b.setContext(ctx).draw());
        tuplets.forEach((t) => t.setContext(ctx).draw());

        m++;
        x += w;
      }
    }

    // Undo the ctx.scale(scale, scale) we applied above
    if (raw) raw.restore();
  }

  // ---------- Playback ----------
  let audioCtx = null;
  let isPlaying = false;

  // Prevent old setTimeout() callbacks from stopping a new run
  let stopTimerId = null;
  let playRunId = 0;

  function clickAt(time, freq, gain = 0.08, dur = 0.03) {
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = "square";
    o.frequency.setValueAtTime(freq, time);
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(gain, time + 0.001);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    o.connect(g).connect(audioCtx.destination);
    o.start(time);
    o.stop(time + dur + 0.02);
  }

  function flattenEvents(exercise) {
    let beatPos = 0;
    const events = [];
    for (const meas of exercise) {
      for (const beat of meas.beats) {
        for (const e of beat) {
          events.push({ beat: beatPos, kind: e.kind, beats: e.beats });
          beatPos += e.beats;
        }
      }
    }
    return { events, totalBeats: beatPos };
  }

  function play() {
    if (!currentExercise) return;

    stop();

    const tempo = Number(tempoEl.value);
    const secondsPerBeat = 60 / tempo;

    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    audioCtx.resume?.().catch(() => {});
    isPlaying = true;
    playBtn.disabled = true;
    stopBtn.disabled = false;
    setStatus("Playing");

    const { events, totalBeats } = flattenEvents(currentExercise);
    const startTime = audioCtx.currentTime + 0.06;

    for (let b = 0; b <= totalBeats + 0.0001; b += 1) {
      const t = startTime + b * secondsPerBeat;
      const isDownbeat = (Math.round(b) % 4) === 0;
      clickAt(t, isDownbeat ? 1200 : 900, isDownbeat ? 0.10 : 0.06, 0.025);
    }

    for (const ev of events) {
      if (ev.kind !== "note") continue;
      clickAt(startTime + ev.beat * secondsPerBeat, 650, 0.07, 0.03);
    }

    const myRun = ++playRunId;

    const endTime = startTime + totalBeats * secondsPerBeat + 0.25;

    if (stopTimerId) window.clearTimeout(stopTimerId);
    stopTimerId = window.setTimeout(() => {
      // Only stop if this timeout belongs to the current run
      if (myRun !== playRunId) return;
      if (isPlaying) stop();
    }, Math.max(0, (endTime - audioCtx.currentTime) * 1000));
  }

  function stop() {
    // Invalidate any pending "auto-stop" from older runs
    playRunId++;

    if (stopTimerId) {
      window.clearTimeout(stopTimerId);
      stopTimerId = null;
    }

    if (audioCtx) { try { audioCtx.close(); } catch {} }
    audioCtx = null;

    isPlaying = false;
    playBtn.disabled = false;
    stopBtn.disabled = true;
    setStatus("Ready");
  }

  // ---------- Wire up ----------
  function regenerate() {
    try {
      clearError();

      const measures = Math.max(1, Math.min(32, Math.round(Number(measuresEl.value) || 8)));
      const restPct = Math.max(0, Math.min(60, Math.round(Number(restsEl.value) || 0)));
      const allow8ths = !!allow8thsEl?.checked;
      const allow16ths = !!allow16thsEl?.checked;
      const allowTriplets = !!allowTripletsEl.checked;

      currentExercise = generateExercise({ measures, restPct, allow8ths, allow16ths, allowTriplets });
      render(currentExercise);
      setStatus(`Generated ${measures} Measures`);
    } catch (e) {
      showError(e);
      setStatus("Render failed (see error box).");
    }
  }

  tempoEl.addEventListener("input", () => {
    tempoValEl.textContent = tempoEl.value;
    syncSliderFill(tempoEl);
  });

  restsEl.addEventListener("input", () => {
    restsValEl.textContent = restsEl.value;
    syncSliderFill(restsEl);
  });

  regenBtn.addEventListener("click", regenerate);
  playBtn.addEventListener("click", play);
  stopBtn.addEventListener("click", stop);

  window.addEventListener("resize", () => {
    if (!currentExercise) return;
    try { render(currentExercise); } catch (e) { showError(e); }
  });

  // init UI
  tempoValEl.textContent = tempoEl.value;
  restsValEl.textContent = restsEl.value;
  syncSliderFill(tempoEl);
  syncSliderFill(restsEl);

  safeRenderAllIcons();
  regenerate();
})();
