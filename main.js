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
  const allow16thQuintupletsEl = $("allow16thQuintuplets"); // NEW
  const allowSextupletsEl = $("allowSextuplets"); 
  const allowDottedQuartersEl = $("allowDottedQuarters");
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
  if (measuresEl) measuresEl.value = "4";
  if (tempoEl) tempoEl.value = "100";
  if (restsEl) restsEl.value = "20";
   
  if (stickingInputEl) stickingInputEl.value = "Natural";
  if (timeSigInput) timeSigInput.value = "4/4"; // NEW: Force UI to 4/4
  if (leadHandToggleEl) leadHandToggleEl.checked = true; // Force Right Hand
   
  if (showStickingEl) showStickingEl.checked = true;
  if (showCountsEl) showCountsEl.checked = true;
  if (metronomeToggleEl) metronomeToggleEl.checked = true;
  
  // NEW: Syncopation Default
  if ($("allowSyncopation")) $("allowSyncopation").checked = false;

  // Force Rhythm Tiles ON
  if (allowDottedQuartersEl) allowDottedQuartersEl.checked = true; 
  if (allowQuartersEl) allowQuartersEl.checked = true;
  if (allow8thsEl) allow8thsEl.checked = true;
  if (allow16thsEl) allow16thsEl.checked = true;
  if (allowTripletsEl) allowTripletsEl.checked = true;
  if (allowQuarterTripletsEl) allowQuarterTripletsEl.checked = true;
  if (allowQuintupletsEl) allowQuintupletsEl.checked = true;
  if (allow16thQuintupletsEl) allow16thQuintupletsEl.checked = true;
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
      // Simple
      { label: "2/4", value: "2/4" },
      { label: "3/4", value: "3/4" },
      { label: "4/4", value: "4/4" },
      { label: "5/4", value: "5/4" },
      { label: "6/4", value: "6/4" },
      
      // Compound (Now comes second)
      { label: "6/8", value: "6/8" },
      { label: "9/8", value: "9/8" },
      { label: "12/8", value: "12/8" },

      // Asymmetric (Now comes last)
      { label: "5/8", value: "5/8" },
      { label: "7/8", value: "7/8" }
  ];


  // Picker Elements
  const pickerOverlay = $("pickerOverlay");
  const pickerTitle = $("pickerTitle");
  // const pickerSearch = $("pickerSearch"); // REMOVED
  const pickerList = $("pickerList");
  const pickerClose = $("pickerClose");

// UPDATED: Compact buttons, flexible wrapping, flattened logic
function showPicker({ theme = 'orange', title = 'Select', multi = false, items, selected = [], defaults = [], quickActions = [], twoColumns = false, groupBy, onSave }) {
    pickerOverlay.classList.remove('picker--orange', 'picker--purple');
    pickerOverlay.classList.add(theme === 'purple' ? 'picker--purple' : 'picker--orange');
    pickerTitle.textContent = title;
    
    const listItems = (typeof items === 'function') ? items() : items;
    const isVisual = listItems.length > 0 && listItems[0].notes;

    // === WIDTH LOGIC ===
    if (isVisual) {
        pickerOverlay.classList.remove('picker--narrow');
    } else {
        pickerOverlay.classList.add('picker--narrow');
    }

    pickerList.classList.remove('picker__list--two-col', 'picker__list--visual');
    if (isVisual) {
        pickerList.classList.add('picker__list--visual');
    } else if (twoColumns) {
        pickerList.classList.add('picker__list--two-col');
    }

    let currentSelection = new Set(selected);

    // Cleanup old elements
    const existingFooter = pickerOverlay.querySelector(".picker__footer");
    if (existingFooter) existingFooter.remove();
    const existingQuick = pickerOverlay.querySelector(".picker__quick-actions");
    if (existingQuick) existingQuick.remove();

    const modal = pickerOverlay.querySelector(".picker__modal");

    if (quickActions && quickActions.length > 0) {
        const footer = document.createElement("div");
        footer.className = "picker__footer";
        
        // === COMPACT FOOTER STYLING ===
        footer.style.display = "flex";
        footer.style.flexWrap = "wrap";
        footer.style.justifyContent = "center";
        footer.style.gap = "6px"; 
        footer.style.padding = "10px"; // Slightly tighter padding

        // Render buttons in a flat list
        quickActions.forEach(qa => {
            // Note: qa should be a single object now, grouping logic handled in setupTileInteractions
            const btn = createActionButton(qa);
            footer.appendChild(btn);
        });
        
        modal.appendChild(footer);
    }
    
    // Helper to create the button element
    function createActionButton(qa) {
        const btn = document.createElement("button");
        let colorClass = "btn-purple";
        if (qa.color) {
            colorClass = `btn-${qa.color}`;
        } else {
            if (["All", "Random", "Full"].includes(qa.label)) colorClass = "btn-orange";
            if (["Deselect", "None"].includes(qa.label)) colorClass = "btn-blue";
        }
        btn.className = `btn btn-quick ${colorClass}`;
        btn.textContent = qa.label;
        
        // === UPDATED: EVEN WIDTHS ===
        // flex: 1 1 0px -> Forces all buttons to ignore text length and share width equally.
        btn.style.flex = "1 1 0px"; 
        btn.style.minWidth = "0"; 
        
        btn.style.height = "36px"; // Compact height
        btn.style.fontSize = "0.9rem"; // Slightly smaller font
        btn.style.padding = "0 2px"; // Minimal padding to maximize space for text
        btn.style.whiteSpace = "nowrap"; 
        btn.style.overflow = "hidden"; // Safety clipping
        btn.style.textOverflow = "ellipsis";

        btn.onclick = () => {
            const allItems = (typeof items === 'function') ? items() : items;
            const newSet = qa.action(allItems, currentSelection);
            if (newSet) {
                currentSelection = newSet;
                render();
                if (onSave) onSave(Array.from(currentSelection));
            }
        };
        return btn;
    }

    pickerOverlay.hidden = false;
    pickerOverlay.setAttribute('aria-hidden', 'false');
    
    function render() {
        pickerList.innerHTML = '';
        const list = (typeof items === 'function') ? items() : items;
        
        // === GROUPING LOGIC ===
        let groups = [];
        if (groupBy) {
            const bucketMap = new Map();
            list.forEach(item => {
                const key = groupBy(item);
                if (!bucketMap.has(key)) bucketMap.set(key, []);
                bucketMap.get(key).push(item);
            });
            bucketMap.forEach((groupItems, key) => {
                groups.push({ title: key, items: groupItems });
            });
        } else {
            groups.push({ title: null, items: list });
        }

        let lastSuperHeader = null;

        groups.forEach(group => {
            if (group.title) {
                // === SUB-HEADER LOGIC ===
                const parts = group.title.split('|||');
                if (parts.length > 1) {
                    const superHeader = parts[0].trim();
                    const subHeader = parts[1].trim();

                    if (superHeader !== lastSuperHeader) {
                        const sh = document.createElement("li");
                        // Apply Main Header Class
                        sh.className = "picker__header picker__header--main"; 
                        sh.textContent = superHeader;
                        pickerList.appendChild(sh);
                        lastSuperHeader = superHeader;
                    }

                    const sub = document.createElement("li");
                    // Apply Sub Header Class
                    sub.className = "picker__header picker__header--sub"; 
                    sub.textContent = subHeader;
                    pickerList.appendChild(sub);

                } else {
                    const header = document.createElement("li");
                    // UPDATE: Apply the '--sub' class so it looks exactly like the Note Grouping headers
                    header.className = "picker__header picker__header--sub";
                    header.textContent = group.title;
                    pickerList.appendChild(header);
                }
            }

            group.items.forEach((it) => {
                const li = document.createElement('li');
                const val = it.id || it.value || it.strategy || it.label; 
                const isSelected = multi ? currentSelection.has(val) : (selected[0] === val);

                if (isVisual) {
                    li.className = 'picker__item--tile';
                    const cb = document.createElement("input");
                    cb.type = "checkbox";
                    cb.className = "picker__checkbox";
                    cb.checked = isSelected;
                    cb.onchange = () => toggle(val);
                    li.appendChild(cb);
                    
                    const tick = document.createElement("span");
                    tick.className = "picker__tick";
                    li.appendChild(tick);
                    
                    const canvasWrap = document.createElement("div");
                    canvasWrap.className = "picker__canvas-wrap";
                    const canvas = document.createElement("canvas");
                    const canvasId = `picker_cvs_${val}`; 
                    canvas.id = canvasId;
                    canvas.className = "rhythmCanvas"; 
                    canvas.width = 130; 
                    canvas.height = 70; 
                    canvasWrap.appendChild(canvas);
                    li.appendChild(canvasWrap);
                    
                    requestAnimationFrame(() => {
                        let clonedNotes = JSON.parse(JSON.stringify(it.notes));
                        let tupletConfig = null;
                        if (val.startsWith("8t") || val.startsWith("qt")) tupletConfig = { num_notes: 3, notes_occupied: 2 };
                        if (val.startsWith("5let")) tupletConfig = { num_notes: 5, notes_occupied: 4 };
                        if (val.startsWith("6let")) tupletConfig = { num_notes: 6, notes_occupied: 4 };
                        if (it._tuplet !== undefined) tupletConfig = it._tuplet;

                        const isComplexTuplet = tupletConfig || val.startsWith("5let") || val.startsWith("6let");
                        if (!isComplexTuplet) {
                            if (typeof normalizeSixteenthGridBeat === 'function') clonedNotes = normalizeSixteenthGridBeat(clonedNotes);
                            if (typeof normalizeEighthRestEighth === 'function') clonedNotes = normalizeEighthRestEighth(clonedNotes);
                            if (typeof simplifyBeat === 'function') clonedNotes = simplifyBeat(clonedNotes);
                        }
                        
                        const shouldBeam = !val.startsWith("qt"); 
                        renderRhythmIcon(canvasId, {
                            notes: clonedNotes,
                            num_beats: clonedNotes.reduce((s,n)=>s+(n.beats||0), 0),
                            beat_value: 4,
                            beam: shouldBeam, 
                            tuplet: tupletConfig 
                        });
                    });

                    li.addEventListener('click', (e) => { if (e.target !== cb) toggle(val); });

                } else {
                    li.className = 'picker__item';
                    if (isSelected) li.classList.add("is-active");
                    if (multi) {
                        const cb = document.createElement("input");
                        cb.type = "checkbox";
                        cb.className = "picker__checkbox";
                        cb.checked = isSelected;
                        cb.onclick = (e) => e.stopPropagation(); 
                        cb.onchange = () => toggle(val);
                        li.appendChild(cb);
                    }
                    const labelSpan = document.createElement("span");
                    labelSpan.textContent = it.label;
                    li.appendChild(labelSpan);
                    li.addEventListener('click', () => { 
                        if (multi) toggle(val);
                        else { onSave([val]); closePicker(); }
                    });
                }
                pickerList.appendChild(li);
            });
        });
    }

    function toggle(val) {
        if (currentSelection.has(val)) currentSelection.delete(val);
        else currentSelection.add(val);
        render();
        if (onSave) onSave(Array.from(currentSelection));
    }

    function closePicker() {
        pickerOverlay.hidden = true;
        pickerOverlay.setAttribute('aria-hidden', 'true');
        const f = pickerOverlay.querySelector(".picker__footer");
        if(f) f.remove();
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

    // Reset transform
    const raw = ctx.context || ctx;
    if (raw.setTransform) raw.setTransform(1, 0, 0, 1, 0, 0);
    raw.clearRect(0, 0, W, H);

    // === 1. CONSISTENT SCALING ===
    const isSmall = H < 85;
    const scale = isSmall ? 0.75 : 0.90;
    
    // === 2. VERTICAL CENTERING ===
    const virtualH = H / scale;
    const staveY = (virtualH / 2) - 35; 

    ctx.save();
    ctx.scale(scale, scale);

    ctx.setFont("Arial", 10, "");
    raw.fillStyle = "#000";
    raw.strokeStyle = "#000";

    // === 3. INVISIBLE STAVE ===
    const stave = new flow.Stave(0, staveY, (W / scale)); 
    stave.setStyle({ strokeStyle: "rgba(0,0,0,0)", fillStyle: "rgba(0,0,0,0)" }); // Invisible
    stave.setContext(ctx);

    // === 4. NOTES ===
    const notes = recipe.notes.map((n) => {
      const isRest = (n.kind === "rest") || !!n.rest;
      const dur = n.dur + (isRest ? "r" : "");
      
      let keys = isRest ? ["b/4"] : ["c/5"];
      if (isRest && recipe.tuplet) keys = ["a/4"];

      const sn = new flow.StaveNote({
        clef: "percussion", 
        keys: keys,
        duration: dur,
      });

      if (isRest) {
          if (recipe.tuplet) sn.setKeyLine(0, 4.0); 
          else sn.setKeyLine(0, 4);
      }

      const dots = Number(n.dots || 0);
      if (dots > 0) {
        for (let i = 0; i < dots; i++) {
          if (flow.Dot?.buildAndAttach) flow.Dot.buildAndAttach([sn], { all: true });
          else if (sn.addDotToAll) sn.addDotToAll();
          else if (sn.addDot) sn.addDot(0);
        }
      }

      sn.setStemDirection(flow.Stem.UP).setStemLength(30);
      sn.setContext(ctx);
      sn.setStave(stave);
      return sn;
    });

    const voice = new flow.Voice({ num_beats: recipe.num_beats, beat_value: recipe.beat_value }).setStrict(false);
    voice.addTickables(notes);

    const formatter = new flow.Formatter();
    formatter.joinVoices([voice]);
    
    // === 5. FORMATTING ===
    formatter.format([voice], (W / scale) - 10);

    // === 6. BEAMS & TUPLETS ===
    const beams = [];
    if (recipe.beam) {
        let currentGroup = [];
        notes.forEach((note, index) => {
            const rawNote = recipe.notes[index];
            const isRest = rawNote.kind === "rest" || !!rawNote.rest;
            const isBeamable = !isRest && ["8", "16", "32"].includes(rawNote.dur);

            if (isBeamable) {
                currentGroup.push(note);
            } else {
                if (currentGroup.length > 1) {
                    const b = new flow.Beam(currentGroup, false);
                    b.setBeamDirection?.(flow.Stem.UP);
                    beams.push(b);
                }
                currentGroup = [];
            }
        });
        if (currentGroup.length > 1) {
            const b = new flow.Beam(currentGroup, false);
            b.setBeamDirection?.(flow.Stem.UP);
            beams.push(b);
        }
    }

    const tupletsToDraw = [];

    // A. GLOBAL TUPLET
    if (recipe.tuplet) {
      // Check if all notes are beamable (no rests, no quarter notes)
      const allBeamable = recipe.notes.every(n => n.kind !== 'rest' && ["8", "16", "32"].includes(n.dur));
      
      tupletsToDraw.push(new flow.Tuplet(notes, {
        num_notes: recipe.tuplet.num_notes,
        notes_occupied: recipe.tuplet.notes_occupied,
        bracketed: !allBeamable, // Hide bracket if beam spans all
        ratioed: false,
      }));
    }

    // B. LOCAL TUPLETS
    let localBuffer = []; // stores {vfNote, rawNote}
    recipe.notes.forEach((rawNote, i) => {
        if (rawNote._localTuplet) {
            localBuffer.push({ vf: notes[i], raw: rawNote });
        } else {
            if (localBuffer.length > 0) {
                const allBeamable = localBuffer.every(x => x.raw.kind !== 'rest' && ["8", "16", "32"].includes(x.raw.dur));
                tupletsToDraw.push(new flow.Tuplet(localBuffer.map(x=>x.vf), { 
                    num_notes: 3, 
                    notes_occupied: 2, 
                    bracketed: !allBeamable, 
                    ratioed: false 
                }));
                localBuffer = [];
            }
        }
    });
    // Flush remaining
    if (localBuffer.length > 0) {
        const allBeamable = localBuffer.every(x => x.raw.kind !== 'rest' && ["8", "16", "32"].includes(x.raw.dur));
        tupletsToDraw.push(new flow.Tuplet(localBuffer.map(x=>x.vf), { 
            num_notes: 3, 
            notes_occupied: 2, 
            bracketed: !allBeamable, 
            ratioed: false 
        }));
    }

    // === 7. DRAW ===
    voice.draw(ctx, stave);
    beams.forEach(b => b.setContext(ctx).draw());
    tupletsToDraw.forEach(t => t.setContext(ctx).draw());

    ctx.restore();
  } catch (e) {
    console.warn("Icon render failed:", canvasId, e);
  }
}





  function safeRenderAllIcons() {
    // NEW: Dotted Quarter Icon
    renderRhythmIcon("dottedQuarterIcon", {
      num_beats: 2, beat_value: 4, // 1.5 beats, but give it 2 beats of space to render cleanly
      beam: false,
      notes: [{ dur: "q", dots: 1 }],
    });

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
      tuplet: { num_notes: 5, notes_occupied: 4, bracketed: false }, 
      notes: [{ dur: "8" }, { dur: "8" }, { dur: "8" }, { dur: "8" }, { dur: "8" }],
    });

    // NEW: 16th Note 5-let Icon (1 Beat)
    renderRhythmIcon("sixteenthQuintupletIcon", {
      num_beats: 1, beat_value: 4,
      beam: true,
      tuplet: { num_notes: 5, notes_occupied: 4, bracketed: false }, 
      notes: [{ dur: "16" }, { dur: "16" }, { dur: "16" }, { dur: "16" }, { dur: "16" }],
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

  // UPDATED HELPER: Forces "Preserve" mode so the engine does not auto-correct your designs
  // isFallback = true means it's random filler (can be cleaned up)
  // isFallback = false (default) means it came from a Tile (MUST BE PRESERVED)
  const make = (dur, beats, dots = 0, isFallback = false) => ({ 
      kind: "note", dur, beats, dots, 
      _preserve: !isFallback 
  });
  
  const R = (dur, beats, dots = 0) => ({ 
      kind: "rest", dur, beats, dots, 
      _preserve: true 
  });

  // NEW HELPER: Simplify Compound Rests (e.g. 3 eighth rests -> 1 dotted quarter rest)
  function simplifyCompoundChunk(chunk) {
      if (!chunk || chunk.length === 0) return chunk;
      if (chunk._preserve) return chunk; // RESPECT THE TILE

      const isRest = (n) => n.kind === "rest";
      const is8 = (n) => n.dur === "8";
      
      // Pattern: 3 Eighth Rests -> Dotted Quarter Rest
      if (chunk.length === 3 && chunk.every(n => isRest(n) && is8(n))) {
          return [{ kind: "rest", dur: "q", dots: 1, beats: 1.5 }];
      }
      
      // Pattern: Rest Rest Note (8ths) -> Quarter Rest + Note
      if (chunk.length === 3 && isRest(chunk[0]) && isRest(chunk[1]) && !isRest(chunk[2])) {
          return [{ kind: "rest", dur: "q", beats: 1.0 }, chunk[2]];
      }

      // Pattern: Note Rest Rest (8ths) -> Note + Quarter Rest
      if (chunk.length === 3 && !isRest(chunk[0]) && isRest(chunk[1]) && isRest(chunk[2])) {
          return [chunk[0], { kind: "rest", dur: "q", beats: 1.0 }];
      }
      
      return chunk;
  }

// Updated: Compound Generator (Fixes missing _preserve flag on pool items)
function pickCompoundBeatPattern({ restPct, allowDottedQuarters, allowQuarters, allow8ths, allow16ths, beatsLeft }) {
     const pool = [];
     const eps = 0.01;

     const isCompoundPulse = Math.abs(beatsLeft - 1.5) < eps;
     const isSimplePulse = Math.abs(beatsLeft - 1.0) < eps;

     // === NEW: 0% REST STRICT MODE ===
     // 8s_11 = "1 &" (Simple)
     // 8s_c_111 = "1 2 3" (Compound)
     // 8s_10 (Quarter) is EXCLUDED from this list, so it won't appear at 0% rests
     const FULL_COMPOUND_IDS = ["q_1", "dq_1", "8s_11", "8s_c_111", "16s_1111", "6let_111111"];

     // --- A. SIMPLE PULSE (2 Eighths / 1 Beat) ---
     if (isSimplePulse) {
         if (allowQuarters) pool.push({ id: "q_simple", w: 10, notes: [make("q", 1.0)] });
         
         if (allow8ths && RHYTHM_VARIANTS["8s"]) {
             RHYTHM_VARIANTS["8s"].forEach(v => {
                 if (activeVariations.has(v.id) && !v._isCompoundVariant) {
                    // STRICT CHECK: If 0% Rest, only allow "8s_11"
                    if (restPct === 0 && !FULL_COMPOUND_IDS.includes(v.id)) return;

                    pool.push({ 
                        id: v.id, 
                        w: v.w, 
                        notes: JSON.parse(JSON.stringify(v.notes)),
                        _preserve: v._preserve 
                    });
                 }
             });
         }
         
         if (allow16ths && RHYTHM_VARIANTS["16s"]) {
             RHYTHM_VARIANTS["16s"].forEach(v => {
                 if (activeVariations.has(v.id)) {
                     // STRICT CHECK
                     if (restPct === 0 && !FULL_COMPOUND_IDS.includes(v.id)) return;

                     pool.push({ 
                        id: v.id, 
                        w: v.w, 
                        notes: JSON.parse(JSON.stringify(v.notes)),
                        _preserve: v._preserve
                     });
                 }
             });
         }
         if (pool.length === 0) return [{ kind: "note", dur: "q", beats: 1.0 }];
     }

     // --- B. COMPOUND PULSE (3 Eighths / 1.5 Beats) ---
     else if (isCompoundPulse) {
         
         // 1. Dotted Quarter
         if (allowDottedQuarters) {
             if (activeVariations.has("dq_1")) pool.push({ id: "dq_1", w: 10, notes: [make("q", 1.5, 1)] });
             if (restPct > 20) pool.push({ id: "dq_rest", w: 5, notes: [R("q", 1.5, 1)] });
         }

         // 2. Compound 8ths (Only from 8s list)
         if (allow8ths && RHYTHM_VARIANTS["8s"]) {
             RHYTHM_VARIANTS["8s"].forEach(v => {
                 if (activeVariations.has(v.id) && v._isCompoundVariant) {
                     // STRICT CHECK: If 0% Rest, only allow "8s_c_111"
                     if (restPct === 0 && !FULL_COMPOUND_IDS.includes(v.id)) return;

                     pool.push({ 
                        id: v.id, 
                        w: v.w, 
                        notes: JSON.parse(JSON.stringify(v.notes)),
                        _preserve: v._preserve
                     });
                 }
             });
         }

         // 3. Compound 16ths
         if (allow16ths && RHYTHM_VARIANTS["6let"]) {
             RHYTHM_VARIANTS["6let"].forEach(v => {
                 if (activeVariations.has(v.id)) {
                     // STRICT CHECK
                     if (restPct === 0 && !FULL_COMPOUND_IDS.includes(v.id)) return;
                     
                     let notes;
                     // ... (keep existing manual conversions for 6let) ...
                     // ... Copy/paste your existing 6let logic here ...
                     
                     // === SHORTCUT FOR YOU: I will just show the push logic below ===
                     // (You don't need to change the big "if/else if" block for 6let manual notes, 
                     // just wrap the pool.push or the loop entry)
                     
                     // RE-USING THE LOGIC FROM PREVIOUS FILE FOR CLARITY:
                     if (v.id === "6let_111100") {
                         notes = [make("16", 0.25), make("16", 0.25), make("16", 0.25), make("8", 0.75, 1)];
                     }
                     // ... (other manual conversions) ...
                     else {
                         notes = v.notes.map(n => {
                             let newDur = "16";
                             let newBeats = 0.25;
                             if (n.dur === "8") { newDur = "8"; newBeats = 0.5; }
                             if (n.dur === "q") { newDur = "q"; newBeats = 1.0; }
                             return { ...n, beats: newBeats, dur: newDur, _localTuplet: undefined, _tuplet: undefined };
                         });
                     }
                     
                     pool.push({ 
                        id: v.id, 
                        w: v.w, 
                        notes: notes,
                        _preserve: v._preserve
                     });
                 }
             });
         }

         if (pool.length === 0) return [{ kind: "note", dur: "q", dots: 1, beats: 1.5, _compoundGrid: true }];
     }

     // --- C. WEIRD FILLER ---
     else {
         if (Math.abs(beatsLeft - 0.5) < eps) return [{ kind: Math.random() * 100 < restPct ? "rest" : "note", dur: "8", beats: 0.5 }];
         return [{ kind: "note", dur: "q", beats: 1.0 }]; 
     }

     const totalW = pool.reduce((s, x) => s + x.w, 0);
     let r = Math.random() * totalW;
     let choice = pool[0];
     for (const item of pool) {
        r -= item.w;
        if (r <= 0) { choice = item; break; }
     }

     const result = JSON.parse(JSON.stringify(choice.notes));
     
     // FIX: Now this will actually work because we copied it to 'choice' above
     if (choice._preserve) result._preserve = true; 

     if (isCompoundPulse) result._compoundGrid = true;
     return result;
}

// This replaces the "Math Generator" with a "Curated Database"
// You can edit, delete, or add lines here to control EXACTLY what appears in the picker.

const RHYTHM_VARIANTS = {
    // === 1. Simple Beats ===
    "dottedQ": [ 
        { id: "dq_1", label: "Dotted Quarter", notes: [make("q", 1.5, 1)], w: 10 } 
    ],
    "q": [ 
        { id: "q_1", label: "Quarter Note", notes: [make("q", 1.0)], w: 10 } 
    ],
    "8s": [
        // === Simple Time (Standard) ===
        { id: "8s_11", label: "2 8ths", notes: [make("8", 0.5), make("8", 0.5)], w: 10 },
        { id: "8s_10", label: "Quarter (10)", notes: [make("q", 1.0)], w: 5 },
        { id: "8s_01", label: "& of 1", notes: [R("8", 0.5), make("8", 0.5)], w: 5 },
        
        // === Compound Time (The 6 Triplet Modulations) ===
        // We use _preserve:true to FORCE exact notation (preventing 8-8-8r -> 8-q bugs)
        
        // 1. Full (1-1-1) -> 8-8-8
        { id: "8s_c_111", label: "1-2-3", notes: [make("8", 0.5), make("8", 0.5), make("8", 0.5)], w: 10, _isCompoundVariant: true, _preserve: true },
        
        // 2. Trip-let-rest (1-1-0) -> 8-8-8r
        { id: "8s_c_110", label: "1-2-R", notes: [make("8", 0.5), make("8", 0.5), R("8", 0.5)], w: 6, _isCompoundVariant: true, _preserve: true },
        
        // 3. Swing (1-0-1) -> Q-8
        { id: "8s_c_101", label: "1-(2)-3", notes: [make("q", 1.0), make("8", 0.5)], w: 8, _isCompoundVariant: true, _preserve: true },
        
        // 4. Rest-let-trip (0-1-1) -> 8r-8-8
        { id: "8s_c_011", label: "R-2-3", notes: [R("8", 0.5), make("8", 0.5), make("8", 0.5)], w: 6, _isCompoundVariant: true, _preserve: true },
        
        // 5. Middle Note (0-1-0) -> 8r-Q
        { id: "8s_c_010", label: "R-2-(3)", notes: [R("8", 0.5), make("q", 1.0)], w: 4, _isCompoundVariant: true, _preserve: true },
        
        // 6. Last Note (0-0-1) -> Qr-8
        { id: "8s_c_001", label: "R-(2)-3", notes: [R("q", 1.0), make("8", 0.5)], w: 4, _isCompoundVariant: true, _preserve: true }
    ],

    // === 2. 16th Note Grid (Curated for readability) ===
    "16s": [
        // 4 Notes
        { id: "16s_1111", label: "1 e & a", notes: [make("16", 0.25), make("16", 0.25), make("16", 0.25), make("16", 0.25)], w: 10 },
        
        // 3 Notes
        // FIX: Changed "16, 16, 16, 16r" to "16, 16, 8" (Sustains the &)
        { id: "16s_1110", label: "1 e &", notes: [make("16", 0.25), make("16", 0.25), make("8", 0.5)], w: 6 },
        { id: "16s_1101", label: "Reverse Gallop", notes: [make("16", 0.25), make("8", 0.5), make("16", 0.25)], w: 8 },
        { id: "16s_1011", label: "Gallop (1 &a)", notes: [make("8", 0.5), make("16", 0.25), make("16", 0.25)], w: 8 },
        { id: "16s_0111", label: "e & a", notes: [R("16", 0.25), make("16", 0.25), make("16", 0.25), make("16", 0.25)], w: 6 },
        
        // 2 Notes
        // FIX: Changed "16, 16, 8r" to "16, dotted-8" (Sustains the e)
        { id: "16s_1100", label: "1 e", notes: [make("16", 0.25), make("8", 0.75, 1)], w: 6 },
        
        { id: "16s_1010", label: "1 & (8ths)", notes: [make("8", 0.5), make("8", 0.5)], w: 2 }, 
        { id: "16s_1001", label: "1 ... a", notes: [make("8", 0.75, 1), make("16", 0.25)], w: 7 },
        
        // FIX: Changed end rest to sustained note
        { id: "16s_0110", label: "e &", notes: [R("16", 0.25), make("16", 0.25), make("8", 0.5)], w: 6 },
        
        { id: "16s_0101", label: "Off-beats (e a)", notes: [R("16", 0.25), make("16", 0.25), R("16", 0.25), make("16", 0.25)], w: 4 },
        { id: "16s_0011", label: "& a", notes: [R("8", 0.5), make("16", 0.25), make("16", 0.25)], w: 6 },
        
        // 1 Note (Syncopation)
        { id: "16s_1000", label: "Quarter (1000)", notes: [make("q", 1.0)], w: 5 },
        { id: "16s_0100", label: "e", notes: [R("16", 0.25), make("8", 0.75, 1)], w: 5 },
        { id: "16s_0010", label: "&", notes: [R("8", 0.5), make("8", 0.5)], w: 2 },
        { id: "16s_0001", label: "a", notes: [R("8", 0.75, 1), make("16", 0.25)], w: 5 }
    ],

    // === 3. Triplets (Standard) ===
    "8t": [
        { id: "8t_111", label: "Trip-let-trip", notes: [make("8", 1/3), make("8", 1/3), make("8", 1/3)], w: 10 },
        { id: "8t_110", label: "Trip-let-rest", notes: [make("8", 1/3), make("8", 1/3), R("8", 1/3)], w: 6 },
        { id: "8t_101", label: "Swing (Trip-skip-trip)", notes: [make("q", 2/3), make("8", 1/3)], w: 8 },
        // NO TUPLET BRACKET FOR QUARTER NOTE
        { id: "8t_100", label: "Quarter (100)", notes: [make("q", 1.0)], w: 5, _tuplet: false }, 
        { id: "8t_011", label: "Rest-let-trip", notes: [R("8", 1/3), make("8", 1/3), make("8", 1/3)], w: 6 },
        { id: "8t_010", label: "Middle note", notes: [R("8", 1/3), make("q", 2/3)], w: 4 }, 
        { id: "8t_001", label: "Last note", notes: [R("q", 2/3), make("8", 1/3)], w: 4 }
    ],

// === 4. Quarter Triplets (3 notes over 2 beats) ===
    "qt": [
        // 111 (Note-Note-Note)
        { id: "qt_111", label: "Full Triplet", notes: [make("q", 2/3), make("q", 2/3), make("q", 2/3)], w: 10 },
        
        // 110 (Note-Note-Rest)
        { id: "qt_110", label: "Long-Short", notes: [make("q", 2/3), make("q", 2/3), R("q", 2/3)], w: 6 },
        
        // 101 (Note-Rest-Note)
        { id: "qt_101", label: "Swing (1 ... 3)", notes: [make("q", 2/3), R("q", 2/3), make("q", 2/3)], w: 6 },
        
        // 100 (Quarter + Quarter Rest)
        // NO TUPLET BRACKET (Standard 2 beats)
        { id: "qt_100", label: "Quarter+Rest", notes: [make("q", 1.0), R("q", 1.0)], w: 5, _tuplet: false },

        // 011 (Rest-Note-Note)
        { id: "qt_011", label: "Pickup (2-3)", notes: [R("q", 2/3), make("q", 2/3), make("q", 2/3)], w: 6 },
        
        // 010 (Rest-Note-Rest)
        { id: "qt_010", label: "Middle Only", notes: [R("q", 2/3), make("q", 2/3), R("q", 2/3)], w: 4 },
        
        // 001 (Rest-Rest-Note)
        { id: "qt_001", label: "Last Only", notes: [R("q", 2/3), R("q", 2/3), make("q", 2/3)], w: 4 }
    ],

// === 5. Quintuplets (5 notes over 2 beats) ===
    "5let": [
        // ============================
        // === 5 NOTES ===
        // ============================
        // 11111 (31)
        { id: "5let_11111", label: "Full 5", notes: Array(5).fill(make("8", 0.4)), w: 10 },

        // ============================
        // === 4 NOTES ===
        // ============================
        // 11110 (30) -> 1, 2, 3, 4(2)
        { id: "5let_11110", label: "1-2-3-4(q)", notes: [make("8", 0.4), make("8", 0.4), make("8", 0.4), make("q", 0.8)], w: 5 },
        // 11101 (29) -> 1, 2, 3(2), 5
        { id: "5let_11101", label: "1-2-3(q)-5", notes: [make("8", 0.4), make("8", 0.4), make("q", 0.8), make("8", 0.4)], w: 5 },
        // 11011 (27) -> 1, 2(2), 4, 5
        { id: "5let_11011", label: "1-2(q)-4-5", notes: [make("8", 0.4), make("q", 0.8), make("8", 0.4), make("8", 0.4)], w: 5 },
        // 10111 (23) -> 1(2), 3, 4, 5
        { id: "5let_10111", label: "1(q)-3-4-5", notes: [make("q", 0.8), make("8", 0.4), make("8", 0.4), make("8", 0.4)], w: 5 },
        // 01111 (15) -> R, 2, 3, 4, 5
        { id: "5let_01111", label: "R-2-3-4-5", notes: [R("8", 0.4), make("8", 0.4), make("8", 0.4), make("8", 0.4), make("8", 0.4)], w: 5 },

        // ============================
        // === 3 NOTES ===
        // ============================
        // 11100 (28) -> 1, 2, 3(3)
        { id: "5let_11100", label: "1-2-3(d.q)", notes: [make("8", 0.4), make("8", 0.4), make("q", 1.2, 1)], w: 5 },
        // 11010 (26) -> 1, 2(2), 4(2)
        { id: "5let_11010", label: "1-2(q)-4(q)", notes: [make("8", 0.4), make("q", 0.8), make("q", 0.8)], w: 5 },
        // 11001 (25) -> 1, 2(3), 5
        { id: "5let_11001", label: "1-2(d.q)-5", notes: [make("8", 0.4), make("q", 1.2, 1), make("8", 0.4)], w: 5 },
        // 10110 (22) -> 1(2), 3, 4(2)
        { id: "5let_10110", label: "1(q)-3-4(q)", notes: [make("q", 0.8), make("8", 0.4), make("q", 0.8)], w: 5 },
        // 10101 (21) -> 1(2), 3(2), 5
        { id: "5let_10101", label: "1(q)-3(q)-5", notes: [make("q", 0.8), make("q", 0.8), make("8", 0.4)], w: 5 },
        // 10011 (19) -> 1(3), 4, 5
        { id: "5let_10011", label: "1(d.q)-4-5", notes: [make("q", 1.2, 1), make("8", 0.4), make("8", 0.4)], w: 5 },
        // 01110 (14) -> R, 2, 3, 4(2)
        { id: "5let_01110", label: "2-3-4(q)", notes: [R("8", 0.4), make("8", 0.4), make("8", 0.4), make("q", 0.8)], w: 5 },
        // 01101 (13) -> R, 2, 3(2), 5
        { id: "5let_01101", label: "2-3(q)-5", notes: [R("8", 0.4), make("8", 0.4), make("q", 0.8), make("8", 0.4)], w: 5 },
        // 01011 (11) -> R, 2(2), 4, 5
        { id: "5let_01011", label: "2(q)-4-5", notes: [R("8", 0.4), make("q", 0.8), make("8", 0.4), make("8", 0.4)], w: 5 },
        // 00111 (7) -> R(2), 3, 4, 5
        { id: "5let_00111", label: "3-4-5", notes: [R("q", 0.8), make("8", 0.4), make("8", 0.4), make("8", 0.4)], w: 5 },

        // ============================
        // === 2 NOTES ===
        // ============================
        // 11000 (24) -> 1, 2(4)
        { id: "5let_11000", label: "1-2(h)", notes: [make("8", 0.4), make("h", 1.6)], w: 4 },
        // 10100 (20) -> 1(2), 3(3)
        { id: "5let_10100", label: "1(q)-3(d.q)", notes: [make("q", 0.8), make("q", 1.2, 1)], w: 4 },
        // 10010 (18) -> 1(3), 4(2)
        { id: "5let_10010", label: "1(d.q)-4(q)", notes: [make("q", 1.2, 1), make("q", 0.8)], w: 4 },
        // 10001 (17) -> 1(4), 5
        { id: "5let_10001", label: "1(h)-5", notes: [make("h", 1.6), make("8", 0.4)], w: 4 },
        // 01100 (12) -> R, 2, 3(3)
        { id: "5let_01100", label: "2-3(d.q)", notes: [R("8", 0.4), make("8", 0.4), make("q", 1.2, 1)], w: 4 },
        // 01010 (10) -> R, 2(2), 4(2)
        { id: "5let_01010", label: "2(q)-4(q)", notes: [R("8", 0.4), make("q", 0.8), make("q", 0.8)], w: 4 },
        // 01001 (9) -> R, 2(3), 5
        { id: "5let_01001", label: "2(d.q)-5", notes: [R("8", 0.4), make("q", 1.2, 1), make("8", 0.4)], w: 4 },
        // 00110 (6) -> R(2), 3, 4(2)
        { id: "5let_00110", label: "3-4(q)", notes: [R("q", 0.8), make("8", 0.4), make("q", 0.8)], w: 4 },
        // 00101 (5) -> R(2), 3(2), 5
        { id: "5let_00101", label: "3(q)-5", notes: [R("q", 0.8), make("q", 0.8), make("8", 0.4)], w: 4 },
        // 00011 (3) -> R(3), 4, 5
        { id: "5let_00011", label: "4-5", notes: [R("q", 1.2, 1), make("8", 0.4), make("8", 0.4)], w: 4 },

        // ============================
        // === 1 NOTE ===
        // ============================
        // 10000 (16) -> Quarter + Rest (2 beats)
        // NO TUPLET BRACKET
        { id: "5let_10000", label: "Quarter+Rest", notes: [make("q", 1.0), R("q", 1.0)], w: 5, _tuplet: false },
        // 01000 (8) -> R, 2(4)
        { id: "5let_01000", label: "2 Only", notes: [R("8", 0.4), make("h", 1.6)], w: 3 },
        // 00100 (4) -> R(2), 3(3)
        { id: "5let_00100", label: "3 Only", notes: [R("q", 0.8), make("q", 1.2, 1)], w: 3 },
        // 00010 (2) -> R(3), 4(2)
        { id: "5let_00010", label: "4 Only", notes: [R("q", 1.2, 1), make("q", 0.8)], w: 3 },
        // 00001 (1) -> R(4), 5
        { id: "5let_00001", label: "5 Only", notes: [R("h", 1.6), make("8", 0.4)], w: 3 }
    ],

// === 16th Note Quintuplets (5 notes over 1 beat) ===
    "5let16": [
        // ============================
        // === 5 NOTES ===
        // ============================
        // 11111 (31)
        { id: "5let16_11111", label: "Full 5", notes: Array(5).fill(make("16", 0.2)), w: 10 },

        // ============================
        // === 4 NOTES ===
        // ============================
        // 11110 (30) -> 1, 2, 3, 4(2)
        { id: "5let16_11110", label: "1-2-3-4(8)", notes: [make("16", 0.2), make("16", 0.2), make("16", 0.2), make("8", 0.4)], w: 5 },
        // 11101 (29) -> 1, 2, 3(2), 5
        { id: "5let16_11101", label: "1-2-3(8)-5", notes: [make("16", 0.2), make("16", 0.2), make("8", 0.4), make("16", 0.2)], w: 5 },
        // 11011 (27) -> 1, 2(2), 4, 5
        { id: "5let16_11011", label: "1-2(8)-4-5", notes: [make("16", 0.2), make("8", 0.4), make("16", 0.2), make("16", 0.2)], w: 5 },
        // 10111 (23) -> 1(2), 3, 4, 5
        { id: "5let16_10111", label: "1(8)-3-4-5", notes: [make("8", 0.4), make("16", 0.2), make("16", 0.2), make("16", 0.2)], w: 5 },
        // 01111 (15) -> R, 2, 3, 4, 5
        { id: "5let16_01111", label: "R-2-3-4-5", notes: [R("16", 0.2), make("16", 0.2), make("16", 0.2), make("16", 0.2), make("16", 0.2)], w: 5 },

        // ============================
        // === 3 NOTES ===
        // ============================
        // 11100 (28) -> 1, 2, 3(3)
        { id: "5let16_11100", label: "1-2-3(d8)", notes: [make("16", 0.2), make("16", 0.2), make("8", 0.6, 1)], w: 5 },
        // 11010 (26) -> 1, 2(2), 4(2)
        { id: "5let16_11010", label: "1-2(8)-4(8)", notes: [make("16", 0.2), make("8", 0.4), make("8", 0.4)], w: 5 },
        // 11001 (25) -> 1, 2(3), 5
        { id: "5let16_11001", label: "1-2(d8)-5", notes: [make("16", 0.2), make("8", 0.6, 1), make("16", 0.2)], w: 5 },
        // 10110 (22) -> 1(2), 3, 4(2)
        { id: "5let16_10110", label: "1(8)-3-4(8)", notes: [make("8", 0.4), make("16", 0.2), make("8", 0.4)], w: 5 },
        // 10101 (21) -> 1(2), 3(2), 5
        { id: "5let16_10101", label: "1(8)-3(8)-5", notes: [make("8", 0.4), make("8", 0.4), make("16", 0.2)], w: 5 },
        // 10011 (19) -> 1(3), 4, 5
        { id: "5let16_10011", label: "1(d8)-4-5", notes: [make("8", 0.6, 1), make("16", 0.2), make("16", 0.2)], w: 5 },
        // 01110 (14) -> R, 2, 3, 4(2)
        { id: "5let16_01110", label: "2-3-4(8)", notes: [R("16", 0.2), make("16", 0.2), make("16", 0.2), make("8", 0.4)], w: 5 },
        // 01101 (13) -> R, 2, 3(2), 5
        { id: "5let16_01101", label: "2-3(8)-5", notes: [R("16", 0.2), make("16", 0.2), make("8", 0.4), make("16", 0.2)], w: 5 },
        // 01011 (11) -> R, 2(2), 4, 5
        { id: "5let16_01011", label: "2(8)-4-5", notes: [R("16", 0.2), make("8", 0.4), make("16", 0.2), make("16", 0.2)], w: 5 },
        // 00111 (7) -> R, 2(2), 4, 5
        { id: "5let16_00111", label: "3-4-5", notes: [R("8", 0.4), make("16", 0.2), make("16", 0.2), make("16", 0.2)], w: 5 },

        // ============================
        // === 2 NOTES ===
        // ============================
        // 11000 (24) -> 1, 2(4)
        { id: "5let16_11000", label: "1-2(q)", notes: [make("16", 0.2), make("q", 0.8)], w: 4 },
        // 10100 (20) -> 1(2), 3(3)
        { id: "5let16_10100", label: "1(8)-3(d8)", notes: [make("8", 0.4), make("8", 0.6, 1)], w: 4 },
        // 10010 (18) -> 1(3), 4(2)
        { id: "5let16_10010", label: "1(d8)-4(8)", notes: [make("8", 0.6, 1), make("8", 0.4)], w: 4 },
        // 10001 (17) -> 1(4), 5
        { id: "5let16_10001", label: "1(q)-5", notes: [make("q", 0.8), make("16", 0.2)], w: 4 },
        // 01100 (12) -> R, 2, 3(3)
        { id: "5let16_01100", label: "2-3(d8)", notes: [R("16", 0.2), make("16", 0.2), make("8", 0.6, 1)], w: 4 },
        // 01010 (10) -> R, 2(2), 4(2)
        { id: "5let16_01010", label: "2(8)-4(8)", notes: [R("16", 0.2), make("8", 0.4), make("8", 0.4)], w: 4 },
        // 01001 (9) -> R, 2(3), 5
        { id: "5let16_01001", label: "2(d8)-5", notes: [R("16", 0.2), make("8", 0.6, 1), make("16", 0.2)], w: 4 },
        // 00110 (6) -> R, 2, 3, 4(2)
        { id: "5let16_00110", label: "3-4(8)", notes: [R("8", 0.4), make("16", 0.2), make("8", 0.4)], w: 4 },
        // 00101 (5) -> R(2), 3(2), 5
        { id: "5let16_00101", label: "3(8)-5", notes: [R("8", 0.4), make("8", 0.4), make("16", 0.2)], w: 4 },
        // 00011 (3) -> R(3), 4, 5
        { id: "5let16_00011", label: "4-5", notes: [R("8", 0.6, 1), make("16", 0.2), make("16", 0.2)], w: 4 },

        // ============================
        // === 1 NOTE ===
        // ============================
        // 10000 (16) -> Quarter (10000)
        // NO TUPLET BRACKET
        { id: "5let16_10000", label: "Quarter (10000)", notes: [make("q", 1.0)], w: 5, _tuplet: false },
        // 01000 (8) -> R, 2(4)
        { id: "5let16_01000", label: "2 Only", notes: [R("16", 0.2), make("q", 0.8)], w: 3 },
        // 00100 (4) -> R(2), 3(3)
        { id: "5let16_00100", label: "3 Only", notes: [R("8", 0.4), make("8", 0.6, 1)], w: 3 },
        // 00010 (2) -> R(3), 4(2)
        { id: "5let16_00010", label: "4 Only", notes: [R("8", 0.6, 1), make("8", 0.4)], w: 3 },
        // 00001 (1) -> R(4), 5
        { id: "5let16_00001", label: "5 Only", notes: [R("q", 0.8), make("16", 0.2)], w: 3 }
    ],

    // === 6. Sextuplets (6 notes over 1 beat) ===
    "6let": [
        // ============================
        // === 6 NOTES ===
        // ============================
        // 111111 (63)
        { id: "6let_111111", label: "Full 6", notes: Array(6).fill(make("16", 1/6)), w: 10 },

        // ============================
        // === 5 NOTES ===
        // ============================
        // 111110 (62) -> 1, 1, 1, 1, 2
        { id: "6let_111110", label: "1-2-3-4-5(8t)", notes: [make("16", 1/6), make("16", 1/6), make("16", 1/6), make("16", 1/6), make("8", 1/3)], w: 5 },
        // 111101 (61) -> 1, 1, 1, 2, 1
        { id: "6let_111101", label: "1-2-3-4(8t)-6", notes: [make("16", 1/6), make("16", 1/6), make("16", 1/6), make("8", 1/3), make("16", 1/6)], w: 5 },
        // 111011 (59) -> 1, 1, 2, 1, 1
        { id: "6let_111011", label: "1-2-3(8t)-5-6", notes: [make("16", 1/6), make("16", 1/6), make("8", 1/3), make("16", 1/6), make("16", 1/6)], w: 5 },
        // 110111 (55) -> 1, 2, 1, 1, 1
        { id: "6let_110111", label: "1-2(8t)-4-5-6", notes: [make("16", 1/6), make("8", 1/3), make("16", 1/6), make("16", 1/6), make("16", 1/6)], w: 5 },
        // 101111 (47) -> 2, 1, 1, 1, 1
        { id: "6let_101111", label: "1(8t)-3-4-5-6", notes: [make("8", 1/3), make("16", 1/6), make("16", 1/6), make("16", 1/6), make("16", 1/6)], w: 5 },
        // 011111 (31) -> R(1), 1, 1, 1, 1, 1
        { id: "6let_011111", label: "R-2-3-4-5-6", notes: [R("16", 1/6), make("16", 1/6), make("16", 1/6), make("16", 1/6), make("16", 1/6), make("16", 1/6)], w: 5 },

        // ============================
        // === 4 NOTES ===
        // ============================
        // 111100 (60) -> SPECIAL: 16th Triplet + 8th Note
        // UPDATED: Added _isHybrid: true to all notes to force beaming
        { 
            id: "6let_111100", 
            label: "1-2-3(Trip)-4", 
            notes: [
                {...make("16", 1/6), _localTuplet: true, _isHybrid: true}, 
                {...make("16", 1/6), _localTuplet: true, _isHybrid: true}, 
                {...make("16", 1/6), _localTuplet: true, _isHybrid: true}, 
                {...make("8", 0.5), _isHybrid: true} 
            ], 
            _tuplet: false, 
            w: 6 
        },

        // 111010 (58) -> 1, 1, 2, 2
        { id: "6let_111010", label: "1-2-3-5(8t)", notes: [make("16", 1/6), make("16", 1/6), make("8", 1/3), make("8", 1/3)], w: 5 },
        // 111001 (57) -> 1, 1, 3(d8), 1
        { id: "6let_111001", label: "1-2-3-6", notes: [make("16", 1/6), make("16", 1/6), make("8", 0.5, 1), make("16", 1/6)], w: 5 },
        // 110110 (54) -> 1, 2, 1, 2
        { id: "6let_110110", label: "1-2(8t)-4-5(8t)", notes: [make("16", 1/6), make("8", 1/3), make("16", 1/6), make("8", 1/3)], w: 5 },
        // 110101 (53) -> 1, 2, 2, 1
        { id: "6let_110101", label: "1-2(8t)-4(8t)-6", notes: [make("16", 1/6), make("8", 1/3), make("8", 1/3), make("16", 1/6)], w: 5 },
        // 110011 (51) -> 1, 3(d8), 1, 1
        { id: "6let_110011", label: "1-2(d8)-5-6", notes: [make("16", 1/6), make("8", 0.5, 1), make("16", 1/6), make("16", 1/6)], w: 5 },
        // 101110 (46) -> 2, 1, 1, 2
        { id: "6let_101110", label: "1(8t)-3-4-5(8t)", notes: [make("8", 1/3), make("16", 1/6), make("16", 1/6), make("8", 1/3)], w: 5 },
        // 101101 (45) -> 2, 1, 2, 1
        { id: "6let_101101", label: "1(8t)-3-4(8t)-6", notes: [make("8", 1/3), make("16", 1/6), make("8", 1/3), make("16", 1/6)], w: 5 },
        // 101011 (43) -> 2, 2, 1, 1
        { id: "6let_101011", label: "1(8t)-3(8t)-5-6", notes: [make("8", 1/3), make("8", 1/3), make("16", 1/6), make("16", 1/6)], w: 5 },

        // 100111 (39) -> SPECIAL: 8th Note + 16th Triplet
        // UPDATED: Added _isHybrid: true to all notes to force beaming
        { 
            id: "6let_100111", 
            label: "1(8)-4-5-6(Trip)", 
            notes: [
                {...make("8", 0.5), _isHybrid: true}, 
                {...make("16", 1/6), _localTuplet: true, _isHybrid: true}, 
                {...make("16", 1/6), _localTuplet: true, _isHybrid: true}, 
                {...make("16", 1/6), _localTuplet: true, _isHybrid: true}
            ], 
            _tuplet: false, 
            w: 6 
        },

        // 011110 (30) -> R(1), 1, 1, 1, 2
        { id: "6let_011110", label: "R-2-3-4-5(8t)", notes: [R("16", 1/6), make("16", 1/6), make("16", 1/6), make("16", 1/6), make("8", 1/3)], w: 5 },
        // 011101 (29) -> R(1), 1, 1, 2, 1
        { id: "6let_011101", label: "R-2-3-4(8t)-6", notes: [R("16", 1/6), make("16", 1/6), make("16", 1/6), make("8", 1/3), make("16", 1/6)], w: 5 },
        // 011011 (27) -> R(1), 1, 2, 1, 1
        { id: "6let_011011", label: "R-2-3(8t)-5-6", notes: [R("16", 1/6), make("16", 1/6), make("8", 1/3), make("16", 1/6), make("16", 1/6)], w: 5 },
        // 010111 (23) -> R(1), 2, 1, 1, 1
        { id: "6let_010111", label: "R-2(8t)-4-5-6", notes: [R("16", 1/6), make("8", 1/3), make("16", 1/6), make("16", 1/6), make("16", 1/6)], w: 5 },
        // 001111 (15) -> R(2), 1, 1, 1, 1
        { id: "6let_001111", label: "R(8t)-3-4-5-6", notes: [R("8", 1/3), make("16", 1/6), make("16", 1/6), make("16", 1/6), make("16", 1/6)], w: 5 },

        // ============================
        // === 3 NOTES ===
        // ============================
        // 111000 (56) -> SPECIAL: 16th Triplet + 8th Rest
        // UPDATED: Added _isHybrid: true to force proper grouping logic (even with rest)
        { 
            id: "6let_111000", 
            label: "1-2-3(Trip)-R", 
            notes: [
                {...make("16", 1/6), _localTuplet: true, _isHybrid: true}, 
                {...make("16", 1/6), _localTuplet: true, _isHybrid: true}, 
                {...make("16", 1/6), _localTuplet: true, _isHybrid: true}, 
                {...R("8", 0.5), _isHybrid: true}
            ], 
            _tuplet: false, 
            w: 6 
        },

        // 110100 (52) -> 1, 2, 3(d8)
        { id: "6let_110100", label: "1-2(8t)-4(d8)", notes: [make("16", 1/6), make("8", 1/3), make("8", 0.5, 1)], w: 5 },
        // 110010 (50) -> 1, 3(d8), 2
        { id: "6let_110010", label: "1-2(d8)-5(8t)", notes: [make("16", 1/6), make("8", 0.5, 1), make("8", 1/3)], w: 5 },
        // 110001 (49) -> 1, 4(q), 1
        { id: "6let_110001", label: "1-2(q)-6", notes: [make("16", 1/6), make("q", 2/3), make("16", 1/6)], w: 5 },
        // 101100 (44) -> 2, 1, 3(d8)
        { id: "6let_101100", label: "1(8t)-3-4(d8)", notes: [make("8", 1/3), make("16", 1/6), make("8", 0.5, 1)], w: 5 },
        // 101010 (42) -> 2, 2, 2 (Standard Triplet)
        { id: "6let_101010", label: "Triplets", notes: [make("8", 1/3), make("8", 1/3), make("8", 1/3)], _tuplet: {num_notes:3, notes_occupied:2}, w: 6 },
        // 101001 (41) -> 2, 3(d8), 1
        { id: "6let_101001", label: "1(8t)-3(d8)-6", notes: [make("8", 1/3), make("8", 0.5, 1), make("16", 1/6)], w: 5 },
        // 100110 (38) -> 3(d8), 1, 2
        { id: "6let_100110", label: "1(d8)-4-5(8t)", notes: [make("8", 0.5, 1), make("16", 1/6), make("8", 1/3)], w: 5 },
        // 100101 (37) -> 3(d8), 2, 1
        { id: "6let_100101", label: "1(d8)-4(8t)-6", notes: [make("8", 0.5, 1), make("8", 1/3), make("16", 1/6)], w: 5 },
        // 100011 (35) -> 4(q), 1, 1
        { id: "6let_100011", label: "1(q)-5-6", notes: [make("q", 2/3), make("16", 1/6), make("16", 1/6)], w: 5 },

        // 011010 (26) -> R(1), 1, 2, 2
        { id: "6let_011010", label: "R-2-3(8t)-5(8t)", notes: [R("16", 1/6), make("16", 1/6), make("8", 1/3), make("8", 1/3)], w: 5 },
        // 011001 (25) -> R(1), 1, 3(d8), 1
        { id: "6let_011001", label: "R-2-3(d8)-6", notes: [R("16", 1/6), make("16", 1/6), make("8", 0.5, 1), make("16", 1/6)], w: 5 },
        // 010110 (22) -> R(1), 2, 1, 2
        { id: "6let_010110", label: "R-2(8t)-4-5(8t)", notes: [R("16", 1/6), make("8", 1/3), make("16", 1/6), make("8", 1/3)], w: 5 },
        // 010101 (21) -> R(1), 2, 2, 1
        { id: "6let_010101", label: "R-2(8t)-4(8t)-6", notes: [R("16", 1/6), make("8", 1/3), make("8", 1/3), make("16", 1/6)], w: 5 },
        // 010011 (19) -> R(1), 3(d8), 1, 1
        { id: "6let_010011", label: "R-2(d8)-5-6", notes: [R("16", 1/6), make("8", 0.5, 1), make("16", 1/6), make("16", 1/6)], w: 5 },
        // 001110 (14) -> R(2), 1, 1, 2
        { id: "6let_001110", label: "R(8t)-3-4-5(8t)", notes: [R("8", 1/3), make("16", 1/6), make("16", 1/6), make("8", 1/3)], w: 5 },
        // 001101 (13) -> R(2), 1, 2, 1
        { id: "6let_001101", label: "R(8t)-3-4(8t)-6", notes: [R("8", 1/3), make("16", 1/6), make("8", 1/3), make("16", 1/6)], w: 5 },
        // 001011 (11) -> R(2), 2, 1, 1
        { id: "6let_001011", label: "R(8t)-3(8t)-5-6", notes: [R("8", 1/3), make("8", 1/3), make("16", 1/6), make("16", 1/6)], w: 5 },

        // 000111 (7) -> SPECIAL: 8th Rest + 16th Triplet
        // UPDATED: Added _isHybrid: true 
        { 
            id: "6let_000111", 
            label: "R(8)-4-5-6(Trip)", 
            notes: [
                {...R("8", 0.5), _isHybrid: true}, 
                {...make("16", 1/6), _localTuplet: true, _isHybrid: true}, 
                {...make("16", 1/6), _localTuplet: true, _isHybrid: true}, 
                {...make("16", 1/6), _localTuplet: true, _isHybrid: true}
            ], 
            _tuplet: false, 
            w: 6 
        },

        // ============================
        // === 2 NOTES ===
        // ============================
        // 110000 (48) -> 1, 2, R(q)
        { id: "6let_110000", label: "1-2-R(q)", notes: [make("16", 1/6), make("16", 1/6), R("q", 2/3)], w: 5 },
        // 101000 (40) -> TRIPLET: 2, 2, R(2)
        { id: "6let_101000", label: "Trip-Let-R", notes: [make("8", 1/3), make("8", 1/3), R("8", 1/3)], _tuplet: {num_notes:3, notes_occupied:2}, w: 5 },
        
        // 100100 (36) -> SPECIAL: 8th Note + 8th Note (Reg)
        { id: "6let_100100", label: "1(Reg)-4(Reg)", notes: [make("8", 0.5), make("8", 0.5)], _tuplet: false, w: 6 },
        
        // 100010 (34) -> TRIPLET: 2, R(2), 2 (Swing)
        { id: "6let_100010", label: "Trip-R-Trip", notes: [make("q", 2/3), make("8", 1/3)], _tuplet: {num_notes:3, notes_occupied:2}, w: 5 },
        // 100001 (33) -> 4(q), R(1), 1
        { id: "6let_100001", label: "1(q)-6", notes: [make("q", 2/3), R("16", 1/6), make("16", 1/6)], w: 5 },

        // 011000 (24) -> R(1), 1, 4(q)
        { id: "6let_011000", label: "R-2-3(q)", notes: [R("16", 1/6), make("16", 1/6), make("q", 2/3)], w: 5 },
        // 010100 (20) -> R(1), 2, 3(d8)
        { id: "6let_010100", label: "R-2(8t)-4(d8)", notes: [R("16", 1/6), make("8", 1/3), make("8", 0.5, 1)], w: 5 },
        // 010010 (18) -> R(1), 3(d8), 2
        { id: "6let_010010", label: "R-2(d8)-5(8t)", notes: [R("16", 1/6), make("8", 0.5, 1), make("8", 1/3)], w: 5 },
        // 010001 (17) -> R(1), 4(q), 1
        { id: "6let_010001", label: "R-2(q)-6", notes: [R("16", 1/6), make("q", 2/3), make("16", 1/6)], w: 5 },

        // 001100 (12) -> R(2), 1, 3(d8)
        { id: "6let_001100", label: "R(8t)-3-4(d8)", notes: [R("8", 1/3), make("16", 1/6), make("8", 0.5, 1)], w: 5 },
        // 001010 (10) -> TRIPLET: R(2), 2, 2
        { id: "6let_001010", label: "R-Let-Trip", notes: [R("8", 1/3), make("8", 1/3), make("8", 1/3)], _tuplet: {num_notes:3, notes_occupied:2}, w: 5 },
        // 001001 (9) -> R(2), 3(d8), 1
        { id: "6let_001001", label: "R(8t)-3(d8)-6", notes: [R("8", 1/3), make("8", 0.5, 1), make("16", 1/6)], w: 5 },

        // 000110 (6) -> R(3), 1, 2
        { id: "6let_000110", label: "R(d8)-4-5(8t)", notes: [R("8", 0.5, 1), make("16", 1/6), make("8", 1/3)], w: 5 },
        // 000101 (5) -> R(3), 2, 1
        { id: "6let_000101", label: "R(d8)-4(8t)-6", notes: [R("8", 0.5, 1), make("8", 1/3), make("16", 1/6)], w: 5 },
        // 000011 (3) -> R(4), 1, 1
        { id: "6let_000011", label: "R(q)-5-6", notes: [R("q", 2/3), make("16", 1/6), make("16", 1/6)], w: 5 },

        // ============================
        // === 1 NOTE ===
        // ============================
        // 100000 (32) -> Quarter (100000)
        // NO TUPLET BRACKET
        { id: "6let_100000", label: "Quarter (100000)", notes: [make("q", 1.0)], w: 5, _tuplet: false },
        // 010000 (16) -> R(1), 1, R(4)
        { id: "6let_010000", label: "2 Only", notes: [R("16", 1/6), make("16", 1/6), R("q", 2/3)], w: 5 },
        // 001000 (8) -> TRIPLET: R(2), 2, R(2)
        { id: "6let_001000", label: "R-Let-R", notes: [R("8", 1/3), make("q", 2/3)], _tuplet: {num_notes:3, notes_occupied:2}, w: 5 },
        
        // 000100 (4) -> SPECIAL: 8th Rest + 8th Note (Reg)
        { id: "6let_000100", label: "R(Reg)-4(Reg)", notes: [R("8", 0.5), make("8", 0.5)], _tuplet: false, w: 5 },
        
        // 000010 (2) -> TRIPLET: R(4), 2
        { id: "6let_000010", label: "R-R-Trip", notes: [R("q", 2/3), make("8", 1/3)], _tuplet: {num_notes:3, notes_occupied:2}, w: 5 },
        // 000001 (1) -> R(4), R(1), 1
        { id: "6let_000001", label: "6 Only", notes: [R("q", 2/3), R("16", 1/6), make("16", 1/6)], w: 5 }
    ],
};














// GLOBAL STATE
let activeVariations = new Set();

// FIX: Define the "Full" IDs that should be active by default
const DEFAULT_FULL_IDS = new Set([
    "q_1",          // Quarter Note
    "dq_1",         // Dotted Quarter
    "8s_11",        // 2 Eighths
    "8s_c_111",     // 3 Eighths (Compound 1-2-3)
    "16s_1111",     // 4 Sixteenths
    "8t_111",       // Triplet (1-2-3)
    "qt_111",       // Quarter Triplet (1-2-3)
    "5let_11111",   // Quintuplet (Full 5)
    "5let16_11111", // 16th Quintuplet (Full 5)
    "6let_111111"   // Sextuplet (Full 6)
]);

// Initialize ONLY the Full variations as active by default
Object.values(RHYTHM_VARIANTS).forEach(g => g.forEach(v => {
    if (DEFAULT_FULL_IDS.has(v.id)) {
        activeVariations.add(v.id);
    }
}));

// Updated pickBeatPattern: 
// 1. UN-BANNED 8th Notes on Upbeats (Necessary to resolve/end a syncopated chain).
// 2. Penalized 8th Notes on Upbeats (So they don't randomly START syncopation often).
// 3. Kept Quarter Note Sustain Penalty (0.1) -> Makes 8ths the preferred "Exit Door".
function pickBeatPattern({ restPct, allowDottedQuarters, allowQuarters, allow8ths, allow16ths, allowTriplets, allowQuarterTriplets, allowQuintuplets, allow16thQuintuplets, allowSextuplets, beatsLeft, currentBeat, allowSyncopation, distToPulse }) {
    
    let pool = []; 
    const eps = 0.01; 
    
    // --- GRID ANALYSIS ---
    const mod = currentBeat % 1.0;
    const isDownbeat = Math.abs(mod) < eps || Math.abs(mod - 1.0) < eps;
    const isUpbeat   = Math.abs(mod - 0.5) < eps; 
    const onSixteenthPartial = !isDownbeat && !isUpbeat; 

    // --- FITS HELPER ---
    const fits = (dur, type) => {
        if (dur > beatsLeft + eps) return false;

        // 1. STRICT 16TH GRID LOCK
        if (onSixteenthPartial) {
             return false; 
        }

        // 2. STRICT DOWNBEAT ONLY TYPES
        // FIX: Removed "8s" from here. 
        // We MUST allow 8ths on the upbeat to resolve syncopation (e.g. 8-q-8).
        // 16s and 5let (8th) remain strict.
        if (type === "qt" || type === "16s" || type === "5let") {
            return isDownbeat;
        }
        
        // 3. SYNCOPATION RULES (Upbeats)
        if (isUpbeat) {
            // Always allow Quarter/DottedQ/8ths
            // (We allow 8ths now so we can stop the quarter chain)
            if (type === "q" || type === "dottedQ" || type === "8s") return true;
            
            if (allowSyncopation) {
                if (type === "8t" || type === "5let16" || type === "6let") return true;
                return true; 
            }
            return false;
        }
        return true; 
    };

    // --- 1. COLLECT ACTIVE VARIATIONS ---
    Object.keys(RHYTHM_VARIANTS).forEach(key => {
        if (key === "q" && !allowQuarters) return;
        if (key === "dottedQ" && !allowDottedQuarters) return;
        if (key === "8s" && !allow8ths) return;
        if (key === "16s" && !allow16ths) return;
        if (key === "8t" && !allowTriplets) return;
        if (key === "qt" && !allowQuarterTriplets) return;
        if (key === "5let" && !allowQuintuplets) return;
        if (key === "5let16" && !allow16thQuintuplets) return;
        if (key === "6let" && !allowSextuplets) return;

        RHYTHM_VARIANTS[key].forEach(v => {
            if (activeVariations.has(v.id)) {
                if (v._isCompoundVariant) return;

                // Hidden Quarter Check
                if (!allowQuarters && v.notes.length === 1 && v.notes[0].dur === "q") {
                    // Allowed if manually selected
                }

                const totalDur = v.notes.reduce((sum, n) => sum + (n.beats || 0), 0);

                if (fits(totalDur, key)) {
                    let weight = v.w;

                    // === RARITY / LOGIC COMPENSATION ===
                    
                    if (key === "dottedQ") {
                        if (isUpbeat) weight *= 0.2; // Break 3-3-2 chains
                    }

                    // CROSS-BEAT PENALTY (SUSTAIN)
                    // This creates the "Short Chain" bias for Quarters.
                    if (allowSyncopation && isUpbeat && totalDur > distToPulse + eps) {
                        weight *= 0.1;
                    }

                    // === SYNCOPATION WEIGHTING ===
                    if (isUpbeat && allowSyncopation) {
                        // 1. TUPLETS (Need Boost)
                        if (key === "8t" || key === "5let16" || key === "6let") {
                            let syncFactor = 2.0;
                            if (restPct < 15) syncFactor = 0.5; 
                            weight *= syncFactor;
                        }
                        // 2. QUARTER NOTES (Entry Logic)
                        // Normal weight for entry (1.0).
                        else if (key === "q") {
                            weight *= 1.0;
                        }
                        // 3. 8TH NOTES (Resolver Logic)
                        // FIX: We allow 8ths, but give them a penalty (0.4).
                        // Why? We don't want them RANDOMLY starting syncopation (like "& 1").
                        // BUT, 0.4 is much higher than the Quarter Chain weight (0.1 above).
                        // So if we are trapped in a Quarter chain, the generator will chose the 8th (0.4) 
                        // over the Quarter (0.1), breaking the loop and creating "8 q 8".
                        else if (key === "8s") {
                            weight *= 0.4;
                        }
                    }
                    
                    // === REST DENSITY ADJUSTMENTS ===
                    const hasRest = v.notes.some(n => n.kind === "rest");

                    if (restPct < 30) {
                        if (hasRest) weight *= 0.2; 
                    } else if (restPct > 60) {
                        if (!hasRest) weight *= 0.5;
                    }
                    
                    if (restPct > 50 && !hasRest) weight *= 0.2; 
                    
                    pool.push({ id: v.id, w: weight, notes: v.notes, _tuplet: v._tuplet });
                }
            }
        });
    });

    // === 2. FORCE OFFSET FOR SYNCOPATION (PICKUPS) ===
    const allowPickups = allowSyncopation;

    if (allowPickups && beatsLeft >= 0.5 && isDownbeat) {
         if (allow8ths && activeVariations.has("8s_11")) {
             pool.push({ 
                 id: "offset_8", 
                 w: 4, 
                 notes: [{ kind: "note", dur: "8", beats: 0.5 }] 
             });
         }
         
         const has1e = activeVariations.has("16s_1111") || 
                       activeVariations.has("16s_1100") || 
                       activeVariations.has("16s_1101");

         if (allow16ths && has1e) {
             pool.push({ 
                 id: "offset_16_16", 
                 w: 4, 
                 notes: [
                     { kind: "note", dur: "16", beats: 0.25 },
                     { kind: "note", dur: "16", beats: 0.25 }
                 ] 
             });
         }
    }

    // --- 3. GENERATE DYNAMIC RESTS ---
    if (restPct > 0) {
        const validRestDurs = [0.5, 1.0, 1.5, 2.0];
        
        if ((allow16ths || allow16thQuintuplets || allowSextuplets)) {
            validRestDurs.unshift(0.25);
        }

        validRestDurs.forEach(dur => {
             let simType = "q";
             if (dur < 0.3) simType = "16s";
             else if (dur < 0.6) simType = "8s";

             if (fits(dur, simType)) {
                 let rDur = "q"; let rDots = 0; let rBeats = dur;
                 
                 if (Math.abs(dur - 0.25) < eps) { rDur = "16"; }
                 else if (Math.abs(dur - 0.5) < eps) { rDur = "8"; }
                 else if (Math.abs(dur - 0.75) < eps) { rDur = "8"; rDots = 1; }
                 else if (Math.abs(dur - 1.0) < eps) { rDur = "q"; }
                 else if (Math.abs(dur - 1.5) < eps) { rDur = "q"; rDots = 1; }
                 else if (Math.abs(dur - 2.0) < eps) { rDur = "h"; }
                 
                 let restWeight = restPct; 

                 if (restPct <= 30) {
                    restWeight = restPct * 0.15; 
                 } else {
                    restWeight = restPct * 0.5; 
                 }

                 if (Math.abs(dur - 2.0) < eps) {
                     if (restPct < 45) return; 
                     restWeight *= 0.2; 
                 }
                 else if (Math.abs(dur - 1.5) < eps) {
                     if (restPct < 35) return;
                     restWeight *= 0.3;
                 }
                 else if (Math.abs(dur - 1.0) < eps) {
                     restWeight *= 0.4; 
                 }

                 pool.push({ 
                     id: `rest_${dur}`, 
                     w: restWeight, 
                     notes: [{ kind: "rest", dur: rDur, dots: rDots, beats: rBeats }] 
                 });
             }
        });
    }

    if (pool.length === 0) return null; 

    const totalW = pool.reduce((s, x) => s + x.w, 0);
    let r = Math.random() * totalW;
    let selectedItem = pool[0];
    for (const item of pool) {
      r -= item.w;
      if (r <= 0) { selectedItem = item; break; }
    }

    let result = JSON.parse(JSON.stringify(selectedItem.notes));
    
    if (selectedItem.id.includes("6let")) {
        result._forceSixLetSticking = true;
    }

    if (selectedItem._tuplet !== undefined) {
        result._tuplet = selectedItem._tuplet;
        if (selectedItem._tuplet === false) result._preserve = true;
    } else {
        if (selectedItem.id.includes("8t")) result._tuplet = { num_notes: 3, notes_occupied: 2 };
        if (selectedItem.id.includes("qt")) result._tuplet = { num_notes: 3, notes_occupied: 2 };
        if (selectedItem.id.includes("5let")) result._tuplet = { num_notes: 5, notes_occupied: 4 };
        if (selectedItem.id.includes("6let")) result._tuplet = { num_notes: 6, notes_occupied: 4 };
    }

    return result;
}









  function durSpecFromBeats(beats) {
    const eps = 1e-6;
    if (Math.abs(beats - 1.5) < eps) return { dur: "q", dots: 1 };
    if (Math.abs(beats - 1.0) < eps) return { dur: "q", dots: 0 };
    if (Math.abs(beats - 0.75) < eps) return { dur: "8", dots: 1 };
    if (Math.abs(beats - 0.5) < eps) return { dur: "8", dots: 0 };
    if (Math.abs(beats - 0.25) < eps) return { dur: "16", dots: 0 };
    return null;
  }

  // Back-compat: if older code expects just a duration string
  function durFromBeats(beats) {
    const spec = durSpecFromBeats(beats);
    return spec ? spec.dur : null;
  }

  function normalizeSixteenthGridBeat(beat) {
    // GUARD CLAUSE: Strict Protection for Tiles
    if (!beat || beat._tuplet || beat._preserve) return beat;

    const totalDur = beat.reduce((sum, n) => sum + (n.beats || 0), 0);
    if (Math.abs(totalDur - 1.0) > 0.01) return beat;

    const hasAttack = [false, false, false, false]; 
    let currentPos = 0;

    for (let e of beat) {
        const pos = Math.round(currentPos / 0.25);
        if (pos < 4 && e.kind === 'note') {
            hasAttack[pos] = true;
        }
        currentPos += Number(e.beats);
    }

    const sig = hasAttack.map(b => b ? '1' : '0').join('');
    const N = (dur, beats, dots = 0) => ({ kind: "note", dur, beats, dots });
    const R = (dur, beats, dots = 0) => ({ kind: "rest", dur, beats, dots });
    const P = (arr) => { arr._preserve = true; return arr; };

    switch (sig) {
        case '1000': 
            // FIX: Only convert to Quarter Note if Quarters are explicitly allowed/selected.
            // We check the Main Quarter Tile (q_1) AND the 16th Variation (16s_1000).
            const allowQ = activeVariations.has("q_1") || activeVariations.has("16s_1000");
            
            if (allowQ) return [N("q", 1)];

            // If user turned off Quarters (e.g. "Full" 16ths only), show explicit 16th breakdown
            return [N("16", 0.25), R("16", 0.25), R("8", 0.5)];

        case '0100': return [R("16", 0.25), N("8", 0.75, 1)];
        case '0010': return [R("8", 0.5), N("8", 0.5)];
        case '0001': return [R("8", 0.75, 1), N("16", 0.25)];
        case '1100': return P([N("16", 0.25), N("16", 0.25), R("8", 0.5)]);
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
    if (!beat || beat._tuplet || beat._preserve) return beat; // GUARD CLAUSE

    const eps = 1e-6;
    const N = (dur, beats, dots = 0) => ({ kind: "note", dur, beats, dots });
    const R = (dur, beats, dots = 0) => ({ kind: "rest", dur, beats, dots });
    const is16r = (e) => e && e.kind === "rest" && e.dur === "16" && Math.abs((e.beats ?? 0) - 0.25) < eps && !e.dots;

    const out = beat.map((e) => ({ ...e }));
    if (beat._preserve) out._preserve = true;
    if (beat._compoundGrid) out._compoundGrid = true;
    if (beat._sixLetGrid) out._sixLetGrid = true;

    if (out.length >= 2 && is16r(out[0]) && is16r(out[1])) {
      out.splice(0, 2, R("8", 0.5));
    }
    const L = out.length;
    if (L >= 2 && is16r(out[L - 2]) && is16r(out[L - 1])) {
      out.splice(L - 2, 2, R("8", 0.5));
    }
    return out;
  }

function absorbRestsInBeat(beat, allowedRhythms) {
    if (beat && (beat._tuplet || beat._preserve)) return beat; // GUARD CLAUSE
    
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
      const dSpec = durSpecFromBeats(total);
      const newDur = dSpec ? dSpec.dur : null;
      
      const isQuarter = Math.abs(total - 1.0) < 0.01;
      const isDottedQuarter = Math.abs(total - 1.5) < 0.01;

      // === PERMISSION CHECK (UPDATED) ===
      // We allow REST absorption even if the Note tile is off. 
      // This fixes the "fragmented 16th rests" issue.
      
      // We still check Dotted Quarters for syncopation reasons, 
      // but standard Quarter Rests are always allowed to clean up the sheet.
      if (isDottedQuarter && allowedRhythms && !allowedRhythms.qd) continue;

      // Handle Dotted Quarter condensation (1.5 beats)
      if (isDottedQuarter) {
          e.beats = 1.5;
          e.dur = "q";
          e.dots = 1; 
          out.splice(i + 1, j - (i + 1)); 
          continue;
      }

      // Handle Quarter Note condensation (1.0 beat)
      if (isQuarter) {
        e.beats = 1;
        e.dur = "q";
        e.dots = 0;
        e._preserve = true; 
        out.splice(i + 1, j - (i + 1)); 
        continue;
      }

      // Fallback for smaller durations
      if (newDur === "8") {
        e.beats = total;
        e.dur = newDur;
        out.splice(i + 1, j - (i + 1));
      }
    }
    return out;
}

  function collapseAllRestBeatToQuarter(beat) {
    if (!beat || beat.length === 0) return beat;
    if (beat._preserve) return beat; // GUARD CLAUSE: DO NOT MERGE PRESERVED TILES

    if (!beat.every((e) => e.kind === "rest")) return beat;
    const total = beat.reduce((sum, n) => sum + (n.beats || 0), 0);

    if (Math.abs(total - 2.0) < 0.001) return [{ kind: "rest", dur: "h", beats: 2.0 }];
    if (Math.abs(total - 1.5) < 0.001) return [{ kind: "rest", dur: "q", dots: 1, beats: 1.5 }];
    if (Math.abs(total - 1.0) < 0.001) return [{ kind: "rest", dur: "q", beats: 1.0 }];

    return beat;
  }

function simplifyBeat(beat) {
  if (beat && beat._preserve) return beat; 
  if (!beat || (!beat._tuplet && !beat._compoundGrid)) return beat;
   
  const numNotes = beat._tuplet ? beat._tuplet.num_notes : (beat._compoundGrid ? 6 : 0);
  const mk = (k, d, b, dots=0, localT=false) => ({ kind: k==="n"?"note":"rest", dur: d, beats: b, dots, _localTuplet: localT });

  // ... (Keep 5-let logic as is) ...
  if (numNotes === 5) {
      // ... (no changes needed here, keep your existing 5-let block) ...
      // Just re-copying the existing 5-let block logic from your file to ensure it's not lost
      const totalDur = beat.reduce((s,n) => s + (n.beats||0), 0);
      const isFast = totalDur < 1.5; 
      const grid = isFast ? 0.2 : 0.4;
      const baseNote = isFast ? "16" : "8";
      const slots = Array(5).fill("0");
      let pos = 0;
      for (const n of beat) {
          const slot = Math.floor((pos + 1e-9) / grid);
          if (n.kind === "note" && slot >= 0 && slot < 5) slots[slot] = "1";
          pos += Number(n.beats || 0);
      }
      const onsetMask = slots.join("");
      if (onsetMask === "10000") return [mk("n", isFast?"q":"h", isFast?1.0:2.0)];
      const newItems = [];
      let i = 0;
      while (i < 5) {
          let durationSlots = 1;
          while (i + durationSlots < 5 && onsetMask[i + durationSlots] === '0' && durationSlots < 2) durationSlots++;
          if (!isFast && onsetMask[i] === '0' && i + 1 < 5 && onsetMask[i+1] === '0') {
               newItems.push({ k: "r", d: "q", b: 0.8, dot: 0 }); i += 2; continue;
          }
          const kindKey = onsetMask[i] === '1' ? "n" : "r";
          let dur = baseNote; let dot = 0;
          if (isFast) {
              if (durationSlots === 2) dur = "8";      
              else if (durationSlots === 3) { dur = "8"; dot = 1; } 
              else if (durationSlots === 4) dur = "q"; 
          } else { dur = "8"; }
          newItems.push({ k: kindKey, d: dur, b: 1 * grid, dot: dot }); i += 1;
      }
      const t = newItems.map(it => mk(it.k, it.d, it.b, it.dot));
      t._tuplet = beat._tuplet;
      return t;
  }

  // --- HANDLE 6-LETS / COMPOUND 16ths ---
  if (numNotes === 6) {
      const isCompound = !!beat._compoundGrid;
      const slotVal = isCompound ? 0.25 : (1/6);
      const slots = Array(6).fill("0");
      let pos = 0;
      for (const n of beat) {
          const slot = Math.floor((pos + 1e-9) / slotVal);
          if (n.kind === "note" && slot >= 0 && slot < 6) slots[slot] = "1";
          pos += Number(n.beats || 0);
      }
      const mask = slots.join("");

      // === SPECIAL HYBRID MASKS (The Fix) ===
      // Added '_isHybrid: true' so beaming works

      // 1. 1-2-3-4 (Trip + 8th) -> 111100
      if (!isCompound && mask === "111100") {
          return [
              {...mk("n", "16", 1/6, 0, true), _isHybrid: true}, 
              {...mk("n", "16", 1/6, 0, true), _isHybrid: true}, 
              {...mk("n", "16", 1/6, 0, true), _isHybrid: true}, 
              {...mk("n", "8", 0.5, 0, false), _isHybrid: true}
          ];
      }
      // 2. 1-2-3-R (Trip + 8th Rest) -> 111000
      if (!isCompound && mask === "111000") {
          return [
              {...mk("n", "16", 1/6, 0, true), _isHybrid: true}, 
              {...mk("n", "16", 1/6, 0, true), _isHybrid: true}, 
              {...mk("n", "16", 1/6, 0, true), _isHybrid: true}, 
              mk("r", "8", 0.5, 0, false)
          ];
      }
      // 3. 1-4-5-6 (8th + Trip) -> 100111
      if (!isCompound && mask === "100111") {
          return [
              {...mk("n", "8", 0.5, 0, false), _isHybrid: true}, 
              {...mk("n", "16", 1/6, 0, true), _isHybrid: true}, 
              {...mk("n", "16", 1/6, 0, true), _isHybrid: true}, 
              {...mk("n", "16", 1/6, 0, true), _isHybrid: true}
          ];
      }
      // 4. R-4-5-6 (8th Rest + Trip) -> 000111
      if (!isCompound && mask === "000111") {
          return [
              mk("r", "8", 0.5, 0, false),
              {...mk("n", "16", 1/6, 0, true), _isHybrid: true}, 
              {...mk("n", "16", 1/6, 0, true), _isHybrid: true}, 
              {...mk("n", "16", 1/6, 0, true), _isHybrid: true}
          ];
      }

      // ... (Keep existing standard 6-let logic below) ...
      const res = (k, d, slots, dot=0) => ({ kind: k==='n'?'note':'rest', dur: d, beats: slots * slotVal, dots: dot });
      if (mask === "100000") return [res('n', 'q', 6, isCompound?1:0)]; 
      if (mask === "000000") return [res('r', 'q', 6, isCompound?1:0)]; 

      const simplifiedItems = [];
      let i = 0;
      while (i < 6) {
          let durationSlots = 1;
          while (i + durationSlots < 6 && mask[i + durationSlots] === '0') durationSlots++;
          const kindKey = mask[i] === '1' ? "n" : "r";
          let dur = '16'; let dots = 0;
          if (durationSlots === 2) dur = '8';
          else if (durationSlots === 3) { dur = '8'; dots = 1; }
          else if (durationSlots === 4) dur = 'q';
          else if (durationSlots === 6) { dur = 'q'; dots = isCompound ? 1 : 0; }
          
          if (durationSlots === 5) {
              simplifiedItems.push(res(kindKey, '16', 1));
              simplifiedItems.push(res('r', 'q', 4));
          } else {
              simplifiedItems.push(res(kindKey, dur, durationSlots, dots));
          }
          i += durationSlots;
      }
      const mk6Result = simplifiedItems.map(x => ({...x, _localTuplet: !isCompound}));
      if (isCompound) mk6Result._compoundGrid = true;
      else mk6Result._tuplet = beat._tuplet;
      return mk6Result;
  }

  // --- HANDLE TRIPLETS (3 NOTES) ---
  if (numNotes === 3) {
      const totalDur = beat.reduce((sum, n) => sum + (n.beats || 0), 0);
      const pat = beat.map((e) => (e.kind === "note" ? "n" : "r")).join("");
      if (Math.abs(totalDur - 2.0) < 0.05) {
          if (pat === "nrr") return [mk("n", "q", 1.0), mk("r", "q", 1.0)];
          if (pat === "rrr") return [mk("r", "h", 2.0)];
          return beat;
      }
      if (Math.abs(totalDur - 1.0) < 0.05) {
          if (pat === "nrr") return [mk("n", "q", 1)];
          if (pat === "rrr") return [mk("r", "q", 1)];
          if (pat === "nr") return [mk("n", "q", 1)]; 
          if (pat === "rr") return [mk("r", "q", 1)];
          const t = beat.map(b => ({...b})); t._tuplet = beat._tuplet;
          return t;
      }
  }
  return beat;
}













// Updated applySticking: Implements "Flow-Based" Natural Sticking
// Tuplets (3s, 5s) flip the "Grid Parity", causing subsequent straight notes 
// to alternate hands (L R L) instead of resetting to the downbeat (R L R).

function applySticking(exercise, strategy) {
    if (!exercise) return;
    exercise.forEach(m => m.beats.forEach(b => b.forEach(n => delete n.sticking)));
    if (!isStickingVisible) return;

    const globalLead = currentLeadHand || "R";
    const other = (h) => (h === "R" ? "L" : "R");

    // 1. SIMPLE PATTERNS
    if (["alternate", "doubles", "paradiddle"].includes(strategy)) {
      let pattern = [];
      if (strategy === "alternate") pattern = [globalLead, other(globalLead)];
      if (strategy === "doubles") pattern = [globalLead, globalLead, other(globalLead), other(globalLead)];
      if (strategy === "paradiddle") pattern = [globalLead, other(globalLead), globalLead, globalLead, other(globalLead), globalLead, other(globalLead), other(globalLead)];
      let idx = 0;
      exercise.forEach(m => m.beats.forEach(beat => beat.forEach(n => {
        if (n.kind === "note") { n.sticking = pattern[idx % pattern.length]; idx++; }
      })));
      return;
    }

    // 2. NATURAL STICKING
    if (strategy === "natural") {
        const use16thGrid = (allow16thsEl && allow16thsEl.checked);
        const use8thGrid = (allow8thsEl && allow8thsEl.checked);
        const useDottedQGrid = (allowDottedQuartersEl && allowDottedQuartersEl.checked);

        let flowParity = 0; 

        exercise.forEach(measure => {
            let measureBeatPos = 0;
            measure.beats.forEach(beat => {
                if (!beat || beat.length === 0) return;

                const tupletDef = beat._tuplet;
                const numNotes = tupletDef ? tupletDef.num_notes : 0;
                let localPos = 0; 
                const groupDur = beat.reduce((s,n) => s + (n.beats||0), 0);
                let currentGroupLead = (flowParity === 0) ? globalLead : other(globalLead);

                // --- DETECT TUPLET TYPE ---
                let density = 0;
                let isOddTuplet = false;

                // Check for forced 6-let sticking (from pickBeatPattern)
                const forceSixLet = beat._forceSixLetSticking;

                // Triplet or Quarter Triplet (Odd)
                // FIX: Only treat as "Odd" (parity flipping) if it is NOT a 6-let derivative
                if (numNotes === 3 && !forceSixLet) { 
                     density = (groupDur > 0) ? (3 / groupDur) : 3;
                     isOddTuplet = true;
                }
                // 5-lets (Odd)
                else if (numNotes === 5) { 
                     density = (groupDur > 0) ? (5 / groupDur) : 5;
                     isOddTuplet = true;
                }
                // 6-lets (Even) OR Forced 6-let derivatives
                else if (numNotes === 6 || (beat[0] && beat[0]._localTuplet) || forceSixLet) { 
                     density = 6;
                     isOddTuplet = false; 
                }

                beat.forEach(n => {
                    if (n.kind === "note") {
                        let stick = currentGroupLead;
                        
                        // --- A. TUPLETS ---
                        if (numNotes > 0 || n._localTuplet || forceSixLet) {
                             const effDensity = (n._localTuplet || forceSixLet) ? 6 : density;
                             const slot = Math.round(localPos * effDensity);
                             
                             let startHand = currentGroupLead;

                             // FIX: Natural Alternating Flow on Upbeats for Tuplets
                             if (!use16thGrid) {
                                 const isUpbeat = Math.abs((measureBeatPos % 1.0) - 0.5) < 0.01;
                                 if (isUpbeat) startHand = other(currentGroupLead);
                             }
                             
                             // 6-LET DERIVATIVE LOGIC:
                             // Slots 0, 2, 4 = Even = Lead Hand (R)
                             if (slot % 2 === 0) stick = startHand;
                             else stick = other(startHand);
                        }

                        // --- B. STRAIGHT RHYTHMS ---
                        else {
                            const absPos = measureBeatPos + localPos; 
                            const eps = 0.01;
                            const sub = absPos % 1.0; 
                            const isDownbeat = sub < eps || Math.abs(sub - 1.0) < eps;
                            const isUpbeat   = Math.abs(sub - 0.5) < eps;              
                            const isDottedQ = Math.abs(n.beats - 1.5) < eps;
                            
                            if (use16thGrid) {
                                if (isDownbeat || isUpbeat) stick = currentGroupLead;
                                else stick = other(currentGroupLead);
                            }
                            else if (use8thGrid || useDottedQGrid || isDottedQ) {
                                if (isDownbeat) stick = currentGroupLead;
                                else stick = other(currentGroupLead);
                            }
                            else {
                                // FIX: Explicitly handle Upbeats (&) as Alternating
                                if (isDownbeat) stick = currentGroupLead;
                                else if (isUpbeat) stick = other(currentGroupLead);
                                else {
                                    const sixteenthPos = Math.round(absPos / 0.25);
                                    stick = (sixteenthPos % 2 === 0) ? currentGroupLead : other(currentGroupLead);
                                }
                            }
                        }
                        n.sticking = stick;
                    }
                    localPos += (n.beats || 0);
                });

                if (isOddTuplet) flowParity = 1 - flowParity;
                measureBeatPos += groupDur;
            });
        });
    }
}

// UPDATED: Strict Filler with Emergency Completion
// Prevents unwanted upbeat notes while ensuring syncopated 16ths can finish their phrase.
function pickHalfBeatPattern(restPct, allow8ths, allow16ths) {
  // 1. If neither are allowed, we must rest.
  if (!allow8ths && !allow16ths) return [{ kind: "rest", dur: "8", beats: 0.5 }];
  
  // 2. Random Rest Check (Standard operation)
  // If we are NOT forced to play a note (restPct > 0), random rests are allowed.
  if (restPct > 0 && chance(restPct)) return [{ kind: "rest", dur: "8", beats: 0.5 }];
  
  const options = [];
  
  // === OPTION 1: 8th Note Filler ===
  // Rule: Only allow a single 8th note filler if:
  // A. We are FORCED to play a note (restPct === 0) due to syncopation/padding, OR
  // B. The user explicitly selected the "&" tile (8s_01), which is defined as "Rest-Note".
  // (We removed the check for "8s_11" because that implies a PAIR, not a singleton upbeat note).
  if (allow8ths) {
      const isForced = (restPct === 0);
      const hasUpbeat8 = activeVariations.has("8s_01"); // Specifically the "Rest-Note" tile
      
      if (isForced || hasUpbeat8) {
          options.push("8");
      }
  }
  
  // === OPTION 2: 16th Note Filler ("& a") ===
  // Rule: Only allow 16th fillers if:
  // A. We are FORCED to play a note (restPct === 0) -> This completes a "1 e" pickup into "1 e & a"
  // B. The user explicitly selected the "& a" tile (16s_0011).
  if (allow16ths) {
      const isForced = (restPct === 0);
      const hasUpbeat16 = activeVariations.has("16s_0011");
      
      if (isForced || hasUpbeat16) {
          options.push("16s");
      }
  }
  
  // === FALLBACK / EMERGENCY ===
  if (options.length === 0) {
      // If logic demands a note (restPct === 0) but no tiles explicitly allow it,
      // we force a note to prevent broken rhythms (like the "Orphan Pickup").
      if (restPct === 0) {
          if (allow8ths) return [{ kind: "note", dur: "8", beats: 0.5 }];
          // If we force 16ths here, it turns "1 e" + "& a" -> "1 e & a", correcting the 1100 bug.
          if (allow16ths) return [
              { kind: "note", dur: "16", beats: 0.25 },
              { kind: "note", dur: "16", beats: 0.25 }
          ];
      }
      
      // Otherwise, default to rest (cleans up "8r 8" issues)
      return [{ kind: "rest", dur: "8", beats: 0.5 }];
  }
  
  const choice = options[Math.floor(Math.random() * options.length)];
  
  if (choice === "8") return [{ kind: "note", dur: "8", beats: 0.5 }];
  
  // Returns two 16th notes ("& a")
  return [
      { kind: "note", dur: "16", beats: 0.25 },
      { kind: "note", dur: "16", beats: 0.25 }
  ];
}




// UPDATED: Strict Cleanup. 
// Only merges 8th+Rest into Quarter if Quarters are actually allowed.
function consolidateMeasureEvents(beats, allowedRhythms, timeSig = "4/4") {
    if (!beats || beats.length < 2) return beats;

    const parts = timeSig.split("/");
    const num = parseInt(parts[0], 10);
    const den = parseInt(parts[1], 10);
    const isCompound = (den === 8 && num % 3 === 0);
    const pulseWidth = isCompound ? 1.5 : 1.0;
    const eps = 0.01;

    for (let i = 0; i < beats.length - 1; i++) {
        const chunkA = beats[i];
        const chunkB = beats[i+1];
        if (!chunkA?.length || !chunkB?.length) continue;

        const lastA = chunkA[chunkA.length - 1];
        const firstB = chunkB[0];

        // PULSE BOUNDARY CHECK
        const posA = lastA.absStart ?? 0;
        const boundary = Math.ceil(posA / pulseWidth - eps) * pulseWidth;
        const spaceInPulse = boundary - posA;

        if (lastA.beats >= spaceInPulse - eps && spaceInPulse > eps) {
            // Exception: Dotted Quarter Syncopation (Rest+Rest only)
            const canFormDQ = Math.abs(lastA.beats + firstB.beats - 1.5) < eps && allowedRhythms?.qd && lastA.kind === "rest";
            if (!canFormDQ) continue; 
        }

        // === CASE 1: CLEAN UP 8TH NOTE + 8TH REST -> QUARTER NOTE ===
        // FIX: Added '&& allowedRhythms.q' to the condition.
        if (lastA.kind === "note" && firstB.kind === "rest") {
            const isEighthA = lastA.dur === "8" && Math.abs(lastA.beats - 0.5) < eps;
            const isEighthB = firstB.dur === "8" && Math.abs(firstB.beats - 0.5) < eps;
            const isOnBeat = Math.abs(posA % 1.0) < eps;

            // ONLY merge if Quarter Notes are explicitly allowed by the user
            if (isOnBeat && isEighthA && isEighthB && allowedRhythms.q) {
                lastA.dur = "q";
                lastA.beats = 1.0;
                delete lastA.dots; 
                
                chunkB.shift();
                if (chunkB.length === 0) beats.splice(i+1, 1);
                i--; 
                continue;
            }
        }

        // === CASE 2: MERGE RESTS ===
        // Rests are always okay to merge for cleaner reading
        if (lastA.kind === "rest" && firstB.kind === "rest" && !lastA._tuplet && !firstB._tuplet) {
            const total = lastA.beats + firstB.beats;
            let mergedDur = null;
            let mergedDots = 0;

            if (Math.abs(total - 1.0) < eps) { mergedDur = "q"; }
            else if (Math.abs(total - 1.5) < eps) { mergedDur = "q"; mergedDots = 1; }
            else if (Math.abs(total - 2.0) < eps) { mergedDur = "h"; }
            else if (Math.abs(total - 3.0) < eps) { mergedDur = "h"; mergedDots = 1; }
            else if (Math.abs(total - 4.0) < eps) { mergedDur = "w"; }

            if (mergedDur) {
                lastA.dur = mergedDur;
                lastA.beats = total;
                lastA.dots = mergedDots;
                chunkB.shift();
                if (chunkB.length === 0) beats.splice(i+1, 1);
                i--; 
            }
        }
    }
    return beats;
}







// Updated generateExercise: Fixes "Orphan Pickups" AND Ensures Release after Upbeat Syncopation
function generateExercise({ measures, timeSignatures, restPct, allowDottedQuarters, allowQuarters, allow8ths, allow16ths, allowTriplets, allowQuarterTriplets, allowQuintuplets, allow16thQuintuplets, allowSextuplets, allowSyncopation }) {    
    const out = [];
    const safeTimeSigs = (timeSignatures && timeSignatures.length > 0) ? timeSignatures : ["4/4"];

    const anyRhythmActive = allowDottedQuarters || allowQuarters || allow8ths || 
                            allow16ths || allowTriplets || allowQuarterTriplets || 
                            allowQuintuplets || allow16thQuintuplets || allowSextuplets;

    for (let m = 0; m < measures; m++) {
      const ts = safeTimeSigs[Math.floor(Math.random() * safeTimeSigs.length)];
      
      const parts = ts.split("/");
      const numerator = parseInt(parts[0], 10);
      const denominator = parseInt(parts[1], 10);
      
      const isCompound = (denominator === 8 && numerator % 3 === 0);      
      const isAsymmetric = (denominator === 8 && numerator % 3 !== 0);    
      const isSimple = !isCompound && !isAsymmetric;                      

      let effectiveAllowQ = allowQuarters;
      let effectiveAllowDQ = allowDottedQuarters;

      if (!anyRhythmActive) {
          if (isSimple) effectiveAllowQ = true;           
          if (isCompound) effectiveAllowDQ = true;        
          if (isAsymmetric) { effectiveAllowQ = true; effectiveAllowDQ = true; }
      }
      
      const permissions = { q: effectiveAllowQ, qd: effectiveAllowDQ };
      const beatsPerMeasure = denominator === 8 ? numerator / 2 : numerator; 
      
      let pulseMap = [];
      if (isAsymmetric) {
          pulseMap = getAsymmetricPulsePattern(numerator); 
      } else if (isCompound) {
          const count = Math.round(beatsPerMeasure / 1.5);
          pulseMap = Array(count).fill(1.5);
      } else {
          pulseMap = Array(Math.ceil(beatsPerMeasure)).fill(1.0);
      }

      // === THE RETRY LOOP ===
      let beats = [];
      let validMeasureFound = false;

      const is44 = ts === "4/4";
      const onlyDQ = allowDottedQuarters && !allowQuarters && !allow8ths && !allow16ths && !allowTriplets && !allowQuarterTriplets && !allowQuintuplets && !allowSextuplets;
      
      if (is44 && onlyDQ && restPct === 0) {
          const permutations = [
              [make("q", 1.5, 1), make("q", 1.5, 1), R("q", 1.0)], 
              [make("q", 1.5, 1), R("q", 1.0), make("q", 1.5, 1)], 
              [R("q", 1.0), make("q", 1.5, 1), make("q", 1.5, 1)]  
          ];
          const choice = permutations[Math.floor(Math.random() * permutations.length)];
          
          let runningPos = 0;
          beats = choice.map((note, idx) => {
              const chunk = [note];
              note.groupId = (m * 100) + idx;
              note.absStart = runningPos;
              runningPos += note.beats;
              return chunk;
          });
          
          out.push({ beats, timeSig: ts });
          continue; 
      }

      const maxAttempts = 100;
      
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
          if (validMeasureFound) break;
          let currentAttemptBeats = [];
          let b = 0;
          let hasNote = false;
          let currentPulseIdx = 0;
          let accumulatedPulse = 0; 
          let measureFailed = false;
          let generatedRests = false;
          
          // NEW: Track if we just placed a pickup note (offset)
          let justPlacedPickup = false;
          // NEW: Track if we need to release a syncopation
          let forceReleaseNext = false;

          while (b < beatsPerMeasure - 0.01) {
              const beatsLeft = beatsPerMeasure - b;

              while (currentPulseIdx < pulseMap.length && (accumulatedPulse + pulseMap[currentPulseIdx] - 0.01) < b) {
                  accumulatedPulse += pulseMap[currentPulseIdx];
                  currentPulseIdx++;
              }
              
              let nextWall = accumulatedPulse + (pulseMap[currentPulseIdx] || 1.0);
              let distToPulse = nextWall - b;
              if (distToPulse < 0.01) distToPulse = 1.0; 

              let chunk = null;
              
              // === DETERMINE EFFECTIVE REST PCT ===
              let effectiveRestPct = restPct;
              
              // LOGIC: If we started a syncopation (Pickup OR Upbeat Figure), 
              // we MUST play a note next to resolve/release it.
              if (justPlacedPickup || forceReleaseNext) {
                  effectiveRestPct = 0; 
              }

              if (isCompound || isAsymmetric) {
                    chunk = pickCompoundBeatPattern({ 
                        restPct: effectiveRestPct, // Use effective pct
                        allowDottedQuarters: effectiveAllowDQ,
                        allowQuarters: effectiveAllowQ, 
                        allow8ths, allow16ths, 
                        allowTriplets, 
                        beatsLeft: distToPulse 
                    });
              } 
              else {
                   if (Math.abs(beatsLeft - 0.5) < 0.01) {
                       chunk = pickHalfBeatPattern(effectiveRestPct, allow8ths, allow16ths);
                   } 
                   else {
                       chunk = pickBeatPattern({ 
                           restPct: effectiveRestPct, // Use effective pct
                           allowDottedQuarters: effectiveAllowDQ, 
                           allowQuarters: effectiveAllowQ, 
                           allow8ths, allow16ths, allowTriplets, 
                           allowQuarterTriplets,
                           allowQuintuplets,
                           allow16thQuintuplets, 
                           allowSextuplets,
                           beatsLeft, 
                           currentBeat: b,
                           allowSyncopation,
                           distToPulse
                       });
                   }
              }

              if (!chunk) {
                  measureFailed = true;
                  break; 
              }

              if (chunk.some(n => n.kind === "rest")) generatedRests = true;
              if (chunk._isFallback) generatedRests = true; 

              const chunkDur = chunk.reduce((sum, n) => sum + (n.beats||0), 0);
              const hasNotes = chunk.some(n => n.kind === "note");

              // === CHECK FOR PICKUP (16th/8th offset) ===
              const isDownbeat = Math.abs(b % 1.0) < 0.01;
              const isPickupDur = Math.abs(chunkDur - 0.5) < 0.01;
              
              if (isDownbeat && isPickupDur && hasNotes) {
                  justPlacedPickup = true;
              } else {
                  justPlacedPickup = false;
              }

              // === CHECK FOR UPBEAT SYNCOPATION RELEASE ===
              // Detect if we just placed a significant note (Quarter, Triplet, 5let) on an upbeat.
              // If so, we ensure the NEXT rhythm is a Note (Release), not a Rest.
              const currentIsUpbeat = Math.abs((b % 1.0) - 0.5) < 0.01;
              const isTuplet = !!chunk._tuplet; // Covers Triplets, 5lets, 6lets
              // Quarter Notes (1.0), Large Tuplets, or Dotted Quarters (1.5)
              const isSignificant = (Math.abs(chunkDur - 1.0) < 0.1 || isTuplet || chunkDur > 0.6);

              if (currentIsUpbeat && hasNotes && isSignificant) {
                  forceReleaseNext = true;
              } else {
                  forceReleaseNext = false;
              }

              if (!isTuplet) {
                  chunk = normalizeSixteenthGridBeat(chunk);
                  
                  if (isSimple) {
                      chunk = normalizeEighthRestEighth(chunk);
                      chunk = absorbRestsInBeat(chunk, permissions);
                      chunk = normalizeEighthRestEighth(chunk);
                      chunk = collapseAllRestBeatToQuarter(chunk);
                  }
                  
                  chunk = simplifyBeat(chunk);
              } 
              
              let runningPos = b;
              chunk.forEach(n => {
                  n.groupId = (m * 100) + currentPulseIdx;
                  n.absStart = runningPos; 
                  runningPos += n.beats;
              });

              if (!hasNote && chunk.some(n => n.kind === "note")) hasNote = true;
              currentAttemptBeats.push(chunk);
              
              b += chunkDur;
          }

          if (measureFailed) continue;

          if (restPct === 0 && generatedRests) {
              const containsUnwantedRests = currentAttemptBeats.some(chunk => 
                  chunk.some(n => n.kind === "rest" && !n._preserve)
              );
              if (containsUnwantedRests) continue; 
          }

          beats = currentAttemptBeats;
          validMeasureFound = true;
          break; 
      }

      let finalHasNote = beats.some(chunk => chunk.some(n => n.kind === "note"));

      if (!finalHasNote) {
           beats = [];
           
           let seedCandidates = [];
           Object.keys(RHYTHM_VARIANTS).forEach(key => {
               if (key === "q" && !effectiveAllowQ) return;
               if (key === "dottedQ" && !effectiveAllowDQ) return;
               if (key === "8s" && !allow8ths) return;
               if (key === "16s" && !allow16ths) return;
               if (key === "8t" && !allowTriplets) return;
               if (key === "qt" && !allowQuarterTriplets) return;
               if (key === "5let" && !allowQuintuplets) return;
               if (key === "5let16" && !allow16thQuintuplets) return;
               if (key === "6let" && !allowSextuplets) return;

               RHYTHM_VARIANTS[key].forEach(v => {
                   if (!activeVariations.has(v.id)) return;
                   if (v._isCompoundVariant) return;
                   if (v.notes[0].kind !== "note") return;
                   seedCandidates.push(v);
               });
           });

           let seedPattern = null;
           let seedMeta = {};
           let seedDur = 1.0;

           if (seedCandidates.length > 0) {
               const choice = seedCandidates[Math.floor(Math.random() * seedCandidates.length)];
               seedPattern = JSON.parse(JSON.stringify(choice.notes));
               seedDur = seedPattern.reduce((s, n) => s + (n.beats || 0), 0);
               
               if (choice.id.includes("6let")) seedMeta._forceSixLetSticking = true;
               if (choice._tuplet) seedMeta._tuplet = choice._tuplet;
               else {
                    if (choice.id.includes("8t")) seedMeta._tuplet = { num_notes: 3, notes_occupied: 2 };
                    if (choice.id.includes("qt")) seedMeta._tuplet = { num_notes: 3, notes_occupied: 2 };
                    if (choice.id.includes("5let")) seedMeta._tuplet = { num_notes: 5, notes_occupied: 4 };
                    if (choice.id.includes("6let")) seedMeta._tuplet = { num_notes: 6, notes_occupied: 4 };
               }
           }
           
           const validStarts = [];
           for (let i = 0; i <= beatsPerMeasure - seedDur; i++) {
               validStarts.push(i);
           }
           const targetPulse = validStarts.length > 0 ? validStarts[Math.floor(Math.random() * validStarts.length)] : 0;
           
           let bSum = 0;
           while (bSum < beatsPerMeasure - 0.01) {
               const distToNext = Math.ceil(bSum + 0.01) - bSum;
               let step = (distToNext > 0.1) ? distToNext : 1.0;
               
               const allowSmall = allow16ths || allow16thQuintuplets || allowSextuplets;
               if (!allowSmall && step < 0.5) step = 0.5;

               if (bSum + step > beatsPerMeasure + 0.01) {
                   step = beatsPerMeasure - bSum;
               }

               if (Math.abs(bSum - targetPulse) < 0.1 && seedPattern) {
                   let chunk = JSON.parse(JSON.stringify(seedPattern));
                   if (seedMeta._tuplet) chunk._tuplet = seedMeta._tuplet;
                   if (seedMeta._forceSixLetSticking) chunk._forceSixLetSticking = true;
                   let run = bSum;
                   chunk.forEach(n => { n.absStart = run; run += n.beats; });
                   beats.push(chunk);
                   bSum += seedDur; 
                   seedPattern = null; 
               } else {
                   const rSpec = durSpecFromBeats(step) || { dur: "q", dots: 0 };
                   const rest = { kind: "rest", dur: rSpec.dur, dots: rSpec.dots, beats: step, absStart: bSum };
                   beats.push([rest]);
                   bSum += step;
               }
           }
      }
      
      // CALL CLEANUP
      beats = consolidateMeasureEvents(beats, permissions, ts); 

      // === BRUTE FORCE PADDING ===
      const currentTotalBeats = beats.reduce((acc, chunk) => {
          return acc + chunk.reduce((sum, n) => sum + (n.beats || 0), 0);
      }, 0);
      
      const missing = beatsPerMeasure - currentTotalBeats;
      
      if (missing > 0.01) {
          let remaining = missing;
          while (remaining > 0.1) {
              let padDur = null;
              let padBeats = 0;
              
              if (remaining >= 1.0) { padDur = "q"; padBeats = 1.0; }
              else if (remaining >= 0.5) { padDur = "8"; padBeats = 0.5; }
              else { padDur = "16"; padBeats = 0.25; }
              
              if (padDur) {
                  beats.push([{ kind: "rest", dur: padDur, beats: padBeats, groupId: 999 }]);
                  remaining -= padBeats;
              } else { break; }
          }
      }
      
      out.push({ beats, timeSig: ts });
    }
    return out;
  }





// Updated makeStaveNote: Fixes 5-let counting by using groupDur for grid calculation
function makeStaveNote(flow, elem, beatIdx, posInBeat, tupletType, isCompound, absPos, groupDur = 0) {
    const isRest = elem.kind === "rest";
    const base = elem.dur;
    const duration = isRest ? (base + "r") : base;

    let keys = ["c/5"]; 
    let targetLine = null;

    if (isRest) {
        if (tupletType) {
            keys = ["a/4"]; 
            targetLine = 3.0; 
        } else {
            keys = ["b/4"]; 
            targetLine = 3;
        }
    }

    const note = new flow.StaveNote({
      clef: "percussion",
      keys: keys,
      duration,
    });
    
    if (isRest && targetLine !== null) {
        if (note.keyProps && note.keyProps[0]) {
            note.keyProps[0].line = targetLine;
        }
        note.setKeyLine(0, targetLine);
    }

    if (!isRest && elem.sticking) {
      const text = new flow.Annotation(elem.sticking)
        .setFont("Arial", 11, "bold")
        .setVerticalJustification(flow.Annotation.VerticalJustify.BOTTOM);
      note.addModifier(text);
    }
    
    // --- COUNTING LOGIC ---
    if (currentShowCounts && !isRest) {
       let txt = "";
       const eps = 0.05;

       // 1. Handle Tuplets separately
       if (tupletType === 5) {
           // FIX: 5-let Counting "1 2 3 4 5" (Reset every group)
           // 16th 5-let (1 beat) -> grid = 0.2
           // 8th 5-let (2 beats) -> grid = 0.4
           const safeDur = (groupDur && groupDur > 0) ? groupDur : 2.0; 
           const grid = safeDur / 5; 
           
           // Calculate positional index (0-4)
           const idx = Math.round(posInBeat / grid);
           
           // Always output 1, 2, 3, 4, 5 based on slot
           txt = (idx + 1).toString();
       } 
       else if (tupletType === 6) {
           const idx = Math.round(posInBeat / (1/6)); 
           const map = ["1", "la", "li", "&", "la", "li"]; 
           txt = (idx === 0) ? (Math.floor(absPos + eps) + 1).toString() : map[idx % 6];
       }
       else if (tupletType === 3) {
           const idx = Math.round(posInBeat / (1/3));
           const map = ["1", "la", "li"];
           txt = (idx === 0) ? (Math.floor(absPos + eps) + 1).toString() : map[idx % 3];
       } 
       // 2. GLOBAL GRID LOGIC
       else {
           const beatNum = Math.floor(absPos + eps) + 1;
           const sub = absPos % 1.0; 

           if (Math.abs(sub) < eps || Math.abs(sub - 1.0) < eps) {
               txt = beatNum.toString();
           } 
           else if (Math.abs(sub - 0.5) < eps) {
               txt = "&";
           }
           else if (Math.abs(sub - 0.25) < eps) {
               txt = "e";
           }
           else if (Math.abs(sub - 0.75) < eps) {
               txt = "a";
           }
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










// Updated buildMeasure: Fixes Tuplet Bracket merging across beats
function buildMeasure(flow, measureModel) {
    const notes = [];
    const tuplets = [];
    const beams = [];
    let currentMeasurePos = 0; 
    const allEvents = [];
    
    measureModel.beats.forEach((beat, bIndex) => {
        if (!beat) return;
        let localPos = 0;
        const isGlobalTuplet = !!beat._tuplet;
        let tType = null;
        if (isGlobalTuplet) tType = beat._tuplet.num_notes || 3;
        const groupDur = beat.reduce((sum, n) => sum + (n.beats || 0), 0);
        const isCompoundPulse = Math.abs(groupDur - 1.5) < 0.01;

        beat.forEach((e) => {
            if (e._localTuplet) tType = 6; 
            const actualAbsPos = (e.absStart !== undefined) ? e.absStart : currentMeasurePos;
            
            // Pass groupDur
            const vfNote = makeStaveNote(flow, e, bIndex, localPos, tType, isCompoundPulse, actualAbsPos, groupDur);
            
            vfNote.__beatPos = actualAbsPos; 
            if (e._localTuplet && !isGlobalTuplet) vfNote._localTuplet = true;
            
            // Pass the Hybrid flag
            if (e._isHybrid) vfNote._isHybrid = true;
            
            allEvents.push({ 
                note: vfNote, dur: e.dur, kind: e.kind, beats: e.beats,
                isTuplet: isGlobalTuplet || !!e._localTuplet,
                pos: currentMeasurePos, groupId: e.groupId 
            });
            localPos += Number(e.beats || 0);
            currentMeasurePos += Number(e.beats || 0);
        });
        
        if (isGlobalTuplet) {
             const vfNotes = allEvents.slice(allEvents.length - beat.length).map(x => x.note);
             const allBeamable = beat.every(e => e.kind === "note" && ["8", "16", "32", "64"].includes(e.dur));
             tuplets.push(new flow.Tuplet(vfNotes, { ...beat._tuplet, bracketed: !allBeamable, ratioed: false }));
        }
    });

    notes.push(...allEvents.map(e => e.note));

    let buffer = []; 
    const flushTuplets = () => {
        if (buffer.length > 0) {
            const vfNotes = buffer.map(b => b.note);
            const allBeamable = buffer.every(b => b.kind === "note" && ["8", "16", "32", "64"].includes(b.dur));
            tuplets.push(new flow.Tuplet(vfNotes, { num_notes: 3, notes_occupied: 2, ratioed: false, bracketed: !allBeamable }));
            buffer = [];
        }
    };

    // === UPDATED LOOP: Checks Group ID to prevent merging across beats ===
    allEvents.forEach(e => { 
        if (e.note._localTuplet) {
            // If the group ID changes (e.g., Beat 1 -> Beat 2), flush the previous bracket first
            if (buffer.length > 0 && buffer[0].groupId !== e.groupId) {
                flushTuplets();
            }
            buffer.push(e); 
        } else {
            flushTuplets();
        } 
    });
    flushTuplets();

    // --- BEAMING ENGINE ---
    let group = [];
    const isBeamable = (e) => (e.kind !== "rest" && ["8", "16", "32", "64"].includes(e.dur));

    function flushBeam() {
        if (group.length >= 2) {
            group.forEach(n => n.setStemDirection(flow.Stem.UP));
            const beam = new flow.Beam(group);
            if(beam.setBeamDirection) beam.setBeamDirection(flow.Stem.UP);
            beams.push(beam);
        }
        group = [];
    }

    for (let i = 0; i < allEvents.length; i++) {
        const evt = allEvents[i];
        
        if (group.length > 0) {
            const prevEvt = allEvents[i-1];
            const parts = (measureModel.timeSig || "4/4").split("/");
            const den = parseInt(parts[1], 10);
            const isSimple = (den === 4); 

            let shouldBreak = (evt.groupId !== prevEvt.groupId);

            if (isSimple && !evt.isTuplet) { 
                const eps = 0.001;
                const sameBeat = Math.floor(prevEvt.pos + eps) === Math.floor(evt.pos + eps);
                if (sameBeat) shouldBreak = false; else shouldBreak = true;
            }
            
            // STRICT TUPLET ISOLATION (With Hybrid Exception)
            if (evt.isTuplet !== prevEvt.isTuplet) {
                const isHybridConnection = (evt.note._isHybrid && prevEvt.note._isHybrid);
                if (!isHybridConnection) {
                    shouldBreak = true;
                }
            }

            if (shouldBreak) flushBeam();
        }

        if (isBeamable(evt)) group.push(evt.note); else flushBeam();
    }
    flushBeam();

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

    const voice = new flow.Voice({ num_beats: num, beat_value: den });
    voice.setStrict(false);
    voice.addTickables(pack.notes);

    // FIX: Ask VexFlow to calculate the EXACT width required for these specific notes.
    // This solves the "cramping" issue by making complex measures report their true size.
    const formatter = new flow.Formatter();
    formatter.joinVoices([voice]);
    const requiredNoteWidth = formatter.preCalculateMinTotalWidth([voice]);

    // Add structural padding
    // First measure needs extra room for Clef & Time Signature (~80px)
    // All measures need a little breathing room (~30px) so notes don't touch bar lines
    const firstMeasureExtra = isFirstMeasure ? 80 : 0;
    const breathingRoom = 30;

    // Calculate total minimum width
    const minW = requiredNoteWidth + firstMeasureExtra + breathingRoom;

    // Ensure no measure is ever ridiculously small (e.g. a whole rest)
    const finalW = Math.max(minW, 120);

    return { ...pack, voice, minW: Math.ceil(finalW) };
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

    // Scale logic
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

    // --- CANVAS SIZING & POSITIONING FIX ---
    // Force styles via JS to bypass potential CSS syntax errors
    if (playheadEl instanceof HTMLCanvasElement) {
      playheadEl.width = physW;
      playheadEl.height = physH;
      playheadEl.style.width = physW + "px";
      playheadEl.style.height = physH + "px";
      
      // FIX 1: Force Absolute Positioning via JS
      playheadEl.style.position = 'absolute';
      playheadEl.style.inset = '0';
      playheadEl.style.top = '0';
      playheadEl.style.left = '0';
      playheadEl.style.pointerEvents = 'none';
      playheadEl.style.zIndex = '10';
    }

    // FIX 2: Force Parent Relative Positioning via JS
    // This ensures the playhead stays inside the box, not at the top of the page
    if (scoreEl && scoreEl.parentElement) {
        scoreEl.parentElement.style.position = 'relative';
    }

    scoreEl.width = physW;
    scoreEl.height = physH;
    scoreEl.style.width = physW + "px";
    scoreEl.style.height = physH + "px";

    layoutMeasures = [];
    clearPlayhead();

    const renderer = new flow.Renderer(scoreEl, flow.Renderer.Backends.CANVAS);
    renderer.resize(physW, physH);

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

        // --- ANCHOR CALCULATION ---
        const parts = currentTS.split("/");
        const n = parseInt(parts[0], 10);
        const d = parseInt(parts[1], 10);
        const lenBeats = (d === 8) ? (n / 2) : n;

        layoutMeasures[mIdx] = { 
            x0: stave.getNoteStartX(), 
            x1: stave.getNoteEndX(), 
            // FIX: Reduced buffer from 60 to 40
            topY: stave.getYForLine(0) - 40, 
            botY: stave.getYForLine(4) + 40, 
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
    // With 'absolute' + 'inset:0' in CSS, we just confirm 0,0 here
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
    
    // Clear the whole canvas (using raw physical dimensions)
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
    
    // Retrieve the exact scale VexFlow used
    const s = lastRenderScale || 1;

    // Apply the scaling Matrix to the context so we can use Raw VexFlow Coordinates
    ctx.save();
    ctx.scale(s, s);

    // Get Raw X (Virtual Coordinate)
    const currentX = xFromAnchors(geom, localBeat);
     
    // Use Raw Y coordinates (Virtual)
    let y0 = Math.max(0, geom.topY);
    let y1 = geom.botY;

    // Calculate width relative to scale so the line remains 5px visually
    const lineWidth = 5 / s;

    // Auto-Scroll Logic (Using Scaled Values for DOM comparison)
    if (scoreWrapEl) {
        const visualY0 = y0 * s;
        const visualY1 = y1 * s;
        const scrollT = scoreWrapEl.scrollTop;
        const wrapH = scoreWrapEl.clientHeight;
        if (isPlaying && !isPaused) {
            if (visualY1 > scrollT + wrapH - 20) {
                scoreWrapEl.scrollTop = visualY0 - 20; 
            } else if (visualY0 < scrollT) {
                scoreWrapEl.scrollTop = visualY0 - 20;
            }
        }
        // PERFORMANCE FIX: Removed syncPlayheadOverlayPosition() from loop
        // It causes layout thrashing and is redundant (handled by CSS inset:0 and resize event)
    }

    ctx.globalAlpha = 0.92;
    ctx.strokeStyle = "#d35400"; 
    ctx.lineWidth = lineWidth; 
    ctx.lineCap = "round"; 
    ctx.shadowColor = "rgba(211, 84, 0, 0.45)";
    ctx.shadowBlur = 6;
    
    ctx.beginPath();
    ctx.moveTo(currentX, y0);
    ctx.lineTo(currentX, y1);
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
           
           // FIX: Handle Count-In Alignment for X/8 Time
           // If we are in the negative (count-in), we must align to the START of the count-in
           // rather than the start of the first measure (0).
           // This ensures 7/8 counts as 1-2-3-0.5 (q q q 8) instead of 0.5-1-1-1 (8 q q q).
           let alignmentBase = measureStart;
           if (schedulerBeat < 0) {
               const firstMs = currentExercise[0];
               if (firstMs) {
                   const ts = firstMs.timeSig || "4/4";
                   const parts = ts.split("/");
                   const n = parseInt(parts[0], 10);
                   const d = parseInt(parts[1], 10);
                   // Calculate the length of the 'negative' measure
                   const len = (d === 8) ? (n / 2) : n;
                   alignmentBase = -len;
               }
           }

           const localBeat = schedulerBeat - alignmentBase;
           
           // 2. IDENTIFY DOWNBEAT & INTEGER BEATS
           // Use a tolerance for floating point precision.
           // Note: localBeat is now relative to alignmentBase, so 0.0, 1.0, 2.0 are always integers.
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
              twoColumns: true, // <--- Enabled 2-column layout
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


// NEW: Time Signature Picker with Quick Actions
  if (timeSigInput) {
    timeSigInput.addEventListener("click", () => {
      showPicker({
        theme: 'purple', 
        title: "Time Signatures",
        multi: true,
        twoColumns: true, 
        items: timeSigOptions,
        selected: currentTimeSigs,
        defaults: [], 
        
        // === CATEGORIZATION LOGIC ===
        groupBy: (item) => {
            const val = item.value;
            if (["2/4", "3/4", "4/4", "5/4", "6/4"].includes(val)) return "Simple Meters";
            if (["6/8", "9/8", "12/8"].includes(val)) return "Compound Meters";
            if (["5/8", "7/8"].includes(val)) return "Asymmetric Meters";
            return "Other";
        },

        quickActions: [
            { 
                label: "All", 
                color: "orange",
                action: (items, current) => toggleSelection(items, current, () => true) 
            },
            { 
                label: "Simple", 
                color: "purple",
                action: (items, current) => toggleSelection(items, current, i => ["2/4", "3/4", "4/4", "5/4", "6/4"].includes(i.value))
            },
            { 
                label: "Compound", 
                color: "purple",
                action: (items, current) => toggleSelection(items, current, i => ["6/8", "9/8", "12/8"].includes(i.value))
            },
            { 
                label: "Asymmetric", 
                color: "purple",
                action: (items, current) => toggleSelection(items, current, i => ["5/8", "7/8"].includes(i.value))
            }
        ],

        onSave: (selection) => {
          selection.sort();
          currentTimeSigs = selection;
          if (selection.length === 0) timeSigInput.value = "None";
          else if (selection.length === 1) timeSigInput.value = selection[0];
          else if (selection.length === timeSigOptions.length) timeSigInput.value = "All";
          else timeSigInput.value = "Mixed";
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
      
      const allowDottedQuarters = !!allowDottedQuartersEl?.checked;
      const allowQuarters = !!allowQuartersEl?.checked; 
      const allow8ths = !!allow8thsEl?.checked;
      const allow16ths = !!allow16thsEl?.checked;
      const allowTriplets = !!allowTripletsEl.checked;
      const allowQuarterTriplets = !!allowQuarterTripletsEl?.checked;
      const allowQuintuplets = !!allowQuintupletsEl?.checked;
      const allow16thQuintuplets = !!allow16thQuintupletsEl?.checked;
      const allowSextuplets = !!allowSextupletsEl?.checked;
      
      // NEW: Syncopation flag
      const allowSyncopation = !!$("allowSyncopation")?.checked;

      currentExercise = generateExercise({ 
        measures, 
        timeSignatures: currentTimeSigs,
        restPct, 
        allowDottedQuarters,
        allowQuarters, 
        allow8ths, 
        allow16ths, 
        allowTriplets, 
        allowQuarterTriplets, 
        allowQuintuplets, 
        allow16thQuintuplets, 
        allowSextuplets,
        allowSyncopation // Pass it
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

// --- NEW: Quick Select Buttons Logic (Main Menu) ---
  const btnAll = $("btnAll");
  const btnRandom = $("btnRandom");
  const btnFull = $("btnFull"); // NEW
  const btnStraight = $("btnStraight");
  const btnTriplets = $("btnTriplets");

  // === UI CLEANUP: Force Remove the Deselect Button ===
  // This ensures the button disappears from the screen even if it's still in your HTML.
  const oldBtnNone = $("btnNone");
  if (oldBtnNone) oldBtnNone.remove();

  // Define groups
  const rhythmInputs = [
      allowDottedQuartersEl, allowQuartersEl, allowQuarterTripletsEl, allow8thsEl, 
      allowQuintupletsEl, allowTripletsEl, allow16thsEl, allow16thQuintupletsEl, allowSextupletsEl
  ].filter(el => !!el); // Safety filter
  
  // UPDATED: Added Dotted Quarters to straight group
  const straightGroup = ["allowDottedQuarters", "allowQuarters", "allow8ths", "allow16ths"];
  const tripletGroup = ["allowQuarterTriplets", "allowTriplets", "allowSextuplets"];

  // Helper to toggle a list of DOM elements
  function toggleDomGroup(groupIds) {
      const targets = rhythmInputs.filter(el => groupIds.includes(el.id));
      // Toggle Logic: If ALL in group are active, turn them OFF. Otherwise turn them ON.
      const allActive = targets.every(el => el.checked);
      const newState = !allActive; 
      targets.forEach(el => el.checked = newState);
      regenerate();
  }

  if (btnAll) btnAll.onclick = () => {
      // Logic: If ANY are currently active -> Turn ALL OFF.
      // Only if NONE are active -> Turn ALL ON.
      const anyActive = rhythmInputs.some(el => el.checked);
      const newState = !anyActive;

      rhythmInputs.forEach(el => el.checked = newState);
      regenerate();
  };

  if (btnRandom) btnRandom.onclick = () => {
      rhythmInputs.forEach(el => { 
          if(el) el.checked = Math.random() < 0.5; 
      });
      regenerate();
  };

  // NEW: Full Button Logic (Toggle: Full <-> All)
  if (btnFull) btnFull.onclick = () => {
      const fullIds = new Set([
          "q_1",          // Quarter
          "dq_1",         // Dotted Quarter
          "8s_11",        // 2 Eighths
          "8s_c_111",     // 3 Eighths (Compound)
          "16s_1111",     // 4 Sixteenths
          "8t_111",       // Triplet
          "qt_111",       // Quarter Triplet
          "5let_11111",   // Quintuplet
          "5let16_11111", // 16th Quintuplet
          "6let_111111"   // Sextuplet
      ]);

      // 1. Detect State: Are any "Non-Full" variations currently active?
      let hasNonFullActive = false;
      Object.values(RHYTHM_VARIANTS).forEach(group => {
          group.forEach(variant => {
              if (!fullIds.has(variant.id) && activeVariations.has(variant.id)) {
                  hasNonFullActive = true;
              }
          });
      });

      // 2. Logic: 
      // If we have non-full stuff active (Mixed/All) -> Go to STRICT FULL.
      // If we have ONLY full stuff active (Strict Full) -> Go to ALL.
      const targetIsFull = hasNonFullActive;

      Object.values(RHYTHM_VARIANTS).forEach(group => {
          group.forEach(variant => {
              if (targetIsFull) {
                  // TARGET: FULL ONLY
                  if (fullIds.has(variant.id)) activeVariations.add(variant.id);
                  else activeVariations.delete(variant.id);
              } else {
                  // TARGET: ALL
                  activeVariations.add(variant.id);
              }
          });
      });
      regenerate();
  };

  if (btnStraight) btnStraight.onclick = () => toggleDomGroup(straightGroup);
  if (btnTriplets) btnTriplets.onclick = () => toggleDomGroup(tripletGroup);




// --- MOBILE FIX: Prevent "Tear Drop" / Focus on Inputs ---
  // This stops the browser from trying to select text when you tap,
  // but still lets the 'click' event fire to open the picker.
  document.querySelectorAll(".white-select").forEach(el => {
      el.addEventListener("mousedown", (e) => {
          e.preventDefault(); 
          // e.preventDefault() on mousedown prevents the input 
          // from getting focus, killing the cursor/handles.
      });
  });

  // NEW: Missing Helper for Picker Buttons
  function toggleSelection(items, currentSet, predicate) {
      const candidates = items.filter(predicate);
      // Check if ALL candidates are currently selected
      const allSelected = candidates.every(item => currentSet.has(item.id || item.value));
      
      if (allSelected) {
          // If all are selected -> Deselect them all
          candidates.forEach(item => currentSet.delete(item.id || item.value));
      } else {
          // Otherwise -> Select them all
          candidates.forEach(item => currentSet.add(item.id || item.value));
      }
      return new Set(currentSet); // Return new Set to trigger update
  }


// Updated setupTileInteractions: Fixes 100100 to dotted 8th + dotted 8th
function setupTileInteractions() {  const tiles = document.querySelectorAll('.rhythmTile');
  tiles.forEach(tile => {
      const input = tile.querySelector('input');
      const iconZone = tile.querySelector('.rhythmIcon');
      if(input) input.addEventListener('change', () => regenerate());

      if(iconZone) {
          iconZone.addEventListener('click', (e) => {
              e.preventDefault(); e.stopPropagation();
              const rhythmKey = iconZone.getAttribute('data-type');
              if (["q", "dottedQ"].includes(rhythmKey)) { if (input) input.click(); return; }
              if (!rhythmKey || !RHYTHM_VARIANTS[rhythmKey]) return;

              let hasSimple = false; let hasCompound = false;
              if (!currentTimeSigs || currentTimeSigs.length === 0) hasSimple = true; 
              else currentTimeSigs.forEach(ts => {
                  const parts = ts.split("/"); const num = parseInt(parts[0], 10); const den = parseInt(parts[1], 10);
                  if (den === 4) hasSimple = true;
                  else if (den === 8) { if (num % 3 === 0) hasCompound = true; else { hasSimple = true; hasCompound = true; } }
              });

              let variants = [...RHYTHM_VARIANTS[rhythmKey]]; 

              if (hasCompound && rhythmKey === "16s" && RHYTHM_VARIANTS["6let"]) {
                  const compoundVars = JSON.parse(JSON.stringify(RHYTHM_VARIANTS["6let"]));
                  compoundVars.forEach(v => {
                      v._isCompoundVariant = true; v._tuplet = null; v._preserve = true; 

                      // SPECIAL CONVERSION: "Sixlitz" patterns
                      if (v.id === "6let_111100") {
                          v.notes = [make("16", 0.25), make("16", 0.25), make("16", 0.25), make("8", 0.75, 1)];
                          v.notes.forEach(n => n._isHybrid = true); // <--- ADD THIS
                      }
                      else if (v.id === "6let_111000") {
                          v.notes = [make("16", 0.25), make("16", 0.25), make("16", 0.25), R("8", 0.75, 1)];
                          v.notes.slice(0,3).forEach(n => n._isHybrid = true); // <--- ADD THIS
                      }
                      else if (v.id === "6let_100111") {
                          v.notes = [make("8", 0.75, 1), make("16", 0.25), make("16", 0.25), make("16", 0.25)];
                          v.notes.forEach(n => n._isHybrid = true); // <--- ADD THIS
                      }
                      // ... (Keep existing conversions) ...
                      else if (v.id === "6let_000111") { v.notes = [R("8", 0.75, 1), make("16", 0.25), make("16", 0.25), make("16", 0.25)]; }
                      else if (v.id === "6let_100100") { v.notes = [make("8", 0.75, 1), make("8", 0.75, 1)]; }
                      else if (v.id === "6let_000100") { v.notes = [R("8", 0.75, 1), make("8", 0.75, 1)]; }
                      else {
                          v.notes = v.notes.map(n => {
                              let newDur = "16"; let newBeats = 0.25;
                              if (n.dur === "8") { newDur = "8"; newBeats = 0.5; }
                              if (n.dur === "q") { newDur = "q"; newBeats = 1.0; }
                              return { ...n, beats: newBeats, dur: newDur, _tuplet: undefined, _localTuplet: undefined };
                          });
                      }
                  });
                  variants = [...variants, ...compoundVars];
              }
              // ... (rest of picker logic same as before) ...
              // I am truncating here to save space, but the important part was the `_isHybrid` tags above.
              if (!hasSimple) variants = variants.filter(v => v._isCompoundVariant);
              if (!hasCompound) variants = variants.filter(v => !v._isCompoundVariant);

              const title = tile.getAttribute('title') || "Variations";
              const currentSelectedIds = variants.filter(v => activeVariations.has(v.id)).map(v => v.id);
              const getNoteCount = (v) => v.notes.filter(n => n.kind !== 'rest').length;
              
              variants.sort((a, b) => {
                  const isCompoundA = !!a._isCompoundVariant; const isCompoundB = !!b._isCompoundVariant;
                  if (isCompoundA !== isCompoundB) return isCompoundA ? 1 : -1; 
                  return getNoteCount(b) - getNoteCount(a);
              });

              const groupFn = (item) => {
                  // Only adds the "Pulse" parent for 8ths and 16ths
                  if (rhythmKey === "8s" || rhythmKey === "16s") {
                      const pulseHeader = item._isCompoundVariant ? "Compound Pulse" : "Simple Pulse";
                      return `${pulseHeader}|||${getNoteCount(item)} Note Grouping`;
                  }
                  // Everything else just gets the Note Grouping header (which will now look correct thanks to step 1)
                  return `${getNoteCount(item)} Note Grouping`;
              };

              const counts = [...new Set(variants.map(getNoteCount))].sort((a, b) => b - a);
              const actions = [];
              actions.push({ label: "All", color: "orange", action: (items, current) => toggleSelection(items, current, () => true) });

              const hasSimpleVar = variants.some(v => !v._isCompoundVariant);
              const hasCompoundVar = variants.some(v => v._isCompoundVariant);
              if (hasSimpleVar && hasCompoundVar) {
                  counts.forEach(c => { if (variants.some(v => !v._isCompoundVariant && getNoteCount(v) === c)) { actions.push({ label: `Simple ${c}`, color: "purple", action: (items, current) => toggleSelection(items, current, i => !i._isCompoundVariant && getNoteCount(i) === c) }); } });
                  counts.forEach(c => { if (variants.some(v => v._isCompoundVariant && getNoteCount(v) === c)) { actions.push({ label: `Comp ${c}`, color: "purple", action: (items, current) => toggleSelection(items, current, i => i._isCompoundVariant && getNoteCount(i) === c) }); } });
              } else {
                  counts.forEach(c => { actions.push({ label: `${c} Note`, color: "purple", action: (items, current) => toggleSelection(items, current, i => getNoteCount(i) === c) }); });
              }

              showPicker({
                  title: title, items: variants, multi: true, groupBy: groupFn, 
                  selected: currentSelectedIds, quickActions: actions,
                  onSave: (selectedIds) => {
                      const displayedIds = new Set(variants.map(v => v.id));
                      displayedIds.forEach(id => activeVariations.delete(id));
                      selectedIds.forEach(id => activeVariations.add(id));
                      regenerate();
                  }
              });
          });
      }
  });
}



  safeRenderAllIcons();
  setupTileInteractions(); 
  regenerate();



// =========================================================
  // === HOTKEY SYSTEM ===
  // =========================================================
  
  window.addEventListener("keydown", (e) => {
      // 1. IGNORE inputs
      if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT") return;

      // --- PLAYBACK CONTROLS ---
      
      // Space -> Play/Pause
      if (e.code === "Space") {
          e.preventDefault(); 
          togglePlayPause();
          return;
      }

      // K -> Play/Pause
      if (e.code === "KeyK") {
          togglePlayPause();
          return;
      }

      // Backspace -> Stop
      if (e.code === "Backspace") {
          e.preventDefault(); // Prevents browser back navigation history
          stop();
          return;
      }

      // Enter -> Regenerate
      if (e.code === "Enter") {
          e.preventDefault();
          regenerate();
          return;
      }

      // R -> Regenerate (Simple Tap)
      if (e.code === "KeyR" && !e.ctrlKey && !e.metaKey) {
          regenerate();
          return;
      }

      // J -> Go Back 1 Second
      if (e.code === "KeyJ") {
          seekBySeconds(-1);
          return;
      }

      // L -> Go Forward 1 Second
      if (e.code === "KeyL") {
          seekBySeconds(1);
          return;
      }

      // --- PARAMETER CONTROLS (Arrows) ---
      if (["ArrowUp", "ArrowRight", "ArrowDown", "ArrowLeft"].includes(e.code)) {
          e.preventDefault(); 
          
          const isIncrease = (e.code === "ArrowUp" || e.code === "ArrowRight");
          const amount = e.shiftKey ? 5 : 1;
          const delta = isIncrease ? amount : -amount;

          // CHECK MODIFIER: Ctrl (Win) or Command (Mac)
          const isModifierHeld = e.ctrlKey || e.metaKey;

          if (isModifierHeld) {
              // === CTRL + ARROWS -> MODIFY RESTS ===
              let val = parseInt(restsEl.value, 10) || 0;
              val += delta;
              val = Math.max(0, Math.min(60, val));
              
              restsEl.value = val;
              restsEl.dispatchEvent(new Event('input'));
          } else {
              // === ARROWS ONLY -> MODIFY BPM ===
              let val = parseInt(tempoEl.value, 10) || 100;
              val += delta;
              val = Math.max(40, Math.min(220, val));
              
              tempoEl.value = val;
              tempoEl.dispatchEvent(new Event('input'));
          }
      }
  });

  // --- SEEK FUNCTION ---
  function seekBySeconds(seconds) {
      if (!totalBeatsScheduled || totalBeatsScheduled <= 0) return;

      const bpm = Math.max(40, Math.min(220, Number(tempoEl.value) || 120));
      const spb = 60 / bpm; 
      const beatDelta = seconds / spb;

      let currentPos = accumulatedBeat;
      if (isPlaying && !isPaused && audioCtx) {
          const elapsed = audioCtx.currentTime - audioStartTime;
          currentPos += (elapsed / spb);
      }

      let newPos = currentPos + beatDelta;
      newPos = Math.max(0, Math.min(totalBeatsScheduled, newPos));

      accumulatedBeat = newPos;
      schedulerBeat = newPos;

      if (isPlaying && !isPaused && audioCtx) {
          audioStartTime = audioCtx.currentTime;
          nextNoteTime = audioStartTime + 0.05; 

          if (masterGain) {
              masterGain.gain.cancelScheduledValues(0);
              masterGain.gain.setValueAtTime(0, audioCtx.currentTime);
              masterGain.gain.linearRampToValueAtTime(1, audioCtx.currentTime + 0.05);
          }
      }

      drawPlayheadAtBeat(accumulatedBeat);
      updateTimeDisplays();
      
      if (progressBar) {
          const pct = (accumulatedBeat / totalBeatsScheduled) * 100;
          progressBar.style.width = pct + "%";
      }
  }


});