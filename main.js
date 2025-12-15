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
  const allowQuartersEl = $("allowQuarters"); // NEW
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
  const timeSigInput = $("timeSigInput"); // NEW: Get this early

  // 2. FORCE DEFAULTS ON REFRESH
  // Overwrite any browser-cached values to your exact preferences
  if (measuresEl) measuresEl.value = "8";
  if (tempoEl) tempoEl.value = "100";
  if (restsEl) restsEl.value = "20";
  
  if (stickingInputEl) stickingInputEl.value = "Natural";
  if (timeSigInput) timeSigInput.value = "4/4"; // NEW: Force UI to 4/4
  if (leadHandToggleEl) leadHandToggleEl.checked = true; // Force Right Hand
  
  if (showStickingEl) showStickingEl.checked = true;
  if (showCountsEl) showCountsEl.checked = true;
  if (metronomeToggleEl) metronomeToggleEl.checked = true;

  // Force Rhythm Tiles ON 
  if (allowQuartersEl) allowQuartersEl.checked = true;
  if (allow8thsEl) allow8thsEl.checked = true; // FIXED: Uncommented this line
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

  // NEW: Time Signature State
  let currentTimeSigs = ["4/4"]; 
  const timeSigOptions = [
      { label: "2/4", value: "2/4" },
      { label: "3/4", value: "3/4" },
      { label: "4/4", value: "4/4" },
      { label: "5/4", value: "5/4" },
      { label: "6/4", value: "6/4" },
      { label: "7/8", value: "7/8" } 
  ];

  // Picker Elements
  const pickerOverlay = $("pickerOverlay");
  const pickerTitle = $("pickerTitle");
  // const pickerSearch = $("pickerSearch"); // REMOVED
  const pickerList = $("pickerList");
  const pickerClose = $("pickerClose");

  // --- PICKER LOGIC (Updated for Multi-Select) ---
  // NEW CODE
function showPicker({ theme = 'orange', title = 'Select', multi = false, items, selected = [], defaults = [], onSave }) {
    pickerOverlay.classList.remove('picker--orange', 'picker--purple');
    pickerOverlay.classList.add(theme === 'purple' ? 'picker--purple' : 'picker--orange');
    pickerTitle.textContent = title;
    
    let currentSelection = new Set(selected);

    // Clean up old footer if it exists
    const existingFooter = pickerOverlay.querySelector(".picker__footer");
    if (existingFooter) existingFooter.remove();

    if (multi) {
        const footer = document.createElement("div");
        footer.className = "picker__footer";

        // 1. Reset Button
        const resetBtn = document.createElement("button");
        resetBtn.className = "btn btn-blue"; 
        resetBtn.textContent = "Reset";
        resetBtn.onclick = () => {
            currentSelection = new Set(defaults); 
            render(); 
        };

        // 2. Done Button
        const doneBtn = document.createElement("button");
        doneBtn.className = "btn btn-purple"; 
        doneBtn.textContent = "Done";
        doneBtn.onclick = () => {
            onSave(Array.from(currentSelection));
            closePicker();
        };

        footer.appendChild(resetBtn);
        footer.appendChild(doneBtn);
        pickerOverlay.querySelector(".picker__modal").appendChild(footer);
    }

    pickerOverlay.hidden = false;
    pickerOverlay.setAttribute('aria-hidden', 'false');
    
    function render() {
        pickerList.innerHTML = '';
        const list = (typeof items === 'function') ? items() : items;
        
        list.forEach((it) => {
            const li = document.createElement('li');
            li.className = 'picker__item';
            
            const val = it.value || it.strategy || it.label; 
            const isSelected = multi ? currentSelection.has(val) : (selected[0] === val);
            
            if (isSelected) li.classList.add("is-active");

            if (multi) {
                const cb = document.createElement("input");
                cb.type = "checkbox";
                cb.className = "picker__checkbox";
                cb.checked = isSelected;
                cb.onclick = (e) => e.stopPropagation(); // Prevents li click firing twice
                cb.onchange = () => toggle(val);
                li.appendChild(cb);
            }

            const labelSpan = document.createElement("span");
            labelSpan.textContent = it.label;
            li.appendChild(labelSpan);
            
            li.addEventListener('click', () => { 
                if (multi) toggle(val);
                else {
                    onSave([val]); 
                    closePicker(); 
                }
            });
            pickerList.appendChild(li);
        });
    }

    function toggle(val) {
        if (currentSelection.has(val)) currentSelection.delete(val);
        else currentSelection.add(val);
        render();
    }

    function closePicker() {
        pickerOverlay.hidden = true;
        pickerOverlay.setAttribute('aria-hidden', 'true');
        const footer = pickerOverlay.querySelector(".picker__footer");
        if (footer) footer.remove();
    }

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

    // Reset transform so scale doesn't accumulate across renders
    const raw = ctx.context || ctx;
    if (raw.setTransform) raw.setTransform(1, 0, 0, 1, 0, 0);

    // Clear at native size
    raw.clearRect(0, 0, W, H);

    // Scale down to fit wide rhythms (like 6-lets)
    // UPDATED: Reduced from 0.85 to 0.72 to prevent overlapping checkboxes
    const scale = 0.8; 
    ctx.save();
    ctx.scale(scale, scale);

    ctx.setFont("Arial", 10, "");
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

    const voice = new flow.Voice({ num_beats: recipe.num_beats, beat_value: recipe.beat_value }).setStrict(false);
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
        // UPDATED: Allow recipe to disable brackets (default to true)
        bracketed: recipe.tuplet.bracketed !== false,
        ratioed: false,
      });
    }

    voice.draw(ctx, stave);
    beamObj?.setContext(ctx).draw();
    tupletObj?.setContext(ctx).draw();

    // IMPORTANT: restore after scaling
    ctx.restore();
  } catch (e) {
    console.warn("Icon render failed:", canvasId, e);
  }
}



  function safeRenderAllIcons() {
    // NEW: Quarter Icon
    renderRhythmIcon("quarterIcon", {
      num_beats: 1, beat_value: 4,
      beam: false,
      notes: [{ dur: "q" }],
    });

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
      // UPDATED: No Bracket
      tuplet: { num_notes: 3, notes_occupied: 2, bracketed: false },
      notes: [{ dur: "8" }, { dur: "8" }, { dur: "8" }],
    });

    renderRhythmIcon("quarterTripletIcon", {
      num_beats: 2, beat_value: 4,
      beam: false,
      // Keep bracket for Quarter Triplets (standard practice)
      tuplet: { num_notes: 3, notes_occupied: 2 }, 
      notes: [{ dur: "q" }, { dur: "q" }, { dur: "q" }],
    });
    
    // NEW: 5-let Icon
    renderRhythmIcon("quintupletIcon", {
      num_beats: 2, beat_value: 4,
      beam: true,
      // UPDATED: No Bracket
      tuplet: { num_notes: 5, notes_occupied: 4, bracketed: false }, 
      notes: [{ dur: "8" }, { dur: "8" }, { dur: "8" }, { dur: "8" }, { dur: "8" }],
    });

    // NEW: 6-let Icon
    renderRhythmIcon("sextupletIcon", {
      num_beats: 1, beat_value: 4,
      beam: true,
      // UPDATED: No Bracket
      tuplet: { num_notes: 6, notes_occupied: 4, bracketed: false }, 
      notes: [{ dur: "16" }, { dur: "16" }, { dur: "16" }, { dur: "16" }, { dur: "16" }, { dur: "16" }],
    });
  }


  // ---------- Rhythm model ----------
  function chance(pct) {
    return Math.random() * 100 < pct;
  }

















function pickBeatPattern({ restPct, allowQuarters, allow8ths, allow16ths, allowTriplets, allowQuarterTriplets, allowQuintuplets, allowSextuplets }) {
    const pool = [];
    
    // 0. QUARTER NOTES
    if (allowQuarters) pool.push({ id: "q", w: 0.18 });

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

    // Fallback: If user unchecked EVERYTHING, default to Quarters
    if (pool.length === 0) {
        pool.push({ id: "q", w: 1 });
    }

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
        if (t[0].kind === 'note' && t[1].kind === 'rest' && t[2].kind === 'rest') {
             t[1].kind = 'note'; 
        }
        t._tuplet = { num_notes: 3, notes_occupied: 2 };
        return t;
    }

    // Quintuplets (Spans 2 beats)
    if (choice === "5let") {
        // --- NEW: 5-let Variations if Rests = 0% ---
        if (restPct === 0) {
            // FIX: Removed _localTuplet: true to prevent "la li" text
            const mk5 = (d) => ({ kind: "note", dur: d, beats: d==="q"?0.8:0.4 });
            const vars = [
                // Standard
                ["8","8","8","8","8"],
                // 1 Quarter, 3 8ths (Sums to 5 slots)
                ["8","8","8","q"], 
                ["8","8","q","8"], 
                ["8","q","8","8"], 
                ["q","8","8","8"], 
                // 2 Quarters, 1 8th (Sums to 5 slots)
                ["q","q","8"],     
                ["q","8","q"],     
                ["8","q","q"]      
            ];
            const pattern = vars[Math.floor(Math.random() * vars.length)];
            const t = pattern.map(d => mk5(d));
            t._tuplet = { num_notes: 5, notes_occupied: 4 };
            return t;
        }

        const t = [
            make("8", 0.4), make("8", 0.4), make("8", 0.4), make("8", 0.4), make("8", 0.4)
        ];
        t._tuplet = { num_notes: 5, notes_occupied: 4 };
        return t;
    }

    // Sextuplets (1 Beat)
    if (choice === "6let") {
        // --- NEW: 6-let Variations if Rests = 0% ---
        if (restPct === 0) {
            // 8th = 1/3 beat, 16th = 1/6 beat
            const mk6 = (d) => ({ kind: "note", dur: d, beats: d==="8"?(1/3):(1/6), _localTuplet: true });
            const vars = [
                // Standard
                ["16","16","16","16","16","16"],
                // 4+2 Groupings
                ["16","16","16","16","8"],
                ["8","16","16","16","16"],
                // Syncopated
                ["16","16","8","16","16"],
                // Mixed 2s and 1s
                ["16","16","8","8"],
                ["8","16","16","8"],
                ["8","8","16","16"]
            ];
            const pattern = vars[Math.floor(Math.random() * vars.length)];
            const t = pattern.map(d => mk6(d));
            t._tuplet = { num_notes: 6, notes_occupied: 4 }; 
            return t;
        }

        const t = [
            make("16", 1/6), make("16", 1/6), make("16", 1/6), 
            make("16", 1/6), make("16", 1/6), make("16", 1/6)
        ];
        t._tuplet = { num_notes: 6, notes_occupied: 4 }; 
        return t;
    }

    // Eighth Triplets
    if (choice === "8t") {
        // --- NEW: Triplet Variations if Rests = 0% ---
        if (restPct === 0) {
             const mk3 = (d) => ({ kind: "note", dur: d, beats: d==="q"?(2/3):(1/3), _localTuplet: true });
             const vars = [
                ["8","8","8"], // Standard
                ["q","8"],     // Swing (Long-Short)
                ["8","q"]      // Inverted (Short-Long)
             ];
             const pattern = vars[Math.floor(Math.random() * vars.length)];
             const t = pattern.map(d => mk3(d));
             t._tuplet = { num_notes: 3, notes_occupied: 2 };
             return t;
        }
    }

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
    // FIX: Do not collapse tuplets (like 5-lets or Q-Triplets) or they lose their 2-beat duration
    if (beat._tuplet) return beat;
    
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
  const mk = (k, d, b, dots=0) => ({ kind: k==="n"?"note":"rest", dur: d, beats: b, dots });

  // --- HANDLE 5-LETS ---
  if (numNotes === 5) {
      const grid = 0.4;
      const slots = Array(5).fill("0");
      let pos = 0;
      for (const n of beat) {
          const slot = Math.floor((pos + 1e-9) / grid);
          if (n.kind === "note" && slot >= 0 && slot < 5) slots[slot] = "1";
          pos += Number(n.beats || 0);
      }
      const onsetMask = slots.join("");

      if (onsetMask === "10000") return [mk("n", "h", 2.0)];
if (onsetMask === "00001") {
  const t = [mk("r", "q", 1.2, 1), mk("n", "q", 0.8)];
  t._tuplet = beat._tuplet; // <-- IMPORTANT: tag the ARRAY
  return t;
}

      const newItems = [];
      let i = 0;
      while (i < 5) {
          let durationSlots = 1;
          while (i + durationSlots < 5 && onsetMask[i + durationSlots] === '0' && durationSlots < 3) {
              durationSlots++;
          }
          const kindKey = onsetMask[i] === '1' ? "n" : "r";
          if (durationSlots === 1) newItems.push({ k: kindKey, d: "8", b: 0.4 });
          else if (durationSlots === 2) newItems.push({ k: kindKey, d: "q", b: 0.8 });
          else if (durationSlots === 3) newItems.push({ k: kindKey, d: "q", dot: 1, b: 1.2 });
          i += durationSlots;
      }
      const t = newItems.map(it => mk(it.k, it.d, it.b, it.dot));
      t._tuplet = beat._tuplet;
      return t;
  }

  // --- HANDLE 6-LETS ---
  if (numNotes === 6) {
      const tag = (arr) => {
          if (arr.length <= 3 && (!arr._tuplet || arr._tuplet.num_notes === 3)) {
              arr._tuplet = { num_notes: 3, notes_occupied: 2 };
              arr._sixLetGrid = true; 
          } else {
              arr._sixLetGrid = true; 
              if (!arr._tuplet) arr._tuplet = beat._tuplet;
          }
          return arr;
      };

      const grid = 1/6;
      const slots = Array(6).fill("0");
      let pos = 0;
      for (const n of beat) {
          const slot = Math.floor((pos + 1e-9) / grid);
          if (n.kind === "note" && slot >= 0 && slot < 6) slots[slot] = "1";
          pos += Number(n.beats || 0);
      }
      const mask = slots.join("");

      // 2. CHECK: Universal Triplet (All odds are 0)
      if (mask[1] === '0' && mask[3] === '0' && mask[5] === '0') {
          if (mask === "100000") return [mk("n", "q", 1)];
          if (mask === "000000") return [mk("r", "q", 1)];

          const rawTrip = [
              { type: mask[0]==='1'?'n':'r' },
              { type: mask[2]==='1'?'n':'r' },
              { type: mask[4]==='1'?'n':'r' }
          ];

          const finalTrip = [];
          let k = 0;
          while (k < 3) {
             const current = rawTrip[k];
             let absorbed = 0;
             if (k + 1 < 3 && rawTrip[k+1].type === 'r') absorbed = 1;
             
             if (absorbed === 1) {
                 finalTrip.push({ kind: current.type==='n'?'note':'rest', dur: 'q', beats: 2/3 });
                 k += 2;
             } else {
                 finalTrip.push({ kind: current.type==='n'?'note':'rest', dur: '8', beats: 1/3 });
                 k += 1;
             }
          }
          return tag(finalTrip);
      }

      // 3. CHECK: 8th Note Variations (Split Halves)
      const half1 = mask.slice(0,3);
      const half2 = mask.slice(3,6);
      const allowedHalves = ["100", "000", "111"]; 

      // FIX: Added "&& mask !== '111111'" to PREVENT full 6-lets from splitting into 3+3
      if (mask !== "111111" && allowedHalves.includes(half1) && allowedHalves.includes(half2)) {
          const buildHalf = (m) => {
              if (m === "100") return [mk("n", "8", 0.5)];
              if (m === "000") return [mk("r", "8", 0.5)];
              if (m === "111") {
                  return [
                      { kind: "note", dur: "16", beats: 1/6, _localTuplet: true },
                      { kind: "note", dur: "16", beats: 1/6, _localTuplet: true },
                      { kind: "note", dur: "16", beats: 1/6, _localTuplet: true }
                  ];
              }
              return [];
          };
          
          const partA = buildHalf(half1);
          const partB = buildHalf(half2);
          const combined = [...partA, ...partB];
          
          if (mask === "100100" || mask === "000100" || mask === "000000") {
             combined._sixLetGrid = true;
             return combined;
          }
          
          combined._sixLetGrid = true;
          return combined;
      }

      // 4. FALLBACK: Greedy Rules (Full 6-let falls here)
      if (mask === "010010") return tag(mk6Let([{ k: "r", d: "16" }, { k: "n", d: "8", dot: 1 }, { k: "n", d: "8" }], beat._tuplet));
      if (mask === "000001") return tag(mk6Let([{ k: "r", d: "q" }, { k: "r", d: "16" }, { k: "n", d: "16" }], beat._tuplet));
      
      const simplifiedItems = [];
      let i = 0;
      while (i < 6) {
          let durationSlots = 1;
          while (i + durationSlots < 6 && mask[i + durationSlots] === '0') {
              durationSlots++;
          }
          const kindKey = mask[i] === '1' ? "n" : "r";

          if (durationSlots === 1) simplifiedItems.push({ k: kindKey, d: "16" });
          else if (durationSlots === 2) simplifiedItems.push({ k: kindKey, d: "8" });
          else if (durationSlots === 3) simplifiedItems.push({ k: kindKey, d: "8", dot: 1 });
          else if (durationSlots === 4) simplifiedItems.push({ k: kindKey, d: "q" });
          else if (durationSlots === 5) { simplifiedItems.push({ k: kindKey, d: "16" }); simplifiedItems.push({ k: "r", d: "q" }); }
          else if (durationSlots === 6) { return tag([{ kind: (kindKey === "n" ? "note" : "rest"), dur: "q", beats: 1 }]); }
          
          i += durationSlots;
      }
      return tag(mk6Let(simplifiedItems, beat._tuplet));
  }

  // --- HANDLE 8th TRIPLETS ---
  if (numNotes === 3) {
      const totalDur = beat.reduce((sum, n) => sum + (n.beats || 0), 0);
      if (totalDur > 1.5) return beat; 
      const pat = beat.map((e) => (e.kind === "note" ? "n" : "r")).join("");
      
      if (pat === "nrr") return [mk("n", "q", 1)];
      if (pat === "rrr") return [mk("r", "q", 1)];

if (pat === "nrn") {
  const t = [mk("n", "q", 2/3), mk("n", "8", 1/3)];
  t._tuplet = beat._tuplet; // <-- tag the ARRAY
  return t;
}
if (pat === "rnr") {
  const t = [mk("r", "8", 1/3), mk("n", "q", 2/3)];
  t._tuplet = beat._tuplet; // <-- tag the ARRAY
  return t;
}
if (pat === "rrn") {
  const t = [mk("r", "q", 2/3), mk("n", "8", 1/3)];
  t._tuplet = beat._tuplet; // <-- tag the ARRAY
  return t;
}
  }
  
  return beat;
}


// Helpers
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

    if (strategy === "natural") {
      let currentBeatLead = globalLead;
      
      exercise.forEach(m => {
        m.beats.forEach(beat => {
          // FIX: Ignore empty spacer beats.
          if (!beat || beat.length === 0) return;

          const tupletDef = beat._tuplet;
          const numNotes = tupletDef ? tupletDef.num_notes : 0;
          
          const is5Let = numNotes === 5;
          const is6Let = numNotes === 6;
          const isStandardTriplet = (numNotes === 3) && !beat._sixLetGrid; 
          
          const global6 = allowSextupletsEl && allowSextupletsEl.checked;
          const global16 = allow16thsEl && allow16thsEl.checked;
          const global8 = allow8thsEl && allow8thsEl.checked;

          const has6 = is6Let || beat._sixLetGrid || beat.some(n => n._localTuplet);
          const isTrip = isStandardTriplet; 
          const totalDur = beat.reduce((sum, n) => sum + (n.beats || 0), 0);
          const isQT = isTrip && totalDur > 1.5;

          // GRID SETUP & FLIP LOGIC
          let gridUnit = 0; 
          let shouldFlip = false;

          // --- TUPLET LOGIC ---
          if (is5Let || has6 || isTrip || isQT) {
              if (is5Let) {
                  gridUnit = 0.4; 
                  shouldFlip = true; // 5 is Odd -> Flip
              }
              else if (isTrip || isQT) {
                  gridUnit = 1/3; 
                  if (isQT) {
                      shouldFlip = false; // RRR -> R
                  } else {
                      shouldFlip = true; // R L R -> L
                  }
              } 
              else if (global6 || has6) {
                  gridUnit = 1/6; 
                  shouldFlip = false; 
              } 
          } 
          // --- BINARY LOGIC (Quarters, 8ths, 16ths) ---
          else {
              // Priority: 16ths > 8ths > Quarters
              const useStrictGrid = global16 || beat.some(x => x.kind === 'note' && (x.dur === '16' || x.beats === 0.25));
              const use8thGrid = global8 || beat.some(x => x.kind === 'note' && (x.dur === '8' || x.beats === 0.5));
              
              if (useStrictGrid) {
                  gridUnit = 0.25; // 16th note
                  shouldFlip = false;
              }
              else if (use8thGrid) {
                  gridUnit = 0.5; // 8th note
                  shouldFlip = false;
              }
              else {
                  // Quarter Note Only -> R R R R
                  gridUnit = 1.0; 
                  shouldFlip = false; 
              }

              // --- 7/8 FIX (Half-Beat Logic) ---
              // If this beat is exactly 0.5 long (end of 7/8) AND isn't using 16ths,
              // it's a single 8th note. That's 1 note (Odd). We MUST flip.
              if (Math.abs(totalDur - 0.5) < 0.01 && !useStrictGrid) {
                  shouldFlip = true;
              }
          }
          
          // Apply Sticking
          let pos = 0;
          beat.forEach(n => {
            if (n.kind === "note") {
               let stick = currentBeatLead;
               if (gridUnit > 0) {
                   const slot = Math.round((pos + 1e-4) / gridUnit);
                   if (slot % 2 === 1) stick = other(currentBeatLead);
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


  // NEW HELPER: Generates a 0.5 beat pattern for 7/8 time
  function pickHalfBeatPattern() {
    // 10% Chance of Rest
    if (Math.random() < 0.1) return [{ kind: "rest", dur: "8", beats: 0.5 }];
    
    // 60% Chance of single 8th Note
    if (Math.random() < 0.7) return [{ kind: "note", dur: "8", beats: 0.5 }];
    
    // 30% Chance of two 16th Notes
    return [
        { kind: "note", dur: "16", beats: 0.25 },
        { kind: "note", dur: "16", beats: 0.25 }
    ];
  }

  // 1. Update generateExercise signature
  function generateExercise({ measures, timeSignatures, restPct, allowQuarters, allow8ths, allow16ths, allowTriplets, allowQuarterTriplets, allowQuintuplets, allowSextuplets }) {    
    const out = [];
    
    // Fallback: If "None" is selected (empty array), default internally to 4/4 
    const safeTimeSigs = (timeSignatures && timeSignatures.length > 0) ? timeSignatures : ["4/4"];

    for (let m = 0; m < measures; m++) {
      // Pick random time signature from the allowed list
      const ts = safeTimeSigs[Math.floor(Math.random() * safeTimeSigs.length)];
      
      // --- NEW MATH FOR X/8 TIME ---
      const parts = ts.split("/");
      const numerator = parseInt(parts[0], 10);
      const denominator = parseInt(parts[1], 10);
      
      // If denominator is 8, divide by 2 (e.g., 7/8 = 3.5 beats)
      const beatsPerMeasure = denominator === 8 ? numerator / 2 : numerator; 

      let beats = [];
      let retries = 0;
      let hasNote = false;

      while (!hasNote && retries < 10) {
          beats = [];
          let b = 0;
          hasNote = false;

          while (b < beatsPerMeasure) {
            const beatsLeft = beatsPerMeasure - b;
            
            // --- NEW: CHECK FOR HALF-BEAT GAP ---
            // If we have exactly 0.5 beats left (e.g. 7/8 time), fill it with a half-beat pattern.
            // We skip the standard normalization functions for this specific chunk to avoid breaking it.
            if (beatsLeft === 0.5) {
                const halfBeat = pickHalfBeatPattern();
                beats.push(halfBeat);
                if (!hasNote && halfBeat.some(n => n.kind === "note")) hasNote = true;
                b += 0.5;
                continue; 
            }

            const canFitTwo = beatsLeft >= 2;
            
            let beat = pickBeatPattern({ 
                restPct, 
                allowQuarters, 
                allow8ths, 
                allow16ths, 
                allowTriplets, 
                allowQuarterTriplets: allowQuarterTriplets && canFitTwo,
                allowQuintuplets: allowQuintuplets && canFitTwo,
                allowSextuplets 
            });

            beat = normalizeSixteenthGridBeat(beat);
            beat = normalizeEighthRestEighth(beat);
            beat = absorbRestsInBeat(beat);
            beat = normalizeEighthRestEighth(beat);
            beat = collapseAllRestBeatToQuarter(beat);
            beat = simplifyBeat(beat); 
            
            if (!hasNote && beat && beat.some(n => n.kind === "note")) hasNote = true;
            
            beats.push(beat);

            const totalDur = beat.reduce((sum, n) => sum + (n.beats||0), 0);
            
            if (Math.abs(totalDur - 2) < 0.1) {
                beats.push([]); 
                b += 2;         
            } else {
                b += 1;         
            }
          }
          retries++;
      }

      // --- MEASURE-LEVEL REST CONDENSING ---
      for (let i = 0; i < beats.length; i++) {
          const isQRest = (b) => b && b.length === 1 && b[0].kind === "rest" && b[0].dur === "q";
          
          let b1 = beats[i];
          let b2 = beats[i+1];
          let b3 = beats[i+2];

          if (b1 && b2 && b3 && isQRest(b1) && isQRest(b2) && isQRest(b3)) {
              beats[i] = [{ kind: "rest", dur: "h", dots: 1, beats: 3 }];
              beats[i+1] = []; 
              beats[i+2] = [];
              i += 2;
          } 
          else if (b1 && b2 && isQRest(b1) && isQRest(b2)) {
              beats[i] = [{ kind: "rest", dur: "h", beats: 2 }];
              beats[i+1] = [];
              i += 1;
          }
      }

      if (!hasNote) {
           beats = [];
           // Ensure fallback fills the correct amount of space
           const fillCount = Math.ceil(beatsPerMeasure);
           for(let k=0; k<fillCount; k++) beats.push([{ kind: "note", dur: "q", beats: 1 }]);
      }

      out.push({ beats, timeSig: ts });
    }
    return out;
  }


















// UPDATED: Now accepts 'tupletType' instead of boolean 'isTriplet'
// ... inside main.js ...

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
           // ALWAYS show 1 2 3 4 5, ignoring the measure beat index
           txt = (idx + 1).toString(); 
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

    // NEW: respect the measure's time signature length (2/4, 3/4, 5/4, 6/4, etc.)
    const ts = measureModel.timeSig || "4/4";
    const numBeats = parseInt(ts.split("/")[0], 10);

    for (let beatIdx = 0; beatIdx < numBeats; beatIdx++) {
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
        const isFullTuplet = (beat.length === numNotes) && beat.every(e => e.kind === "note");
        const showBracket = isQuarterTriplet || !isFullTuplet;

        tuplets.push(new flow.Tuplet(vfNotes, {
          ...beat._tuplet,
          bracketed: showBracket, 
          ratioed: false,
        }));      
      } else {
          // BUILD LOCAL TUPLETS (The splits)
          let buffer = [];
          const flush = () => {
              if (buffer.length > 0) {
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
    
    // Read Time Sig
    pack.timeSig = measureModel.timeSig || "4/4";
    const parts = pack.timeSig.split("/");
    const num = parseInt(parts[0], 10);
    const den = parseInt(parts[1], 10);

    // FIX 1: Pass the actual denominator (e.g., 8) to VexFlow
    const voice = new flow.Voice({ num_beats: num, beat_value: den });
    voice.setStrict(false);
    voice.addTickables(pack.notes);

    // CHANGED: Aggressively increased weights for 6-let spacing
    const BASE = 140 * SHEET_DENSITY;       
    const PER_NOTE = 50 * SHEET_DENSITY;   
    const PER_TUPLET = 150 * SHEET_DENSITY; 
    const firstPad = (isFirstMeasure ? 80 : 0) * SHEET_DENSITY;

    const minW = BASE + pack.notes.length * PER_NOTE + pack.tuplets.length * PER_TUPLET + firstPad;
    return { ...pack, voice, minW: Math.ceil(minW) };
  }

  function render(exercise) {
    const flow = VF();
    if (!(scoreEl instanceof HTMLCanvasElement)) throw new Error("Canvas needed");

    const totalMeasures = exercise.length;
    const packs = exercise.map((mm, i) => packMeasure(flow, mm, i === 0));

    // 1. WIDTH CALCULATION
    const wrapEl = scoreWrapEl || scoreEl?.parentElement;
    const rect = wrapEl?.getBoundingClientRect?.() || { width: 600 };
    const containerInnerW = rect.width || 600;

    const styles = wrapEl ? window.getComputedStyle(wrapEl) : null;
    const padL = styles ? (parseFloat(styles.paddingLeft) || 0) : 0;
    const padR = styles ? (parseFloat(styles.paddingRight) || 0) : 0;

    let availW = containerInnerW - padL - padR;
    let logicalWidth = availW;

    const marginX = 15;
    const marginY = 20;
    const lineGap = 150; 

    let scale = 0.85; 
    if (availW < 1000) scale = 0.8; 
    if (availW < 700) scale = 0.65; 

    let usableW = (logicalWidth / scale) - (marginX * 2);

    // 2. LINE WRAPPING
    const totalMinW = packs.reduce((sum, p) => sum + p.minW, 0);
    const avgMinW = totalMinW / totalMeasures;

    const pixelLimit = Math.floor(usableW / 320);
    const densityLimit = Math.floor(usableW / (avgMinW * 1.1));

    let maxPerLine = Math.min(densityLimit, pixelLimit, 4);
    maxPerLine = Math.max(1, maxPerLine); 

    const linesCount = Math.ceil(totalMeasures / maxPerLine);
    const height = marginY * 2 + linesCount * lineGap;

    const physW = Math.floor(logicalWidth);
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

    // 4. DRAW LOOP
    let mIdx = 0;
    for (let line = 0; line < linesCount; line++) {
      const y = marginY + line * lineGap;
      
      const remainingMeasures = totalMeasures - mIdx;
      const remainingLines = linesCount - line;
      const countOnLine = Math.min(maxPerLine, Math.ceil(remainingMeasures / remainingLines));
      
      let lineTotalMinW = 0;
      for(let j=0; j < countOnLine; j++) {
         if (mIdx + j < packs.length) lineTotalMinW += packs[mIdx + j].minW;
      }

      let x = marginX;
      for (let i = 0; i < countOnLine; i++) {
        if (mIdx >= totalMeasures) break;
        
        const pack = packs[mIdx];
        const share = pack.minW / lineTotalMinW;
        const widthForThisMeasure = usableW * share;

        const stave = new flow.Stave(x, y, widthForThisMeasure);
        
        const currentTS = pack.timeSig || "4/4";
        const prevTS = (mIdx > 0 && exercise[mIdx - 1]) ? exercise[mIdx - 1].timeSig : null;

        if (mIdx === 0 || currentTS !== prevTS) {
            stave.addTimeSignature(currentTS);
        }

        if (mIdx === 0) {
          stave.addClef("percussion");
          stave.setNoteStartX(stave.getX() + 65); 
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

        // --- PLAYHEAD FIX ---
        // Calculate REAL length in Quarter Beats.
        const parts = currentTS.split("/");
        const n = parseInt(parts[0], 10);
        const d = parseInt(parts[1], 10);
        
        // 7/8 = 3.5 beats. 4/4 = 4 beats.
        const lenBeats = (d === 8) ? (n / 2) : n;

        layoutMeasures[mIdx] = { 
            x0: stave.getNoteStartX(), 
            x1: stave.getNoteEndX(), 
            topY: y, 
            botY: y + 100, 
            lenBeats, 
            anchors: calculateAnchors(stave, pack, lenBeats) 
        };

        mIdx++;
        x += widthForThisMeasure;
      }
    }
    if (raw) raw.restore();

    if (accumulatedBeat > 0) drawPlayheadAtBeat(accumulatedBeat);
  }



  // New Helper for Playhead Anchors
  function calculateAnchors(stave, pack, lenBeats) {
      const startX = stave.getNoteStartX();
      const endX = stave.getNoteEndX();
      const anchors = [];
      anchors.push({ b: 0, x: startX });
      anchors.push({ b: lenBeats, x: endX });

      pack.notes.forEach(n => {
        if (typeof n.getAbsoluteX === 'function' && n.__beatPos !== undefined) {
            anchors.push({ b: n.__beatPos, x: n.getAbsoluteX() });
        }
      });

      anchors.sort((a,b) => a.b - b.b);
      return anchors;
  }


  // ---------- Playback Logic ----------

  function flattenEvents(exercise) {
    // 1. Calculate actual total beats based on Time Signatures
    const actualTotalBeats = exercise.reduce((acc, m) => {
        const ts = m.timeSig || "4/4";
        const parts = ts.split("/");
        const num = parseInt(parts[0], 10);
        const den = parseInt(parts[1], 10);
        const measureLen = (den === 8) ? (num / 2) : num;
        return acc + measureLen;
    }, 0);

    // 2. Create dense array for scheduler
    const events = Array.from({ length: Math.ceil(actualTotalBeats) + 4 }, () => []);
    
    // --- FIX: TRACK MEASURE START TIMES SEPARATELY ---
    // This prevents floating point drift from accumulating across measures.
    let measureStartCursor = 0;
    
    exercise.forEach(measure => {
        // Calculate theoretical length of this measure
        const ts = measure.timeSig || "4/4";
        const parts = ts.split("/");
        const num = parseInt(parts[0], 10);
        const den = parseInt(parts[1], 10);
        const measureLen = (den === 8) ? (num / 2) : num;

        // Reset the local cursor to the EXACT measure start
        let localCursor = 0;

        measure.beats.forEach(beatGroup => {
            // Determine the "intended" duration of this group to prevent drift
            // 1. Sum the beats
            const rawSum = beatGroup.reduce((s, n) => s + (n.beats || 0), 0);
            
            // 2. Round to nearest reasonable grid (fixes 1.99999 -> 2.0)
            // We round to nearest 0.25 which covers 0.25, 0.5, 1.0, 2.0 safely
            let chunkLen = Math.round(rawSum * 1000) / 1000;
            
            // Hard Fix for known tuplet lengths
            // Quarter Triplets (3 notes) and 5-lets (5 notes) usually equal 2.0
            if (beatGroup._tuplet && Math.abs(chunkLen - 2.0) < 0.05) {
                chunkLen = 2.0;
            }

            beatGroup.forEach((note) => {
               if (note.kind === 'note') {
                   const freq = 650; 
                   
                   // Calculate absolute time relative to the HARD measure start
                   // This ensures Note 1 of Measure 2 is always exactly at MeasureStart + 0
                   const absPos = measureStartCursor + localCursor;
                   
                   const bucket = Math.floor(absPos);
                   const offset = absPos - bucket;
                   
                   if (!events[bucket]) events[bucket] = [];
                   events[bucket].push({ offset: offset, freq: freq });
               }
               
               // Increment local position
               localCursor += (note.beats || 0);
            });
            
            // FORCE ALIGNMENT:
            // Instead of leaving localCursor at 1.9999, snap it to the chunk end
            // We calculate where the chunk *should* have ended relative to the start
            // Actually, simply doing localCursor = start + chunkLen is safer if we tracked starts
            // But here, we just correct the drift for the NEXT group:
            
            // We verify if localCursor drifted significantly from chunkLen. 
            // If we just finished a QT, localCursor might be 1.9999. chunkLen is 2.0.
            // We snap localCursor to the clean 2.0 value.
            if (Math.abs(localCursor - chunkLen) < 0.01) {
                localCursor = chunkLen;
            }
        });
        
        // Advance global cursor by the THEORETICAL measure length
        // This swallows any remaining internal drift from this measure
        measureStartCursor += measureLen;
    });
    
    return { eventsByBeat: events, totalBeats: actualTotalBeats };
  }


  // ---------- Playback ----------
   
  // =========================================================
  // CORERECTED PLAYBACK ENGINE
  // =========================================================

  // SINGLETON AUDIO STATE
  let audioCtx = null; 
  let masterGain = null; 
  let isPlaying = false;
  let isPaused = false;
  let schedulerTimer = null; 

  // Timing / Sync
  let lastRenderScale = 1;
  let layoutMeasures = []; 
  let playRunId = 0;
  let playheadRAF = null;
   
  // Audio Scheduling State
  let nextNoteTime = 0; 
  let totalBeatsScheduled = 0;
  let eventsByBeat = []; 
  let measureStartBeats = []; 

  // --- THE FIX: SEPARATE VISUAL ANCHOR FROM SCHEDULER CURSOR ---
  let schedulerBeat = 0;    // Tracks where the Audio Engine is currently looking
  let accumulatedBeat = 0;  // Tracks the VISUAL start point (static during play)
  let audioStartTime = 0;   // The AudioContext time when play started
  let lastTempoVal = 100;    

  // Update time display function
  function updateTimeDisplays() {
    const tempo = Math.max(40, Math.min(220, Number(tempoEl.value) || 120));
    const spb = 60 / tempo;
    
    // Total Time
    const totalSeconds = totalBeatsScheduled * spb;
    if(totalTimeEl) totalTimeEl.textContent = formatTime(totalSeconds);

    // Current Time (Calculated from Visuals)
    let currentBeat = 0;
    if (isPlaying && !isPaused && audioCtx) {
        const timeElapsed = audioCtx.currentTime - audioStartTime;
        currentBeat = accumulatedBeat + (timeElapsed / spb);
    } else {
        currentBeat = accumulatedBeat;
    }

    // Clamp for display
    currentBeat = Math.max(0, Math.min(totalBeatsScheduled, currentBeat));
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
      return geom.x0 + (localBeat / 4) * (geom.x1 - geom.x0);
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
    
    let mIdx = 0;
    const starts = measureStartBeats || [];
    for (let i = 0; i < starts.length - 1; i++) {
        if (visibleBeat >= starts[i]) {
            mIdx = i;
        } else {
            break;
        }
    }
    
    if (mIdx >= layoutMeasures.length) mIdx = layoutMeasures.length - 1;

    const geom = layoutMeasures[mIdx];
    if (!geom) return;

    const measureStart = starts[mIdx] || 0;
    const localBeat = Math.max(0, visibleBeat - measureStart);
    
    const s = lastRenderScale || 1;
    const currentX = xFromAnchors(geom, localBeat) * s;
     
    let y0 = Math.max(0, geom.topY * s);
    let y1 = Math.min(playheadEl.height, geom.botY * s);

    const halfWidth = 2.5;
    const clampedX = Math.max(halfWidth, Math.min(playheadEl.width - halfWidth, currentX));

    // Auto-Scroll Logic
    if (scoreWrapEl) {
        const scrollT = scoreWrapEl.scrollTop;
        const wrapH = scoreWrapEl.clientHeight;
        // Only scroll if we are playing and out of view
        if (isPlaying && !isPaused) {
            if (y1 > scrollT + wrapH - 20) {
                scoreWrapEl.scrollTop = y0 - 20; 
            } else if (y0 < scrollT) {
                scoreWrapEl.scrollTop = y0 - 20;
            }
        }
        syncPlayheadOverlayPosition();
    }

    ctx.save();
    ctx.globalAlpha = 0.92;
    ctx.strokeStyle = "#d35400"; 
    ctx.lineWidth = 5; 
    ctx.lineCap = "round"; 
    ctx.shadowColor = "rgba(211, 84, 0, 0.45)";
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
      const tempoNow = Math.max(40, Math.min(220, Number(tempoEl.value) || 120));
      const spb = 60 / tempoNow;
      const timeElapsed = now - audioStartTime;
      
      // FIX: Use accumulatedBeat (static anchor) + elapsed time
      const currentBeat = accumulatedBeat + (timeElapsed / spb);

      if (currentBeat >= totalBeatsScheduled + END_BUFFER_BEATS) {
        stop();
        return;
      }

      drawPlayheadAtBeat(currentBeat);
      
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
    
    o.connect(g).connect(masterGain); 
    
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(gain, time + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    o.start(time);
    o.stop(time + dur + 0.05);
  }

  // --- Audio Scheduler ---
  function scheduleBeats() {
    if (!isPlaying || isPaused || !audioCtx) return;

    const TICK_MS = 50; 
    const LOOKAHEAD = 0.5;
    const currentRunId = playRunId; 

    const tempoNow = Math.max(40, Math.min(220, Number(tempoEl.value) || 120));
    const spb = 60 / tempoNow;

    while (nextNoteTime < audioCtx.currentTime + LOOKAHEAD) {
      if (nextNoteTime < audioCtx.currentTime - 0.2) {
           nextNoteTime = audioCtx.currentTime;
      }

      const totalLen = measureStartBeats[measureStartBeats.length - 1];
      
      if (schedulerBeat < totalLen) {
           // 1. LOCATE MEASURE
           let mIdx = 0;
           for (let i = 0; i < measureStartBeats.length - 1; i++) {
               if (schedulerBeat >= measureStartBeats[i] - 1e-3) mIdx = i;
               else break;
           }

           const measureStart = measureStartBeats[mIdx];
           const localBeat = schedulerBeat - measureStart;
           
           // 2. IDENTIFY DOWNBEAT & INTEGER BEATS
           // Use a tolerance for floating point precision
           const isDownbeat = (Math.abs(localBeat) < 0.05) || (Math.abs(schedulerBeat - accumulatedBeat) < 0.05 && schedulerBeat < 0);
           const isIntegerBeat = Math.abs(localBeat - Math.round(localBeat)) < 0.05;

           // 3. CALCULATE STEP DURATION (SNAP TO GRID)
           const ts = currentExercise[mIdx].timeSig || "4/4";
           const parts = ts.split("/");
           const den = parseInt(parts[1], 10);
           
           let stepDuration = 1.0;
           
           if (den === 8) {
               // In X/8, we snap to the nearest 0.5 (Eighth note)
               // e.g., if at 1.4, next grid is 1.5 -> step is 0.1
               const nextGrid = (Math.floor(localBeat * 2) + 1) / 2;
               stepDuration = nextGrid - localBeat;
               // If already on grid, take full step
               if (stepDuration < 0.01) stepDuration = 0.5;
           } else {
               // In X/4, we snap to the nearest 1.0 (Quarter note)
               // e.g., if at 1.4, next grid is 2.0 -> step is 0.6
               const nextGrid = Math.floor(localBeat) + 1;
               stepDuration = nextGrid - localBeat;
               // If already on grid, take full step
               if (stepDuration < 0.01) stepDuration = 1.0;
           }

           // 4. METRONOME CLICK
           // FIX: Only click if we are on a valid integer beat (or Downbeat)
           // This prevents clicking immediately if you scrub to 1.4
           if (isMetronomeOn && (isIntegerBeat || isDownbeat)) {
               const freq = isDownbeat ? 1200 : 900;
               const gain = isDownbeat ? 0.15 : 0.08;
               clickAt(nextNoteTime, freq, gain, 0.03);
           }

           // 5. SCHEDULE RHYTHM NOTES
           const startWindow = schedulerBeat - 0.01;
           const endWindow = schedulerBeat + stepDuration - 0.01;
           
           const startBucket = Math.floor(startWindow);
           const endBucket = Math.floor(endWindow);
           
           for (let b = startBucket; b <= endBucket; b++) {
               if (!eventsByBeat[b]) continue;
               eventsByBeat[b].forEach(ev => {
                   const absTime = b + ev.offset;
                   if (absTime >= startWindow && absTime < endWindow) {
                       const timeOffset = absTime - schedulerBeat; 
                       const scheduleTime = nextNoteTime + (timeOffset * spb);
                       
                       if (scheduleTime > audioCtx.currentTime - 0.05) {
                           clickAt(scheduleTime, ev.freq, 0.07, 0.03);
                       }
                   }
               });
           }

           // 6. ADVANCE SCHEDULER
           nextNoteTime += (stepDuration * spb);
           schedulerBeat += stepDuration; 
           
      } else {
           // End of song handling
           nextNoteTime += spb; 
           schedulerBeat += 1;
      }
    }

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
    
    // Update the Visual Anchor
    accumulatedBeat = pct * totalBeatsScheduled;
    schedulerBeat = accumulatedBeat; // Sync scheduler
    
    if (isPlaying && audioCtx) {
        if (masterGain) masterGain.disconnect();
        
        masterGain = audioCtx.createGain();
        masterGain.connect(audioCtx.destination);
        
        masterGain.gain.setValueAtTime(0, audioCtx.currentTime);
        masterGain.gain.linearRampToValueAtTime(1, audioCtx.currentTime + 0.05);

        const now = audioCtx.currentTime;
        const spb = 60 / Math.max(40, Math.min(220, Number(tempoEl.value) || 120));
        
        audioStartTime = now;
        nextNoteTime = now + 0.05; // Short buffer
    }

    if (progressBar) progressBar.style.width = (pct * 100) + "%";
    drawPlayheadAtBeat(accumulatedBeat);
    updateTimeDisplays(); 
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

    if (masterGain) {
        masterGain.disconnect();
    }
    
    masterGain = audioCtx.createGain();
    masterGain.connect(audioCtx.destination);
    
    masterGain.gain.setValueAtTime(0, audioCtx.currentTime);
    masterGain.gain.linearRampToValueAtTime(1, audioCtx.currentTime + 0.05);
    
    // Ensure we use the FIRST flattenEvents
    const flat = flattenEvents(currentExercise);
    eventsByBeat = flat.eventsByBeat;
    totalBeatsScheduled = flat.totalBeats;

    audioCtx.resume().then(() => {
      playBtn.disabled = false;
      stopBtn.disabled = false;
      isPlaying = true;
      isPaused = false;
      playRunId++; 
      
      playBtnText.textContent = "Pause";
      setStatus("Playing", "play");

      masterGain.gain.cancelScheduledValues(0);
      masterGain.gain.setValueAtTime(0, audioCtx.currentTime);
      masterGain.gain.linearRampToValueAtTime(1, audioCtx.currentTime + 0.1);

      const tempoNow = Math.max(40, Math.min(220, Number(tempoEl.value) || 120));
      const spb = 60 / tempoNow;
      lastTempoVal = tempoNow;

      if (isResuming || accumulatedBeat > 0) {
        audioStartTime = audioCtx.currentTime;
        // Sync scheduler to visual anchor
        schedulerBeat = accumulatedBeat; 
        nextNoteTime = audioStartTime + 0.05;
      } else {
        // Count-in Logic
        let firstLen = 4;
        if (currentExercise && currentExercise[0]) {
            const ts = currentExercise[0].timeSig || "4/4";
            const parts = ts.split("/");
            const n = parseInt(parts[0], 10);
            const d = parseInt(parts[1], 10);
            firstLen = (d === 8) ? (n / 2) : n; 
        }
            
        const startBeat = isMetronomeOn ? -firstLen : 0;
        
        accumulatedBeat = startBeat; 
        schedulerBeat = startBeat; // Sync scheduler
        audioStartTime = audioCtx.currentTime;
        
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

      if (masterGain) {
          masterGain.gain.cancelScheduledValues(0);
          masterGain.gain.setValueAtTime(0, audioCtx.currentTime);
      }

      const now = audioCtx.currentTime;
      const spb = 60 / lastTempoVal;
      
      // FREEZE the visual anchor
      accumulatedBeat += (now - audioStartTime) / spb;
      schedulerBeat = accumulatedBeat; // Sync scheduler
      
      audioStartTime = now;

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

      audioCtx.suspend().then(() => {
          isPaused = true;
          isPlaying = false;
          playBtnText.textContent = "Play";
          setStatus("Paused", "warn");
      });
  }

  function stop() {
    playRunId++; 
    
    isPlaying = false;
    isPaused = false;
    
    if (schedulerTimer) clearTimeout(schedulerTimer);
    if (masterGain && audioCtx) masterGain.gain.setValueAtTime(0, audioCtx.currentTime);

    cancelAnimationFrame(playheadRAF || 0);
    playheadRAF = null;

    accumulatedBeat = 0; 
    schedulerBeat = 0; 
    nextNoteTime = 0;

    playBtn.disabled = false;
    stopBtn.disabled = true;
    playBtnText.textContent = "Play";
    setStatus("Ready");

    clearPlayhead();
    if (progressBar) progressBar.style.width = "0%";
    
    updateTimeDisplays();
  }

  function togglePlayPause() {
      if (isPlaying && !isPaused) pauseMusic();
      else startMusic(isPaused);
  }

  // --- TEMPO HOT SWAP (Fixed for new variables) ---
  tempoEl.addEventListener("input", () => {
    tempoValEl.textContent = tempoEl.value;
    syncSliderFill(tempoEl);
    
    if (isPlaying && !isPaused && audioCtx) {
        const now = audioCtx.currentTime;
        const newTempo = Math.max(40, Math.min(220, Number(tempoEl.value) || 120));
        
        // 1. Commit progress to visual anchor using OLD tempo
        const oldSpb = 60 / lastTempoVal;
        const elapsed = now - audioStartTime;
        accumulatedBeat += (elapsed / oldSpb);
        
        // 2. Reset Start Time
        audioStartTime = now;
        
        // 3. HARD SYNC: Recalculate next note time using NEW tempo
        // We calculate the exact beat distance between "Now" (accumulatedBeat)
        // and the "Next Scheduled Event" (schedulerBeat).
        const newSpb = 60 / newTempo;
        const beatsUntilNextClick = schedulerBeat - accumulatedBeat;
        
        // Force the audio clock to align with the new visual speed immediately
        nextNoteTime = now + (beatsUntilNextClick * newSpb);

        // 4. Update Tempo ref
        lastTempoVal = newTempo;
    } else {
        lastTempoVal = Math.max(40, Math.min(220, Number(tempoEl.value) || 120));
    }
    
    updateTimeDisplays();
  });

  // ---------- Wire up ----------
  
  // Updated Sticking Picker (Adapter for new showPicker)
  if (stickingInputEl) {
      stickingInputEl.addEventListener("click", () => {
          showPicker({
              title: "Select Sticking",
              multi: false,
              items: stickingOptions,
              selected: [currentStickingStrategy], 
              onSave: (selection) => {
                  const val = selection[0]; // e.g. "natural" or "alternate"
                  // Find the label for display
                  const item = stickingOptions.find(x => x.strategy === val || x.value === val);
                  if (item) {
                      stickingInputEl.value = item.label;
                      currentStickingStrategy = item.strategy;
                      if (currentExercise) {
                          applySticking(currentExercise, currentStickingStrategy);
                          render(currentExercise);
                      }
                  }
              }
          });
      });
  }

  // NEW: Time Signature Picker
  // const timeSigInput = $("timeSigInput"); // REMOVED: Already defined at top
  if (timeSigInput) {
    timeSigInput.addEventListener("click", () => {
      showPicker({
        title: "Time Signatures",
        multi: true,
        items: timeSigOptions,
        selected: currentTimeSigs,
        defaults: [], // Resets to empty (None)
        onSave: (selection) => {
          selection.sort();
          currentTimeSigs = selection;

          // Update the UI text based on selection count
          if (selection.length === 0) {
            timeSigInput.value = "None";
          } else if (selection.length === 1) {
            timeSigInput.value = selection[0];
          } else if (selection.length === timeSigOptions.length) {
            timeSigInput.value = "All";
          } else {
            timeSigInput.value = "Mixed";
          }

          regenerate();
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
      
      const allowQuarters = !!allowQuartersEl?.checked; 
      const allow8ths = !!allow8thsEl?.checked;
      const allow16ths = !!allow16thsEl?.checked;
      const allowTriplets = !!allowTripletsEl.checked;
      const allowQuarterTriplets = !!allowQuarterTripletsEl?.checked;
      const allowQuintuplets = !!allowQuintupletsEl?.checked;
      const allowSextuplets = !!allowSextupletsEl?.checked;

      currentExercise = generateExercise({ 
        measures, 
        timeSignatures: currentTimeSigs,
        restPct, 
        allowQuarters, 
        allow8ths, 
        allow16ths, 
        allowTriplets, 
        allowQuarterTriplets, 
        allowQuintuplets, 
        allowSextuplets 
      });
      
      // FIX 1: Correctly calculate start beats for X/8 signatures
      measureStartBeats = [];
      let acc = 0;
      
      for (const mm of currentExercise) {
          measureStartBeats.push(acc);
          
          const ts = mm.timeSig || "4/4";
          const parts = ts.split("/");
          const num = parseInt(parts[0], 10);
          const den = parseInt(parts[1], 10);
          
          // 7/8 -> 3.5 beats long
          const len = (den === 8) ? (num / 2) : num;
          
          acc += len;
      }
      measureStartBeats.push(acc); // Total duration at the end

      applySticking(currentExercise, currentStickingStrategy);

      render(currentExercise);
      setStatus(`Generated ${measures} Measures`);
      
      if (typeof flattenEvents === "function") {
          const flat = flattenEvents(currentExercise);
          eventsByBeat = flat?.eventsByBeat || [];
          totalBeatsScheduled = Number(flat?.totalBeats) || 0;
      } else {
          eventsByBeat = [];
          totalBeatsScheduled = 0;
      }
      
      if (!Number.isFinite(totalBeatsScheduled) || totalBeatsScheduled <= 0) {
          totalBeatsScheduled = measureStartBeats[measureStartBeats.length - 1] || 0;
      }
      
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

  // --- NEW: Quick Select Buttons Logic ---
  const btnAll = $("btnAll");
  const btnRandom = $("btnRandom");
  const btnNone = $("btnNone");
  const btnStraight = $("btnStraight");
  const btnTriplets = $("btnTriplets");

  const rhythmInputs = [
      allowQuartersEl, allowQuarterTripletsEl, allow8thsEl, 
      allowQuintupletsEl, allowTripletsEl, allow16thsEl, allowSextupletsEl
  ];

  function setRhythms(actives) {
      rhythmInputs.forEach(el => {
          if (el) el.checked = actives.includes(el.id);
      });
  }

  if (btnAll) btnAll.onclick = () => {
      rhythmInputs.forEach(el => { if(el) el.checked = true; });
  };

  if (btnRandom) btnRandom.onclick = () => {
      rhythmInputs.forEach(el => { 
          // 50% chance for each rhythm to be checked
          if(el) el.checked = Math.random() < 0.5; 
      });
  };

  if (btnNone) btnNone.onclick = () => {
      rhythmInputs.forEach(el => { if(el) el.checked = false; });
  };

  if (btnStraight) btnStraight.onclick = () => {
      // Straight = Quarters, 8ths, 16ths
      setRhythms(["allowQuarters", "allow8ths", "allow16ths"]);
  };

  if (btnTriplets) btnTriplets.onclick = () => {
      // Triplets = Quarter Triplets, Triplets, 6-lets
      setRhythms(["allowQuarterTriplets", "allowTriplets"]);
  };

  safeRenderAllIcons();
  regenerate();
});