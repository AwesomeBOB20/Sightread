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
  const allow16thQuintupletsEl = $("allow16thQuintuplets");
  const allowSextupletsEl = $("allowSextuplets"); 
  const allow9letsEl = $("allow9lets"); // <--- NEW
  const allowDottedQuartersEl = $("allowDottedQuarters");
  const allowQuartersEl = $("allowQuarters"); // NEW
  const allow8thsEl = $("allow8ths");
  const allow16thsEl = $("allow16ths");
  const undoBtn = $("undo"); // NEW
  const regenBtn = $("regen");
  const playBtn = $("play");
  const stopBtn = $("stop");

  let exerciseHistory = []; // NEW: History Stack
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

  // NEW: Force Undo button to reset to disabled (Dark) state
  if (undoBtn) undoBtn.disabled = true;
   
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
  if (allow9letsEl) allow9letsEl.checked = true;

  // 3. INITIALIZE STATE (Synced to the defaults set above)
  let currentStickingStrategy = "natural";
  let currentLeadHand = "R"; 
  let isStickingVisible = true;
  let currentShowCounts = true;
  let isMetronomeOn = true;  
  let activeVariations = new Set(); 
  
  // NEW: Track the pulse ratio for audio (1.0 = Quarter, 1.5 = Dotted Quarter)
  let currentPulseRatio = 1.0; 

  // NEW: Helper to draw the white tempo icon
  function drawTempoIcon(isDotted) {
      const c = $("tempoIcon");
      if (!c) return;
      const ctx = c.getContext("2d");
      const w = c.width;
      const h = c.height;

      ctx.clearRect(0, 0, w, h);
      ctx.strokeStyle = "#fff";
      ctx.fillStyle = "#fff";
      ctx.lineWidth = 2;

      // Draw Note Head (rotated oval)
      ctx.save();
      ctx.translate(8, 16);
      ctx.rotate(-20 * Math.PI / 180);
      ctx.beginPath();
      ctx.ellipse(0, 0, 5, 3.5, 0, 0, 2 * Math.PI);
      ctx.fill();
      ctx.restore();

      // Draw Stem
      ctx.beginPath();
      ctx.moveTo(12, 16); // right side of head
      ctx.lineTo(12, 2);  // up
      ctx.stroke();

      // Draw Dot (if needed)
      if (isDotted) {
          ctx.beginPath();
          ctx.arc(18, 14, 2, 0, 2 * Math.PI); // x, y, radius
          ctx.fill();
      }
  }

  // NEW: Time Signature State
  let currentTimeSigs = ["4/4"]; 
  
  // CONSTANT: Pulse Maps for Asymmetric Meters
  const PULSE_PATTERNS = {
      "5/8": [[1.5, 1.0], [1.0, 1.5]],
      "7/8": [[1.5, 1.0, 1.0], [1.0, 1.5, 1.0], [1.0, 1.0, 1.5]],
      "9/8_asym": [[1.5, 1.0, 1.0, 1.0], [1.0, 1.5, 1.0, 1.0], [1.0, 1.0, 1.5, 1.0], [1.0, 1.0, 1.0, 1.5]]
  };

  const timeSigOptions = [
      // Simple
      { label: "2/4", value: "2/4" },
      { label: "3/4", value: "3/4" },
      { label: "4/4", value: "4/4" },
      { label: "5/4", value: "5/4" },
      { label: "6/4", value: "6/4" },
      
      // Compound
      { label: "6/8", value: "6/8" },
      { label: "9/8", value: "9/8" },
      { label: "12/8", value: "12/8" },

      // Asymmetric
      { label: "5/8", value: "5/8" },
      { label: "7/8", value: "7/8" },
      { label: "9/8", value: "9/8_asym" } // NEW
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

    // Used to clean up resize listener when picker closes
    let footerResizeHandler = null;

    if (quickActions && quickActions.length > 0) {
        const footer = document.createElement("div");
        footer.className = "picker__footer";

        // Render buttons in a flat list
        quickActions.forEach(qa => {
            const btn = createActionButton(qa);
            footer.appendChild(btn);
        });

        modal.appendChild(footer);

        // Measure the *intrinsic* width needed to fit the longest label,
        // then store it as a CSS var so grid columns stay even + as small as possible.
        const updateFooterMin = () => {
            const buttons = Array.from(footer.querySelectorAll("button"));
            if (buttons.length === 0) return;

            // Create an offscreen measurer that still gets `.picker__footer .btn` styles
            const measurer = document.createElement("div");
            measurer.className = "picker__footer";
            measurer.style.position = "absolute";
            measurer.style.left = "-99999px";
            measurer.style.top = "0";
            measurer.style.visibility = "hidden";
            measurer.style.pointerEvents = "none";
            measurer.style.height = "0";
            measurer.style.overflow = "visible";

            document.body.appendChild(measurer);

            let max = 0;
            for (const b of buttons) {
                const clone = b.cloneNode(true);
                clone.onclick = null;
                clone.style.width = "max-content";   // force intrinsic sizing
                clone.style.justifySelf = "start";
                measurer.appendChild(clone);

                const w = clone.getBoundingClientRect().width;
                if (w > max) max = w;
            }

            measurer.remove();

            footer.style.setProperty("--picker-footer-min", `${Math.ceil(max)}px`);
        };

        footerResizeHandler = () => updateFooterMin();

        // Wait 1 frame so CSS has applied before measuring
        requestAnimationFrame(updateFooterMin);
        window.addEventListener("resize", footerResizeHandler);
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

        // NOTE: do NOT use `btn-quick` here (it has big padding/font-size !important).
        // We want footer sizing to be controlled by `.picker__footer .btn` CSS.
        btn.className = `btn ${colorClass}`;
        btn.textContent = qa.label;

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

        // cleanup footer + resize listener
        if (footerResizeHandler) {
            window.removeEventListener("resize", footerResizeHandler);
            footerResizeHandler = null;
        }

        const f = pickerOverlay.querySelector(".picker__footer");
        if (f) f.remove();
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
    let scale = isSmall ? 0.75 : 0.90;
    
    // NEW: Extra shrink for 60px height
    if (H < 65) scale = 0.65; 

    const is9Let = recipe.tuplet && recipe.tuplet.num_notes === 9;
    const isDense = recipe.notes.length > 6;

    if (is9Let || isDense) {
         scale = isSmall ? 0.45 : 0.65;
    }
    
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
    stave.setStyle({ strokeStyle: "rgba(0,0,0,0)", fillStyle: "rgba(0,0,0,0)" });
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
        let accumulatedSlots = 0;
        let splitIndices = []; 
        
        // INTEGER MATH HELPER
        const getSlots = (n) => {
            if (n.beats) return Math.round(n.beats * 4.5);
            if (n.dur === "16") return 1; 
            if (n.dur === "8") return n.dots ? 3 : 2;
            if (n.dur === "q") return 4; 
            return 0;
        };

        const isFull9 = is9Let && recipe.notes.length === 9 && recipe.notes.every(n => n.kind !== 'rest' && !n.rest);

        notes.forEach((note, index) => {
            const rawNote = recipe.notes[index];
            const isRest = rawNote.kind === "rest" || !!rawNote.rest;
            const isBeamable = !isRest && ["8", "16", "32"].includes(rawNote.dur);

            if (isBeamable) {
                currentGroup.push(note);
            } else {
                if (currentGroup.length > 1) {
                    const b = new flow.Beam(currentGroup, false);
                    if (splitIndices.length > 0) b.breakSecondaryAt(splitIndices);
                    b.setBeamDirection?.(flow.Stem.UP);
                    beams.push(b);
                }
                currentGroup = [];
                splitIndices = [];
            }
            
            // Advance the counter
            const slots = getSlots(rawNote);
            accumulatedSlots += slots;

            // 9-LET LOGIC (3+3+3)
            if (is9Let && !isFull9) {
                 if (accumulatedSlots === 3 || accumulatedSlots === 6) {
                     let skipSplit = false;
                     // Check bounds and context for "111" patterns
                     if (index - 2 >= 0 && index + 3 < recipe.notes.length) {
                         const is16 = (k) => {
                             const n = recipe.notes[k];
                             return n.dur === "16" && n.kind !== "rest" && !n.rest;
                         };
                         const prev3 = is16(index) && is16(index-1) && is16(index-2);
                         const next3 = is16(index+1) && is16(index+2) && is16(index+3);
                         if (prev3 && next3) skipSplit = true;
                     }

                     if (!skipSplit && currentGroup.length > 0) {
                        splitIndices.push(currentGroup.length - 1);
                     }
                 }
            }
        });
        
        // Final flush
        if (currentGroup.length > 1) {
            const b = new flow.Beam(currentGroup, false);
            if (is9Let && !isFull9 && splitIndices.length > 0) {
                 b.breakSecondaryAt(splitIndices);
            }
            b.setBeamDirection?.(flow.Stem.UP);
            beams.push(b);
        }
    }

    const tupletsToDraw = [];
    
    // === GLOBAL TUPLET (e.g. the "6" or "9") ===
    // FIX: Check if render is explicitly disabled (render: false)
    if (recipe.tuplet && recipe.tuplet.render !== false) {
      const allBeamable = recipe.notes.every(n => n.kind !== 'rest' && ["8", "16", "32"].includes(n.dur));
      
      // FIX: Respect explicit bracketed setting from the recipe
      let shouldBracket = !allBeamable;
      if (typeof recipe.tuplet.bracketed === 'boolean') {
          shouldBracket = recipe.tuplet.bracketed;
      }

      tupletsToDraw.push(new flow.Tuplet(notes, {
        num_notes: recipe.tuplet.num_notes,
        notes_occupied: recipe.tuplet.notes_occupied,
        bracketed: shouldBracket,
        ratioed: false,
      }));
    }

    // === LOCAL TUPLETS (e.g. the "3" inside the 6) ===
    let localBuffer = []; 
    recipe.notes.forEach((rawNote, i) => {
        if (rawNote._localTuplet) {
            localBuffer.push({ vf: notes[i], raw: rawNote });
        } else {
            if (localBuffer.length > 0) {
                // Determine if we need a bracket line or just the number
                // Standard rule: Beamed notes = Number only (bracketed: false)
                // Mixed/Rest notes = Bracket line (bracketed: true)
                const allBeamable = localBuffer.every(x => x.raw.kind !== 'rest' && ["8", "16", "32"].includes(x.raw.dur));
                
                tupletsToDraw.push(new flow.Tuplet(localBuffer.map(x=>x.vf), { 
                    num_notes: 3, notes_occupied: 2, bracketed: !allBeamable, ratioed: false 
                }));
                localBuffer = [];
            }
        }
    });
    // Flush buffer at end
    if (localBuffer.length > 0) {
        const allBeamable = localBuffer.every(x => x.raw.kind !== 'rest' && ["8", "16", "32"].includes(x.raw.dur));
        tupletsToDraw.push(new flow.Tuplet(localBuffer.map(x=>x.vf), { 
            num_notes: 3, notes_occupied: 2, bracketed: !allBeamable, ratioed: false 
        }));
    }

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



// NEW: 9-let Icon (Spans 2 Beats)
    renderRhythmIcon("nineletIcon", {
      num_beats: 2, beat_value: 4,
      beam: true,
      // 9 notes in the space of 8 sixteenths (2 beats)
      tuplet: { num_notes: 9, notes_occupied: 8, bracketed: false }, 
      notes: Array(9).fill({ dur: "16" }) 
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

  // HELPER: Forces "Preserve" mode so the engine does not auto-correct your designs
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

  // (Deleted 150 lines of dead code: pickCompoundBeatPattern & simplifyCompoundChunk)

// This replaces the "Math Generator" with a "Curated Database"
// You can edit, delete, or add lines here to control EXACTLY what appears in the picker.















const RHYTHM_VARIANTS = {
    // === 1. Simple Beats ===
"q": [ 
        // 1. Simple Time (1.0 beat)
        { id: "q_1", label: "Quarter Note", notes: [make("q", 1.0)], w: 10 },

        // 2. COMPOUND QUARTER VARIATIONS (3.0 Beats -> 2 Pulses)
        // Note: Dotted Quarter (1.5) has been REMOVED.
        
        // 111 (Full): q q q
        { id: "q_cmp_111", label: "Full (3)", notes: [make("q", 1.0), make("q", 1.0), make("q", 1.0)], w: 10, _isCompoundVariant: true },
        
        // 110 (Long-Short): q q r
        { id: "q_cmp_110", label: "Long-Short", notes: [make("q", 1.0), make("q", 1.0), R("q", 1.0)], w: 6, _isCompoundVariant: true },
        
        // 101 (Swing): q r q
        { id: "q_cmp_101", label: "Swing (1...3)", notes: [make("q", 1.0), R("q", 1.0), make("q", 1.0)], w: 6, _isCompoundVariant: true },
        
        // 100 (Start): q r r (Rest is Half Note 2.0)
        { id: "q_cmp_100", label: "Start Only", notes: [make("q", 1.0), R("h", 2.0)], w: 5, _isCompoundVariant: true },

        // 011 (Pickup): r q q
        { id: "q_cmp_011", label: "Pickup (2-3)", notes: [R("q", 1.0), make("q", 1.0), make("q", 1.0)], w: 6, _isCompoundVariant: true },
        
        // 010 (Middle): r q r
        { id: "q_cmp_010", label: "Middle Only", notes: [R("q", 1.0), make("q", 1.0), R("q", 1.0)], w: 4, _isCompoundVariant: true },
        
        // 001 (End): r r q
        { id: "q_cmp_001", label: "End Only", notes: [R("h", 2.0), make("q", 1.0)], w: 4, _isCompoundVariant: true }
    ],

    "dottedQ": [ 
        // ============================
        // === 1. PULSE (1.5 Beats) ===
        // ============================
        // NEW: Allows this tile to work in 5/8, 6/8, etc.
        { id: "dq_1", label: "Dotted Quarter (Pulse)", notes: [make("q", 1.5, 1)], w: 10 },

        // ============================
        // === 3-BEAT BUCKETS (4/4) ===
        // ============================
        // Always allowed if Dotted Quarters are ON
        { id: "dq3_std", label: "3-Beat Chain (q. q.)", notes: [make("q", 1.5, 1), make("q", 1.5, 1)], w: 10 },
        { id: "dq3_rest", label: "3-Beat Chain (Rest)", notes: [R("q", 1.5, 1), make("q", 1.5, 1)], w: 8 },

        // ============================
        // === 2-BEAT BUCKETS (4/4) ===
        // ============================
        
        // --- A. STANDARD (1.5 + 0.5) ---
        // Always allowed
        { id: "dq_std_rest", label: "Standard (Rest)", notes: [make("q", 1.5, 1), R("8", 0.5)], w: 10 },
        
        // Depends on 8ths OR 16ths
        { id: "dq_std_8", label: "Standard (8th)", notes: [make("q", 1.5, 1), make("8", 0.5)], w: 10 },
        
        // Depends on 16ths
        { id: "dq_std_16s", label: "Standard (16ths)", notes: [make("q", 1.5, 1), make("16", 0.25), make("16", 0.25)], w: 8 },
        
        // Depends on Sextuplets
        { 
            id: "dq_std_6let", 
            label: "Standard (Trip)", 
            notes: [
                make("q", 1.5, 1), 
                {...make("16", 1/6), _localTuplet: true}, 
                {...make("16", 1/6), _localTuplet: true}, 
                {...make("16", 1/6), _localTuplet: true}
            ], 
            w: 5 
        },

        // --- B. REVERSE / ANTICIPATED (0.5 + 1.5) ---
        // Always allowed
        { id: "dq_rev_rest", label: "Reverse (Rest)", notes: [R("8", 0.5), make("q", 1.5, 1)], w: 10 },
        
        // Depends on 8ths OR 16ths
        { id: "dq_rev_8", label: "Reverse (8th)", notes: [make("8", 0.5), make("q", 1.5, 1)], w: 10 },
        
        // Depends on 16ths
        { id: "dq_rev_16s", label: "Reverse (16ths)", notes: [make("16", 0.25), make("16", 0.25), make("q", 1.5, 1)], w: 8 },
        
        // Depends on Sextuplets
        { 
            id: "dq_rev_6let", 
            label: "Reverse (Trip)", 
            notes: [
                {...make("16", 1/6), _localTuplet: true}, 
                {...make("16", 1/6), _localTuplet: true}, 
                {...make("16", 1/6), _localTuplet: true},
                make("q", 1.5, 1)
            ], 
            w: 5 
        }
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
        
        { id: "16s_0101", label: "Off-beats (e a)", notes: [R("16", 0.25), make("8", 0.5), make("16", 0.25)], w: 4 },
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
        { id: "6let_111111", label: "Full 6", notes: Array(6).fill(make("16", 1/6)), w: 10 },

        // ============================
        // === 5 NOTES ===
        // ============================
        { id: "6let_111110", label: "1-2-3-4-5(8t)", notes: [make("16", 1/6), make("16", 1/6), make("16", 1/6), make("16", 1/6), make("8", 1/3)], w: 5 },
        { id: "6let_111101", label: "1-2-3-4(8t)-6", notes: [make("16", 1/6), make("16", 1/6), make("16", 1/6), make("8", 1/3), make("16", 1/6)], w: 5 },
        { id: "6let_111011", label: "1-2-3(8t)-5-6", notes: [make("16", 1/6), make("16", 1/6), make("8", 1/3), make("16", 1/6), make("16", 1/6)], w: 5 },
        { id: "6let_110111", label: "1-2(8t)-4-5-6", notes: [make("16", 1/6), make("8", 1/3), make("16", 1/6), make("16", 1/6), make("16", 1/6)], w: 5 },
        { id: "6let_101111", label: "1(8t)-3-4-5-6", notes: [make("8", 1/3), make("16", 1/6), make("16", 1/6), make("16", 1/6), make("16", 1/6)], w: 5 },
        { id: "6let_011111", label: "R-2-3-4-5-6", notes: [R("16", 1/6), make("16", 1/6), make("16", 1/6), make("16", 1/6), make("16", 1/6), make("16", 1/6)], w: 5 },

        // ============================
        // === 4 NOTES (HYBRIDS: NO "6", YES "3") ===
        // ============================
        // 111100 -> 16th Triplet + 8th Note
        { 
            id: "6let_111100", 
            label: "1-2-3(Trip)-4", 
            notes: [
                {...make("16", 1/6), _localTuplet: true, _isHybrid: true}, 
                {...make("16", 1/6), _localTuplet: true, _isHybrid: true}, 
                {...make("16", 1/6), _localTuplet: true, _isHybrid: true}, 
                {...make("8", 0.5), _isHybrid: true} 
            ], 
            // render: false tells the renderer to SKIP the global "6" bracket entirely
            _tuplet: {num_notes:6, notes_occupied:4, render: false}, 
            w: 6 
        },

        { id: "6let_111010", label: "1-2-3-5(8t)", notes: [make("16", 1/6), make("16", 1/6), make("8", 1/3), make("8", 1/3)], w: 5 },
        { id: "6let_111001", label: "1-2-3-6", notes: [make("16", 1/6), make("16", 1/6), make("8", 0.5, 1), make("16", 1/6)], w: 5 },
        { id: "6let_110110", label: "1-2(8t)-4-5(8t)", notes: [make("16", 1/6), make("8", 1/3), make("16", 1/6), make("8", 1/3)], w: 5 },
        { id: "6let_110101", label: "1-2(8t)-4(8t)-6", notes: [make("16", 1/6), make("8", 1/3), make("8", 1/3), make("16", 1/6)], w: 5 },
        { id: "6let_110011", label: "1-2(d8)-5-6", notes: [make("16", 1/6), make("8", 0.5, 1), make("16", 1/6), make("16", 1/6)], w: 5 },
        { id: "6let_101110", label: "1(8t)-3-4-5(8t)", notes: [make("8", 1/3), make("16", 1/6), make("16", 1/6), make("8", 1/3)], w: 5 },
        { id: "6let_101101", label: "1(8t)-3-4(8t)-6", notes: [make("8", 1/3), make("16", 1/6), make("8", 1/3), make("16", 1/6)], w: 5 },
        { id: "6let_101011", label: "1(8t)-3(8t)-5-6", notes: [make("8", 1/3), make("8", 1/3), make("16", 1/6), make("16", 1/6)], w: 5 },

        // 100111 -> 8th Note + 16th Triplet
        { 
            id: "6let_100111", 
            label: "1(8)-4-5-6(Trip)", 
            notes: [
                {...make("8", 0.5), _isHybrid: true}, 
                {...make("16", 1/6), _localTuplet: true, _isHybrid: true}, 
                {...make("16", 1/6), _localTuplet: true, _isHybrid: true}, 
                {...make("16", 1/6), _localTuplet: true, _isHybrid: true}
            ], 
            _tuplet: {num_notes:6, notes_occupied:4, render: false}, 
            w: 6 
        },

        { id: "6let_011110", label: "R-2-3-4-5(8t)", notes: [R("16", 1/6), make("16", 1/6), make("16", 1/6), make("16", 1/6), make("8", 1/3)], w: 5 },
        { id: "6let_011101", label: "R-2-3-4(8t)-6", notes: [R("16", 1/6), make("16", 1/6), make("16", 1/6), make("8", 1/3), make("16", 1/6)], w: 5 },
        { id: "6let_011011", label: "R-2-3(8t)-5-6", notes: [R("16", 1/6), make("16", 1/6), make("8", 1/3), make("16", 1/6), make("16", 1/6)], w: 5 },
        { id: "6let_010111", label: "R-2(8t)-4-5-6", notes: [R("16", 1/6), make("8", 1/3), make("16", 1/6), make("16", 1/6), make("16", 1/6)], w: 5 },
        { id: "6let_001111", label: "R(8t)-3-4-5-6", notes: [R("8", 1/3), make("16", 1/6), make("16", 1/6), make("16", 1/6), make("16", 1/6)], w: 5 },

        // ============================
        // === 3 NOTES (HYBRIDS: NO "6", YES "3") ===
        // ============================
        // 111000 -> 16th Triplet + 8th Rest
        { 
            id: "6let_111000", 
            label: "1-2-3(Trip)-R", 
            notes: [
                {...make("16", 1/6), _localTuplet: true, _isHybrid: true}, 
                {...make("16", 1/6), _localTuplet: true, _isHybrid: true}, 
                {...make("16", 1/6), _localTuplet: true, _isHybrid: true}, 
                {...R("8", 0.5), _isHybrid: true}
            ], 
            _tuplet: {num_notes:6, notes_occupied:4, render: false},
            w: 6 
        },

        { id: "6let_110100", label: "1-2(8t)-4(d8)", notes: [make("16", 1/6), make("8", 1/3), make("8", 0.5, 1)], w: 5 },
        { id: "6let_110010", label: "1-2(d8)-5(8t)", notes: [make("16", 1/6), make("8", 0.5, 1), make("8", 1/3)], w: 5 },
        { id: "6let_110001", label: "1-2(q)-6", notes: [make("16", 1/6), make("q", 2/3), make("16", 1/6)], w: 5 },
        { id: "6let_101100", label: "1(8t)-3-4(d8)", notes: [make("8", 1/3), make("16", 1/6), make("8", 0.5, 1)], w: 5 },
        { id: "6let_101010", label: "Triplets", notes: [make("8", 1/3), make("8", 1/3), make("8", 1/3)], _tuplet: {num_notes:3, notes_occupied:2}, w: 6 },
        { id: "6let_101001", label: "1(8t)-3(d8)-6", notes: [make("8", 1/3), make("8", 0.5, 1), make("16", 1/6)], w: 5 },
        { id: "6let_100110", label: "1(d8)-4-5(8t)", notes: [make("8", 0.5, 1), make("16", 1/6), make("8", 1/3)], w: 5 },
        { id: "6let_100101", label: "1(d8)-4(8t)-6", notes: [make("8", 0.5, 1), make("8", 1/3), make("16", 1/6)], w: 5 },
        { id: "6let_100011", label: "1(q)-5-6", notes: [make("q", 2/3), make("16", 1/6), make("16", 1/6)], w: 5 },

        { id: "6let_011010", label: "R-2-3(8t)-5(8t)", notes: [R("16", 1/6), make("16", 1/6), make("8", 1/3), make("8", 1/3)], w: 5 },
        { id: "6let_011001", label: "R-2-3(d8)-6", notes: [R("16", 1/6), make("16", 1/6), make("8", 0.5, 1), make("16", 1/6)], w: 5 },
        { id: "6let_010110", label: "R-2(8t)-4-5(8t)", notes: [R("16", 1/6), make("8", 1/3), make("16", 1/6), make("8", 1/3)], w: 5 },
        { id: "6let_010101", label: "R-2(8t)-4(8t)-6", notes: [R("16", 1/6), make("8", 1/3), make("8", 1/3), make("16", 1/6)], w: 5 },
        { id: "6let_010011", label: "R-2(d8)-5-6", notes: [R("16", 1/6), make("8", 0.5, 1), make("16", 1/6), make("16", 1/6)], w: 5 },
        { id: "6let_001110", label: "R(2)-3-4-5(8t)", notes: [R("8", 1/3), make("16", 1/6), make("16", 1/6), make("8", 1/3)], w: 5 },
        { id: "6let_001101", label: "R(2)-3-4(8t)-6", notes: [R("8", 1/3), make("16", 1/6), make("8", 1/3), make("16", 1/6)], w: 5 },
        { id: "6let_001011", label: "R(2)-3(8t)-5-6", notes: [R("8", 1/3), make("8", 1/3), make("16", 1/6), make("16", 1/6)], w: 5 },

        // 000111 (7) -> SPECIAL: 8th Rest + 16th Triplet
        { 
            id: "6let_000111", 
            label: "R(8)-4-5-6(Trip)", 
            notes: [
                {...R("8", 0.5), _isHybrid: true}, 
                {...make("16", 1/6), _localTuplet: true, _isHybrid: true}, 
                {...make("16", 1/6), _localTuplet: true, _isHybrid: true}, 
                {...make("16", 1/6), _localTuplet: true, _isHybrid: true}
            ], 
            _tuplet: {num_notes:6, notes_occupied:4, render: false},
            w: 6 
        },

        // ============================
        // === 2 NOTES (HYBRIDS: NO "6") ===
        // ============================
        { id: "6let_110000", label: "1-2-R(q)", notes: [make("16", 1/6), make("16", 1/6), R("q", 2/3)], w: 5 },
        { id: "6let_101000", label: "Trip-Let-R", notes: [make("8", 1/3), make("8", 1/3), R("8", 1/3)], _tuplet: {num_notes:3, notes_occupied:2}, w: 5 },
        
        // 100100 -> 8th + 8th (on 1 and 4)
        { 
            id: "6let_100100", 
            label: "1(8)-4(8)", 
            notes: [make("8", 0.5), make("8", 0.5)], 
            _tuplet: {num_notes:6, notes_occupied:4, render: false}, 
            w: 6 
        },
        
        { id: "6let_100010", label: "Trip-R-Trip", notes: [make("q", 2/3), make("8", 1/3)], _tuplet: {num_notes:3, notes_occupied:2}, w: 5 },
        { id: "6let_100001", label: "1(q)-6", notes: [make("q", 2/3), R("16", 1/6), make("16", 1/6)], w: 5 },

        { id: "6let_011000", label: "R-2-3(q)", notes: [R("16", 1/6), make("16", 1/6), make("q", 2/3)], w: 5 },
        { id: "6let_010100", label: "R-2(8t)-4(d8)", notes: [R("16", 1/6), make("8", 1/3), make("8", 0.5, 1)], w: 5 },
        { id: "6let_010010", label: "R-2(d8)-5(8t)", notes: [R("16", 1/6), make("8", 0.5, 1), make("8", 1/3)], w: 5 },
        { id: "6let_010001", label: "R-2(q)-6", notes: [R("16", 1/6), make("q", 2/3), make("16", 1/6)], w: 5 },

        { id: "6let_001100", label: "R(8t)-3-4(d8)", notes: [R("8", 1/3), make("16", 1/6), make("8", 0.5, 1)], w: 5 },
        { id: "6let_001010", label: "R-Let-Trip", notes: [R("8", 1/3), make("8", 1/3), make("8", 1/3)], _tuplet: {num_notes:3, notes_occupied:2}, w: 5 },
        { id: "6let_001001", label: "R(8t)-3(d8)-6", notes: [R("8", 1/3), make("8", 0.5, 1), make("16", 1/6)], w: 5 },

        { id: "6let_000110", label: "R(d8)-4-5(8t)", notes: [R("8", 0.5, 1), make("16", 1/6), make("8", 1/3)], w: 5 },
        { id: "6let_000101", label: "R(d8)-4(8t)-6", notes: [R("8", 0.5, 1), make("8", 1/3), make("16", 1/6)], w: 5 },
        { id: "6let_000011", label: "R(q)-5-6", notes: [R("q", 2/3), make("16", 1/6), make("16", 1/6)], w: 5 },

        // ============================
        // === 1 NOTE ===
        // ============================
        { id: "6let_100000", label: "Quarter", notes: [make("q", 1.0)], w: 5, _tuplet: false },
        { id: "6let_010000", label: "2 Only", notes: [R("16", 1/6), make("16", 1/6), R("q", 2/3)], w: 5 },
        { id: "6let_001000", label: "R-Let-R", notes: [R("8", 1/3), make("q", 2/3)], _tuplet: {num_notes:3, notes_occupied:2}, w: 5 },
        
        // 000100 -> SPECIAL: 8th Rest + 8th Note (Reg)
        { 
            id: "6let_000100", 
            label: "R(8)-4(8)", 
            notes: [R("8", 0.5), make("8", 0.5)], 
            _tuplet: {num_notes:6, notes_occupied:4, render: false}, 
            w: 5 
        },
        
        { id: "6let_000010", label: "R-R-Trip", notes: [R("q", 2/3), make("8", 1/3)], _tuplet: {num_notes:3, notes_occupied:2}, w: 5 },
        { id: "6let_000001", label: "6 Only", notes: [R("q", 2/3), R("16", 1/6), make("16", 1/6)], w: 5 }
    ],

// === 7. 9-lets (9 notes over 2 beats) ===
    "9let": [
        // ============================
        // === 9 NOTES (Full) ===
        // ============================
        { 
            id: "9let_111111111", 
            label: "Full 9", 
            notes: Array(9).fill(make("16", 2/9)), 
            w: 10,
            _tuplet: { num_notes: 9, notes_occupied: 8 }
        },

        // ============================
        // === 8 NOTES (One 8th) ===
        // ============================
        // 111111101 (Last note syncopation)
        { 
            id: "9let_111111101", 
            label: "1-2-3-4-5-6-7(8)", 
            notes: [
                make("16", 2/9), make("16", 2/9), make("16", 2/9), 
                make("16", 2/9), make("16", 2/9), make("16", 2/9), 
                make("8", 4/9), make("16", 2/9)
            ], 
            w: 5, _tuplet: { num_notes: 9, notes_occupied: 8 } 
        },
        // 111101111 (Middle syncopation)
        { 
            id: "9let_111101111", 
            label: "1-2-3-4(8)-6-7", 
            notes: [
                make("16", 2/9), make("16", 2/9), make("16", 2/9), 
                make("8", 4/9), 
                make("16", 2/9), make("16", 2/9), make("16", 2/9), make("16", 2/9)
            ], 
            w: 5, _tuplet: { num_notes: 9, notes_occupied: 8 } 
        },
        // 101111111 (First note syncopation)
        { 
            id: "9let_101111111", 
            label: "1(8)-3-4-5-6-7", 
            notes: [
                make("8", 4/9), 
                make("16", 2/9), make("16", 2/9), make("16", 2/9), 
                make("16", 2/9), make("16", 2/9), make("16", 2/9), make("16", 2/9)
            ], 
            w: 5, _tuplet: { num_notes: 9, notes_occupied: 8 } 
        },

        // ============================
        // === 7 NOTES (One Dotted 8th) ===
        // ============================
        // 111111100 (End Sustain)
        { 
            id: "9let_111111100", 
            label: "1-2-3-4-5-6-7(d8)", 
            notes: [
                make("16", 2/9), make("16", 2/9), make("16", 2/9), 
                make("16", 2/9), make("16", 2/9), make("16", 2/9), 
                make("8", 6/9, 1) // Dotted 8th
            ], 
            w: 5, _tuplet: { num_notes: 9, notes_occupied: 8 } 
        },
        // 111100111 (Middle Sustain)
        { 
            id: "9let_111100111", 
            label: "1-2-3-4(d8)-7", 
            notes: [
                make("16", 2/9), make("16", 2/9), make("16", 2/9), 
                make("8", 6/9, 1), 
                make("16", 2/9), make("16", 2/9), make("16", 2/9)
            ], 
            w: 5, _tuplet: { num_notes: 9, notes_occupied: 8 } 
        },
        // 100111111 (Start Sustain)
        { 
            id: "9let_100111111", 
            label: "1(d8)-4-5-6-7", 
            notes: [
                make("8", 6/9, 1), 
                make("16", 2/9), make("16", 2/9), make("16", 2/9), 
                make("16", 2/9), make("16", 2/9), make("16", 2/9)
            ], 
            w: 5, _tuplet: { num_notes: 9, notes_occupied: 8 } 
        },

        // ============================
        // === 6 NOTES (Two 8ths) ===
        // ============================
        // 101101101 (The "Swing" 9-let: Long-Short-Long-Short-Long-Short)
        { 
            id: "9let_101101101", 
            label: "1(8)-3-4(8)-6-7(8)-9", 
            notes: [
                make("8", 4/9), make("16", 2/9), 
                make("8", 4/9), make("16", 2/9), 
                make("8", 4/9), make("16", 2/9)
            ], 
            w: 5, _tuplet: { num_notes: 9, notes_occupied: 8 } 
        },
        // 111101101
        { 
            id: "9let_111101101", 
            label: "1-2-3-4(8)-6(8)-8", 
            notes: [
                make("16", 2/9), make("16", 2/9), make("16", 2/9), 
                make("8", 4/9), make("16", 2/9), make("8", 4/9), make("16", 2/9)
            ], 
            w: 5, _tuplet: { num_notes: 9, notes_occupied: 8 } 
        },
        // 101111101
        { 
            id: "9let_101111101", 
            label: "1(8)-3-4-5-6-7(8)-9", 
            notes: [
                make("8", 4/9), 
                make("16", 2/9), make("16", 2/9), make("16", 2/9), make("16", 2/9), 
                make("8", 4/9), make("16", 2/9)
            ], 
            w: 5, _tuplet: { num_notes: 9, notes_occupied: 8 } 
        },
        // 101101111
        { 
            id: "9let_101101111", 
            label: "1(8)-3-4(8)-6-7", 
            notes: [
                make("8", 4/9), make("16", 2/9), 
                make("8", 4/9), 
                make("16", 2/9), make("16", 2/9), make("16", 2/9), make("16", 2/9)
            ], 
            w: 5, _tuplet: { num_notes: 9, notes_occupied: 8 } 
        },

        // ============================
        // === 5 NOTES (Two Dotted 8ths) ===
        // ============================
        // 111100100
        { 
            id: "9let_111100100", 
            label: "1-2-3-4(d8)-7(d8)", 
            notes: [
                make("16", 2/9), make("16", 2/9), make("16", 2/9), 
                make("8", 6/9, 1), make("8", 6/9, 1)
            ], 
            w: 5, _tuplet: { num_notes: 9, notes_occupied: 8 } 
        },
        // 100111100
        { 
            id: "9let_100111100", 
            label: "1(d8)-4-5-6-7(d8)", 
            notes: [
                make("8", 6/9, 1), 
                make("16", 2/9), make("16", 2/9), make("16", 2/9), 
                make("8", 6/9, 1)
            ], 
            w: 5, _tuplet: { num_notes: 9, notes_occupied: 8 } 
        },
        // 100100111
        { 
            id: "9let_100100111", 
            label: "1(d8)-4(d8)-7-8-9", 
            notes: [
                make("8", 6/9, 1), make("8", 6/9, 1), 
                make("16", 2/9), make("16", 2/9), make("16", 2/9)
            ], 
            w: 5, _tuplet: { num_notes: 9, notes_occupied: 8 } 
        }
    ]
};












// 1. Define Expansion Function (Ensures tiles exist)
(function expandCompoundVariations() {
    if (!RHYTHM_VARIANTS["6let"] || !RHYTHM_VARIANTS["16s"]) return;

    const compoundVars = JSON.parse(JSON.stringify(RHYTHM_VARIANTS["6let"]));
    compoundVars.forEach(v => {
        v._isCompoundVariant = true; 
        v._tuplet = null; 
        v._preserve = true; 
        v._compoundGrid = true; 
        v.id = "cmp_" + v.id;

        // --- TRANSFORMATION LOGIC ---
        if (v.id.includes("6let_111100")) {
            v.notes = [make("16", 0.25), make("16", 0.25), make("16", 0.25), make("8", 0.75, 1)];
            v.notes.forEach(n => n._isHybrid = true);
        }
        else if (v.id.includes("6let_111000")) {
            v.notes = [make("16", 0.25), make("16", 0.25), make("16", 0.25), R("8", 0.75, 1)];
            v.notes.slice(0,3).forEach(n => n._isHybrid = true);
        }
        else if (v.id.includes("6let_100111")) {
            v.notes = [make("8", 0.75, 1), make("16", 0.25), make("16", 0.25), make("16", 0.25)];
            v.notes.forEach(n => n._isHybrid = true);
        }
        else if (v.id.includes("6let_000111")) { 
            v.notes = [R("8", 0.75, 1), make("16", 0.25), make("16", 0.25), make("16", 0.25)]; 
        }
        else if (v.id.includes("6let_100100")) { v.notes = [make("8", 0.75, 1), make("8", 0.75, 1)]; }
        else if (v.id.includes("6let_000100")) { v.notes = [R("8", 0.75, 1), make("8", 0.75, 1)]; }
        else {
            v.notes = v.notes.map(n => {
                let newDur = "16"; 
                let newBeats = 0.25;
                const dots = n.dots || 0;
                if (n.dur === "8") { newDur = "8"; newBeats = (dots > 0) ? 0.75 : 0.5; }
                else if (n.dur === "q") { newDur = "q"; newBeats = (dots > 0) ? 1.5 : 1.0; }
                return { ...n, beats: newBeats, dur: newDur, _localTuplet: undefined, _tuplet: undefined };
            });
        }

        // FIX 1: Only activate "Full Grouping" (111111) by default
        if (typeof activeVariations !== 'undefined') {
            if (v.id.includes("111111")) {
                activeVariations.add(v.id);
            }
        }
    });

    RHYTHM_VARIANTS["16s"].push(...compoundVars);
})();

// === NEW: INJECT CATEGORY TYPES FOR BALANCED SELECTION ===
// This ensures we can balance "Quarters" vs "16ths" evenly, 
// instead of 16ths drowning out Quarters by sheer number of variations.
Object.keys(RHYTHM_VARIANTS).forEach(key => {
    RHYTHM_VARIANTS[key].forEach(v => v._type = key);
});

// ======================================================
// 1. GENERATION & LOGIC ENGINE
// ...










// ======================================================
// 1. GENERATION & LOGIC ENGINE (STRICT MODE & SYNCOPATION FIXES)
// ======================================================

/**
 * HELPER: Filters the global RHYTHM_VARIANTS database
 */
function getStrictCandidates(targetBeats, isCompoundContext, restPct) {
    const candidates = [];
    const eps = 0.01;

    // Iterate over every category
    for (const [categoryKey, variants] of Object.entries(RHYTHM_VARIANTS)) {
        
        // GLOBAL CHECKBOX GATES
        if (categoryKey === "q") {
            if (!allowQuartersEl.checked) continue;
        }

        if (categoryKey === "dottedQ") {
            if (!allowDottedQuartersEl.checked) continue;
        }

        if (categoryKey === "8s" && !allow8thsEl.checked) continue;
        if (categoryKey === "16s" && !allow16thsEl.checked) continue;
        if (categoryKey === "8t" && !allowTripletsEl.checked) continue;
        if (categoryKey === "qt" && !allowQuarterTripletsEl.checked) continue;
        if (categoryKey === "5let" && !allowQuintupletsEl.checked) continue;
        if (categoryKey === "5let16" && !allow16thQuintupletsEl.checked) continue;
        if (categoryKey === "6let" && !allowSextupletsEl.checked) continue;
        if (categoryKey === "9let" && !allow9letsEl.checked) continue;

        for (const v of variants) {
            // 1. DURATION MATCH (Critical for Asymmetric Meters)
            const tileDur = v.notes.reduce((acc, n) => acc + (n.beats || 0), 0);
            if (Math.abs(tileDur - targetBeats) > eps) continue;

            // 2. ACTIVATION CHECK
            // dottedQ is special: it's a category toggle, not individual tiles
            if (categoryKey !== "dottedQ") {
                if (!activeVariations.has(v.id)) continue;
            }

            // 3. SMART DEPENDENCY LOGIC
            if (categoryKey === "dottedQ") {
                if (v.id.includes("6let") && !allowSextupletsEl.checked) continue;
                if (v.id.includes("16s") && !allow16thsEl.checked) continue;
                if (v.id.includes("8") && !allow8thsEl.checked && !allow16thsEl.checked) continue;
            }

            // 4. CONTEXT MATCH (Strict Separation)
            const isCompoundTile = !!v._isCompoundVariant;

            if (isCompoundContext) {
                // === COMPOUND TIME ===
                // Allow Compound tiles OR strict "Pulse" tiles (q_c_1)
                if (!isCompoundTile && categoryKey !== "dottedQ" && v.id !== "q_c_1") continue;
            } else {
                // === SIMPLE TIME ===
                // BAN anything marked as Compound
                if (isCompoundTile) continue;
            }

            // 5. REST FILTER EXCEPTION
            // The User Request: "The only exception should be dotted quarter variations with rests."
            // Logic:
            // - If category is 'dottedQ' AND Rest Slider is 0% -> BAN variations with rests.
            // - Otherwise -> ALLOW everything (let the Weights decide).
            const hasRest = v.notes.some(n => n.kind === 'rest' || !!n.rest);

            if (categoryKey === "dottedQ") {
                if (restPct === 0 && hasRest) continue;
            }

            // 6. ADD TO POOL
            candidates.push(v);
        }
    }

    return candidates;
}







function pickRandomStrict(list) {
    if (!list || list.length === 0) return null;

    // === BALANCED SELECTION LOGIC ===
    // 1. Group candidates by their Source Category (e.g., "q", "8s", "dottedQ")
    const groups = {};
    list.forEach(item => {
        // Use injected _type, or fallback to ID prefix if missing (safety)
        const type = item._type || item.id.split('_')[0]; 
        if (!groups[type]) groups[type] = [];
        groups[type].push(item);
    });

    // 2. WEIGHTED LOTTERY SYSTEM (ALL CATEGORIES EXPLICIT)
    // "Tickets" in the lottery. Higher number = generates more often.
    const WEIGHTS = {
        // === CORE RHYTHMS (Your High Priority) ===
        "16s": 8,      // 16th Notes
        "8t": 8,       // Triplets
        "8s": 3,       // 8th Notes
        
        // === BASIC PULSE ===
        "q": 3,         // Quarter Notes
        "dottedQ": 1,   // Dotted Quarter Phrases (e.g. q. + 8th)

        // === ADVANCED TUPLETS (The "Spice") ===
        "qt": 3,        // Quarter Triplets (3 over 2)
        "5let": 3,      // 5-lets (8th note base)
        "5let16": 3,    // 5-lets (16th note base)
        "6let": 3,      // Sextuplets
        "9let": 3,      // 9-lets

        // === FALLBACK ===
        "default": 2
    };

    const lotteryPool = [];
    const types = Object.keys(groups);

    types.forEach(type => {
        // Use specific weight, or fallback to default
        const weight = WEIGHTS[type] || WEIGHTS["default"];
        
        // Add this category to the pool 'weight' times
        for (let i = 0; i < weight; i++) {
            lotteryPool.push(type);
        }
    });

    // 3. Pick a Random Category from the Weighted Pool
    const chosenType = lotteryPool[Math.floor(Math.random() * lotteryPool.length)];

    // 4. Pick a Random Variant from that Category
    const subList = groups[chosenType];
    const choice = subList[Math.floor(Math.random() * subList.length)];
    
    // === DEEP COPY & METADATA INJECTION ===
    const copy = JSON.parse(JSON.stringify(choice.notes));
    
    if (choice._tuplet !== undefined) {
        copy._tuplet = choice._tuplet;
    } else {
        if (choice.id.startsWith("8t"))    copy._tuplet = { num_notes: 3, notes_occupied: 2 };
        if (choice.id.startsWith("5let"))  copy._tuplet = { num_notes: 5, notes_occupied: 4 };
        if (choice.id.startsWith("6let"))  copy._tuplet = { num_notes: 6, notes_occupied: 4 };
        if (choice.id.startsWith("qt"))    copy._tuplet = { num_notes: 3, notes_occupied: 2 };
        if (choice.id.startsWith("9let"))  copy._tuplet = { num_notes: 9, notes_occupied: 8 };
    }

    if (choice._compoundGrid) copy._compoundGrid = true;
    if (choice.id.includes("6let")) copy._forceSixLetSticking = true;
    
    return copy;
}

// === SYNCOPATION HELPERS ===

function getSyncopationFiller() {
    const candidates = [];
    
    // 1. 8th Note (Standard)
    if (allow8thsEl.checked) {
        candidates.push([make("8", 0.5)]);
    }
    
    // REMOVED: Two 16ths (Straight 16ths create clutter in syncopation)

    // 2. 16th Triplet (Swing feel)
    if (allowSextupletsEl.checked) {
        const trip = [
            {...make("16", 1/6), _localTuplet: true},
            {...make("16", 1/6), _localTuplet: true},
            {...make("16", 1/6), _localTuplet: true}
        ];
        candidates.push(trip);
    }

    if (candidates.length === 0) return null;
    return candidates[Math.floor(Math.random() * candidates.length)];
}

function getSyncopatedCore() {
    const cores = [];
    
    const isFull = (v, expectedCount) => {
        if (v.notes.some(n => n.kind === 'rest')) return false;
        return v.notes.length === expectedCount;
    };

    // 1. Full 16th Quintuplet (1 Beat) - HIGH PRIORITY
    if (allow16thQuintupletsEl.checked) {
        const t = RHYTHM_VARIANTS["5let16"].find(v => isFull(v, 5));
        if (t && activeVariations.has(t.id)) cores.push(t);
    }
    
    // 2. Full Sextuplet (1 Beat) - HIGH PRIORITY
    if (allowSextupletsEl.checked) {
        const t = RHYTHM_VARIANTS["6let"].find(v => isFull(v, 6));
        if (t && activeVariations.has(t.id)) cores.push(t);
    }
    
    // 3. Full Triplet (Standard)
    if (allowTripletsEl.checked) {
        const t = RHYTHM_VARIANTS["8t"].find(v => isFull(v, 3));
        if (t && activeVariations.has(t.id)) cores.push(t);
    }

    // REMOVED: 4 16ths (Standard Grid) to prevent "busy" syncopation
    
    // 4. Quarter Note (Lowest Priority "Core")
    if (allowQuartersEl.checked) cores.push(RHYTHM_VARIANTS["q"].find(v => v.id === "q_1"));

    const validCores = cores.filter(c => !!c); 
    if (validCores.length === 0) return null;
    return pickRandomStrict(validCores);
}

// Replacing the entire generateExercise function
function generateExercise({ measures, timeSignatures, restPct, allowSyncopation }) {
    const out = [];
    const safeTimeSigs = (timeSignatures && timeSignatures.length > 0) ? timeSignatures : ["4/4"];

// HELPER: Pass-through (Disabled Density Filtering)
    // This ensures variations with rests (like "1 e &") are ALWAYS allowed,
    // regardless of the Rest Slider setting.
    function applyDensityFilter(list) {
        return list; 
    }
    
    // HELPER: Procedural 0.5 beat fillers (Eighth or 2-16ths)
    function getHalfBeatFillers() {
        const fillers = [];
        // 1. Single Eighth (Standard)
        if (allow8thsEl.checked) fillers.push([make("8", 0.5)]);
        // 2. Two Sixteenths (If 16ths enabled)
        if (allow16thsEl.checked) fillers.push([make("16", 0.25), make("16", 0.25)]);
        
        // Fallback
        if (fillers.length === 0) return [[make("8", 0.5)]];
        return fillers;
    }

    // === 1. PER-EXERCISE RANDOMIZATION ===
    const exercisePatterns = {
        "5/8": PULSE_PATTERNS["5/8"][Math.floor(Math.random() * PULSE_PATTERNS["5/8"].length)],
        "7/8": PULSE_PATTERNS["7/8"][Math.floor(Math.random() * PULSE_PATTERNS["7/8"].length)],
        "9/8_asym": PULSE_PATTERNS["9/8_asym"][Math.floor(Math.random() * PULSE_PATTERNS["9/8_asym"].length)]
    };

    for (let m = 0; m < measures; m++) {
        const rawTs = safeTimeSigs[Math.floor(Math.random() * safeTimeSigs.length)];
        
        let ts = rawTs; 
        if (rawTs === "9/8_asym") ts = "9/8"; 

        const parts = ts.split("/");
        const num = parseInt(parts[0], 10);
        const den = parseInt(parts[1], 10);
        
        // --- 2. DETERMINE PULSE MAP ---
        let pulseMap = [];

        if (rawTs === "9/8_asym") {
            pulseMap = exercisePatterns["9/8_asym"];
        }
        else if (den === 8) {
            if (num === 5 && exercisePatterns["5/8"]) pulseMap = exercisePatterns["5/8"];
            else if (num === 7 && exercisePatterns["7/8"]) pulseMap = exercisePatterns["7/8"];
            else if (num % 3 === 0) pulseMap = Array(num / 3).fill(1.5);
            else pulseMap = Array(num).fill(0.5); 
        } 
        else {
            pulseMap = Array(num).fill(1.0);
        }

        let measureBeats = [];
        let currentAbsPos = 0;

        for (let i = 0; i < pulseMap.length; i++) {
            const pulseDur = pulseMap[i]; // 1.5, 1.0, or 0.5
            const isPulseCompound = (Math.abs(pulseDur - 1.5) < 0.01);
            
            // --- A. REST LOGIC ---
            const roll = Math.random() * 100;
            if (roll < restPct) {
                let rDur = "8";
                let rDots = 0;
                
                if (Math.abs(pulseDur - 1.5) < 0.01) { rDur = "q"; rDots = 1; }
                else if (Math.abs(pulseDur - 1.0) < 0.01) { rDur = "q"; }
                else if (Math.abs(pulseDur - 0.5) < 0.01) { rDur = "8"; }

                const restEvent = [{ kind: "rest", dur: rDur, beats: pulseDur, dots: rDots }];
                let tempAbsPos = currentAbsPos;
                restEvent.forEach(n => { n.groupId = (m * 100) + i; n.absStart = tempAbsPos; tempAbsPos += (n.beats || 0); });
                measureBeats.push(restEvent);
                currentAbsPos += pulseDur;
                continue;
            }

            // --- B. SYNCOPATION LOGIC (For 1.0 pulses) ---
            if (allowSyncopation && pulseDur === 1.0 && (i + 1 < pulseMap.length) && pulseMap[i+1] === 1.0) {
                if (Math.random() < 0.30) {
                    let availableBeats = 1; 
                    let checkIdx = i + 2;
                    while (checkIdx < pulseMap.length && pulseMap[checkIdx] === 1.0) {
                        availableBeats++; checkIdx++;
                    }
                    let numCores = 1;
                    for (let k = 0; k < availableBeats - 1; k++) {
                        if (Math.random() < 0.25) numCores++; else break; 
                    }
                    const entry = getSyncopationFiller();
                    const exit = getSyncopationFiller();
                    const cores = [];
                    let coresValid = true;
                    for (let c = 0; c < numCores; c++) {
                        const cTile = getSyncopatedCore();
                        if (!cTile) { coresValid = false; break; }
                        cores.push(cTile);
                    }

                    if (entry && exit && coresValid) {
                        const gIdBase = (m * 100) + i;
                        let t = currentAbsPos;
                        entry.forEach(n => { n.groupId = gIdBase + 0.1; n.absStart = t; t += n.beats; });
                        measureBeats.push(entry);
                        currentAbsPos += 0.5;
                        cores.forEach((coreTile, cIdx) => {
                             let tCore = currentAbsPos;
                             coreTile.forEach(n => { n.groupId = gIdBase + 0.2 + (cIdx * 0.01); n.absStart = tCore; tCore += n.beats; });
                             measureBeats.push(coreTile);
                             currentAbsPos += 1.0;
                        });
                        let tExit = currentAbsPos;
                        exit.forEach(n => { 
                            n.groupId = gIdBase + 0.9; n.absStart = tExit; tExit += n.beats; 
                            n._isSyncExit = true; 
                        });
                        measureBeats.push(exit);
                        currentAbsPos += 0.5;
                        i += numCores; 
                        continue;
                    }
                }
            }

            // --- C. STANDARD TILE SELECTION (Pulse-Driven + Buckets) ---
            let chosenTile = null;
            let candidates = [];
            let usedBucketSize = 0;

            // 1. SIMPLE TIME BUCKETS (1.0 Beat Base)
            if (!isPulseCompound && pulseDur === 1.0) {
                 
                 // === 3-Beat Bucket Check (Strict) ===
                 if (i + 2 < pulseMap.length && pulseMap[i+1] === 1.0 && pulseMap[i+2] === 1.0) {
                     const b3 = applyDensityFilter(getStrictCandidates(3.0, false, restPct));
                     const b2 = applyDensityFilter(getStrictCandidates(2.0, false, restPct));
                     const b1 = applyDensityFilter(getStrictCandidates(1.0, false, restPct));

                     const mustPick3 = (b3.length > 0 && b1.length === 0 && b2.length === 0);
                     
                     // CHANGE 0.30 TO 0.05 HERE:
                     if (mustPick3 || (b3.length > 0 && Math.random() < 0.10)) {
                         candidates = b3;
                         usedBucketSize = 3;
                     }
                 }

                 // === 2-Beat Bucket Check (Rescue Logic) ===
                 if (usedBucketSize === 0 && i + 1 < pulseMap.length && pulseMap[i+1] === 1.0) {
                     const rawB2 = getStrictCandidates(2.0, false, restPct); 
                     const b2Strict = applyDensityFilter(rawB2); 
                     const b1Strict = applyDensityFilter(getStrictCandidates(1.0, false, restPct));
                     
                     let bucketList = [];
                     if (b2Strict.length > 0) {
                         const forceBucket = (b1Strict.length === 0);
                         // CHANGE 0.50 TO 0.10 HERE:
                         if (forceBucket || Math.random() < 0.10) bucketList = b2Strict;
                     }
                     else if (b1Strict.length === 0 && rawB2.length > 0) {
                         bucketList = rawB2;
                     }
                     
                     if (bucketList.length > 0) {
                         candidates = bucketList;
                         usedBucketSize = 2;
                     }
                 }
                 
                 // Fallback to 1 beat
                 if (usedBucketSize === 0) {
                     candidates = applyDensityFilter(getStrictCandidates(1.0, false, restPct));
                     usedBucketSize = 1;
                 }
            }
            
            // 2. COMPOUND TIME BUCKETS (1.5 Beat Base) + NEW MIXED PULSE
            else if (isPulseCompound && pulseDur === 1.5) {
                 
                 // NEW: Check for 3.0 beat buckets (Two Dotted Quarters)
                 if (i + 1 < pulseMap.length && pulseMap[i+1] === 1.5) {
                     const b3 = applyDensityFilter(getStrictCandidates(3.0, true, restPct));
                     const b15 = applyDensityFilter(getStrictCandidates(1.5, true, restPct));

                     const forceBucket = (b15.length === 0);
                     // REDUCED PROBABILITY: From 0.50 to 0.15 (15% chance)
                     if (b3.length > 0 && (forceBucket || Math.random() < 0.15)) { 
                         candidates = b3;
                         usedBucketSize = 2; // Consumes 2 pulses (1.5 + 1.5 = 3.0)
                     }
                 }

                 // Default 1.5 Logic (Standard Dotted Quarter)
                 if (usedBucketSize === 0) {
                     // === NEW: COMPOSITE PULSE LOGIC ===
                     // Chance to split 1.5 into (1.0 + 0.5) or (0.5 + 1.0)
                     // RESTRICTION: Only allow Triplets, 5-lets (16th), and 6-lets for the 1.0 beat portion.
                     if (Math.random() < 0.50) {
                         // 1. Get ALL 1.0 beat candidates
                         const allSimple = getStrictCandidates(1.0, false, restPct);
                         
                         // 2. Filter STRICTLY for Tuplets (8t, 5let16, 6let)
                         const allowedPrefixes = ["8t", "5let16", "6let"];
                         const tupletCandidates = allSimple.filter(t => allowedPrefixes.some(pre => t.id.startsWith(pre)));
                         
                         const simpleTiles = applyDensityFilter(tupletCandidates);
                         const halfTiles = getHalfBeatFillers();

                         if (simpleTiles.length > 0 && halfTiles.length > 0) {
                             const one = pickRandomStrict(simpleTiles);
                             
                             // MARKER: Identify these notes as the "Tuplet Island"
                             // We attach the config so Sticking/Rendering treats them as a distinct block
                             if (one) {
                                 // FIX: Handle "false" tuplets (like Quarter Note 100) correctly.
                                 // If _tuplet is explicitly false, we pass a config that prevents rendering.
                                 let tConfig = one._tuplet;
                                 if (tConfig === undefined) {
                                     tConfig = { num_notes: 3, notes_occupied: 2 };
                                 } else if (tConfig === false) {
                                     tConfig = { render: false };
                                 }
                                 
                                 one.forEach(n => n._mixedTuplet = tConfig);
                             }

                             const half = halfTiles[Math.floor(Math.random() * halfTiles.length)];
                             // MARKER: Identify filler notes for Sticking logic
                             half.forEach(n => n._isCompoundFiller = true);

                             // Randomly decide Order: Front-Loaded vs Back-Loaded
                             if (Math.random() < 0.5) {
                                 chosenTile = [...one, ...JSON.parse(JSON.stringify(half))]; 
                             } else {
                                 chosenTile = [...JSON.parse(JSON.stringify(half)), ...one]; 
                             }
                             usedBucketSize = 1; 
                         }
                     }
            }
}

            // 3. Default: Single Pulse Bucket (For 0.5 pulses or fallback)
            if (!chosenTile && usedBucketSize === 0 && candidates.length === 0) {
                candidates = applyDensityFilter(getStrictCandidates(pulseDur, isPulseCompound, restPct));
                usedBucketSize = 1;
            }

            if (!chosenTile && candidates.length > 0) {
                chosenTile = pickRandomStrict(candidates);
            }

            // --- FAIL SAFE (User request: Use Rest) ---
            if (!chosenTile) {
                 let fDur = "q";
                 let fDots = 0;
                 if (Math.abs(pulseDur - 1.5) < 0.01) { fDur = "q"; fDots = 1; }
                 else if (Math.abs(pulseDur - 1.0) < 0.01) { fDur = "q"; }
                 else if (Math.abs(pulseDur - 0.5) < 0.01) { fDur = "8"; }
                 chosenTile = [{ kind: "rest", dur: fDur, beats: pulseDur, dots: fDots, _fallback: true }];
            }

            // Apply Group ID and Positions
            const actualTileDur = chosenTile.reduce((s,n) => s + (n.beats||0), 0);
            let tempAbsPos = currentAbsPos;
            chosenTile.forEach(n => { n.groupId = (m * 100) + i; n.absStart = tempAbsPos; tempAbsPos += (n.beats || 0); });
            measureBeats.push(chosenTile);
            currentAbsPos += actualTileDur;

            if (usedBucketSize > 1) {
                i += (usedBucketSize - 1); 
            } else if (actualTileDur > pulseDur + 0.01) {
                let eaten = actualTileDur;
                while (eaten > pulseDur + 0.01 && i < pulseMap.length - 1) {
                    eaten -= pulseMap[i+1];
                    i++; 
                }
            }
        }
        out.push({ beats: measureBeats, timeSig: ts, pulseMap });
    }
    return out;
}


// ======================================================
// 2. STICKING LOGIC (UNIVERSAL GRID + DENSITY FIX)
// ======================================================

function applySticking(exercise, strategy) {
    if (!exercise) return;

    // Reset all sticking
    exercise.forEach(m => m.beats.forEach(b => b.forEach(n => delete n.sticking)));

    if (!isStickingVisible) return;

    const globalLead = currentLeadHand || "R";
    const other = (h) => (h === "R" ? "L" : "R");

    // Rudiment Strategies
    if (["alternate", "doubles", "paradiddle"].includes(strategy)) {
        let pattern = [];
        if (strategy === "alternate") pattern = [globalLead, other(globalLead)];
        if (strategy === "doubles") pattern = [globalLead, globalLead, other(globalLead), other(globalLead)];
        if (strategy === "paradiddle") pattern = [globalLead, other(globalLead), globalLead, globalLead, other(globalLead), globalLead, other(globalLead), other(globalLead)];
        
        let idx = 0;
        exercise.forEach(m => m.beats.forEach(beat => beat.forEach(n => {
            if (n.kind === "note") { 
                n.sticking = pattern[idx % pattern.length]; 
                idx++; 
            }
        })));
        return;
    }

    // Natural Sticking (Grid-Based)
    if (strategy === "natural") {
        let currentHand = globalLead;
        const is16thGridActive = (allow16thsEl && allow16thsEl.checked);

        exercise.forEach(measure => {
            measure.beats.forEach(beat => {
                if (!beat || beat.length === 0) return;

                const beatLead = currentHand;
                const beatDur = beat.reduce((s,n) => s + (n.beats||0), 0);
                const isCompoundBeat = Math.abs(beatDur - 1.5) < 0.05;

                // --- 1. COMPOUND TIME HANDLING (6/8, 9/8, etc.) ---
                if (isCompoundBeat) {
                    const isMixed = beat.some(n => !!n._mixedTuplet); // Detect Mixed Meter Pulse

                    if (isMixed) {
                        // === NEW: Mixed Pulse Sticking (1.0 + 0.5 or 0.5 + 1.0) ===
                        let hand = beatLead;
                        beat.forEach(n => {
                            if (n.kind === "rest") return;

                            if (n._isCompoundFiller) {
                                // CASE A: The Filler (0.5 Beat)
                                n.sticking = hand;
                                
                                // FIX: Differentiate 16ths (RL) vs 8ths (R...R)
                                if (n.dur === "16" || n.dur === "32") {
                                     // If filler is 16ths: STRICT ALTERNATING (R L)
                                     hand = other(hand);
                                } else {
                                     // If filler is 8th: Check Density (Ghosting)
                                     // If 16ths are allowed, 8th takes 2 slots (Hit, Ghost) -> Next is Same Hand
                                     if (is16thGridActive) hand = hand; 
                                     else hand = other(hand);
                                }
                            } 
                            else {
                                // CASE B: The Tuplet Island (1.0 Beat)
                                // Strict Alternating regardless of grid
                                n.sticking = hand;
                                hand = other(hand);
                            }
                        });
                        
                        // Set the start hand for the NEXT pulse
                        currentHand = hand;
                        return;
                    }

                    // === STANDARD COMPOUND LOGIC (UNCHANGED) ===
                    const has16ths = beat.some(n => n.dur === "16" || n.dur === "32");
                    if (has16ths || is16thGridActive) {
                        let localPos = 0; 
                        beat.forEach(n => {
                            if (n.kind === "note") {
                                const slot = Math.round((localPos / 1.5) * 6);
                                n.sticking = (slot % 2 === 0) ? beatLead : other(beatLead);
                            }
                            localPos += (n.beats || 0);
                        });
                        currentHand = beatLead; 
                    } else {
                         let localPos = 0; 
                         beat.forEach(n => {
                             if (n.kind === "note") {
                                 const slot = Math.round((localPos / 1.5) * 3); 
                                 n.sticking = (slot % 2 === 0) ? beatLead : other(beatLead);
                             }
                             localPos += (n.beats || 0);
                         });
                         currentHand = other(beatLead);
                    }
                    return;
                }

                // --- 2. SIMPLE TIME HANDLING (Standard Grid) ---
                let slotsPerBeat = 2; // Default 8ths

                if (beat._forceSixLetSticking) {
                    slotsPerBeat = 6;
                }
                else if (beat._tuplet) {
                    const n = beat._tuplet.num_notes;
                    const dur = beatDur || 1; 
                    if (n === 3 && Math.abs(dur - 2.0) < 0.05) slotsPerBeat = 3; 
                    else slotsPerBeat = n / dur;
                } else {
                    const has16ths = beat.some(n => n.dur === "16" || n.dur === "32");
                    const hasSextuplets = beat.some(n => n._localTuplet || Math.abs(n.beats - 1/6) < 0.01);

                    if (hasSextuplets) {
                        slotsPerBeat = 6;
                    } else {
                        // For simple time, we respect the global toggle OR local density
                        if (has16ths || is16thGridActive) slotsPerBeat = 4;
                        else slotsPerBeat = 2;
                    }
                }

                // Apply Sticking
                let localPos = 0;
                beat.forEach(n => {
                    if (n.kind === "note") {
                        const slot = Math.round(localPos * slotsPerBeat);
                        n.sticking = (slot % 2 === 0) ? beatLead : other(beatLead);
                    }
                    localPos += (n.beats || 0);
                });

                // Calculate next hand
                const totalSlots = Math.round(beatDur * slotsPerBeat);
                if (totalSlots % 2 !== 0) {
                    currentHand = other(beatLead); 
                } else {
                    currentHand = beatLead; 
                }
            });
        });
    }
}



// ======================================================
// 3. RENDERING & COUNTING (VEXFLOW)
// ======================================================

function getCountingText(absPos, posInBeat, groupDur, tupletType, timeSig, pulseMap) {
    if (!currentShowCounts) return null;
    const eps = 0.02;

    const parts = (timeSig || "4/4").split("/");
    const den = parseInt(parts[1], 10);
    const isEighthMeter = (den === 8);

    // Helper to get the Beat Number (e.g. "1", "2")
    const getBeatNum = (pos) => {
        if (isEighthMeter) return getEighthCount(pos, pulseMap);
        return Math.floor(pos + eps) + 1;
    };

    // ==========================================
    // 1. 5-LETS
    // ==========================================
    if (tupletType === 5) {
        if (groupDur > 1.8) {
             const idx = Math.round((posInBeat / groupDur) * 5) % 5;
             return (idx + 1).toString();
        }
        let offset = 0.0;
        if (Math.abs((posInBeat * 10) % 2 - 1) < 0.1) offset = 0.5;
        const relPos = posInBeat - offset;
        const idx = Math.round(relPos * 5) % 5;
        return (idx + 1).toString();
    }

    // ==========================================
    // 2. SEXTUPLETS & 16th TRIPLETS (Tuplet 6)
    // ==========================================
    if (tupletType === 6) {
        // UNIVERSAL PULSE LOGIC (Solves 4/4 vs 9/8 and Sextuplet vs Straight 16ths)
        // We look strictly at the 0.5 beat window.
        
        const pulseOffset = posInBeat % 0.5; // Where are we in the current 0.5 slice?
        
        // CHECK 1: Start of a 0.5 Pulse (0.0)
        if (pulseOffset < 0.05 || pulseOffset > 0.45) {
            // In 9/8 (Eighth Meter), every 0.5 step is a main Pulse Number (1, 2, 3)
            if (isEighthMeter) return getBeatNum(absPos).toString();

            // In 4/4 (Simple Meter):
            // 0.0 = Beat Number
            // 0.5 = "&"
            const beatPhase = absPos % 1.0; 
            if (Math.abs(beatPhase - 0.5) < 0.1) return "&";
            return getBeatNum(absPos).toString();
        }

        // CHECK 2: Straight 16th Note (0.25)
        // If we are exactly halfway through the 0.5 pulse, it's an "&" (or "e"/"a" in 16ths)
        // This catches the "Compound 16ths" in 9/8 -> 1 (&) 2 (&)
        if (Math.abs(pulseOffset - 0.25) < 0.05) {
            return "&";
        }

        // CHECK 3: Triplet / Sextuplet Syllables
        // Map remaining positions (0.16, 0.33) to "la" and "li"
        const slot = Math.round((pulseOffset / 0.5) * 3);
        if (slot === 1) return "la";
        if (slot === 2) return "li";
        
        return "";
    }

    // ==========================================
    // 3. TRIPLETS (Tuplet 3)
    // ==========================================
    if (tupletType === 3) {
        // CASE A: Composite Triplet (Inside 1.5 beat group)
        // We use Offset Logic to keep the triplet intact (spanning across pulses)
        if (Math.abs(groupDur - 1.5) < 0.1) {
            let startOffset = 0.0;
            const checkBack = (posInBeat - 0.5) * 3;
            if (Math.abs(checkBack - Math.round(checkBack)) < 0.1) startOffset = 0.5;

            const relativeOffset = posInBeat - startOffset;
            const slot = Math.round(relativeOffset * 3) % 3;

            if (slot === 0) return getBeatNum(absPos).toString();
            if (slot === 1) return "la";
            if (slot === 2) return "li";
        }

        // CASE B: Standard Logic (Simple Meter / Standard Grid)
        const slot = Math.round((posInBeat / groupDur) * 3) % 3;

        if (slot === 0) {
            if (isEighthMeter) return getBeatNum(absPos).toString();
            const beatPhase = absPos % 1.0;
            if (Math.abs(beatPhase - 0.5) < 0.1) return "&"; 
            return getBeatNum(absPos).toString();
        }

        return (slot === 1) ? "la" : "li";
    }

    // ==========================================
    // 4. 9-LETS
    // ==========================================
    if (tupletType === 9) {
        const slot = Math.round((posInBeat / groupDur) * 9) % 9;
        return ((slot % 3) + 1).toString();
    }

    // ==========================================
    // 5. FALLBACK (Standard 8ths/16ths)
    // ==========================================
    if (isEighthMeter) {
        let scan = 0;
        let offsetInPulse = 0;
        if (pulseMap) {
            for (let i = 0; i < pulseMap.length; i++) {
                if (absPos >= scan - eps && absPos < scan + pulseMap[i] - eps) {
                    offsetInPulse = absPos - scan;
                    break;
                }
                scan += pulseMap[i];
            }
        }
        const remainder = offsetInPulse % 0.5;
        if (Math.abs(remainder) < 0.1 || Math.abs(remainder - 0.5) < 0.1) {
             return getEighthCount(absPos, pulseMap);
        }
        return "&";
    }

    // Simple Meter Fallback
    const beatNum = Math.floor(absPos + eps) + 1;
    const beatRelPos = absPos % 1.0;
    
    if (beatRelPos < eps || beatRelPos > 1 - eps) return beatNum.toString(); 
    if (Math.abs(beatRelPos - 0.5) < eps) return "&";
    if (Math.abs(beatRelPos - 0.25) < eps) return "e";
    if (Math.abs(beatRelPos - 0.75) < eps) return "a";

    return null;
}

// Helper to get just the main number for tuplets in X/8
function getEighthCount(absPos, pulseMap) {
    const eps = 0.02;
    let scan = 0;
    if (pulseMap) {
        for (let i = 0; i < pulseMap.length; i++) {
            // Check if absPos is within this pulse
            if (absPos >= scan - eps && absPos < scan + pulseMap[i] - eps) {
                const offset = absPos - scan;
                // FIX: Add small buffer (0.001) to offset to prevent 0.999 -> 0 errors
                const eighth = Math.floor((offset + 0.001) / 0.5);
                return (eighth + 1).toString();
            }
            scan += pulseMap[i];
        }
    }
    return "1";
}


// UPDATED SIGNATURE: Accepts timeSig and pulseMap
function makeStaveNote(flow, elem, beatIdx, posInBeat, tupletType, absPos, groupDur, timeSig, pulseMap) {
    const isRest = elem.kind === "rest";
    const duration = elem.dur + (isRest ? "r" : "");

    // 1. Keys & Positioning
    let keys = ["c/5"]; 
    let targetLine = null;

    if (isRest) {
        if (tupletType) { keys = ["a/4"]; targetLine = 3.0; } 
        else { keys = ["b/4"]; targetLine = 3; } 
    }

    const note = new flow.StaveNote({ clef: "percussion", keys, duration });
    
    if (isRest && targetLine !== null) {
        if (note.keyProps && note.keyProps[0]) note.keyProps[0].line = targetLine;
        note.setKeyLine(0, targetLine);
    }

    // 2. Sticking
    if (!isRest && elem.sticking) {
      note.addModifier(new flow.Annotation(elem.sticking)
        .setFont("Arial", 11, "bold")
        .setVerticalJustification(flow.Annotation.VerticalJustify.BOTTOM));
    }
    
    // 3. Counting Text (UPDATED)
    if (!isRest) {
       // FIX: Check for _mixedTuplet to handle 5-lets/Triplets in Compound Time
       let activeTuplet = tupletType;
       if (!activeTuplet) {
           if (elem._mixedTuplet) activeTuplet = elem._mixedTuplet.num_notes;
           else if (elem._localTuplet) activeTuplet = 6;
           else if (elem._compoundGrid) activeTuplet = 6;
           else activeTuplet = 0;
       }

       const txt = getCountingText(absPos, posInBeat, groupDur || 1.0, activeTuplet, timeSig, pulseMap);
       if (txt) {
           note.addModifier(new flow.Annotation(txt)
            .setFont("Arial", 11, "bold") 
            .setVerticalJustification(flow.Annotation.VerticalJustify.BOTTOM));
       }
    }
    
    // 4. Dots
    const dots = Math.max(0, Number(elem.dots || 0));
    for (let i = 0; i < dots; i++) {
        if (flow.Dot?.buildAndAttach) flow.Dot.buildAndAttach([note], { all: true });
        else note.addDotToAll();
    }

    note.setStemDirection(flow.Stem.UP).setStemLength(35);
    return note;
}




















function buildMeasure(flow, measureModel) {
    const notes = [];
    const tuplets = [];
    const beams = [];
    const allEvents = [];
    
    let currentMeasurePos = 0; 
    
    // Parse Meter
    const timeSig = measureModel.timeSig || "4/4";
    const pulseMap = measureModel.pulseMap || [];

    // === PULSE AWARE: Pre-calculate Beat Boundaries ===
    // e.g. 5/8 with pulse [1.5, 1.0] -> Boundaries: [1.5, 2.5]
    // Standard 4/4 [1,1,1,1] -> Boundaries: [1.0, 2.0, 3.0, 4.0]
    const boundaries = new Set();
    let acc = 0;
    pulseMap.forEach(p => {
        acc += p;
        // Store boundary with minor epsilon to avoid float issues
        // We actually store the clean sum. Logic below handles epsilon.
        boundaries.add(Math.round(acc * 1000) / 1000); 
    });
    
    // === PASS 1: Create Notes (UPDATED: Pass pulseMap to makeStaveNote) ===
    measureModel.beats.forEach((beat, bIndex) => {
        if (!beat) return;
        let localPos = 0;
        
        const isGlobalTuplet = !!(beat._tuplet && beat._tuplet !== false);
        const groupDur = beat.reduce((sum, n) => sum + (n.beats || 0), 0);
        
        let tType = isGlobalTuplet ? (beat._tuplet.num_notes || 3) : 0;

        beat.forEach((e) => {
            const actualAbsPos = e.absStart || currentMeasurePos;
            
            // UPDATED: Pass timeSig and pulseMap to makeStaveNote
            const vfNote = makeStaveNote(flow, e, bIndex, localPos, tType, actualAbsPos, groupDur, timeSig, pulseMap);
            vfNote.__beatPos = actualAbsPos; 
            
            allEvents.push({ 
    note: vfNote, dur: e.dur, kind: e.kind, beats: e.beats,
    // UPDATE THIS LINE:
    isTuplet: isGlobalTuplet || !!e._localTuplet || !!e._mixedTuplet,
    // ... keep the rest ...
    tupletNum: tType, 
    pos: actualAbsPos, groupId: e.groupId,
    isHybrid: !!e._isHybrid,
    rawEvent: e 
});

            localPos += Number(e.beats || 0);
        });
        currentMeasurePos += groupDur;

        // Add Global Tuplet Wrapper
        if (isGlobalTuplet) {
             if (beat._tuplet.render !== false) {
                 const vfNotes = allEvents.slice(allEvents.length - beat.length).map(x => x.note);
                 const allBeamable = beat.every(e => e.kind !== "rest" && ["8", "16", "32", "64"].includes(e.dur));
                 let shouldBracket = !allBeamable;
                 
                 if (beat._tuplet && typeof beat._tuplet.bracketed === 'boolean') {
                     shouldBracket = beat._tuplet.bracketed;
                 }

                 tuplets.push(new flow.Tuplet(vfNotes, { 
                     ...beat._tuplet, 
                     bracketed: shouldBracket, 
                     ratioed: false 
                 }));
             }
        }
    });

    notes.push(...allEvents.map(e => e.note));

// === PASS 2: Local Tuplets (Enhanced) ===
    let localBuffer = []; 
    let currentConfig = null;
    let currentGroupId = null; 

    const flushLocalTuplet = () => {
        if (localBuffer.length > 0) {
            const config = currentConfig || { num_notes: 3, notes_occupied: 2 };
            
            // === SMART BRACKET LOGIC ===
            const allBeamable = localBuffer.every(evt => {
                const isRest = (evt.kind === 'rest');
                const isBeamableDur = ["8", "16", "32", "64"].includes(evt.dur);
                return !isRest && isBeamableDur;
            });

            const vfNotes = localBuffer.map(evt => evt.note);

            // FIX: Check config.render !== false
            if (config.render !== false) {
                tuplets.push(new flow.Tuplet(vfNotes, { 
                    ...config, 
                    bracketed: !allBeamable, 
                    ratioed: false 
                }));
            }
        }
        localBuffer = [];
        currentConfig = null;
        currentGroupId = null;
    };

    allEvents.forEach(evt => {
        const raw = evt.rawEvent || {};
        
        const isMixed = !!raw._mixedTuplet;
        const isLocal = !!raw._localTuplet;

        if (isMixed || isLocal) {
            const nodeConfig = raw._mixedTuplet || { num_notes: 3, notes_occupied: 2 };
            const thisGroupId = evt.groupId; 

            // Check if we are continuing the SAME tuplet group
            const configMatch = currentConfig && 
                                (currentConfig === nodeConfig || 
                                (currentConfig.num_notes === nodeConfig.num_notes && currentConfig.notes_occupied === nodeConfig.notes_occupied));
            
            const groupMatch = (currentGroupId !== null && thisGroupId === currentGroupId);

            if (!configMatch || !groupMatch) {
                flushLocalTuplet(); // Finish previous group
                currentConfig = nodeConfig; // Start new
                currentGroupId = thisGroupId;
            }
            // PUSH THE FULL EVENT (so we can check .dur and .kind later)
            localBuffer.push(evt);
        } else {
            flushLocalTuplet();
        }
    });
    flushLocalTuplet(); // Final flush



    // === PASS 3: Beaming Engine (PULSE AWARE) ===
    let groupEvents = []; 
    const isBeamable = (e) => (e.kind !== "rest" && ["8", "16", "32", "64"].includes(e.dur));
    
    function flushBeam() {
        if (groupEvents.length >= 2) {
            const vfNotes = groupEvents.map(e => e.note);
            const beam = new flow.Beam(vfNotes);
            
            // Sub-beam logic (9-lets etc)
            const firstEvt = groupEvents[0];
            if (firstEvt.isTuplet && firstEvt.tupletNum === 9) {
                const splitIndices = [];
                let currentSlots = 0;
                groupEvents.forEach((evt, index) => {
                    const slots = Math.round((evt.beats || 0) * 4.5);
                    currentSlots += slots;
                    if (currentSlots === 3 || currentSlots === 6) {
                        let shouldSplit = true;
                        if (index >= 2 && index + 3 < groupEvents.length) {
                            const is16 = (k) => groupEvents[k].dur === "16" && groupEvents[k].kind !== "rest";
                            if (is16(index) && is16(index-1) && is16(index-2) &&
                                is16(index+1) && is16(index+2) && is16(index+3)) {
                                shouldSplit = false; 
                            }
                        }
                        if (shouldSplit && index < groupEvents.length - 1) splitIndices.push(index);
                    }
                });
                if (splitIndices.length > 0) beam.breakSecondaryAt(splitIndices);
            }
            beams.push(beam);
        }
        groupEvents = [];
    }

    for (let i = 0; i < allEvents.length; i++) {
        const evt = allEvents[i];
        
        if (groupEvents.length > 0) {
            const prevEvt = groupEvents[groupEvents.length - 1];
            let shouldBreak = false;

            // --- PULSE AWARE BREAK LOGIC ---
            // Current event starts at evt.pos.
            // If evt.pos is exactly on a defined Pulse Boundary, we MUST break the previous beam.
            // Example: 5/8 (1.5 + 1.0). Boundary is at 1.5.
            // Note A ends at 1.5. Note B starts at 1.5. 
            // Note B is on a boundary -> Break.
            
            // Check if current position matches any boundary
            // Use rounding to avoid floating point mismatch (1.49999)
            const checkPos = Math.round(evt.pos * 1000) / 1000;
            
            if (boundaries.has(checkPos)) {
                // EXCEPTION: Tuplets often cross internal boundaries (e.g. 9-let spans 2 beats).
                // If both notes belong to the SAME Tuplet Group, do not break.
                if (evt.isTuplet && evt.groupId === prevEvt.groupId) {
                    shouldBreak = false;
                } else {
                    shouldBreak = true;
                }
            }

            // Standard Type Checks
            if (evt.isTuplet !== prevEvt.isTuplet) {
                if (!evt.isHybrid || !prevEvt.isHybrid) shouldBreak = true;
            }
            if (evt.isTuplet && evt.groupId !== prevEvt.groupId) shouldBreak = true;

            if (shouldBreak) flushBeam();
        }

        if (isBeamable(evt)) groupEvents.push(evt); 
        else flushBeam();
    }
    flushBeam();

    return { notes, beams, tuplets };
}















  // ---------- Rendering ----------
  let currentExercise = null;

  // No changes required to logic, but strictly ensuring buildMeasure is called
  function packMeasure(flow, measureModel, isFirstMeasure = false) {
    // measureModel contains { beats, timeSig, pulseMap }
    // buildMeasure now uses that pulseMap
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
    const formatter = new flow.Formatter();
    formatter.joinVoices([voice]);
    const requiredNoteWidth = formatter.preCalculateMinTotalWidth([voice]);

    // Add structural padding
    const firstMeasureExtra = isFirstMeasure ? 80 : 0;
    const breathingRoom = 30;

    // Calculate total minimum width
    const minW = requiredNoteWidth + firstMeasureExtra + breathingRoom;
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
           // --- Fix for Issue 1: Remove manual offset hacking ---
           // VexFlow handles this automatically if added before formatting
           // stave.setNoteStartX(stave.getX() + 65); <--- REMOVED
       }

       // Fix: Set context BEFORE drawing/formatting so widths are calculated correctly
       stave.setContext(ctx); 
       stave.draw();
        
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
      
      // Use a Map to deduplicate anchors by beat position
      const anchorMap = new Map();
      anchorMap.set(0, startX);
      anchorMap.set(lenBeats, endX);

      pack.notes.forEach(n => {
        if (typeof n.getAbsoluteX === 'function' && n.__beatPos !== undefined) {
            // FIX: Only add if we don't have a better anchor there
            if (!anchorMap.has(n.__beatPos)) {
                anchorMap.set(n.__beatPos, n.getAbsoluteX());
            }
        }
      });

      // Convert back to sorted array
      const anchors = Array.from(anchorMap.entries())
                           .map(([b, x]) => ({ b, x }))
                           .sort((a,b) => a.b - b.b);
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
    // UPDATED SPB CALCULATION
    const spb = (60 / tempo) / currentPulseRatio; 
    
    // Total Time
    const totalSeconds = totalBeatsScheduled * spb;
    if(totalTimeEl) totalTimeEl.textContent = formatTime(totalSeconds);

    // Current Time
    let currentBeat = 0;
    if (isPlaying && !isPaused && audioCtx) {
        const timeElapsed = audioCtx.currentTime - audioStartTime;
        currentBeat = accumulatedBeat + (timeElapsed / spb);
    } else {
        currentBeat = accumulatedBeat;
    }

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
      // UPDATED SPB with Pulse Ratio
      const spb = (60 / tempoNow) / currentPulseRatio;

      const timeElapsed = now - audioStartTime;
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
    // UPDATED SPB with Pulse Ratio
    const spb = (60 / tempoNow) / currentPulseRatio;

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
           
           // Handle Count-In Alignment
           let alignmentBase = measureStart;
           if (schedulerBeat < 0) {
               const firstMs = currentExercise[0];
               if (firstMs) {
                   const ts = firstMs.timeSig || "4/4";
                   const parts = ts.split("/");
                   const n = parseInt(parts[0], 10);
                   const d = parseInt(parts[1], 10);
                   const len = (d === 8) ? (n / 2) : n;
                   alignmentBase = -len;
               }
           }

           const localBeat = schedulerBeat - alignmentBase;
           
           // 2. IDENTIFY PULSE & CLICK LOGIC
           const currentMeasureData = currentExercise[mIdx];
           const parts = (currentMeasureData.timeSig || "4/4").split("/");
           const num = parseInt(parts[0], 10);
           const den = parseInt(parts[1], 10);
           
           // A. Build Pulse Map (UPDATED: Read from measure if available)
           let pulseMap = currentMeasureData.pulseMap;
           
           if (!pulseMap) {
               // Fallback Logic (Only used for legacy or count-in)
               if (den === 8) {
                   if (num % 3 === 0) {
                       pulseMap = Array(num / 3).fill(1.5);
                   } else {
                       if (num === 5) pulseMap = [1.5, 1.0]; 
                       else if (num === 7) pulseMap = [1.0, 1.0, 1.5];
                       else pulseMap = Array(Math.ceil(num/2)).fill(1.0);
                   }
               } else {
                   pulseMap = Array(num).fill(1.0);
               }
           }

           // B. Locate Current Position in Pulse Map
           let checkPos = 0;
           let isPulseStart = false;
           let isPulseSubdivision = false;
           const eps = 0.05;

           for (let len of pulseMap) {
               // Are we at the START of this pulse group?
               if (Math.abs(localBeat - checkPos) < eps) {
                   isPulseStart = true;
                   break;
               }
               // Are we INSIDE this pulse group (subdivision)?
               if (localBeat > checkPos && localBeat < checkPos + len - eps) {
                   // Check for dotted quarter subdivisions (0.5 within 1.5)
                   const offset = localBeat - checkPos;
                   if (Math.abs(offset % 0.5) < eps) {
                       isPulseSubdivision = true;
                   }
                   break;
               }
               checkPos += len;
           }

           const isDownbeat = (Math.abs(localBeat) < eps);
           const isCountIn = (schedulerBeat < 0);

           // 3. CALCULATE STEP DURATION (SNAP TO GRID)
           let stepDuration = 1.0;
           if (den === 8) {
               // X/8 -> Snap to nearest 0.5
               const nextGrid = (Math.floor(localBeat * 2) + 1) / 2;
               stepDuration = nextGrid - localBeat;
               if (stepDuration < 0.01) stepDuration = 0.5;
           } else {
               // X/4 -> Snap to nearest 1.0
               const nextGrid = Math.floor(localBeat) + 1;
               stepDuration = nextGrid - localBeat;
               if (stepDuration < 0.01) stepDuration = 1.0;
           }

           // 4. METRONOME CLICK
           if (isMetronomeOn) {
               if (isPulseStart) {
                   // MAIN PULSE: Play Loud
                   const freq = isDownbeat ? 1200 : 900;
                   const gain = isDownbeat ? 0.5 : 0.3; 
                   clickAt(nextNoteTime, freq, gain, 0.03);
               } 
               else if (isPulseSubdivision && isCountIn) {
                   // COUNT-IN SUBDIVISION
                   clickAt(nextNoteTime, 900, 0.1, 0.03); 
               }
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
                           clickAt(scheduleTime, ev.freq, 0.3, 0.03);
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
        // UPDATED SPB
        const spb = (60 / Math.max(40, Math.min(220, Number(tempoEl.value) || 120))) / currentPulseRatio;
        
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
      // UPDATED SPB
      const spb = (60 / tempoNow) / currentPulseRatio;
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
      // UPDATED SPB
      const spb = (60 / lastTempoVal) / currentPulseRatio;
      
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
        // UPDATED SPB
        const oldSpb = (60 / lastTempoVal) / currentPulseRatio;
        const elapsed = now - audioStartTime;
        accumulatedBeat += (elapsed / oldSpb);
        
        // 2. Reset Start Time
        audioStartTime = now;
        
        // 3. HARD SYNC: Recalculate next note time using NEW tempo
        // We calculate the exact beat distance between "Now" (accumulatedBeat)
        // and the "Next Scheduled Event" (schedulerBeat).
        // UPDATED SPB
        const newSpb = (60 / newTempo) / currentPulseRatio;
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


// NEW HELPER: Exclusive Toggle for Picker Items
  function toggleExclusiveSelection(items, currentSet, predicate) {
      const candidates = items.filter(predicate);
      const others = items.filter(i => !predicate(i));
      
      // Check: Is this group currently the ONLY thing active?
      const allCandidatesIn = candidates.every(i => currentSet.has(i.value));
      const noOthersIn = others.every(i => !currentSet.has(i.value));
      const isCurrentlySolo = allCandidatesIn && noOthersIn;
      
      const newSet = new Set(currentSet);
      
      if (isCurrentlySolo) {
          // 2nd Click: Turn OFF (Result: Empty)
          candidates.forEach(i => newSet.delete(i.value));
      } else {
          // 1st Click: Turn ON Exclusive (Result: Only this group)
          newSet.clear();
          candidates.forEach(i => newSet.add(i.value));
      }
      return newSet;
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
            if (["5/8", "7/8", "9/8_asym"].includes(val)) return "Asymmetric Meters";
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
                // UPDATED: Use Exclusive Toggle
                action: (items, current) => toggleExclusiveSelection(items, current, i => ["2/4", "3/4", "4/4", "5/4", "6/4"].includes(i.value))
            },
            { 
                label: "Compound", 
                color: "purple",
                // UPDATED: Use Exclusive Toggle
                action: (items, current) => toggleExclusiveSelection(items, current, i => ["6/8", "9/8", "12/8"].includes(i.value))
            },
            { 
                label: "Asymmetric", 
                color: "purple",
                // UPDATED: Use Exclusive Toggle
                action: (items, current) => toggleExclusiveSelection(items, current, i => ["5/8", "7/8", "9/8_asym"].includes(i.value))
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

  // NEW: Syncopation Auto-Regen
  const allowSyncopationEl = $("allowSyncopation");
  if (allowSyncopationEl) {
      allowSyncopationEl.addEventListener("change", regenerate);
  }







function undo() {
      if (exerciseHistory.length === 0) return;
      
      stop();
      clearError();

      // 1. Pop the last state
      const previousState = exerciseHistory.pop();
      currentExercise = previousState;
      
      // Update Button State
      undoBtn.disabled = (exerciseHistory.length === 0);

      // 2. RE-RUN PULSE DETECTION (Updates Icon)
      // We must re-detect this because the previous exercise might have been 6/8 vs 4/4
      let isDotted = false;
      if (currentExercise.length > 0 && currentExercise[0].pulseMap.length > 0) {
          const firstPulse = currentExercise[0].pulseMap[0];
          isDotted = Math.abs(firstPulse - 1.5) < 0.1;
          currentPulseRatio = isDotted ? 1.5 : 1.0;
      } else {
          currentPulseRatio = 1.0;
      }
      drawTempoIcon(isDotted);

      // 3. RE-CALCULATE MEASURE STARTS
      measureStartBeats = [];      
      let acc = 0;
      for (const mm of currentExercise) {
          measureStartBeats.push(acc);
          const ts = mm.timeSig || "4/4";
          const parts = ts.split("/");
          const num = parseInt(parts[0], 10);
          const den = parseInt(parts[1], 10);
          const len = (den === 8) ? (num / 2) : num;
          acc += len;
      }
      measureStartBeats.push(acc); 

      // 4. RENDER VISUALS
      // Note: Sticking is embedded in the saved object, but if you changed hands 
      // since then, we might want to re-apply current strategy? 
      // Let's assume we want to re-apply current UI settings to the old notes:
      applySticking(currentExercise, currentStickingStrategy);
      render(currentExercise);
      setStatus(`Restored Previous Exercise`);

      // 5. AUDIO PREP
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
  }









  function regenerate() {
    try {
      stop(); 
      clearError();

      // === NEW: SAVE HISTORY ===
      if (currentExercise && currentExercise.length > 0) {
          // We can push the reference directly since generateExercise creates new objects every time
          exerciseHistory.push(currentExercise);
          // Limit history to 20 items to save memory
          if (exerciseHistory.length > 20) exerciseHistory.shift();
          
          if (undoBtn) undoBtn.disabled = false;
      }

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
      const allow9lets = !!allow9letsEl?.checked;
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
        allow9lets, 
        allowSyncopation
      });

      // === NEW: DETECT PULSE & UPDATE ICON ===
      let newPulseRatio = 1.0;
      let isDotted = false;

      if (currentExercise.length > 0 && currentExercise[0].pulseMap.length > 0) {
          const firstPulse = currentExercise[0].pulseMap[0];
          isDotted = Math.abs(firstPulse - 1.5) < 0.1;
          newPulseRatio = isDotted ? 1.5 : 1.0;
      }

      // === NEW: BPM METRIC MODULATION ===
      // If switching Pulse Type (e.g. Quarter -> Dotted Quarter), 
      // automatically adjust BPM so the "Note Speed" (8th notes) stays constant.
      if (currentPulseRatio !== newPulseRatio) {
          let currentBPM = Number(tempoEl.value) || 100;
          
          // Case 1: Switching TO Compound (1.0 -> 1.5)
          // BPM must DROP to maintain speed (e.g. 120 -> 80)
          if (currentPulseRatio === 1.0 && newPulseRatio === 1.5) {
               currentBPM = Math.round(currentBPM / 1.5);
          }
          
          // Case 2: Switching TO Simple (1.5 -> 1.0)
          // BPM must RISE to maintain speed (e.g. 80 -> 120)
          else if (currentPulseRatio === 1.5 && newPulseRatio === 1.0) {
               currentBPM = Math.round(currentBPM * 1.5);
          }

          // Safety Clamp
          currentBPM = Math.max(40, Math.min(220, currentBPM));
          
          // Apply to UI
          tempoEl.value = currentBPM;
          tempoValEl.textContent = currentBPM;
          syncSliderFill(tempoEl);
      }

      // Commit the new ratio
      currentPulseRatio = newPulseRatio;
      drawTempoIcon(isDotted);
      
      // FIX: Correctly calculate start beats for X/8 signatures
      measureStartBeats = [];      let acc = 0;
      
      for (const mm of currentExercise) {
          measureStartBeats.push(acc);
          const ts = mm.timeSig || "4/4";
          const parts = ts.split("/");
          const num = parseInt(parts[0], 10);
          const den = parseInt(parts[1], 10);
          const len = (den === 8) ? (num / 2) : num;
          acc += len;
      }
      measureStartBeats.push(acc); 

      applySticking(currentExercise, currentStickingStrategy);

      render(currentExercise);
      setStatus(`Generated ${measures} Measures`);
      
      // --- AUDIO PREP ---
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

      // --- SMOKE TEST VALIDATION (Integrated) ---
      let abominationCount = 0;
      currentExercise.forEach((m, i) => {
          const flat = m.beats.flat();
          for (let k = 0; k < flat.length - 2; k++) {
              const a = flat[k], b = flat[k+1], c = flat[k+2];
              // CHECK: Rest Sandwich (16r + 1.5r + 16r)
              if (a.kind === 'rest' && b.kind === 'rest' && c.kind === 'rest') {
                  if (a.beats === 0.25 && b.beats === 1.5 && c.beats === 0.25) {
                      console.error(`[Measure ${i+1}] ABOMINATION DETECTED: 16r + 1.5r + 16r.`);
                      abominationCount++;
                  }
              }
          }
      });
      if (abominationCount === 0) {
        console.log("%c Smoke Test Passed: No abominations.", "color: green; font-weight: bold;");
      }
      
    } catch (e) {
      showError(e);
      setStatus("Render failed (see error box).");
    }
  }



  restsEl.addEventListener("input", () => {
    restsValEl.textContent = restsEl.value;
    syncSliderFill(restsEl);
  });

  if (undoBtn) undoBtn.addEventListener("click", undo); // NEW
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
      allowQuintupletsEl, allowTripletsEl, allow16thsEl, allow16thQuintupletsEl, allowSextupletsEl,
      allow9letsEl // <--- NEW
  ].filter(el => !!el);
  
  const straightGroup = ["allowDottedQuarters", "allowQuarters", "allow8ths", "allow16ths"];
  const tripletGroup = ["allowQuarterTriplets", "allowTriplets", "allowSextuplets"];

  // REPLACEMENT HELPER: Exclusive Toggle (Solo -> Off -> Solo)
  function toggleExclusiveDomGroup(groupIds) {
      const targets = rhythmInputs.filter(el => groupIds.includes(el.id));
      const others = rhythmInputs.filter(el => !groupIds.includes(el.id));
      
      // Check: Is this group currently the ONLY thing active?
      const allTargetsOn = targets.every(el => el.checked);
      const allOthersOff = others.every(el => !el.checked);
      const isCurrentlySolo = allTargetsOn && allOthersOff;

      if (isCurrentlySolo) {
          // 2nd Click: Turn OFF (Result: Nothing selected)
          targets.forEach(el => el.checked = false);
      } else {
          // 1st Click: Turn ON Exclusive (Result: Only this group selected)
          targets.forEach(el => el.checked = true);
          others.forEach(el => el.checked = false);
      }
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

  // Full Button Logic
  if (btnFull) btnFull.onclick = () => {
      const fullIds = new Set([
          "q_c_1",          
          "dq3_std", 
          "dq3_rest",
          "dq_std_rest",
          "dq_std_8",
          "dq_rev_8",
          
          "q_1",
          "q_cmp_111",      // <--- ADDED: Compound Quarter Full (111)
          "8s_11",          
          "8s_c_111",       
          "16s_1111",       
          "8t_111",         
          "qt_111",         
          "q_compound_111", 
          "5let_11111",     
          "5let16_11111",   
          "6let_111111",    
          "9let_111111111",

          // FIX: Added the Compound 16th Full Grouping
          "cmp_6let_111111" 
      ]);
      
      let hasNonFullActive = false;
      Object.values(RHYTHM_VARIANTS).forEach(group => {
          group.forEach(variant => {
              if (!fullIds.has(variant.id) && activeVariations.has(variant.id)) {
                  hasNonFullActive = true;
              }
          });
      });
      
      const targetIsFull = hasNonFullActive;
      Object.values(RHYTHM_VARIANTS).forEach(group => {
          group.forEach(variant => {
              if (targetIsFull) {
                  if (fullIds.has(variant.id)) activeVariations.add(variant.id);
                  else activeVariations.delete(variant.id);
              } else {
                  activeVariations.add(variant.id);
              }
          });
      });
      regenerate();
  };


  // UPDATE LISTENERS TO USE EXCLUSIVE TOGGLE
  if (btnStraight) btnStraight.onclick = () => toggleExclusiveDomGroup(straightGroup);
  if (btnTriplets) btnTriplets.onclick = () => toggleExclusiveDomGroup(tripletGroup);

  // --- GLOBAL UI HANDLERS ---
  // Replaces the inline onclick="..." logic in HTML
  document.querySelectorAll('.smart-toggle').forEach(el => {
      el.addEventListener('click', (e) => {
          // If user clicked the wrapper (span/div) but NOT the actual input, toggle the input manually
          if (e.target.tagName !== 'INPUT') {
              const input = el.querySelector('input');
              if (input) input.click();
          }
      });
  });

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


// Updated setupTileInteractions: Simplified thanks to Global Expansion
function setupTileInteractions() {
  const tiles = document.querySelectorAll('.rhythmTile');
  tiles.forEach(tile => {
      const input = tile.querySelector('input');
      const iconZone = tile.querySelector('.rhythmIcon');
      if(input) input.addEventListener('change', () => regenerate());

      if(iconZone) {
          iconZone.addEventListener('click', (e) => {
              e.preventDefault(); e.stopPropagation();
              const rhythmKey = iconZone.getAttribute('data-type');
              
              // === DISABLE PICKER FOR DOTTED Q TOGGLE (Category Switch) ===
              if (rhythmKey === "dottedQ") { 
                  if (input) input.click(); 
                  return; 
              }

              // 1. DETERMINE METER TYPE
              let hasSimple = false; 
              let hasCompound = false;

              if (!currentTimeSigs || currentTimeSigs.length === 0) hasSimple = true; 
              else currentTimeSigs.forEach(ts => {
                  if (ts.includes("_asym") || ts === "5/8" || ts === "7/8") {
                      hasSimple = true;
                      hasCompound = true;
                  } else {
                      const parts = ts.split("/"); 
                      const num = parseInt(parts[0], 10); 
                      const den = parseInt(parts[1], 10);
                      
                      if (den === 4) {
                          hasSimple = true;
                      }
                      else if (den === 8) { 
                          if (num % 3 === 0) hasCompound = true; 
                          else { hasSimple = true; hasCompound = true; }
                      }
                  }
              });

              // === NEW: COMPOUND TIME RESTRICTIONS ===
              if (!hasSimple && hasCompound) {
                  // 1. BLOCK: Large tuplets that don't fit the "1 Beat Island" logic
                  if (["5let", "9let", "qt"].includes(rhythmKey)) {
                      // FALLBACK: Toggle the checkbox instead of opening picker
                      if (input) input.click();
                      return; 
                  }
              }

              // 2. QUARTER NOTE LOGIC (Special Case)
              if (rhythmKey === "q") {
                  if (hasCompound) {
                      const variants = RHYTHM_VARIANTS["q"].filter(v => v._isCompoundVariant);
                      const getNoteCount = (v) => v.notes.filter(n => n.kind !== 'rest').length;
                      variants.sort((a, b) => getNoteCount(b) - getNoteCount(a));
                      const groupFn = (item) => `Compound Pulse|||${getNoteCount(item)} Note Grouping`;
                      const currentSelectedIds = variants.filter(v => activeVariations.has(v.id)).map(v => v.id);
                      
                      const counts = [...new Set(variants.map(getNoteCount))].sort((a, b) => b - a);
                      const actions = [
                          { label: "All", color: "orange", action: (items, current) => toggleSelection(items, current, () => true) }
                      ];
                      counts.forEach(c => { 
                          actions.push({ 
                              label: `${c} Note`, color: "purple", 
                              action: (items, current) => toggleSelection(items, current, i => getNoteCount(i) === c) 
                          }); 
                      });
                      
                      showPicker({
                          title: "Quarters", items: variants, multi: true, groupBy: groupFn, 
                          selected: currentSelectedIds, quickActions: actions,
                          onSave: (selectedIds) => {
                              variants.forEach(v => activeVariations.delete(v.id));
                              selectedIds.forEach(id => activeVariations.add(id));
                              regenerate();
                          }
                      });
                      return; 
                  } else {
                      if (input) input.click(); 
                      return;
                  }
              }

              if (!rhythmKey || !RHYTHM_VARIANTS[rhythmKey]) return;

              // === 3. GENERIC FILTER LOGIC ===
              let variants = [...RHYTHM_VARIANTS[rhythmKey]]; 

              // A. Simple Time Only: Hide Compound Variants
              if (hasSimple && !hasCompound) {
                  variants = variants.filter(v => !v._isCompoundVariant);
              }
              
              // B. Compound Time Only:
              if (!hasSimple && hasCompound) {
                  // If it's one of the "Island" types (1-beat tuplets), we ALLOW Simple variants.
                  const isIslandType = ["8t", "5let16", "6let"].includes(rhythmKey);

                  if (!isIslandType) {
                      variants = variants.filter(v => v._isCompoundVariant);
                  }
              }
              
              // C. Asymmetric: Show Everything (No filter)

              const title = tile.getAttribute('title') || "Variations";
              const currentSelectedIds = variants.filter(v => activeVariations.has(v.id)).map(v => v.id);
              const getNoteCount = (v) => v.notes.filter(n => n.kind !== 'rest').length;
              
              variants.sort((a, b) => {
                  const isCompoundA = !!a._isCompoundVariant; const isCompoundB = !!b._isCompoundVariant;
                  if (isCompoundA !== isCompoundB) return isCompoundA ? 1 : -1; 
                  return getNoteCount(b) - getNoteCount(a);
              });

              const groupFn = (item) => {
                  if (rhythmKey === "dottedQ") return "Simple Pulse|||Variations";
                  if (rhythmKey === "8s" || rhythmKey === "16s") {
                      const pulseHeader = item._isCompoundVariant ? "Compound Pulse" : "Simple Pulse";
                      return `${pulseHeader}|||${getNoteCount(item)} Note Grouping`;
                  }
                  return `${getNoteCount(item)} Note Grouping`;
              };

              const counts = [...new Set(variants.map(getNoteCount))].sort((a, b) => b - a);
              const actions = [];
              actions.push({ label: "All", color: "orange", action: (items, current) => toggleSelection(items, current, () => true) });

              const hasSimpleVar = variants.some(v => !v._isCompoundVariant);
              const hasCompoundVar = variants.some(v => v._isCompoundVariant);
              
              if (hasSimpleVar && hasCompoundVar) {
                  counts.forEach(c => { 
                      if (variants.some(v => !v._isCompoundVariant && getNoteCount(v) === c)) { 
                          actions.push({ label: `Simple ${c}`, color: "purple", action: (items, current) => toggleSelection(items, current, i => !i._isCompoundVariant && getNoteCount(i) === c) }); 
                      } 
                  });
                  counts.forEach(c => { 
                      if (variants.some(v => v._isCompoundVariant && getNoteCount(v) === c)) { 
                          actions.push({ label: `Comp ${c}`, color: "purple", action: (items, current) => toggleSelection(items, current, i => i._isCompoundVariant && getNoteCount(i) === c) }); 
                      } 
                  });
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

// 2. Define Defaults (Ensures tiles are selected)
if (typeof RHYTHM_VARIANTS !== 'undefined') {
    const defaultIds = [
        "q_c_1",          
        "dq3_std", 
        "dq3_rest",
        "dq_std_rest",    
        "dq_std_8",
        "q_1",
        "q_cmp_111",      // <--- ADDED: Compound Quarter Full (111)
        "8s_11",          
        "8s_c_111",       
        "16s_1111",       
        "8t_111",         
        "qt_111",         
        "q_compound_111", 
        "5let_11111",     
        "5let16_11111",   
        "6let_111111",    
        "9let_111111111",
        
        // FIX: Explicitly add it to defaults so it appears on refresh
        "cmp_6let_111111" 
    ];

    defaultIds.forEach(id => activeVariations.add(id));
}

regenerate();

// =========================================================
  // === HOTKEY SYSTEM ===
  // =========================================================
  
  window.addEventListener("keydown", (e) => {
      // 1. HANDLE ESCAPE (Closes Picker) - High Priority
      if (e.code === "Escape") {
          const picker = $("pickerOverlay");
          if (picker && !picker.hidden) {
              e.preventDefault();
              picker.hidden = true;
              picker.setAttribute('aria-hidden', 'true');
              // Clean up dynamic footer if it exists
              const f = picker.querySelector(".picker__footer");
              if (f) f.remove();
              return;
          }
      }

      // 2. IGNORE inputs (Prevent typing from triggering hotkeys)
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
      // UPDATED SPB
      const spb = (60 / bpm) / currentPulseRatio; 
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
