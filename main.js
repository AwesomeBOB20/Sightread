window.addEventListener("DOMContentLoaded", () => {
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

  const SHEET_DENSITY = 0.62; 
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

    // Calculate a rough minimum width based on contents
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
    // We pass 'true' for isFirstMeasure to add padding for the clef/time sig
    const packs = exercise.map((mm, i) => packMeasure(flow, mm, i === 0));

    const rectW = Math.floor(scoreWrapEl.getBoundingClientRect().width || 0);
    const MIN_CANVAS_W = 600;
    
    // Increase margins for a cleaner look
    const marginX = 15; 
    const marginY = 20;
    const lineGap = 140; // More vertical space between systems

    let wrapW = Math.max(MIN_CANVAS_W, rectW - 24);
    let usableW = wrapW - (marginX * 2);

    // --- IMPROVED SPACING LOGIC ---
    // Calculate average minimum width required by the generated notes
    const totalMinW = packs.reduce((sum, p) => sum + p.minW, 0);
    const avgMinW = totalMinW / totalMeasures;

    // Decide measures per line based on content density, not just pixel width
    // We cap it at 3 (or 2 if mobile) to ensure "Spread" look
    let maxMeasuresPerLine = 3; 
    if (usableW < 500) maxMeasuresPerLine = 2; // Mobile check
    
    let measuresPerLine = Math.floor(usableW / (avgMinW * 1.1)); 
    measuresPerLine = Math.max(1, Math.min(measuresPerLine, maxMeasuresPerLine));

    const lines = Math.ceil(totalMeasures / measuresPerLine);
    const height = marginY * 2 + lines * lineGap;

    // High DPI scaling logic
    const displayW = Math.max(320, rectW - 24);
    const scale = Math.min(1, displayW / wrapW);
    const physW = Math.max(1, Math.floor(wrapW * scale));
    const physH = Math.max(1, Math.floor(height * scale));

    lastRenderScale = scale;

    // Resize canvases
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
    
    // Context setup
    const ctx = renderer.getContext();
    ctx.setFont("Arial", 10, "");
    if (ctx.clearRect) ctx.clearRect(0, 0, physW, physH);

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
      const countOnLine = lineEnd - lineStart;
      
      // IMPORTANT: precise width division for evenness
      const widthPerMeasure = usableW / countOnLine;

      let x = marginX;
      for (let i = lineStart; i < lineEnd; i++) {
        if (m >= totalMeasures) break;

        const stave = new flow.Stave(x, y, widthPerMeasure);
        
        // Add Clef/TimeSig only on the very first measure of the piece
        if (m === 0) {
          stave.addClef("percussion").addTimeSignature("4/4");
          // Add padding to the start of the note rendering area
          stave.setNoteStartX(stave.getX() + 50); 
        }

        stave.setContext(ctx).draw();

        const pack = packs[m];
        const { beams, tuplets, voice } = pack;

        // Link VexFlow elements to the stave
        if (voice.setStave) voice.setStave(stave);
        if (voice.setContext) voice.setContext(ctx);

        // --- JUSTIFICATION ---
        // This is what spreads the notes out evenly within the measure box
        const formatter = new flow.Formatter();
        formatter.joinVoices([voice]).formatToStave([voice], stave);

        voice.draw(ctx, stave);
        beams.forEach((b) => b.setContext(ctx).draw());
        tuplets.forEach((t) => t.setContext(ctx).draw());

        // Playhead calculations
        const startX = stave.getNoteStartX();
        const endX = stave.getNoteEndX();
        const topY = y;
        const botY = y + 100; // Fixed height for playhead area

        const anchors = [];
        anchors.push({ b: 0, x: startX });
        anchors.push({ b: 4, x: endX });

        pack.notes.forEach(n => {
          if (typeof n.getAbsoluteX === 'function' && n.__beatPos !== undefined) {
              anchors.push({ b: n.__beatPos, x: n.getAbsoluteX() });
          }
        });
        anchors.sort((a,b) => a.b - b.b);

        layoutMeasures[m] = { x0: startX, x1: endX, topY, botY, anchors };

        m++;
        x += widthPerMeasure;
      }
    }
    if (raw) raw.restore();
    
    if (accumulatedBeat > 0) drawPlayheadAtBeat(accumulatedBeat);
  }


  // ---------- Playback ----------
  const MEASURE_BEATS = 4;
   
  // SINGLETON AUDIO STATE (Fixes the "Ghost Player" glitch)
  let audioCtx = null; 
  let masterGain = null; // Master volume for instant muting
  let isPlaying = false;
  let isPaused = false;
  let schedulerTimer = null; 

  // Timing / Sync
  let lastRenderScale = 1;
  let layoutMeasures = []; 
  let playRunId = 0; // The "Ghost Killer" ID
  let playheadRAF = null;
   
  // Audio Scheduling State
  let nextBeatIndex = 0;
  let nextNoteTime = 0; // AUDIO CLOCK MASTER
  let totalBeatsScheduled = 0;
  let eventsByBeat = []; 

  // Dynamic Playhead State (Differential Math)
  let accumulatedBeat = 0;   // How many beats played BEFORE the last tempo change/resume
  let audioStartTime = 0;    // When the current "chunk" of audio started (AudioContext time)
  let lastTempoVal = 120;    // Tracker for tempo changes

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
      // Fallback linear
      return geom.x0 + (localBeat / 4) * (geom.x1 - geom.x0);
    }
    // Interpolate accurately between note anchors
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
      if (runId !== playRunId) return; // Ghost check

      const now = audioCtx.currentTime;
      // DIFFERENTIAL SYNC:
      // Current Beat = Beats_Before_Swap + (Time_Since_Swap / Seconds_Per_Beat)
      const tempoNow = Math.max(40, Math.min(220, Number(tempoEl.value) || 120));
      const spb = 60 / tempoNow;
      const timeElapsed = now - audioStartTime;
      
      const currentBeat = accumulatedBeat + (timeElapsed / spb);

      if (currentBeat >= totalBeatsScheduled + END_BUFFER_BEATS) {
        stop();
        return;
      }

      drawPlayheadAtBeat(currentBeat);

      if (progressBar) {
        const total = totalBeatsScheduled;
        const disp = Math.min(Math.max(0, currentBeat), total);
        const pct = (total > 0) ? (disp / total) * 100 : 0;
        progressBar.style.width = pct + "%";
      }

      playheadRAF = requestAnimationFrame(tick);
    };

    playheadRAF = requestAnimationFrame(tick);
  }

  // --- Audio Utilities ---
  function clickAt(time, freq, gain, dur) {
    if (!audioCtx || !masterGain) return;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = "square";
    o.frequency.setValueAtTime(freq, time);
    
    // Connect to MASTER GAIN (for instant mute)
    o.connect(g).connect(masterGain); 
    
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(gain, time + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    o.start(time);
    o.stop(time + dur + 0.05);
  }

  function flattenEvents(exercise) {
    // Robust Flattening Logic:
    // Create an array of arrays, one for each beat index in the song
    const totalBeats = exercise.length * 4;
    const events = Array.from({ length: totalBeats }, () => []);
    
    let globalBeatIndex = 0;
    
    exercise.forEach(measure => {
        measure.beats.forEach(beatGroup => {
            // beatGroup is an array of note objects for this beat
            // We assume standard VexFlow timing within the beat
            let posInBeat = 0;
            beatGroup.forEach(note => {
               if (note.kind === 'note') {
                   // Calculate offset from the start of the beat (0.0 to 0.99)
                   events[globalBeatIndex].push({ offset: posInBeat });
               }
               posInBeat += note.beats; 
            });
            globalBeatIndex++;
        });
    });
    
    return { eventsByBeat: events, totalBeats };
  }

  // --- Audio Scheduler (Recursive Timeout - Glitch Free) ---
  function scheduleBeats() {
    if (!isPlaying || isPaused || !audioCtx) return;

    const TICK_MS = 50; 
    const LOOKAHEAD = 0.5; // Short lookahead for responsiveness
    const currentRunId = playRunId; 

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
           
           // Metronome Click
           clickAt(nextNoteTime, isDownbeat ? 1200 : 900, isDownbeat ? 0.15 : 0.08, 0.03);

           // Rhythm Notes
           if (nextBeatIndex >= 0 && nextBeatIndex < eventsByBeat.length) {
             const beatNotes = eventsByBeat[nextBeatIndex] || [];
             for (const n of beatNotes) {
               const noteTime = nextNoteTime + (n.offset * spb);
               // Only schedule if it hasn't passed drastically
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
    
    // Force Sync
    accumulatedBeat = pct * totalBeatsScheduled;
    
    if (isPlaying && audioCtx) {
        // Instant Audio Re-Sync
        const now = audioCtx.currentTime;
        const spb = 60 / Math.max(40, Math.min(220, Number(tempoEl.value) || 120));
        
        // Reset differential timer
        audioStartTime = now;
        
        // Align scheduler
        nextBeatIndex = Math.ceil(accumulatedBeat);
        // Time of next beat = Now + (Fraction remaining * spb)
        nextNoteTime = now + ((nextBeatIndex - accumulatedBeat) * spb);
    }

    if (progressBar) progressBar.style.width = (pct * 100) + "%";
    drawPlayheadAtBeat(accumulatedBeat);
  }

  if (barContainer) {
    barContainer.style.cursor = "pointer";
    barContainer.addEventListener("click", handleScrub);
  }

  function startMusic(isResuming = false) {
    if (!currentExercise) return;
    
    if (!isResuming && isPlaying && !isPaused) stop();

    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!audioCtx) audioCtx = new AudioContext();

    // Init Master Gain for instant mute capability
    if (!masterGain) {
        masterGain = audioCtx.createGain();
        masterGain.connect(audioCtx.destination);
    }
    
    // Pre-calculate Events
    const flat = flattenEvents(currentExercise);
    eventsByBeat = flat.eventsByBeat;
    totalBeatsScheduled = flat.totalBeats;

    // Webflow/Chrome policy: Must resume if suspended
    audioCtx.resume().then(() => {
      // Setup State
      playBtn.disabled = false;
      stopBtn.disabled = false;
      isPlaying = true;
      isPaused = false;
      playRunId++; // Kill any ghosts
      
      playBtnText.textContent = "Pause";
      setStatus("Playing", "play");

      // Unmute
      masterGain.gain.cancelScheduledValues(0);
      masterGain.gain.setValueAtTime(1, audioCtx.currentTime);

      const tempoNow = Math.max(40, Math.min(220, Number(tempoEl.value) || 120));
      const spb = 60 / tempoNow;
      lastTempoVal = tempoNow;

      if (isResuming) {
        // --- RESUME LOGIC ---
        // We start the timer NOW. 
        // accumulatedBeat already holds where we were.
        audioStartTime = audioCtx.currentTime;
        
        nextBeatIndex = Math.ceil(accumulatedBeat);
        nextNoteTime = audioStartTime + ((nextBeatIndex - accumulatedBeat) * spb);
      } else {
        // --- FRESH START LOGIC ---
        accumulatedBeat = -MEASURE_BEATS; // Count-in
        audioStartTime = audioCtx.currentTime;
        
        nextBeatIndex = -MEASURE_BEATS;
        nextNoteTime = audioCtx.currentTime + 0.1; 
      }

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

      // 1. Instant Mute (Critical for responsiveness)
      if (masterGain) {
          masterGain.gain.cancelScheduledValues(0);
          masterGain.gain.setValueAtTime(0, audioCtx.currentTime);
      }

      // 2. Freeze Math (Bake current time into accumulatedBeat)
      const now = audioCtx.currentTime;
      const spb = 60 / lastTempoVal;
      accumulatedBeat += (now - audioStartTime) / spb;

      if (schedulerTimer) {
        clearTimeout(schedulerTimer);
        schedulerTimer = null;
      }

      // 3. Suspend (optional, but good for saving battery on mobile)
      audioCtx.suspend().then(() => {
          isPaused = true;
          isPlaying = false;
          playBtnText.textContent = "Play";
          setStatus("Paused", "warn");
      });
  }

  function stop() {
    playRunId++; // Kill ghosts
    
    isPlaying = false;
    isPaused = false;
    
    if (schedulerTimer) clearTimeout(schedulerTimer);
    if (masterGain && audioCtx) masterGain.gain.setValueAtTime(0, audioCtx.currentTime);

    cancelAnimationFrame(playheadRAF || 0);
    playheadRAF = null;

    accumulatedBeat = 0; 
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
      else startMusic(isPaused);
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

  // TEMPO HOT SWAP (Differential Math)
  tempoEl.addEventListener("input", () => {
    tempoValEl.textContent = tempoEl.value;
    syncSliderFill(tempoEl);
    
    if (isPlaying && !isPaused && audioCtx) {
        const now = audioCtx.currentTime;
        const newTempo = Math.max(40, Math.min(220, Number(tempoEl.value) || 120));
        
        // 1. Calculate how much we progressed at the OLD tempo
        const oldSpb = 60 / lastTempoVal;
        const elapsed = now - audioStartTime;
        accumulatedBeat += (elapsed / oldSpb);
        
        // 2. Reset the timer to NOW
        audioStartTime = now;
        
        // 3. Update Tempo ref
        lastTempoVal = newTempo;
        
        // 4. Re-align Scheduler
        // We do NOT change accumulatedBeat here, we just change how fast we add to it
        const newSpb = 60 / newTempo;
        nextBeatIndex = Math.ceil(accumulatedBeat);
        nextNoteTime = now + ((nextBeatIndex - accumulatedBeat) * newSpb);
    } else {
        lastTempoVal = Math.max(40, Math.min(220, Number(tempoEl.value) || 120));
    }
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
    try { 
        render(currentExercise); 
        syncPlayheadOverlayPosition(); 
        if (accumulatedBeat > 0) drawPlayheadAtBeat(accumulatedBeat);
    } catch (e) { showError(e); }
  });

  tempoValEl.textContent = tempoEl.value;
  restsValEl.textContent = restsEl.value;
  syncSliderFill(tempoEl);
  syncSliderFill(restsEl);

  safeRenderAllIcons();
  regenerate();
});
