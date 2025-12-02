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
  const regenBtn = $("regen");
  const playBtn = $("play");
  const stopBtn = $("stop");
  const statusEl = $("status");
  const errorEl = $("error");
  const scoreEl = $("score");
  const scoreWrapEl = $("scoreWrap");

  function setStatus(msg) { statusEl.textContent = msg; }
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

  // ---------- Rhythm model ----------
  function chance(pct) {
    return Math.random() * 100 < pct;
  }

  function pickBeatPattern({ restPct, allowTriplets }) {
    const options = allowTriplets ? ["q", "8s", "16s", "8t"] : ["q", "8s", "16s"];
    const r = Math.random();
    const choice =
      options.length === 4
        ? (r < 0.33 ? "8s" : r < 0.58 ? "16s" : r < 0.80 ? "q" : "8t")
        : (r < 0.40 ? "8s" : r < 0.70 ? "16s" : "q");

    const make = (dur, beats) => ({
      kind: chance(restPct) ? "rest" : "note",
      dur,
      beats,
    });

    if (choice === "q") return [make("q", 1)];
    if (choice === "8s") return [make("8", 0.5), make("8", 0.5)];
    if (choice === "16s") return [make("16", 0.25), make("16", 0.25), make("16", 0.25), make("16", 0.25)];

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

  function absorbRestsInBeat(beat) {
    // Skip tuplets entirely
    if (beat && beat._tuplet) return beat;

    const out = beat.map((e) => ({ ...e }));

    for (let i = 0; i < out.length; i++) {
      const e = out[i];
      if (e.kind !== "note") continue;

      // Sum consecutive rests after this note
      let j = i + 1;
      let restSum = 0;
      while (j < out.length && out[j].kind === "rest") {
        restSum += out[j].beats;
        j++;
      }
      if (restSum <= 0) continue;

      const total = e.beats + restSum;
      const newDur = durFromBeats(total);

      // Only absorb if it becomes a clean duration we support
      if (newDur === "8" || newDur === "q") {
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

    const b = beat.map((e) => ({ ...e })); // clone elems
    const pat = b.map((e) => (e.kind === "note" ? "n" : "r")).join("");

    // r r r -> quarter rest (drop tuplet entirely)
    if (pat === "rrr") {
      return [{ kind: "rest", dur: "q", beats: 1 }];
    }

    // r n r -> 8th rest, then quarter note (still triplet beat)
    if (pat === "rnr") {
      const out = [
        { kind: "rest", dur: "8", beats: 1 / 3 },
        { kind: "note", dur: "q", beats: 2 / 3 },
      ];
      out._tuplet = beat._tuplet;
      return out;
    }

    // r r n -> quarter rest, then 8th note (still triplet beat)
    if (pat === "rrn") {
      const out = [
        { kind: "rest", dur: "q", beats: 2 / 3 },
        { kind: "note", dur: "8", beats: 1 / 3 },
      ];
      out._tuplet = beat._tuplet;
      return out;
    }

    // n r r -> collapse to a plain quarter note (drop tuplet entirely)
    if (pat === "nrr") {
      return [{ kind: "note", dur: "q", beats: 1 }];
    }

    // n r n -> quarter note, then 8th note (still triplet beat)
    if (pat === "nrn") {
      const out = [
        { kind: "note", dur: "q", beats: 2 / 3 },
        { kind: "note", dur: "8", beats: 1 / 3 },
      ];
      out._tuplet = beat._tuplet;
      return out;
    }

    // n n r and r n n: leave as-is (no merging rests into notes here)
    return beat;
  }

  function generateExercise({ measures, restPct, allowTriplets }) {
    const out = [];
    for (let m = 0; m < measures; m++) {
      const beats = [];
      for (let b = 0; b < 4; b++) {
        let beat = pickBeatPattern({ restPct, allowTriplets });
        beat = absorbRestsInBeat(beat);
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

    // Base durations only: "q" | "8" | "16"
    const base = elem.dur; 
    const duration = isRest ? (base + "r") : base;

    const note = new flow.StaveNote({
      clef: "percussion",
      keys: isRest ? ["b/4"] : ["c/5"],
      duration,
    });

    if (isRest) note.setKeyLine(0, 3);

    // Apply dots (dotted 8th / dotted quarter)
    const dots = Math.max(0, Number(elem.dots || 0));
    if (dots > 0) {
      for (let i = 0; i < dots; i++) {
        if (typeof note.addDotToAll === "function") note.addDotToAll();
        else if (typeof note.addDot === "function") note.addDot(0);
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
        if (group.length >= 2 && groupDur) {
          if (groupDur === "8") {
            group.forEach((n) => n.setStemDirection(flow.Stem.UP));
            const beam = new flow.Beam(group, false);
            if (beam.setBeamDirection) beam.setBeamDirection(flow.Stem.UP);
            beams.push(beam);
          } else if (groupDur === "16") {
            // Force stems UP before auto-beaming tries to decide for us
            group.forEach((n) => n.setStemDirection(flow.Stem.UP));

            flow.Beam.generateBeams(group, {
              stem_direction: flow.Stem.UP,
              maintain_stem_directions: true,
            }).forEach((b) => {
              if (b.setBeamDirection) b.setBeamDirection(flow.Stem.UP);
              beams.push(b);
            });
          }
        }
        group = [];
        groupDur = null;
      }

      for (let i = 0; i < beat.length; i++) {
        const elem = beat[i];
        const note = vfNotes[i];

        const isNote = elem.kind === "note";
        const isTuplet = !!beat._tuplet; // whole beat is tuplet
        const isBeamable8 = !isTuplet && elem.dur === "8" && !elem.dots;
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
    voice.setStrict(true);
    voice.addTickables(pack.notes);

    const fmt = new flow.Formatter().joinVoices([voice]);

    // Correct API order:
    // - preCalculateMinTotalWidth([voice]) computes and caches min width
    // - getMinTotalWidth() ONLY works after that (and takes NO args)
    let min = 0;

    if (typeof fmt.preCalculateMinTotalWidth === "function") {
      min = fmt.preCalculateMinTotalWidth([voice]);
    } else {
      // fallback: run a 0-width format pass (sets minTotalWidth internally)
      fmt.format([voice], 0);
      min = fmt.getMinTotalWidth();
    }

    const PAD = 40 + pack.tuplets.length * 18 + (isFirstMeasure ? 70 : 0);

    return { ...pack, voice, minW: Math.ceil(min + PAD) };
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

        const formatter = new flow.Formatter().joinVoices([voice]);

        // Format using the *real* note area inside this stave (prevents overflow)
        if (typeof formatter.formatToStave === "function") {
          formatter.formatToStave([voice], stave);
        } else {
          const startX = typeof stave.getNoteStartX === "function" ? stave.getNoteStartX() : (x + 20);
          const endX   = typeof stave.getNoteEndX === "function"   ? stave.getNoteEndX()   : (x + w - 20);
          const avail = Math.max(60, (endX - startX) - 10);
          formatter.format([voice], avail);
        }

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
    isPlaying = true;
    playBtn.disabled = true;
    stopBtn.disabled = false;
    setStatus("Playing…");

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
    setStatus("Ready.");
  }

  // ---------- Wire up ----------
  function regenerate() {
    try {
      clearError();

      const measures = Math.max(1, Math.min(32, Math.round(Number(measuresEl.value) || 8)));
      const restPct = Math.max(0, Math.min(60, Math.round(Number(restsEl.value) || 0)));
      const allowTriplets = !!allowTripletsEl.checked;

      currentExercise = generateExercise({ measures, restPct, allowTriplets });
      render(currentExercise);
      setStatus(`Generated ${measures} measures.`);
    } catch (e) {
      showError(e);
      setStatus("Render failed (see error box).");
    }
  }

  tempoEl.addEventListener("input", () => (tempoValEl.textContent = tempoEl.value));
  restsEl.addEventListener("input", () => (restsValEl.textContent = restsEl.value));

  regenBtn.addEventListener("click", regenerate);
  playBtn.addEventListener("click", play);
  stopBtn.addEventListener("click", stop);

  window.addEventListener("resize", () => {
    if (!currentExercise) return;
    try { render(currentExercise); } catch (e) { showError(e); }
  });

  tempoValEl.textContent = tempoEl.value;
  restsValEl.textContent = restsEl.value;
  regenerate();
})();
