(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const $$ = (sel) => document.querySelector(sel);

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
  const playheadEl = $("playhead");
  const playBtnText = $("playBtnText");
  const progressBar = $("progressBar");
  const barContainer = $$(".bar");

  const SHEET_DENSITY = 0.82; 
  const END_BUFFER_BEATS = 0.25; 

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

  // --- Rhythm tile icons (VexFlow -> canvas) ---
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

      const stave = new flow.Stave(10, 18, W - 20);
      stave.setStyle?.({ strokeStyle: "rgba(0,0,0,0)", fillStyle: "rgba(0,0,0,0)" });
      stave.setContext(ctx);

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
      formatter.format([voice], W - 30);

      let beamObj = null;
      if (recipe.beam) {
        beamObj = new flow.Beam(notes, false);
        beamObj.setBeamDirection?.(flow.Stem.UP);
      }

      let tupletObj = null;
      if (recipe.tuplet) {
        tupletObj = new flow.Tuplet(notes, {
          num_notes: recipe.tuplet.num_notes,
          notes_occupied: recipe.tuplet.notes_occupied,
          bracketed: true,
          ratioed: false,
        });
      }

      voice.draw(ctx, stave);
      beamObj?.setContext(ctx).draw();
      tupletObj?.setContext(ctx).draw();
    } catch (e) {
      console.warn("Icon render failed:", canvasId, e);
    }
  }

  function safeRenderAllIcons() {
    renderRhythmIcon("eighthIcon", {
      num_beats: 1, beat_value: 4,
      beam: true,
      notes: [{ dur: "8" }, { dur: "8" }],
    });

    renderRhythmIcon("sixteenthIcon", {
      num_beats: 1, beat_value: 4,
      beam: true,
      notes: [{ dur: "16" }, { dur: "16" }, { dur: "16" }, { dur: "16" }],
    });

    renderRhythmIcon("tripletIcon", {
      num_beats: 2, beat_value: 4,
      beam: true,
      tuplet: { num_notes: 3, notes_occupied: 2 },
      notes: [{ dur: "8" }, { dur: "8" }, { dur: "8" }],
    });
  }

  // ---------- Rhythm model ----------
  function chance(pct) {
    return Math.random() * 100 < pct;
  }

  function pickBeatPattern({ restPct, allow8ths, allow16ths, allowTriplets }) {
    const pool = [{ id: "q", w: 0.18 }];
    if (allow8ths)     pool.push({ id: "8s", w: 0.38 });
    if (allow16ths)    pool.push({ id: "16s", w: 0.34 });
    if (allowTriplets) pool.push({ id: "8t", w: 0.20 });

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

    const t = [make("8", 1 / 3), make("8", 1 / 3), make("8", 1 / 3)];
    t._tuplet = { num_notes: 3, notes_occupied: 2 };
    return t;
  }

  function durFromBeats(beats) {
    const eps = 1e-6;
    if (Math.abs(beats - 1) < eps) return "q";
    if (Math.abs(beats - 0.5) < eps) return "8";
    if (Math.abs(beats - 0.25) < eps) return "16";
    return null;
  }

  function normalizeSixteenthGridBeat(beat) {
    const eps = 1e-6;
    if (!beat || beat._tuplet) return beat;

    const N = (dur, beats, dots = 0) => ({ kind: "note", dur, beats, dots });
    const R = (dur, beats, dots = 0) => ({ kind: "rest", dur, beats, dots });

    const is16r = (e) =>
      e && e.kind === "rest" && e.dur === "16" && Math.abs((e.beats ?? 0) - 0.25) < eps && Number(e.dots || 0) === 0;
    const isPlain8 = (e) =>
      e && (e.kind === "note" || e.kind === "rest") && e.dur === "8" && Math.abs((e.beats ?? 0) - 0.5) < eps && Number(e.dots || 0) === 0;

    if (beat.length === 3 && is16r(beat[0]) && is16r(beat[1]) && isPlain8(beat[2])) {
      return [R("8", 0.5), beat[2].kind === "note" ? N("8", 0.5) : R("8", 0.5)];
    }
    if (beat.length === 3 && isPlain8(beat[0]) && is16r(beat[1]) && is16r(beat[2])) {
      return [beat[0].kind === "note" ? N("8", 0.5) : R("8", 0.5), R("8", 0.5)];
    }

    if (beat.length !== 4) return beat;
    for (const e of beat) {
      if (e.dur !== "16") return beat;
      if (Math.abs((e.beats ?? 0) - 0.25) > eps) return beat;
      if (Number(e.dots || 0) !== 0) return beat;
    }

    const pat = beat.map((e) => (e.kind === "note" ? "n" : "r")).join("");

    if (pat === "rnrr") return [R("16", 0.25), N("8", 0.75, 1)];
    if (pat === "rrrn") return [R("8", 0.75, 1), N("16", 0.25)];
    if (pat === "nrrn") return [N("8", 0.75, 1), N("16", 0.25)];
    if (pat === "nnrr") return [N("16", 0.25), N("16", 0.25), R("8", 0.5)];
    if (pat === "rrnn") return [R("8", 0.5), N("8", 0.5)];
    if (pat === "nrrr") return [N("q", 1)];

    return beat;
  }

  function normalizeEighthRestEighth(beat) {
    const eps = 1e-6;
    if (!beat || beat._tuplet) return beat;

    const N = (dur, beats, dots = 0) => ({ kind: "note", dur, beats, dots });
    const R = (dur, beats, dots = 0) => ({ kind: "rest", dur, beats, dots });

    const is16r = (e) => e && e.kind === "rest" && e.dur === "16" && Math.abs((e.beats ?? 0) - 0.25) < eps && !e.dots;
    const is16n = (e) => e && e.kind === "note" && e.dur === "16" && Math.abs((e.beats ?? 0) - 0.25) < eps && !e.dots;
    const is8r  = (e) => e && e.kind === "rest" && e.dur === "8"  && Math.abs((e.beats ?? 0) - 0.5)  < eps && !e.dots;

    const out = beat.map((e) => ({ ...e }));

    if (out.length >= 2 && is16r(out[0]) && is16r(out[1])) {
      out.splice(0, 2, R("8", 0.5));
    }

    const L = out.length;
    if (L >= 2 && is16r(out[L - 2]) && is16r(out[L - 1])) {
      out.splice(L - 2, 2, R("8", 0.5));
    }

    if (out.length === 3 && is8r(out[0]) && is16n(out[1]) && is16n(out[2])) {
      return [out[0], N("8", 0.5)];
    }

    return out;
  }

  function absorbRestsInBeat(beat) {
    if (beat && beat._tuplet) return beat;
    const out = beat.map((e) => ({ ...e }));

    for (let i = 0; i < out.length; i++) {
      const e = out[i];
      if (e.kind !== "note") continue;

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

      if (hasDottedRest && newDur === "q") {
        e.beats = 1;
        e.dur = "q";
        e.dots = 0;
        out.splice(i + 1, j - (i + 1)); 
        continue;
      }

      if (!hasDottedRest && (newDur === "8" || newDur === "q")) {
        e.beats = total;
        e.dur = newDur;
        out.splice(i + 1, j - (i + 1));
      }
    }
    return out;
  }

  function collapseAllRestBeatToQuarter(beat) {
    if (!beat || beat.length === 0) return beat;
    if (!beat.every((e) => e.kind === "rest")) return beat;
    return [{ kind: "rest", dur: "q", beats: 1 }];
  }

  function mergeTripletBeatClean(beat) {
    if (!beat || !beat._tuplet) return beat;
    const pat = beat.map((e) => (e.kind === "note" ? "n" : "r")).join("");

    if (pat === "rrr") return [{ kind: "rest", dur: "q", beats: 1 }];
    if (pat === "nrr") return [{ kind: "note", dur: "q", beats: 1 }];

    if (pat === "rnr") {
      const out = [{ kind: "rest", dur: "8", beats: 1 / 3 }, { kind: "note", dur: "q", beats: 2 / 3 }];
      out._tuplet = beat._tuplet;
      return out;
    }
    if (pat === "rrn") {
      const out = [{ kind: "rest", dur: "q", beats: 2 / 3 }, { kind: "note", dur: "8", beats: 1 / 3 }];
      out._tuplet = beat._tuplet;
      return out;
    }
    if (pat === "nrn") {
      const out = [{ kind: "note", dur: "q", beats: 2 / 3 }, { kind: "note", dur: "8", beats: 1 / 3 }];
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
      if (flow.Dot?.buildAndAttach) {
        for (let i = 0; i < dots; i++) flow.Dot.buildAndAttach([note], { all: true });
      } else if (note.addDotToAll) {
        for (let i = 0; i < dots; i++) note.addDotToAll();
      } else if (note.addDot) {
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
      
      let pos = 0;
      for (let i = 0; i < beat.length; i++) {
        vfNotes[i].__beatPos = beatIdx + pos;
        pos += Number(beat[i]?.beats || 0);
      }
      notes.push(...vfNotes);

      const isTripletBeat = !!beat._tuplet;

      if (isTripletBeat) {
        for (let i = 0; i < beat.length; i++) {
          if (beat[i]?.kind === "rest") vfNotes[i].__tripletRest = true;
        }
        for (let i = 0; i < vfNotes.length; i++) {
          const n = vfNotes[i];
          if (n && typeof n.isRest === "function" && n.isRest()) {
            n.setKeyLine?.(0, 3);
            n.setYShift?.(-6);
          }
        }
        // No bracket if full triplet
        const isFullTriplet = (beat.length === 3) && beat.every(e => e.kind === "note");
        tuplets.push(new flow.Tuplet(vfNotes, {
          ...beat._tuplet,
          bracketed: !isFullTriplet, 
          ratioed: false,
        }));
      }

      // Pro Beaming
      let group = [];
      let groupDur = null;
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
        const isTuplet = !!beat._tuplet; 
        const isBeamable8 = !isTuplet && elem.dur === "8";
        const isBeamable16 = !isTuplet && elem.dur === "16";

        if (isNote && (isBeamable8 || isBeamable16)) {
          if (!groupDur) groupDur = elem.dur;
          group.push(note);
        } else {
          flushGroup(); 
        }
      }
      flushGroup(); 

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
            flushTripGroup();
          }
        }
        flushTripGroup();
      }
    }

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

    const BASE = 170 * SHEET_DENSITY;
    const PER_NOTE = 18 * SHEET_DENSITY;
    const PER_TUPLET = 26 * SHEET_DENSITY;
    const firstPad = (isFirstMeasure ? 70 : 0) * SHEET_DENSITY;

    const minW = BASE + pack.notes.length * PER_NOTE + pack.tuplets.length * PER_TUPLET + firstPad;
    return { ...pack, voice, minW: Math.ceil(minW) };
  }

  function render(exercise) {
    const flow = VF();
    if (!(scoreEl instanceof HTMLCanvasElement)) throw new Error("Canvas needed");

    const totalMeasures = exercise.length;
    const packs = exercise.map((mm, i) => packMeasure(flow, mm, i === 0));
    const rectW = Math.floor(scoreWrapEl.getBoundingClientRect().width || 0);
    const MIN_CANVAS_W = 600;
    const marginX = 20;
    const marginY = 18;
    const lineGap = 120;
    const PREFERRED_PER_LINE = 6;
    const MIN_MEASURE_W = 150;

    let wrapW = Math.max(MIN_CANVAS_W, rectW - 24);
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
    while (measuresPerLine > 1) {
      const needed = maxLineMinSum(measuresPerLine);
      if (needed <= usableW && (usableW / measuresPerLine) >= MIN_MEASURE_W) break;
      measuresPerLine--;
    }
    measuresPerLine = Math.max(1, measuresPerLine);

    const lines = Math.ceil(totalMeasures / measuresPerLine);
    const height = marginY * 2 + lines * lineGap;
    const wrapBoxW = Math.floor(scoreWrapEl.getBoundingClientRect().width || 0);
    const displayW = Math.max(320, wrapBoxW - 24);
    const scale = Math.min(1, displayW / wrapW);

    const physW = Math.max(1, Math.floor(wrapW * scale));
    const physH = Math.max(1, Math.floor(height * scale));

    lastRenderScale = scale;

    if (playheadEl instanceof HTMLCanvasElement) {
      playheadEl.width = physW;
      playheadEl.height = physH;
      playheadEl.style.width = physW + "px";
      playheadEl.style.height = physH + "px";
    }
    layoutMeasures = []; 
    clearPlayhead();

    const renderer = new flow.Renderer(scoreEl, flow.Renderer.Backends.CANVAS);
    renderer.resize(physW, physH);
    scoreEl.style.width = physW + "px";
    scoreEl.style.height = physH + "px";
    scoreEl.style.verticalAlign = "top";

    scoreWrapEl.style.position = "relative";
    if (playheadEl instanceof HTMLCanvasElement) {
      playheadEl.style.position = "absolute";
      playheadEl.style.pointerEvents = "none";
      playheadEl.width = scoreEl.width;
      playheadEl.height = scoreEl.height;
      playheadEl.style.width = scoreEl.style.width;
      playheadEl.style.height = scoreEl.style.height;
      playheadEl.style.left = scoreEl.offsetLeft + "px";
      playheadEl.style.top = scoreEl.offsetTop + "px";
      syncPlayheadOverlayPosition();
    }

    const ctx = renderer.getContext();
    ctx.setFont("Arial", 10, "");

    if (ctx && ctx.clearRect) ctx.clearRect(0, 0, physW, physH);
    if (ctx && ctx.context && ctx.context.clearRect) ctx.context.clearRect(0, 0, physW, physH);

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
      const lineStart = m;
      const lineEnd = Math.min(totalMeasures, lineStart + measuresPerLine);
      const mins = [];
      let sumMin = 0;
      for (let i = lineStart; i < lineEnd; i++) {
        const w = packs[i].minW;
        mins.push(w);
        sumMin += w;
      }

      const extra = Math.max(0, usableW - sumMin);
      const widths = mins.slice();
      if (extra > 0) {
        const weightSum = sumMin || 1;
        for (let i = 0; i < widths.length; i++) {
          widths[i] = Math.floor(widths[i] + (extra * (mins[i] / weightSum)));
        }
        let diff = usableW - widths.reduce((a, b) => a + b, 0);
        let k = 0;
        while (diff > 0) { widths[k % widths.length]++; diff--; k++; }
      }

      let x = marginX;
      for (let col = 0; col < widths.length; col++) {
        if (m >= totalMeasures) break;

        const w = widths[col];
        const stave = new flow.Stave(x, y, w);
        const x0 = (typeof stave.getNoteStartX === "function") ? stave.getNoteStartX() : (x + 20);
        const staveTopY = (typeof stave.getYForLine === "function") ? (stave.getYForLine(0)) : (y + 10);
        const staveBotY = (typeof stave.getYForLine === "function") ? (stave.getYForLine(4)) : (y + 50);

        const V_PADDING = 10; 
        const topY = staveTopY - V_PADDING;
        const botY = staveBotY + V_PADDING;

        layoutMeasures[m] = { x0, x1: x0, topY, botY, staveTopY, staveBotY }; 

        if (stave.setStyle) stave.setStyle({ strokeStyle: "#000", fillStyle: "#000" });
        if (m === 0 && line === 0 && col === 0) {
          stave.addClef("percussion").addTimeSignature("4/4");
        }
        stave.setContext(ctx).draw();

        const pack = packs[m];
        const { beams, tuplets, voice } = pack;

        if (voice.setContext) voice.setContext(ctx);
        if (voice.setStave) voice.setStave(stave);
        pack.notes.forEach((n) => {
          n.setContext(ctx);
          if (n.setStave) n.setStave(stave);
        });

        const TRIPLET_REST_NUDGE_PX = 0;
        pack.notes.forEach((n) => {
          if (!n?.__tripletRest) return;
          const y = (typeof stave.getYForLine === "function") ? stave.getYForLine(3) : null;
          if (y != null && typeof n.setYs === "function") n.setYs([y + TRIPLET_REST_NUDGE_PX]);
        });

        const formatter = new flow.Formatter();
        const makeGhost = (dur) => {
          try { return new flow.GhostNote({ duration: dur }); }
          catch { return new flow.GhostNote(dur); }
        };
        const guideNotes = [makeGhost("q"), makeGhost("q"), makeGhost("q"), makeGhost("q")];
        const guideVoice = new flow.Voice({ num_beats: 4, beat_value: 4 }).setStrict(false);
        guideVoice.addTickables(guideNotes);

        if (guideVoice.setContext) guideVoice.setContext(ctx);
        if (guideVoice.setStave) guideVoice.setStave(stave);
        guideNotes.forEach((n) => { n.setContext?.(ctx); n.setStave?.(stave); });

        formatter.joinVoices([voice, guideVoice]);
        if (typeof formatter.formatToStave === "function") {
          formatter.formatToStave([voice, guideVoice], stave);
        } else {
          const startX = typeof stave.getNoteStartX === "function" ? stave.getNoteStartX() : (x + 20);
          const endX   = typeof stave.getNoteEndX === "function"   ? stave.getNoteEndX()   : (x + w - 20);
          const avail = Math.max(60, (endX - startX) - 10);
          formatter.format([voice, guideVoice], avail);
        }

        const gx = guideNotes.map((n) =>
          (typeof n.getAbsoluteX === "function") ? n.getAbsoluteX()
          : (n.getTickContext?.() ? n.getTickContext().getX() : null)
        );

        const endX = (typeof stave.getNoteEndX === "function") ? stave.getNoteEndX() : (x + w - 20);
        const beatX = [
          gx[0] ?? x0,
          gx[1] ?? null,
          gx[2] ?? null,
          gx[3] ?? null,
          endX
        ];

        const anchors = [];
        anchors.push({ b: 0, x: beatX[0] });
        for (let bi = 1; bi < MEASURE_BEATS; bi++) {
          if (beatX[bi] != null) anchors.push({ b: bi, x: beatX[bi] });
        }

        pack.notes.forEach((n) => {
          const isRest = (typeof n.isRest === "function") ? n.isRest() : false;
          if (isRest) return;
          const b = n.__beatPos;
          if (b == null) return;
          const x = (typeof n.getAbsoluteX === "function") ? n.getAbsoluteX() : (n.getTickContext?.() ? n.getTickContext().getX() : null);
          if (x != null) anchors.push({ b, x });
        });

        anchors.push({ b: 4, x: beatX[4] });
        anchors.sort((a, b) => (a.b - b.b) || (a.x - b.x));
        
        layoutMeasures[m] = { x0: beatX[0], x1: beatX[4], beatX, topY, botY, staveTopY, staveBotY, anchors };

        const TRIPLET_REST_LINE = 3;
        const TRIPLET_REST_NUDGE = 6;
        pack.notes.forEach((n) => {
          if (!n?.__tripletRest) return;
          n.setKeyLine?.(0, TRIPLET_REST_LINE);
          const y = (typeof stave.getYForLine === "function") ? stave.getYForLine(TRIPLET_REST_LINE) + TRIPLET_REST_NUDGE : null;
          if (y != null) {
            if (typeof n.setYs === "function") n.setYs([y]);
            else n.ys = [y];
          }
          if (n.render_options) n.render_options.y_shift = TRIPLET_REST_NUDGE;
        });

        voice.draw(ctx, stave);
        beams.forEach((b) => b.setContext(ctx).draw());
        tuplets.forEach((t) => t.setContext(ctx).draw());

        m++;
        x += w;
      }
    }
    if (raw) raw.restore();
  }












// ---------- Playback ----------
  const MEASURE_BEATS = 4;
   
  // SINGLETON AUDIO STATE (Fixes the "Ghost Player" glitch)
  let audioCtx = null; 
  let isPlaying = false;
  let isPaused = false;
  let schedulerTimer = null; // We use setTimeout now, not setInterval

  // Timing / Sync
  let lastRenderScale = 1;
  let layoutMeasures = []; 
  let playRunId = 0;
  let playheadRAF = null;
   
  // Audio Scheduling State
  let nextBeatIndex = 0;
  let nextNoteTime = 0; // AUDIO CLOCK MASTER
  let totalBeatsScheduled = 0;
  let eventsByBeat = []; 

  // Dynamic Playhead State (Accumulator)
  let playbackBeat = 0;   
  let lastAudioTime = 0; 

  function syncPlayheadOverlayPosition() {
    if (!(playheadEl instanceof HTMLCanvasElement)) return;
    playheadEl.style.left = "0px";
    playheadEl.style.top  = "0px";
  }

  function clearPlayhead() {
    if (!(playheadEl instanceof HTMLCanvasElement)) return;
    const c = playheadEl.getContext("2d");
    if (!c) return;
    c.clearRect(0, 0, playheadEl.width, playheadEl.height);
  }

  function xFromAnchors(geom, localBeat) {
    const a = geom?.anchors;
    if (!a || a.length < 2) {
      const bx = geom.beatX || [geom.x0, null, null, null, geom.x1];
      const b0 = Math.max(0, Math.min(MEASURE_BEATS - 1, Math.floor(localBeat)));
      const frac = Math.max(0, Math.min(1, localBeat - b0));
      const x0 = bx[b0] ?? geom.x0;
      const x1 = bx[b0 + 1] ?? geom.x1;
      return x0 + (x1 - x0) * frac;
    }
    let i = 0;
    while (i + 1 < a.length && a[i + 1].b <= localBeat + 1e-9) i++;
    const A = a[i];
    const B = a[Math.min(i + 1, a.length - 1)];
    if (!B || B.b === A.b) return A.x;
    const f = (localBeat - A.b) / (B.b - A.b);
    return A.x + (B.x - A.x) * Math.max(0, Math.min(1, f));
  }

  function drawPlayheadAtBeat(beatPos) {
    if (!(playheadEl instanceof HTMLCanvasElement)) return;
    const ctx = playheadEl.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, playheadEl.width, playheadEl.height);

    const visibleBeat = Math.max(0, beatPos);
    let mIdx = Math.floor(visibleBeat / MEASURE_BEATS); 
    if (mIdx >= layoutMeasures.length && mIdx > 0) {
      mIdx = layoutMeasures.length - 1;
    }

    const geom = layoutMeasures[mIdx];
    if (!geom) return;

    let localBeat = visibleBeat - mIdx * MEASURE_BEATS;
    if (visibleBeat >= (mIdx + 1) * MEASURE_BEATS) {
        localBeat = MEASURE_BEATS; 
    }

    const s = lastRenderScale || 1;
    const currentX = xFromAnchors(geom, localBeat) * s;
     
    let y0 = Math.max(0, geom.topY * s);
    let y1 = Math.min(playheadEl.height, geom.botY * s);

    const halfWidth = 2.5;
    const clampedX = Math.max(halfWidth, Math.min(playheadEl.width - halfWidth, currentX));

    if (scoreWrapEl) {
        const scrollT = scoreWrapEl.scrollTop;
        const wrapH = scoreWrapEl.clientHeight;
        if (y0 < scrollT || y1 > scrollT + wrapH) {
            scoreWrapEl.scrollTop = y0 - 20; 
        }
        syncPlayheadOverlayPosition();
    }

    ctx.save();
    ctx.globalAlpha = 0.92;
    ctx.strokeStyle = "#fe6429";
    ctx.lineWidth = 5; 
    ctx.lineCap = "round"; 
    ctx.shadowColor = "rgba(254,100,41,0.45)";
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.moveTo(clampedX, y0);
    ctx.lineTo(clampedX, y1);
    ctx.stroke();
    ctx.restore();
  }
 
  // --- Animation Loop ---
  function startPlayheadLoop(runId) {
    if (!(playheadEl instanceof HTMLCanvasElement)) return;
    if (!audioCtx) return;

    cancelAnimationFrame(playheadRAF || 0);

    const tick = () => {
      if (!isPlaying || !audioCtx || isPaused) return;
      if (runId !== playRunId) return;

      const now = audioCtx.currentTime;
      const dt = now - lastAudioTime;
      lastAudioTime = now;

      // Visuals follow the same tempo math, but errors don't affect audio now
      const tempoNow = Math.max(40, Math.min(220, Number(tempoEl.value) || 120));
      const spb = 60 / tempoNow;

      playbackBeat += dt / spb;

      if (playbackBeat >= totalBeatsScheduled + END_BUFFER_BEATS) {
        stop();
        return;
      }

      drawPlayheadAtBeat(playbackBeat);

      if (progressBar) {
        const total = totalBeatsScheduled;
        const current = Math.min(Math.max(0, playbackBeat), total);
        const pct = (total > 0) ? (current / total) * 100 : 0;
        progressBar.style.width = pct + "%";
      }

      playheadRAF = requestAnimationFrame(tick);
    };

    playheadRAF = requestAnimationFrame(tick);
  }

  // --- Audio Utilities ---
  function clickAt(time, freq, gain, dur) {
    if (!audioCtx) return;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = "square";
    o.frequency.setValueAtTime(freq, time);
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(gain, time + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    o.connect(g).connect(audioCtx.destination);
    o.start(time);
    o.stop(time + dur + 0.05);
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

  // --- Audio Scheduler (Recursive Timeout - Glitch Free) ---
  function scheduleBeats() {
    if (!isPlaying || isPaused || !audioCtx) return;

    const TICK_MS = 50; 
    const LOOKAHEAD = 1.0; 
    const currentRunId = playRunId; // Closure capture

    const tempoNow = Math.max(40, Math.min(220, Number(tempoEl.value) || 120));
    const spb = 60 / tempoNow;

    while (nextNoteTime < audioCtx.currentTime + LOOKAHEAD) {
      // Lag protection: if behind by >0.2s, skip ahead
      if (nextNoteTime < audioCtx.currentTime - 0.2) {
           nextNoteTime += spb;
           nextBeatIndex++;
           continue; 
      }

      if (nextBeatIndex < totalBeatsScheduled) {
           const isDownbeat = (nextBeatIndex % MEASURE_BEATS === 0);
           
           // Metronome
           clickAt(nextNoteTime, isDownbeat ? 1200 : 900, isDownbeat ? 0.15 : 0.08, 0.03);

           // Notes
           if (nextBeatIndex >= 0 && nextBeatIndex < eventsByBeat.length) {
             const beatNotes = eventsByBeat[nextBeatIndex] || [];
             for (const n of beatNotes) {
               const noteTime = nextNoteTime + (n.offset * spb);
               if (noteTime > audioCtx.currentTime - 0.05) {
                  clickAt(noteTime, 650, 0.07, 0.03);
               }
             }
           }
      }

      nextNoteTime += spb;
      nextBeatIndex++;
    }

    // Schedule next check (Recursion)
    schedulerTimer = window.setTimeout(() => {
        if (playRunId === currentRunId) {
            scheduleBeats();
        }
    }, TICK_MS);
  }

  // --- Scrubber Logic ---
  function handleScrub(e) {
    if (!currentExercise) return;
    const rect = barContainer.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    let pct = Math.max(0, Math.min(1, clickX / rect.width));
    
    playbackBeat = pct * totalBeatsScheduled;
    nextBeatIndex = Math.ceil(playbackBeat);
    if (audioCtx) {
        nextNoteTime = audioCtx.currentTime + 0.05;
    }

    if (progressBar) progressBar.style.width = (pct * 100) + "%";
    drawPlayheadAtBeat(playbackBeat);
  }

  if (barContainer) {
    barContainer.style.cursor = "pointer";
    barContainer.addEventListener("click", handleScrub);
  }

  function startMusic() {
    if (!currentExercise) return;
    
    // Strict restart if already playing
    if (isPlaying && !isPaused) stop();

    // Singleton Context (Don't destroy/recreate)
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!audioCtx) audioCtx = new AudioContext();

    const { events } = flattenEvents(currentExercise);
    totalBeatsScheduled = currentExercise.length * MEASURE_BEATS;
    const beatsCount = Math.ceil(totalBeatsScheduled + 1e-6);
    eventsByBeat = Array.from({ length: beatsCount }, () => []);
    
    for (const ev of events) {
      if (ev.kind !== "note") continue;
      const b = Math.floor(ev.beat + 1e-9);
      const offset = ev.beat - b;
      if (b >= 0 && b < eventsByBeat.length) eventsByBeat[b].push({ offset });
    }

    // Resume/Unlock
    audioCtx.resume().then(() => {
      // Setup State
      playBtn.disabled = false;
      stopBtn.disabled = false;
      isPlaying = true;
      isPaused = false;
      playRunId++; 
      
      playBtnText.textContent = "Pause";
      setStatus("Playing", "play");

      // Clocks
      lastAudioTime = audioCtx.currentTime;
      playbackBeat = -MEASURE_BEATS; 
      nextBeatIndex = -MEASURE_BEATS;
      nextNoteTime = audioCtx.currentTime + 0.1; 

      // Loops
      if (schedulerTimer) clearTimeout(schedulerTimer);
      scheduleBeats(); 
      startPlayheadLoop(playRunId);

    }).catch(e => {
      console.error(e);
      setStatus("Audio Error");
    });
  }

  function pauseMusic() {
      if (!isPlaying || !audioCtx || isPaused) return;

      if (schedulerTimer) {
        clearTimeout(schedulerTimer);
        schedulerTimer = null;
      }

      audioCtx.suspend().then(() => {
          isPaused = true;
          isPlaying = false;
          playBtnText.textContent = "Play";
          setStatus("Paused", "warn");
      });
  }

  function stop() {
    playRunId++; // Kill ghost schedulers
    
    isPlaying = false;
    isPaused = false;
    
    if (schedulerTimer) {
        clearTimeout(schedulerTimer);
        schedulerTimer = null;
    }

    cancelAnimationFrame(playheadRAF || 0);
    playheadRAF = null;

    playbackBeat = 0; 
    nextBeatIndex = 0;

    playBtn.disabled = false;
    stopBtn.disabled = true;
    playBtnText.textContent = "Play";
    setStatus("Ready");

    clearPlayhead();
    if (progressBar) progressBar.style.width = "0%";
  }

  function togglePlayPause() {
      if (isPlaying && !isPaused) pauseMusic();
      else startMusic();
  }












  // ---------- Wire up ----------
  function regenerate() {
    try {
      stop(); 
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
  playBtn.addEventListener("click", togglePlayPause);
  stopBtn.addEventListener("click", stop);
 
  window.addEventListener("resize", () => {
    if (!currentExercise) return;
    try { render(currentExercise); syncPlayheadOverlayPosition(); } catch (e) { showError(e); }
  });

  tempoValEl.textContent = tempoEl.value;
  restsValEl.textContent = restsEl.value;
  syncSliderFill(tempoEl);
  syncSliderFill(restsEl);

  safeRenderAllIcons();
  regenerate();
})();
