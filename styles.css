@import url('https://fonts.googleapis.com/css2?family=Ubuntu:wght@400&display=swap');

/* === Theme (matched) === */
:root{
  --black:#000; --white:#fff;
  --bg:#1c1c1c;
  --section-gap:20px;

  /* Oranges */
  --orange:#d35400;
  --orange-d:#c25227;
  --orange-dim:#a84300;

  /* Purple & Blues */
  --purple:#96318d; --purple-d:#81227a; --purple-dim:#752070;
  --blue:#058890;  --blue-d:#04767e;   --blue-dim:#03656b;

  --gray-1:#ddd; --gray-3:#53525d;
}

/* === Base === */
*{ box-sizing:border-box; }
html, body{
  font-family:'Ubuntu',system-ui,-apple-system,Segoe UI,Roboto,sans-serif;
  font-weight:400;
}
body{
  margin:0;
  background:var(--bg);
  color:#fff;
  font-size:18px;
  padding:0;
}

/* === Layout === */
.wrap{
  width:100%;
  max-width:1200px;  /* allow score area to be wider than the top card */
  margin:50px auto;
}

.top{
  width:100%;
  position:relative;
  margin:0 auto;
  margin-bottom: var(--section-gap);
  background:var(--blue);
  border:2px solid var(--black);
  border-radius:12px;
  padding:12px;
  display:flex;
  flex-direction:column;
  gap:20px;
}

.title{
  font-size:1.2rem;
  line-height:1.2;
  margin:0;
  text-align:center;
}
.sub{
  font-size:1rem;
  opacity:.95;
  text-align:center;
  margin-top:6px;
}

.controls{
  display:flex;
  flex-wrap:wrap;
  gap:20px;
  align-items:center;
  justify-content:center;
}

/* Field blocks (Renamed to avoid Webflow collisions) */
.rdm-field{
  display:flex;
  flex-direction:column;
  gap:8px;
  align-items:stretch;
  min-width:220px;

  /* SAFETY: Force remove any unwanted borders/bg inherited from Webflow defaults */
  background: transparent !important;
  border: none !important;
  padding: 0 !important;
  margin: 0 !important;
}

.rdm-field > span{
  color:#fff;
  font-size:1.1rem;
}

.fieldHead{
  display:flex;
  align-items:baseline;
  justify-content:space-between;
  gap:12px;
  width:100%;
}

.fieldLabel{
  color:#fff;
  font-size:1.05rem;
}

.fieldValue{
  color:#fff;
  font-size:1.05rem;
  font-weight:700;
  white-space:nowrap;
}


/* Inputs */
.rdm-field input[type="number"]{
  width:100%;
  height:44px;
  padding:8px;
  font-size:1.1rem;
  border:2px solid var(--black);
  border-radius:6px;
  background:#fff;
  color:#000;
  text-align:center;
  outline:none;
}

.pill{
  height:44px;
  display:inline-flex;
  align-items:center;
  justify-content:center;
  border:2px solid var(--black);
  border-radius:6px;
  background:#fff;
  color:#000;
  padding:6px 12px;
  font-size:1.05rem;
  user-select:none;
  white-space:nowrap;
}

/* Checkbox line */
.check{
  display:flex;
  align-items:center;
  justify-content:center;
  gap:10px;
  width:100%;
  padding:10px 12px;
  border:2px solid var(--black);
  border-radius:12px;
  background:var(--blue);
}

.check--compact{
  width:auto;
  padding:10px 14px;
  border-radius:999px;
}

/* Triplets chip — default (not selected) */
.check--compact{
  border-color:#fff;   /* override black border */
  color:#fff;
}

.check--compact span{
  color:inherit;
}

.check--compact input{
  accent-color:#fff;   /* checkbox is white when off */
}

/* Triplets chip — selected */
.check--compact:has(input:checked){
  border-color: var(--purple);
  color: var(--purple);
  box-shadow: 0 0 0 2px rgba(150,49,141,.35);
}

.check--compact:has(input:checked) input{
  accent-color: var(--purple);
}


.check span{ font-size:1.05rem; }

/* === Buttons (matched 44px) === */
.btnRow{
  display:flex;
  gap:20px;
  width:100%;
  justify-content:center;
  flex-wrap:wrap;
}
.btn{
  height:44px;
  display:inline-flex;
  align-items:center;
  justify-content:center;
  border:2px solid var(--black);
  color:#fff;
  font-size:1.05rem;
  padding:6px 12px;
  border-radius:6px;
  cursor:pointer;
  user-select:none;
  -webkit-tap-highlight-color:transparent;
  background:var(--orange); /* default matches your ref buttons */
}
.btn:hover{ background:var(--orange-d); }
.btn:disabled{ background:var(--orange-dim); cursor:not-allowed; }

.btn.primary{ background:var(--purple); }
.btn.primary:hover{ background:var(--purple-d); }

/* Make "Stop" distinct but still on-theme */
.btn.danger{ background:var(--blue-dim); }
.btn.danger:hover{ background:var(--blue-d); }


.statusChip{
  position:absolute;
  top:12px;
  right:12px;
  display:inline-flex;
  align-items:center;
  gap:8px;
  border:2px solid var(--black);
  border-radius:999px;
  padding:8px 12px;
  background:#fff;
  color:#000;
  font-size:.95rem;
  line-height:1;
  white-space:nowrap;
}

.statusChip .dot{
  width:10px;
  height:10px;
  border-radius:50%;
  border:2px solid var(--black);
  background:var(--blue);
}

/* states */
.statusChip--ok .dot{ background:var(--blue); }
.statusChip--play .dot{ background:var(--orange); }
.statusChip--warn .dot{ background:var(--orange); }

/* keep it from overlaying on small screens */
@media (max-width:700px){
  .statusChip{
    position:static;
    align-self:center;
    margin-top:12px;
  }
}


/* === Slider (exact thumb + track style you like) === */
.rdm-field input[type="range"]{
  --thumb:24px;
  --fill: var(--purple); /* default fill */
  width:100%;
  height:16px;
  border-radius:6px;
  box-shadow:inset 0 0 0 2px var(--black);
  background:linear-gradient(to right,var(--fill) 0 0) no-repeat var(--bg-pos,0/0%), #fff;
  -webkit-appearance:none;
  appearance:none;
  outline:none;
}
.rdm-field input[type="range"]::-webkit-slider-thumb{
  -webkit-appearance:none;
  width:var(--thumb);
  height:var(--thumb);
  background:#fff;
  border-radius:50%;
  border:2px solid var(--black);
  cursor:pointer;
}

.rdm-field input[type="range"].slider-fill{ --fill: var(--purple); }
.rdm-field input[type="range"].slider--orange{ --fill: var(--orange); }


.rdm-field input[type="range"]::-moz-range-thumb{
  width:var(--thumb);
  height:var(--thumb);
  background:#fff;
  border-radius:50%;
  border:2px solid var(--black);
  cursor:pointer;
}

/* iOS: only thumb interactive */
.is-ios .rdm-field input[type="range"] { touch-action: manipulation; }
.is-ios .rdm-field input[type="range"]::-webkit-slider-runnable-track { pointer-events:none; }
.is-ios .rdm-field input[type="range"]::-webkit-slider-thumb { pointer-events:auto; }

/* === Main area === */
.main{ margin-top:0; }

.status{
  color:#fff;
  opacity:.95;
  font-size:1rem;
  margin:0 0 var(--section-gap) 2px;
  text-align:left;
}

.error{
  border:2px solid var(--black);
  background:rgba(254,100,41,.20);
  border-radius:12px;
  padding:12px;
  white-space:pre-wrap;
  margin-bottom:12px;
}

.scoreWrap{
  width:min(100%, 1200px);
  margin:0 auto;
  margin-bottom: var(--section-gap);
  border:2px solid var(--black);
  border-radius:12px;
  background:var(--blue);
  padding:12px;

  overflow-x:hidden;    /* HIDE horizontal scroll */
  overflow-y:auto;      /* KEEP vertical scroll */
  text-align:center;    /* center the stack when it’s smaller than wrap */
}

.scoreStack{
  position:relative;
  display:inline-block; /* sizes to the canvases; scroll stays accurate */
}

.score, .playhead {
  display: block;
  vertical-align: top; /* Ensures no baseline space below/above */
}


.optionsCard{
  width:min(100%, 1200px);
  margin:0 auto;
  border:2px solid var(--black);
  border-radius:12px;
  background:var(--blue);
  padding:12px;
  display:flex;
  justify-content:center;
  gap:14px;
  flex-wrap:wrap;
}

/* Rhythm tile (Triplets) */
.rhythmTile{
  position:relative;
  display:inline-flex;
  align-items:center;
  justify-content:center;
  width:170px;
  height:80px;
  border:2px solid var(--black);
  border-radius:12px;
  background:#fff;
  cursor:pointer;
  user-select:none;
}

.rhythmTile input{
  position:absolute;
  top:8px;
  left:8px;
  width:18px;
  height:18px;
  opacity:0;          /* keep it real, but hidden */
  margin:0;
}

/* visual checkbox */
.rhythmTick{
  position:absolute;
  top:8px;
  left:8px;
  width:18px;
  height:18px;
  border:2px solid var(--black);
  border-radius:4px;
  background:#fff;
}

.rhythmIcon{
  display:flex;
  align-items:center;
  justify-content:center;
  color:#000; /* icon color */
}

.rhythmCanvas{
  display:block;
  width:120px;   /* visual size */
  height:auto;   /* keep aspect ratio */
}

/* Selected state */
.rhythmTile input:checked ~ .rhythmTick{
  border-color: var(--purple);
  background: var(--purple);
}

.rhythmTile input:checked ~ .rhythmTick::after{
  content:"";
  position:absolute;
  left:5px;
  top:1px;
  width:5px;
  height:10px;
  border:solid #fff;
  border-width:0 3px 3px 0;
  transform:rotate(45deg);
}

/* keyboard focus */
.rhythmTile:focus-within{
  box-shadow:0 0 0 3px rgba(150,49,141,.35);
}

/* screen-reader only text */
.srOnly{
  position:absolute;
  width:1px;
  height:1px;
  padding:0;
  margin:-1px;
  overflow:hidden;
  clip:rect(0,0,0,0);
  white-space:nowrap;
  border:0;
}


@media (min-width: 940px){
  .scoreWrap{ min-width:900px; }
}

.score{
  display:block;
  background:#fff;
  border:2px solid var(--black);
  border-radius:10px;
  /* IMPORTANT: do NOT force width:100% / height:auto.
     Your JS sets exact pixel sizes for perfect overlay alignment. */
}

.playhead{
  position:absolute;
  inset:0;
  pointer-events:none;
}

/* === Progress Bar (New) === */
.bar {
  position: relative;
  height: 40px;              /* Matches reference code */
  background: var(--white);
  border: 2px solid var(--black);
  overflow: hidden;
  margin: 0 auto 20px auto;  /* Centered, bottom spacing */
  border-radius: 5px;        /* Matches reference code */
  width: min(100%, 1200px);  /* Matches score width */
}

.bar__fill {
  height: 100%;
  background: var(--orange); /* Matches reference code */
  width: 0%;                 /* JS will update this */
  transition: width 0.1s linear;
}


/* Responsive */
@media (max-width:700px){
  .wrap{ width:92%; margin:10px auto; }
  .rdm-field{ min-width:0; width:100%; }
  .btn{ width:100%; max-width:520px; }
}
