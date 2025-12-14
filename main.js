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
  const allowQuarterTripletsEl = $("allowQuarterTriplets");
  const allowQuintupletsEl = $("allowQuintuplets");
  const allowSextupletsEl = $("allowSextuplets"); // NEW
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
  // FIX: Fallback to the button itself if the text span is missing
  const playBtnText = $("playBtnText") || playBtn; 
  const progressBar = $("progressBar");
  const barContainer = $$(".bar");
  
  // NEW: Time Elements
  const currentTimeEl = $("currentTime");
  const totalTimeEl = $("totalTime");

  const SHEET_DENSITY = 0.28; 
  const END_BUFFER_BEATS = 0.25;

  function syncSliderFill(input) {
    const min = Number(input.min || 0);
    const max = Number(input.max || 100);
    const val = Number(input.value || 0);
    const pct = max === min ? 0 : ((val - min) / (max - min)) * 100;
    
    // Set BOTH variables to ensure compatibility with all CSS versions
    input.style.setProperty("--pct", `${pct}%`);
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
  
  // NEW: Time Formatter
  function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }




// 1. GET ELEMENTS FIRST
  const stickingInputEl = $("stickingInput");
  const leadHandToggleEl = $("leadHandToggle"); 
  const showStickingEl = $("showSticking");
  const showCountsEl = $("showCounts");
  const metronomeToggleEl = $("metronomeToggle");

  // 2. FORCE DEFAULTS ON REFRESH
  // Overwrite any browser-cached values to your exact preferences
  if (measuresEl) measuresEl.value = "8";
  if (tempoEl) tempoEl.value = "100";
  if (restsEl) restsEl.value = "20";
  
  if (stickingInputEl) stickingInputEl.value = "Natural";
  if (leadHandToggleEl) leadHandToggleEl.checked = true; // Force Right Hand
  
  if (showStickingEl) showStickingEl.checked = true;
  if (showCountsEl) showCountsEl.checked = true;
  if (metronomeToggleEl) metronomeToggleEl.checked = true;

  // Force Rhythm Tiles ON
  if (allow8thsEl) allow8thsEl.checked = true;
  if (allow16thsEl) allow16thsEl.checked = true;
  if (allowTripletsEl) allowTripletsEl.checked = true;
  if (allowQuarterTripletsEl) allowQuarterTripletsEl.checked = true;
  if (allowQuintupletsEl) allowQuintupletsEl.checked = true;
  // NEW: Force 6-lets ON
  if (allowSextupletsEl) allowSextupletsEl.checked = true;

  // 3. INITIALIZE STATE (Synced to the defaults set above)
  let currentStickingStrategy = "natural";
  let currentLeadHand = "R"; 
  let isStickingVisible = true;
  let currentShowCounts = true;
  let isMetronomeOn = true;  

  // Picker Elements
  const pickerOverlay = $("pickerOverlay");
  const pickerTitle = $("pickerTitle");
  // const pickerSearch = $("pickerSearch"); // REMOVED
  const pickerList = $("pickerList");
  const pickerClose = $("pickerClose");

  // --- PICKER LOGIC (Search Removed + Active State Added) ---
  function showPicker({ theme = 'orange', title = 'Select', getItems, onSelect }) {
      pickerOverlay.classList.remove('picker--orange', 'picker--purple');
      pickerOverlay.classList.add(theme === 'purple' ? 'picker--purple' : 'picker--orange');
      pickerTitle.textContent = title;
      pickerOverlay.hidden = false;
      pickerOverlay.setAttribute('aria-hidden', 'false');
      
      let items = [];
      function render() {
          pickerList.innerHTML = '';
          // Render all items without filtering
          items.forEach((it) => {
              const li = document.createElement('li');
              li.className = 'picker__item';
              
              // NEW: Check if this item matches the current selection to add 'is-active' class
              // We check against the global sticking input value
              if (it.label === $("stickingInput").value) {
                li.classList.add("is-active");
              }
              
              li.textContent = it.label;
              li.addEventListener('click', () => { onSelect(it); closePicker(); });
              pickerList.appendChild(li);
          });
      }
      function closePicker() {
          pickerOverlay.hidden = true;
          pickerOverlay.setAttribute('aria-hidden', 'true');
      }
      items = getItems();
      render();
      pickerClose.onclick = closePicker;
      pickerOverlay.onclick = (e) => { if(e.target === pickerOverlay) closePicker(); };
  }

  // UPDATED Sticking Options (Strategies only, Hands handled by toggle)
  const stickingOptions = [
      { label: "Natural", strategy: "natural" },
      { label: "Alternating", strategy: "alternate" },
      { label: "Doubles", strategy: "doubles" },
      { label: "Paradiddles", strategy: "paradiddle" },
  ];


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
      
      // NEW: Scale down to 85% to fit wide rhythms (like 6-lets)
      const scale = 0.85;
      ctx.scale(scale, scale);

      ctx.setFont("Arial", 10, "");

      const raw = ctx.context || ctx;
      // Clear the larger virtual area
      raw.clearRect(0, 0, W / scale, H / scale);
      raw.fillStyle = "#000";
      raw.strokeStyle = "#000";

      // Create a wider stave in the scaled context
      const stave = new flow.Stave(10, 18, (W / scale) - 20);
      
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

    renderRhythmIcon("quarterTripletIcon", {
      num_beats: 2, beat_value: 4,
      beam: false,
      tuplet: { num_notes: 3, notes_occupied: 2 },
      notes: [{ dur: "q" }, { dur: "q" }, { dur: "q" }],
    });
    
    // NEW: 5-let Icon
    renderRhythmIcon("quintupletIcon", {
      num_beats: 2, beat_value: 4,
      beam: true,
      tuplet: { num_notes: 5, notes_occupied: 4 }, // 5 notes in space of 4 eighths (2 beats)
      notes: [{ dur: "8" }, { dur: "8" }, { dur: "8" }, { dur: "8" }, { dur: "8" }],
    });

    // NEW: 6-let Icon
    renderRhythmIcon("sextupletIcon", {
      num_beats: 1, beat_value: 4,
      beam: true,
      tuplet: { num_notes: 6, notes_occupied: 4 }, // 6 notes in space of 4 16ths (1 beat)
      notes: [{ dur: "16" }, { dur: "16" }, { dur: "16" }, { dur: "16" }, { dur: "16" }, { dur: "16" }],
    });
  }


  // ---------- Rhythm model ----------
  function chance(pct) {
    return Math.random() * 100 < pct;
  }

















function pickBeatPattern({ restPct, allow8ths, allow16ths, allowTriplets, allowQuarterTriplets, allowQuintuplets, allowSextuplets }) {
    const pool = [{ id: "q", w: 0.18 }];
    
    // 1. EIGHTH NOTES
    if (allow8ths) pool.push({ id: "8s", w: 0.38 });

    // 2. SIXTEENTH NOTE FAMILY
    if (allow16ths) {
        pool.push({ id: "16s", w: 0.30 }); 
        pool.push({ id: "8_2x16", w: 0.12 });
        pool.push({ id: "2x16_8", w: 0.12 });
        pool.push({ id: "sync", w: 0.10 });
    }

    // 3. EIGHTH TRIPLETS
    if (allowTriplets) pool.push({ id: "8t", w: 0.20 });

    // 4. QUARTER TRIPLETS (2 Beats)
    if (allowQuarterTriplets) pool.push({ id: "qt", w: 0.15 });

    // 5. QUINTUPLETS (2 Beats)
    if (allowQuintuplets) pool.push({ id: "5let", w: 0.15 });

    // 6. SEXTUPLETS (1 Beat)
    if (allowSextuplets) pool.push({ id: "6let", w: 0.15 });

    // Select
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
    
    // 16ths Family
    if (choice === "16s") return [make("16", 0.25), make("16", 0.25), make("16", 0.25), make("16", 0.25)];
    if (choice === "8_2x16") return [make("8", 0.5), make("16", 0.25), make("16", 0.25)];
    if (choice === "2x16_8") return [make("16", 0.25), make("16", 0.25), make("8", 0.5)];
    if (choice === "sync")   return [make("16", 0.25), make("8", 0.5), make("16", 0.25)];

    // Quarter Triplets (Spans 2 beats)
    if (choice === "qt") {
        const t = [make("q", 2/3), make("q", 2/3), make("q", 2/3)];
        
        // FIX: Ban "Downbeat Only" (Note-Rest-Rest)
        if (t[0].kind === 'note' && t[1].kind === 'rest' && t[2].kind === 'rest') {
             t[1].kind = 'note'; 
        }

        t._tuplet = { num_notes: 3, notes_occupied: 2 };
        return t;
    }

    // Quintuplets (Spans 2 beats)
    if (choice === "5let") {
        // 5 notes in the space of 2 beats. 
        // 2 beats / 5 notes = 0.4 beats per note.
        const t = [
            make("8", 0.4), make("8", 0.4), make("8", 0.4), make("8", 0.4), make("8", 0.4)
        ];
        // 5 notes in the space of 4 eighth notes (which is 2 beats)
        t._tuplet = { num_notes: 5, notes_occupied: 4 };
        return t;
    }

    // Sextuplets (1 Beat)
    if (choice === "6let") {
        // 6 notes in 1 beat. Each note is 1/6 beat.
        // We use "16" duration for VexFlow appearance to group them tightly.
        const t = [
            make("16", 1/6), make("16", 1/6), make("16", 1/6), 
            make("16", 1/6), make("16", 1/6), make("16", 1/6)
        ];
        t._tuplet = { num_notes: 6, notes_occupied: 4 }; // 6 in space of 4 sixteenths
        return t;
    }

    // Eighth Triplets
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
    if (!beat || beat._tuplet) return beat;

    // 1. Map the beat to an "Attack Grid"
    const hasAttack = [false, false, false, false]; 
    let currentPos = 0;

    for (let e of beat) {
        const pos = Math.round(currentPos / 0.25);
        if (pos < 4 && e.kind === 'note') {
            hasAttack[pos] = true;
        }
        currentPos += Number(e.beats);
    }

    // 2. Create Signature
    const sig = hasAttack.map(b => b ? '1' : '0').join('');
    const N = (dur, beats, dots = 0) => ({ kind: "note", dur, beats, dots });
    const R = (dur, beats, dots = 0) => ({ kind: "rest", dur, beats, dots });

    // 3. Force Notation
    switch (sig) {
        case '1000': return [N("q", 1)];
        case '0100': return [R("16", 0.25), N("8", 0.75, 1)];
        case '0010': return [R("8", 0.5), N("8", 0.5)];
        case '0001': return [R("8", 0.75, 1), N("16", 0.25)];
        case '1100': return [N("16", 0.25), N("16", 0.25), R("8", 0.5)];
        case '1010': return [N("8", 0.5), N("8", 0.5)];
        case '1001': return [N("8", 0.75, 1), N("16", 0.25)];
        case '0110': return [R("16", 0.25), N("16", 0.25), N("8", 0.5)];
        case '0101': return [R("16", 0.25), N("8", 0.5), N("16", 0.25)];
        case '0011': return [R("8", 0.5), N("16", 0.25), N("16", 0.25)];
        case '1110': return [N("16", 0.25), N("16", 0.25), N("8", 0.5)];
        case '1101': return [N("16", 0.25), N("8", 0.5), N("16", 0.25)];
        case '1011': return [N("8", 0.5), N("16", 0.25), N("16", 0.25)];
        case '0111': return [R("16", 0.25), N("16", 0.25), N("16", 0.25), N("16", 0.25)];
        case '1111': return [N("16", 0.25), N("16", 0.25), N("16", 0.25), N("16", 0.25)];
        case '0000': return [R("q", 1)];
    }
    return beat;
  }

  function normalizeEighthRestEighth(beat) {
    const eps = 1e-6;
    if (!beat || beat._tuplet) return beat;

    const N = (dur, beats, dots = 0) => ({ kind: "note", dur, beats, dots });
    const R = (dur, beats, dots = 0) => ({ kind: "rest", dur, beats, dots });
    const is16r = (e) => e && e.kind === "rest" && e.dur === "16" && Math.abs((e.beats ?? 0) - 0.25) < eps && !e.dots;

    const out = beat.map((e) => ({ ...e }));
    if (out.length >= 2 && is16r(out[0]) && is16r(out[1])) {
      out.splice(0, 2, R("8", 0.5));
    }
    const L = out.length;
    if (L >= 2 && is16r(out[L - 2]) && is16r(out[L - 1])) {
      out.splice(L - 2, 2, R("8", 0.5));
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

/* =========================
   NEW (true top-priority fix)
   - Moves 010010 right after onsetMask
   - Removes the later duplicate 010010 block
   ========================= */

function simplifyBeat(beat) {
  if (!beat || !beat._tuplet) return beat;
  
  const numNotes = beat._tuplet.num_notes;

  // --- HANDLE 6-LETS (The Greedy Minimal-Rest Rule) ---
  if (numNotes === 6) {
      // HELPER: Tags the result so Sticking knows to use 1/6 grid (R L R L R L)
      const tag = (arr) => {
          arr._sixLetGrid = true; 
          // Preserve the visual tuplet bracket if it exists
          if (arr._tuplet) arr._tuplet = beat._tuplet; 
          return arr;
      };

      // 1. Generate the Onset Mask
      const onsetMask = (() => {
        const grid = 1/6;
        const slots = Array(6).fill("0");
        let pos = 0;
        for (const n of beat) {
          const slot = Math.floor((pos + 1e-9) / grid);
          if (n.kind === "note" && slot >= 0 && slot < 6) slots[slot] = "1";
          pos += Number(n.beats || 0);
        }
        return slots.join("");
      })();

      // 2. RULE: TRIPLET GRID DOWN-SAMPLING
      const isTripletGrid = (onsetMask[1] === '0' && onsetMask[3] === '0' && onsetMask[5] === '0');
      
      if (isTripletGrid) {
          const tripItems = [
              { k: onsetMask[0] === '1' ? 'n' : 'r' },
              { k: onsetMask[2] === '1' ? 'n' : 'r' },
              { k: onsetMask[4] === '1' ? 'n' : 'r' }
          ];
          const pat = tripItems.map(i => i.k).join("");

          // "100010" -> nrn -> Quarter Note + 8th Note
          if (pat === "nrn") {
             const t = [
                 { kind: "note", dur: "q", beats: 2/3 },
                 { kind: "note", dur: "8", beats: 1/3 }
             ];
             t._tuplet = { num_notes: 3, notes_occupied: 2 }; 
             return tag(t);
          }

          // "001000" -> rnr -> 8th Rest + Quarter Note
          if (pat === "rnr") {
             const t = [
                 { kind: "rest", dur: "8", beats: 1/3 },
                 { kind: "note", dur: "q", beats: 2/3 }
             ];
             t._tuplet = { num_notes: 3, notes_occupied: 2 };
             return tag(t);
          }

          // "000010" -> rrn -> Quarter Rest + 8th Note
          if (pat === "rrn") {
             const t = [
                 { kind: "rest", dur: "q", beats: 2/3 },
                 { kind: "note", dur: "8", beats: 1/3 }
             ];
             t._tuplet = { num_notes: 3, notes_occupied: 2 };
             return tag(t);
          }

          if (pat === "nrr") return tag([{ kind: "note", dur: "q", beats: 1 }]);
          if (pat === "rrr") return tag([{ kind: "rest", dur: "q", beats: 1 }]);
          
          // Fallback to Triplet
          return tag(mkTrip(tripItems));
      }

      // 3. SPECIALIST RULES
      if (onsetMask === "010010") {
        return tag(mk6Let([
          { k: "r", d: "16" }, 
          { k: "n", d: "8", dot: 1 }, 
          { k: "n", d: "8" }
        ], beat._tuplet));
      }

      if (onsetMask === "000001") {
         return tag(mk6Let([
            { k: "r", d: "q" },   
            { k: "r", d: "16" }, 
            { k: "n", d: "16" }   
         ], beat._tuplet));
      }

      // The Splitter (No Tag = Standard 8th Sticking R R)
      const splitCandidates = ["100111", "111100", "100100", "000100", "111000", "000111"];
      if (splitCandidates.includes(onsetMask)) {
           const getHalf = (m) => {
              if (m === "100") return [{ kind: "note", dur: "8", beats: 0.5 }];
              if (m === "000") return [{ kind: "rest", dur: "8", beats: 0.5 }];
              if (m === "111") {
                 return [
                    { kind: "note", dur: "16", beats: 1/6, _localTuplet: true },
                    { kind: "note", dur: "16", beats: 1/6, _localTuplet: true },
                    { kind: "note", dur: "16", beats: 1/6, _localTuplet: true }
                 ];
              }
              return [];
           };
           // Note: We deliberately do NOT tag these, so they behave like standard 8ths (R R)
           return [...getHalf(onsetMask.slice(0,3)), ...getHalf(onsetMask.slice(3,6))];
      }

      // 4. THE GREEDY RULE
      const simplifiedItems = [];
      let i = 0;
      while (i < 6) {
          let durationSlots = 1;
          while (i + durationSlots < 6 && onsetMask[i + durationSlots] === '0') {
              durationSlots++;
          }
          
          const kindKey = onsetMask[i] === '1' ? "n" : "r";

          if (durationSlots === 1) simplifiedItems.push({ k: kindKey, d: "16" });
          else if (durationSlots === 2) simplifiedItems.push({ k: kindKey, d: "8" });
          else if (durationSlots === 3) simplifiedItems.push({ k: kindKey, d: "8", dot: 1 });
          else if (durationSlots === 4) simplifiedItems.push({ k: kindKey, d: "q" });
          else if (durationSlots === 5) {
              simplifiedItems.push({ k: kindKey, d: "16" });
              simplifiedItems.push({ k: "r", d: "q" }); 
          }
          else if (durationSlots === 6) {
              return tag([{ kind: (kindKey === "n" ? "note" : "rest"), dur: "q", beats: 1 }]);
          }
          
          i += durationSlots;
      }
      return tag(mk6Let(simplifiedItems, beat._tuplet));
  }

  // --- HANDLE 8th TRIPLETS ---
  if (numNotes === 3) {
      const totalDur = beat.reduce((sum, n) => sum + (n.beats || 0), 0);
      if (totalDur > 1.5) return beat; // Ignore Quarter Triplets

      const pat = beat.map((e) => (e.kind === "note" ? "n" : "r")).join("");
      
      if (pat === "nrn") {
         const t = [
             { kind: "note", dur: "q", beats: 2/3 },
             { kind: "note", dur: "8", beats: 1/3 }
         ];
         t._tuplet = beat._tuplet;
         return t;
      }

      if (pat === "rrr") return [{ kind: "rest", dur: "q", beats: 1 }];
      if (pat === "nrr") return [{ kind: "note", dur: "q", beats: 1 }];
      if (pat === "rnr") { 
          const t = [{ kind: "rest", dur: "8", beats: 1/3 }, { kind: "note", dur: "q", beats: 2/3 }]; 
          t._tuplet = beat._tuplet; return t; 
      }
      if (pat === "rrn") { 
          const t = [{ kind: "rest", dur: "q", beats: 2/3 }, { kind: "note", dur: "8", beats: 1/3 }]; 
          t._tuplet = beat._tuplet; return t; 
      }
  }
  
  return beat;
}






// Helper: Standard splitter for complex syncopated 6-lets
function fallbackSplitter(beat) {
    const optimizeHalf = (notes) => {
        const m = notes.map(n => n.kind === 'note' ? '1' : '0').join('');
        if (m === "100") return { isTuplet: false, notes: [{ kind: "note", dur: "8", beats: 0.5 }] };
        if (m === "000") return { isTuplet: false, notes: [{ kind: "rest", dur: "8", beats: 0.5 }] };
        const marked = notes.map(n => ({ ...n, _localTuplet: true }));
        return { isTuplet: true, notes: marked };
    };
    const res1 = optimizeHalf(beat.slice(0, 3));
    const res2 = optimizeHalf(beat.slice(3, 6));
    const combined = [...res1.notes, ...res2.notes];
    if (res1.isTuplet || res2.isTuplet) combined._tuplet = beat._tuplet;
    return combined;
}







// --- HELPERS ---
function mk6Let(items, tupletData) {
  const t = items.map(i => ({
    kind: i.k === "n" ? "note" : "rest",
    dur: i.d,
    dots: i.dot || 0,
    beats: i.d === "q" ? 2/3 : (i.d === "8" ? (i.dot ? 0.5 : 1/3) : 1/6),
    _localTuplet: true
  }));
  t._tuplet = tupletData;
  return t;
}

function mkTrip(items) {
  const t = items.map(i => ({
    kind: i.k === "n" ? "note" : "rest",
    dur: "8",
    beats: 1/3
  }));
  t._tuplet = { num_notes: 3, notes_occupied: 2 };
  return t;
}

  // NOTE: applySticking is preserved in your file separately, 
  // but generateExercise comes right after it.
  // Ensure you paste this block carefully to keep applySticking if it was below.
  
  // Wait! In your file applySticking was BETWEEN mergeTripletBeatClean and generateExercise.
  // To be safe, I am NOT including applySticking in this block.
  // You must stop highlighting BEFORE applySticking.

  // REVISED STRATEGY: 
  // Paste Part A (Logic) over everything from pickBeatPattern down to mergeTripletBeatClean.
  // Paste Part B (Generator) over generateExercise.
  
  // Let's restart the copy block to include applySticking so you don't have to think.
  // This block REPLACES EVERYTHING from pickBeatPattern to generateExercise.

  function applySticking(exercise, strategy) {
    if (!exercise) return;
    exercise.forEach(m => m.beats.forEach(b => b.forEach(n => delete n.sticking)));
    if (!isStickingVisible) return;

    const globalLead = currentLeadHand || "R";
    const other = (h) => (h === "R" ? "L" : "R");

    // SEQUENTIAL (Pattern-based)
    if (["alternate", "doubles", "paradiddle"].includes(strategy)) {
      let pattern = [];
      if (strategy === "alternate") pattern = [globalLead, other(globalLead)];
      if (strategy === "doubles") pattern = [globalLead, globalLead, other(globalLead), other(globalLead)];
      if (strategy === "paradiddle") pattern = [globalLead, other(globalLead), globalLead, globalLead, other(globalLead), globalLead, other(globalLead), other(globalLead)];
      let idx = 0;
      exercise.forEach(m => {
        m.beats.forEach(beat => {
          beat.forEach(n => {
            if (n.kind === "note") {
              n.sticking = pattern[idx % pattern.length];
              idx++;
            }
          });
        });
      });
      return;
    }

    // NATURAL (Grid-based)
    if (strategy === "natural") {
      let currentBeatLead = globalLead;
      
      exercise.forEach(m => {
        m.beats.forEach(beat => {
          const isGlobalTriplet = !!beat._tuplet;
          const totalDur = beat.reduce((sum, n) => sum + (n.beats || 0), 0);
          
          const isQuarterTriplet = isGlobalTriplet && (totalDur > 1.5) && beat.length === 3;
          const isQuintuplet   = isGlobalTriplet && (totalDur > 1.5) && beat.length === 5;
          const isGlobalSextuplet = isGlobalTriplet && (Math.abs(totalDur - 1) < 0.1) && beat.length === 6;

          // Check if this beat was tagged as a 6-let derivative
          const forceSixLet = !!beat._sixLetGrid;

          // FIX: Don't flip if it's a 6-let derivative!
          const shouldFlip = !forceSixLet && ((isGlobalTriplet && !isQuarterTriplet && !isGlobalSextuplet) || isQuintuplet); 

          let gridUnit = 0;
          if (isQuintuplet) gridUnit = 0.4;
          else if (isGlobalSextuplet || forceSixLet) gridUnit = 1/6; // Force 1/6 grid
          else if (isGlobalTriplet) gridUnit = 1/3;
          
          if (gridUnit === 0 && beat.some(n => n._localTuplet)) gridUnit = 1/6;

          let pos = 0;
          
          beat.forEach(n => {
            if (n.kind === "note") {
               let stick = currentBeatLead;
               
               if (gridUnit > 0) {
                   const slot = Math.round((pos + 1e-4) / gridUnit);
                   if (slot % 2 === 1) stick = other(currentBeatLead);
                   else stick = currentBeatLead;
               }
               else if (isQuarterTriplet) {
                   stick = currentBeatLead; 
               }
               else {
                   const p = pos % 1;
                   const isOff = (Math.abs(p - 0.25) < 0.05 || Math.abs(p - 0.75) < 0.05);
                   if (isOff) stick = other(currentBeatLead);
                   else stick = currentBeatLead;
               }

               n.sticking = stick;
            }
            pos += n.beats;
          });

          if (shouldFlip) currentBeatLead = other(currentBeatLead);
        });
      });
    }
}


  function generateExercise({ measures, restPct, allow8ths, allow16ths, allowTriplets, allowQuarterTriplets, allowQuintuplets, allowSextuplets }) {    
    const out = [];
    for (let m = 0; m < measures; m++) {
      const beats = [];
      let b = 0;
      
      while (b < 4) {
        const canFitTwo = (4 - b) >= 2;
        
        let beat = pickBeatPattern({ 
            restPct, allow8ths, allow16ths, allowTriplets, 
            allowQuarterTriplets: allowQuarterTriplets && canFitTwo,
            allowQuintuplets: allowQuintuplets && canFitTwo,
            allowSextuplets 
        });

        // Run Normalizers
        beat = normalizeSixteenthGridBeat(beat);
        beat = normalizeEighthRestEighth(beat);
        beat = absorbRestsInBeat(beat);
        beat = normalizeEighthRestEighth(beat);
        beat = collapseAllRestBeatToQuarter(beat);
        beat = simplifyBeat(beat); // <--- UPDATED
        
        beats.push(beat);

        const totalDur = beat.reduce((sum, n) => sum + (n.beats||0), 0);
        
        if (Math.abs(totalDur - 2) < 0.1) {
            beats.push([]); 
            b += 2;         
        } else {
            b += 1;         
        }
      }
      out.push({ beats });
    }
    return out;
}



















// UPDATED: Now accepts 'tupletType' instead of boolean 'isTriplet'
// ... inside main.js ...

function makeStaveNote(flow, elem, beatIdx, posInBeat, tupletType) {
    const isRest = elem.kind === "rest";
    const base = elem.dur;
    const duration = isRest ? (base + "r") : base;

    // 1. DETERMINE PITCH & TARGET LINE
    // Normal Rest -> "b/4" (Line 3 - Middle)
    // Tuplet Rest -> "a/4" (Line 2.5 - Space) -> Nudged to 2.8
    let keys = ["c/5"]; 
    let targetLine = null;

    if (isRest) {
        if (tupletType) {
            // Start at "a/4" (2.5) to break the "Line 3 snap", 
            // then we'll force it up to 2.8 manually.
            keys = ["a/4"]; 
            targetLine = 3.0; // <--- THE SWEET SPOT (Right between 2.5 and 3.0)
        } else {
            keys = ["b/4"]; // Standard Middle Line (3.0)
            targetLine = 3;
        }
    }

    // 2. CREATE NOTE
    const note = new flow.StaveNote({
      clef: "percussion",
      keys: keys,
      duration,
    });
    
    // 3. APPLY LINE FORCING
    if (isRest && targetLine !== null) {
        if (note.keyProps && note.keyProps[0]) {
            note.keyProps[0].line = targetLine;
        }
        note.setKeyLine(0, targetLine);
    }

    // ... (Keep the rest of your sticking/counts/dots logic exactly as is) ...
    if (!isRest && elem.sticking) {
      const text = new flow.Annotation(elem.sticking)
        .setFont("Arial", 11, "bold")
        .setVerticalJustification(flow.Annotation.VerticalJustify.BOTTOM);
      note.addModifier(text);
    }
    
    if (currentShowCounts && !isRest) {
       let txt = "";
       const p = posInBeat;
       const eps = 0.05;

       if (tupletType === 5) {
           const idx = Math.round(p / 0.4); 
           if (idx === 0) txt = (beatIdx + 1).toString();
           else txt = (idx + 1).toString(); 
       } 
       else if (tupletType === 6) {
           const idx = Math.round(p / (1/6)); 
           if (idx === 0) txt = (beatIdx + 1).toString();
           else if (idx === 1) txt = "la";
           else if (idx === 2) txt = "li";
           else if (idx === 3) txt = "&";
           else if (idx === 4) txt = "la";
           else if (idx === 5) txt = "li";
       }
       else if (tupletType === 3) {
           if (Math.abs(p - 0) < eps) txt = (beatIdx + 1).toString();
           else if (Math.abs(p - 1/3) < eps) txt = "la";
           else if (Math.abs(p - 2/3) < eps) txt = "li";
           else if (Math.abs(p - 4/3) < eps) txt = "la"; 
       } 
       else {
           if (Math.abs(p - 0) < eps) txt = (beatIdx + 1).toString();
           else if (Math.abs(p - 0.25) < eps) txt = "e";
           else if (Math.abs(p - 0.50) < eps) txt = "&";
           else if (Math.abs(p - 0.75) < eps) txt = "a";
       }

       if (txt) {
           const countAnn = new flow.Annotation(txt)
            .setFont("Arial", 11, "bold") 
            .setVerticalJustification(flow.Annotation.VerticalJustify.BOTTOM);
           note.addModifier(countAnn); 
       }
    }
    
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
      if (!beat || beat.length === 0) continue;

      const isGlobalTuplet = !!beat._tuplet; 
      
      let runningPos = 0;
      const vfNotes = beat.map((e) => {
          let tType = null;
          if (isGlobalTuplet) {
              tType = beat._tuplet.num_notes || 3;
          } else if (e._localTuplet) {
              tType = 6;
          }

          const n = makeStaveNote(flow, e, beatIdx, runningPos, tType);
          
          n.__beatPos = beatIdx + runningPos;
          if (e._localTuplet) n._localTuplet = true; 
          runningPos += Number(e.beats || 0);
          return n;
      });
      
      notes.push(...vfNotes);

      if (isGlobalTuplet) {
        
        const numNotes = beat._tuplet.num_notes || 3;
        const totalDur = beat.reduce((sum, n) => sum + (n.beats || 0), 0);
        
        const isQuarterTriplet = (totalDur > 1.5) && (numNotes === 3);
        const isFullTriplet = (beat.length === numNotes) && beat.every(e => e.kind === "note");

        tuplets.push(new flow.Tuplet(vfNotes, {
          ...beat._tuplet,
          bracketed: !isFullTriplet || isQuarterTriplet, 
          ratioed: false,
        }));
      } else {
        // ... (rest of the function remains the same)
          // BUILD LOCAL TUPLETS (The splits)
          let buffer = [];
          const flush = () => {
              if (buffer.length > 0) {
                  // Create "3" bracket for these 16th triplets
                  tuplets.push(new flow.Tuplet(buffer, { num_notes: 3, notes_occupied: 2, ratioed: false, bracketed: true }));
                  buffer = [];
              }
          };
          vfNotes.forEach(n => {
              if (n._localTuplet) buffer.push(n);
              else flush();
          });
          flush();
      }

      // Pro Beaming Logic...
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

      const isTripletBeat = isGlobalTuplet || vfNotes.some(n => n._localTuplet);
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
          const isTupletNote = isGlobalTuplet || !!elem._localTuplet;
          
          if (isTupletNote && elem.kind === "note" && (elem.dur === "8" || elem.dur === "16")) {
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

    // CHANGED: Reduced BASE (200->130) so empty measures can shrink.
    // Increased PER_NOTE (25->32) so dense measures claim more space.
    const BASE = 130 * SHEET_DENSITY;       
    const PER_NOTE = 32 * SHEET_DENSITY;    
    const PER_TUPLET = 45 * SHEET_DENSITY;  
    const firstPad = (isFirstMeasure ? 80 : 0) * SHEET_DENSITY;

    const minW = BASE + pack.notes.length * PER_NOTE + pack.tuplets.length * PER_TUPLET + firstPad;
    return { ...pack, voice, minW: Math.ceil(minW) };
  }

  function render(exercise) {
    const flow = VF();
    if (!(scoreEl instanceof HTMLCanvasElement)) throw new Error("Canvas needed");

    const totalMeasures = exercise.length;
    const packs = exercise.map((mm, i) => packMeasure(flow, mm, i === 0));

    // 1. WIDTH CALCULATION (Fit Container Logic)
    
    // Get the container's visual width
    const rect = scoreWrapEl.getBoundingClientRect();
    const containerInnerW = rect.width || 600;
    
    const styles = window.getComputedStyle(scoreWrapEl);
    const padL = parseFloat(styles.paddingLeft) || 0;
    const padR = parseFloat(styles.paddingRight) || 0;
    
    // Calculate exact available space
    let availW = containerInnerW - padL - padR;

    // REMOVED: FORCE_MIN_WIDTH logic. 
    // We now set logicalWidth exactly to availW so it never overflows.
    let logicalWidth = availW;

    const marginX = 15;
    const marginY = 20;
    const lineGap = 150; // Increased vertical gap

    // CHANGED: Scale logic. 
    // On Desktop (> 1000px), we keep it standard (0.85).
    // On Mobile/Tablet, we bump it UP (0.9) to make notes large and readable,
    // relying on the scrollbar for width.
    let scale = 0.85; 
    if (availW < 1000) {
        scale = 0.9; 
    }

    // Usable width for calculations (unscaled)
    let usableW = (logicalWidth / scale) - (marginX * 2);

    // 2. Line Wrapping Strategy
    const totalMinW = packs.reduce((sum, p) => sum + p.minW, 0);
    const avgMinW = totalMinW / totalMeasures;

    // Constraint: Minimum 320px per measure
    const pixelLimit = Math.floor(usableW / 320);
    
    // Constraint: Density Check
    const densityLimit = Math.floor(usableW / (avgMinW * 1.1));

    // Calculate Measures Per Line
    let maxPerLine = Math.min(densityLimit, pixelLimit, 4);
    maxPerLine = Math.max(1, maxPerLine); 

    const linesCount = Math.ceil(totalMeasures / maxPerLine);
    const height = marginY * 2 + linesCount * lineGap;

    // 3. Physical Canvas Size
    // Use logicalWidth (which might be wider than screen)
    const physW = Math.floor(logicalWidth);
    const physH = Math.max(1, Math.floor(height * scale));

    lastRenderScale = scale;

    // Resize Playhead to match
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
    
    // Explicitly set style width/height to ensure scroll works
    scoreEl.style.width = physW + "px";
    scoreEl.style.height = physH + "px";

    // SYNC FIX: Ensure Playhead style matches Score style exactly
    if (playheadEl) {
        playheadEl.style.width = physW + "px";
        playheadEl.style.height = physH + "px";
    }

    const ctx = renderer.getContext();
    if (ctx) {
        if (typeof ctx.setFont === 'function') ctx.setFont("Arial", 10, "");
        if (typeof ctx.clearRect === 'function') ctx.clearRect(0, 0, physW, physH);
    }
    
    const raw = (ctx && ctx.context) ? ctx.context : ctx;
    if (raw) {
        raw.save();
        raw.scale(scale, scale);
    }

    setStatus(`Generated ${exercise.length} Measures`);

    // 4. Draw Loop
    let mIdx = 0;
    for (let line = 0; line < linesCount; line++) {
      const y = marginY + line * lineGap;
      
      const remainingMeasures = totalMeasures - mIdx;
      const remainingLines = linesCount - line;
      const countOnLine = Math.min(maxPerLine, Math.ceil(remainingMeasures / remainingLines));
      
      // NEW: Proportional Distribution Logic
      // 1. Calculate the TOTAL "weight" (minW) of all measures on this line
      let lineTotalMinW = 0;
      for(let j=0; j < countOnLine; j++) {
         if (mIdx + j < packs.length) {
             lineTotalMinW += packs[mIdx + j].minW;
         }
      }

      let x = marginX;
      for (let i = 0; i < countOnLine; i++) {
        if (mIdx >= totalMeasures) break;
        
        const pack = packs[mIdx];

        // 2. Assign width based on this measure's share of the total weight
        // This ensures complex measures get more space than simple ones.
        const share = pack.minW / lineTotalMinW;
        const widthForThisMeasure = usableW * share;

        const stave = new flow.Stave(x, y, widthForThisMeasure);
        
        if (mIdx === 0) {
          stave.addClef("percussion").addTimeSignature("4/4");
          stave.setNoteStartX(stave.getX() + 55); 
        }

        stave.setContext(ctx).draw();
        
        const { beams, tuplets, voice } = pack;

        if (voice.setStave) voice.setStave(stave);
        if (voice.setContext) voice.setContext(ctx);

        const formatter = new flow.Formatter();
        formatter.joinVoices([voice]).formatToStave([voice], stave, { align_rests: false, context: ctx });

        voice.draw(ctx, stave);
        beams.forEach((b) => b.setContext(ctx).draw());
        tuplets.forEach((t) => t.setContext(ctx).draw());

        layoutMeasures[mIdx] = { 
            x0: stave.getNoteStartX(), 
            x1: stave.getNoteEndX(), 
            topY: y, 
            botY: y + 100, 
            anchors: calculateAnchors(stave, pack) 
        };

        mIdx++;
        x += widthForThisMeasure;
      }
    }
    if (raw) raw.restore();

    if (accumulatedBeat > 0) drawPlayheadAtBeat(accumulatedBeat);
  }

  // New Helper for Playhead Anchors
  function calculateAnchors(stave, pack) {
      const startX = stave.getNoteStartX();
      const endX = stave.getNoteEndX();
      const anchors = [];
      anchors.push({ b: 0, x: startX });
      anchors.push({ b: 4, x: endX });

      pack.notes.forEach(n => {
        if (typeof n.getAbsoluteX === 'function' && n.__beatPos !== undefined) {
            anchors.push({ b: n.__beatPos, x: n.getAbsoluteX() });
        }
      });
      anchors.sort((a,b) => a.b - b.b);
      return anchors;
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
  let lastTempoVal = 100;    // Default 100 to match HTML

  // NEW: Update time display function
  function updateTimeDisplays() {
    const tempo = Math.max(40, Math.min(220, Number(tempoEl.value) || 120));
    const spb = 60 / tempo;
    
    // Total Time
    const totalSeconds = totalBeatsScheduled * spb;
    if(totalTimeEl) totalTimeEl.textContent = formatTime(totalSeconds);

    // Current Time
    // Clamp between 0 and totalBeats
    const currentBeat = Math.max(0, Math.min(totalBeatsScheduled, accumulatedBeat));
    const currentSeconds = currentBeat * spb;
    if(currentTimeEl) currentTimeEl.textContent = formatTime(currentSeconds);
  }

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
    ctx.strokeStyle = "#d35400"; /* Theme Orange */
    ctx.lineWidth = 5; 
    ctx.lineCap = "round"; 
    ctx.shadowColor = "rgba(211, 84, 0, 0.45)"; /* Theme Orange RGB */
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
      
      // NEW: Update live Time Display in loop
      // We manually update the 'accumulatedBeat' variable for the UI briefly to calculate time
      // But we don't save it to the global scope yet, as that's handled by pause/stop logic.
      const beatForUI = Math.max(0, Math.min(totalBeatsScheduled, currentBeat));
      if(currentTimeEl) currentTimeEl.textContent = formatTime(beatForUI * spb);

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
           
           // Metronome Click (Only if enabled)
           if (isMetronomeOn) {
               clickAt(nextNoteTime, isDownbeat ? 1200 : 900, isDownbeat ? 0.15 : 0.08, 0.03);
           }

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
        // NUCLEAR FIX: Kill "Ghost Notes" from the old position
        if (masterGain) masterGain.disconnect();
        
        masterGain = audioCtx.createGain();
        masterGain.connect(audioCtx.destination);
        
        // Instant ramp up to avoid clicks
        masterGain.gain.setValueAtTime(0, audioCtx.currentTime);
        masterGain.gain.linearRampToValueAtTime(1, audioCtx.currentTime + 0.05);

        // Instant Audio Re-Sync
        const now = audioCtx.currentTime;
        const spb = 60 / Math.max(40, Math.min(220, Number(tempoEl.value) || 120));
        
        // Reset differential timer
        audioStartTime = now;
        
        // Align scheduler
        nextBeatIndex = Math.ceil(accumulatedBeat);
        nextNoteTime = now + ((nextBeatIndex - accumulatedBeat) * spb);
    }

    if (progressBar) progressBar.style.width = (pct * 100) + "%";
    drawPlayheadAtBeat(accumulatedBeat);
    updateTimeDisplays(); // NEW: Update time when scrubbing
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

    // NUCLEAR FIX: Kill "Ghost Notes"
    // We disconnect the old Master Gain. Any notes scheduled before the pause 
    // are still connected to this old node, so they will play into the void (silence).
    if (masterGain) {
        masterGain.disconnect();
    }
    
    // Create a fresh Master Gain for the new notes
    masterGain = audioCtx.createGain();
    masterGain.connect(audioCtx.destination);
    
    // Soft start the volume (0.05s fade-in) to prevent "popping"
    masterGain.gain.setValueAtTime(0, audioCtx.currentTime);
    masterGain.gain.linearRampToValueAtTime(1, audioCtx.currentTime + 0.05);
    
    // Pre-calculate Events
    
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

      // Unmute (with a quick ramp to prevent clicking/popping)
      masterGain.gain.cancelScheduledValues(0);
      masterGain.gain.setValueAtTime(0, audioCtx.currentTime);
      masterGain.gain.linearRampToValueAtTime(1, audioCtx.currentTime + 0.1);

      const tempoNow = Math.max(40, Math.min(220, Number(tempoEl.value) || 120));
      const spb = 60 / tempoNow;
      lastTempoVal = tempoNow;

// Treat as resume if paused OR if we have scrubbed forward (accumulatedBeat > 0)
      if (isResuming || accumulatedBeat > 0) {
        // --- RESUME LOGIC ---
        audioStartTime = audioCtx.currentTime;
        
        // FIX: Revert to ceil. Using floor caused the previous beat to replay immediately,
        // creating the "double track" or stutter sound.
        nextBeatIndex = Math.ceil(accumulatedBeat);
        
        // Calculate exact time for the NEXT beat
        nextNoteTime = audioStartTime + ((nextBeatIndex - accumulatedBeat) * spb);
      } else {

        // --- FRESH START LOGIC ---
        // If metronome is ON, use count-in (-4). If OFF, start immediately (0).
        const startBeat = isMetronomeOn ? -MEASURE_BEATS : 0;

        accumulatedBeat = startBeat; 
        audioStartTime = audioCtx.currentTime;
        
        nextBeatIndex = startBeat;
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
      audioStartTime = now; // <--- FIX: Reset start time so subsequent renders don't double-add

      // Force UI to snap to the exact frozen position
      drawPlayheadAtBeat(accumulatedBeat);
      if (progressBar) {
        const total = totalBeatsScheduled;
        const disp = Math.min(Math.max(0, accumulatedBeat), total);
        const pct = (total > 0) ? (disp / total) * 100 : 0;
        progressBar.style.width = pct + "%";
      }

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
    
    // NEW: Reset time
    updateTimeDisplays();
  }

  function togglePlayPause() {
      if (isPlaying && !isPaused) pauseMusic();
      else startMusic(isPaused);
  }

  // ---------- Wire up ----------
  
  if (stickingInputEl) {
      stickingInputEl.addEventListener("click", () => {
          showPicker({
              title: "Select Sticking",
              getItems: () => stickingOptions,
              onSelect: (item) => {
                  stickingInputEl.value = item.label;
                  currentStickingStrategy = item.strategy;
                  // Note: Hand logic is now handled by the global toggle
                  if (currentExercise) {
                      applySticking(currentExercise, currentStickingStrategy);
                      render(currentExercise);
                  }
              }
          });
      });
  }
  
  // NEW: Lead Hand Toggle
  if (leadHandToggleEl) {
      leadHandToggleEl.addEventListener("change", () => {
          currentLeadHand = leadHandToggleEl.checked ? "R" : "L";
          if (currentExercise) {
              applySticking(currentExercise, currentStickingStrategy);
              render(currentExercise);
          }
      });
  }

  // NEW: Sticking On/Off
  if (showStickingEl) {
      showStickingEl.addEventListener("change", () => {
          isStickingVisible = showStickingEl.checked;
          if (currentExercise) {
              applySticking(currentExercise, currentStickingStrategy);
              render(currentExercise);
          }
      });
  }
  
  // NEW: Counts On/Off
  if (showCountsEl) {
      showCountsEl.addEventListener("change", () => {
          currentShowCounts = showCountsEl.checked;
          if (currentExercise) render(currentExercise);
      });
  }

  // NEW: Metronome On/Off
  if (metronomeToggleEl) {
      metronomeToggleEl.addEventListener("change", () => {
          isMetronomeOn = metronomeToggleEl.checked;
      });
  }

  function regenerate() {
    try {
      stop(); 
      clearError();
      const measures = Math.max(1, Math.min(32, Math.round(Number(measuresEl.value) || 8)));
      const restPct = Math.max(0, Math.min(60, Math.round(Number(restsEl.value) || 0)));
      
      const allow8ths = !!allow8thsEl?.checked;
      const allow16ths = !!allow16thsEl?.checked;
      const allowTriplets = !!allowTripletsEl.checked;
      const allowQuarterTriplets = !!allowQuarterTripletsEl?.checked;
      const allowQuintuplets = !!allowQuintupletsEl?.checked;
      // NEW: 6-let
      const allowSextuplets = !!allowSextupletsEl?.checked;

      currentExercise = generateExercise({ 
        measures, restPct, allow8ths, allow16ths, allowTriplets, 
        allowQuarterTriplets, allowQuintuplets, allowSextuplets // Pass it here
      });
      
      // Apply sticking
      applySticking(currentExercise, currentStickingStrategy);

      render(currentExercise);
      setStatus(`Generated ${measures} Measures`);
      
      const flat = flattenEvents(currentExercise);
      totalBeatsScheduled = flat.totalBeats;
      updateTimeDisplays();
      
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
        const newSpb = 60 / newTempo;
        nextBeatIndex = Math.ceil(accumulatedBeat);
        nextNoteTime = now + ((nextBeatIndex - accumulatedBeat) * newSpb);
    } else {
        lastTempoVal = Math.max(40, Math.min(220, Number(tempoEl.value) || 120));
    }
    
    updateTimeDisplays();
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