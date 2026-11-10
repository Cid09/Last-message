const $ = (id) => document.getElementById(id);

/* 화면 맞춤: 논리 높이 800 고정. 아이패드 등 넓은 화면은 가로를 넓게 쓰고(와이드), 📱 버튼으로 9:16 고정(쇼츠 녹화용) 전환 */
let wideMode = Math.min(innerWidth, innerHeight) >= 700 && matchMedia("(pointer:coarse)").matches;
try { const v = localStorage.getItem("wide"); if (v !== null) wideMode = v === "1"; } catch (e) {}
function fit() {
  const vw = innerWidth, vh = innerHeight, W = wideMode ? Math.max(450, Math.min(820, vw / vh * 800)) : 450, st = document.documentElement.style;
  st.setProperty("--w", W + "px"); st.setProperty("--s", Math.min(vw / W, vh / 800));
  const b = document.getElementById("fitBtn"); if (b) b.textContent = wideMode ? "📱" : "⛶";
}
addEventListener("resize", fit); addEventListener("orientationchange", () => setTimeout(fit, 200)); fit();
const introScreen = $("introScreen"), storyScreen = $("storyScreen"),
      endingScreen = $("endingScreen"), creditsScreen = $("creditsScreen");

const TIME_LIMIT = 6000;      // 장면당 제한 시간 (4장면 → 50초 이내)
const FEEDBACK_MS = 1700;     // 선택 후 자동 진행 대기

let lightAdj = 0, history = [], flags, sceneIndex, runId = 0, views, viewTick, timerTick, sceneStart,
    gameStart, reactions, lastSec, locked;

const scenes = [
  {
    label: "SCENE 01", title: "21:12 단체방 폭발", icon: "🌧️", idle: 2, room: { name: "2학년 3반 단체방", sub: "참여자 28명", group: true }, time: [21, 12],
    text: "밤 9시 12분.\n반 단체방이 갑자기 폭발한다.",
    chat: [
      ["민수", "야 이거 봤냐ㅋㅋㅋ 전학생 발표 영상"],
      ["지훈", "풀버전 있음. 올린다?"],
      ["민수", "ㅇㅇ 올려 올려ㅋㅋㅋㅋ", "😂 7"],
      ["지훈", "[동영상] 서연_발표_망함.mp4"],
      ["하은", "…그건 좀 아닌 것 같은데"]
    ],
    choices: [
      { text: "ㅋㅋㅋ 같이 웃는다.", say: "ㅋㅋㅋㅋㅋ 미쳤다", reply: ["민수", "역시 ㅋㅋㅋ 너 좀 아는데?"], set: { joined: true }, spread: 400, bad: true, feedback: "웃음이 목에 걸렸다. 왜 이렇게 오래 남지." },
      { text: "“그만해. 올리지 마.”", say: "그만해. 올리지 마.", reply: ["지훈", "뭐야 갑자기 진지;;"], set: { supported: true }, spread: -60, feedback: "손이 떨렸다. 그래도 보냈다." },
      { text: "말없이 방을 나간다.", sys: "나님이 채팅방을 나갔습니다.", reply: ["민수", "ㅋㅋ 쟤 나감"], set: { ignored: true }, spread: 150, feedback: "화면을 껐는데도, 웃음소리가 들리는 것 같았다." }
    ]
  },
  {
    label: "SCENE 02", title: "도착한 DM", icon: "📩", idle: 2, room: { name: "서연", sub: "방금 전 접속" }, time: [21, 40],
    text: (f) => f.joined ? "21:40.\n아까 웃었던 게 계속 마음에 걸린다.\n그때, 서연에게서 DM이 왔다." : f.supported ? "21:40.\n네가 말린 걸 서연도 알았나 보다.\n서연에게서 DM이 왔다." : "21:40.\n방을 나왔는데도 마음이 불편하다.\n서연에게서 DM이 왔다.",
    chat: (f) => [
      ["서연", f.joined ? "너도 단체방에 있었지…?" : f.supported ? "아까 말려준 거, 너 맞지?" : "단체방 영상… 봤어?"],
      ["서연", "발표 주제가 ‘내가 좋아하는 것’이었어."],
      ["서연", "별 얘기를 했는데… 너무 떨려서 더듬었어."],
      ["서연", "그게 계속 돌아다니는 걸 보니까"],
      ["서연", "내일 학교 가기가 무서워."]
    ],
    choices: [
      { text: "“별일 아닐 거야.”", say: "별일 아닐 거야.", reply: ["서연", "…응. 그렇겠지."], spread: 200, bad: true, feedback: "말해놓고 알았다. 이건 위로가 아니었다." },
      { text: "“속상했겠다. 내가 들어줄게.”", say: "속상했겠다. 내가 들어줄게.", reply: ["서연", "…고마워. 사실 계속 울었어."], set: { supported: true }, spread: -80, feedback: "답장이 오기까지의 몇 초가 아주 길었다." },
      { text: "읽고 답하지 않는다.", sys: "읽음 · 답장 없음", reply: ["서연", "…바쁘구나. 미안."], set: { ignored: true }, spread: 250, bad: true, feedback: "‘읽음’이 떴다. 되돌릴 수 없었다." }
    ]
  },
  {
    label: "SCENE 03", title: "다른 반까지", icon: "🌫️", idle: 2, room: { name: "2학년 3반 단체방", sub: "참여자 28명", group: true }, time: [8, 20],
    text: (f) => f.joined ? "다음 날 아침.\n영상은 학교 전체로 퍼졌다.\n그리고 모두가 안다. 처음에 웃은 사람 중에 네가 있었다는 걸." : "다음 날 아침.\n영상은 이미 학교 전체로 퍼졌다.",
    chat: (f) => [
      ["민수", f.joined ? "너도 웃었잖아ㅋㅋ 이제 와서 뭘" : "옆 반도 다 봤대ㅋㅋ"],
      ["지훈", "조회수 3천 넘음 ㄷㄷ 서연 밈 됐다", "😂 23"],
      ["하은", "…진짜 너무한 거 아냐?"],
      ["서연", "영상 내려 달라고 했는데 아무도 안 들어줘."],
      ["서연", "쉬는 시간마다 화장실에 숨어 있어…"]
    ],
    choices: [
      { text: "친구들에게 공유 중단을 요청한다.", say: "다들 영상 그만 돌려. 서연이 힘들어해.", reply: ["민수", "헐 갑분싸 ㅋㅋ"], set: { supported: true }, spread: -200, feedback: "몇 명은 나를 쳐다봤다. 몇 명은, 영상을 껐다." },
      { text: "선생님께 상황을 알린다.", sys: "선생님께 따로 메시지를 보냈습니다.", reply: ["하은", "…잘했어. 나도 같이 말씀드릴게."], set: { reported: true, supported: true }, spread: -500, feedback: "복도를 걷는 내내 심장이 뛰었다. 그래도 걸었다." },
      { text: "나까지 놀림받을까 봐 모른 척한다.", sys: "읽음 · 답장 없음", reply: ["지훈", "ㅋㅋㅋ 다음 영상 간다"], set: { ignored: true }, spread: 600, bad: true, feedback: "아무 일 없는 척하는 건 생각보다 무거웠다." }
    ]
  },
  {
    label: "SCENE 04", title: "복도 끝에서", icon: "🚪", idle: 2, room: { name: "복도 · 방과 후", sub: "직접 대화", live: true }, time: [16, 10],
    text: (f) => f.reported ? "방과 후.\n선생님과 이야기를 마치고 나오는 길,\n복도 끝에 서연이 서 있다." : "방과 후.\n텅 빈 복도 끝에\n서연이 혼자 서 있다.",
    chat: (f) => [
      ["서연", f.joined ? "…너도 그 방에 있었지." : "…아, 너구나."],
      ["서연", "아까 누가 내 영상을 보면서 지나갔어."],
      ["서연", "웃으면서. 나를 모르는 척하고."],
      ["서연", "그 웃음소리가 하루 종일 안 잊혀."]
    ],
    choices: [
      { text: "“네 잘못 아니야.”라고 말해 준다.", say: "네 잘못 아니야.", reply: ["서연", "…그렇게 말해준 사람, 처음이야."], set: { supported: true }, spread: -100, feedback: "서연이 처음으로 고개를 들었다." },
      { text: "아무 말도 못 하고 곁에 서 있는다.", sys: "…(곁에 서 있는다)", reply: ["서연", "…옆에 있어 줘서 고마워."], spread: 100, feedback: "아무 말도 못 했다. 그래도 떠나지 않았다." },
      { text: "“…먼저 갈게.”라며 돌아선다.", say: "…먼저 갈게.", reply: ["서연", "…응. 잘 가."], set: { ignored: true }, spread: 300, bad: true, feedback: "등 뒤에서 오래, 시선이 느껴졌다." }
    ]
  },
  {
    label: "SCENE 05", title: "마지막 선택", icon: "🌅", idle: 2, room: { name: "서연", sub: "접속 중" }, time: [12, 35],
    text: (f) => f.reported ? "다음 날 점심시간.\n선생님이 상황을 알게 되셨다.\n서연이 조용히 묻는다. “그래도… 아직 남아 있어.”" : "다음 날 점심시간.\n서연이 조용히 묻는다.\n“아직 영상이 남아 있어. 어떡하지?”",
    chat: (f) => [
      ["서연", f.reported ? "선생님이 오셨는데, 어디서부터 말해야 할지 모르겠어." : "혼자서는 못 하겠어."],
      ["서연", "누가 알게 되면 더 이상해질까 봐 무서워."],
      ["서연", "…근데 너라면, 말해도 될 것 같아서."],
      ["나", "…"]
    ],
    choices: [
      { text: "함께 선생님께 가서 삭제를 요청한다.", say: "같이 선생님께 가자. 내가 옆에 있을게.", reply: ["서연", "…응. 같이 가."], ending: "good", spread: -9999, feedback: "서연의 손을 잡았다. 차가웠다." },
      { text: "곁에 있어 주기만 한다.", say: "…내가 옆에 있을게.", reply: ["서연", "그래도… 고마워."], ending: "normal", spread: -100, feedback: "곁에 있다는 것. 그게 전부일까." },
      { text: "더 이상 관여하지 않는다.", say: "미안, 난 더 못 하겠어.", reply: ["서연", "…알겠어."], ending: "bad", spread: 800, bad: true, feedback: "돌아섰다. 이번에도." }
    ]
  }
];

/* ---------- 효과 ---------- */
let ac;
function getAC() { ac = ac || new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === "suspended") ac.resume(); return ac; }
function beep(f = 880, d = .08, type = "sine", v = .05) {
  try {
    if (bgm.muted()) return;
    getAC();
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.value = f; g.gain.value = v;
    o.connect(g); g.connect(ac.destination); o.start();
    g.gain.exponentialRampToValueAtTime(.0001, ac.currentTime + d);
    o.stop(ac.currentTime + d);
  } catch (e) {}
}
/* ---------- BGM: 직접 생성하는 배경음악 (저작권 걱정 없음) ----------
   어두울 땐 비 소리 + 낮은 단조 패드 + 외로운 음, 밝아질수록 장조 + 맑은 종소리 */
const bgm = (() => {
  let on = false, muted = false, master, filt, rainG, light = 0, tgt = 0, step = 0, nextT = 0, timer;
  const mid = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const minor = [[57, 60, 64], [53, 57, 60], [50, 53, 57], [52, 55, 59]];
  const major = [[60, 64, 67], [55, 59, 62], [57, 60, 64], [53, 57, 60]];
  const note = (f, t, dur, type, vol, atk) => {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.value = f;
    g.gain.setValueAtTime(.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + atk);
    g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.connect(g); g.connect(filt); o.start(t); o.stop(t + dur + .1);
  };
  function schedule(t) {
    const L = light, bar = Math.floor(step / 8), ch = (L < .5 ? minor : major)[bar % 4];
    if (step % 8 === 0) {
      ch.forEach((m, i) => { note(mid(m + (L > .5 ? 0 : -12)), t, 5, "triangle", .04, 1.4); note(mid(m + (L > .5 ? 12 : 0)) * 1.003, t, 5, "sine", .022, 1.6); });
      note(mid(ch[0] - 24), t, 4, "sine", .1, .06);
    }
    if (Math.random() < L * .6) note(mid(ch[Math.floor(Math.random() * 3)] + 12 + (Math.random() < .4 ? 12 : 0)), t, 1.6, "sine", .035, .005);
    else if (L < .4 && step % 4 === 2 && Math.random() < .55) note(mid(ch[Math.floor(Math.random() * 3)] + 12), t, 2.4, "sine", .05, .01);
    step++;
  }
  return {
    muted: () => muted,
    hush() { if (master) master.gain.setTargetAtTime(0, ac.currentTime, .35); },
    restore() { if (master) master.gain.setTargetAtTime(muted ? 0 : .8, ac.currentTime, .3); },
    melody() {
      if (!on || muted) return; const t0 = ac.currentTime + .1;
      master.gain.setTargetAtTime(1, ac.currentTime, .3);
      [[64, 0], [67, .55], [69, 1.1], [72, 1.7], [71, 2.4], [67, 2.95], [69, 3.5], [76, 4.3]].forEach(([m, dt]) => { note(mid(m + 12), t0 + dt, 2.4, "sine", .1, .02); note(mid(m), t0 + dt, 2.4, "triangle", .04, .05); });
    },
    setLight: (v) => { tgt = v; },
    toggle() {
      muted = !muted; $("muteBtn").textContent = muted ? "🔇" : "🔊";
      if (master) master.gain.setTargetAtTime(muted ? 0 : .8, ac.currentTime, .15);
    },
    start() {
      if (on) return; on = true; getAC();
      master = ac.createGain(); master.gain.value = 0; master.gain.setTargetAtTime(muted ? 0 : .8, ac.currentTime, 1.2);
      filt = ac.createBiquadFilter(); filt.type = "lowpass"; filt.frequency.value = 800; filt.connect(master); master.connect(ac.destination);
      const buf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const src = ac.createBufferSource(); src.buffer = buf; src.loop = true;
      const bp = ac.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 2600; bp.Q.value = .5;
      rainG = ac.createGain(); rainG.gain.value = 0; src.connect(bp); bp.connect(rainG); rainG.connect(master); src.start();
      nextT = ac.currentTime + .1;
      timer = setInterval(() => {
        light += (tgt - light) * .06;
        filt.frequency.setTargetAtTime(700 + light * 3800, ac.currentTime, .5);
        rainG.gain.setTargetAtTime(.06 * Math.max(0, 1 - light * 1.4), ac.currentTime, .5);
        while (nextT < ac.currentTime + .6) { schedule(nextT); nextT += .5; }
      }, 150);
    }
  };
})();
document.addEventListener("visibilitychange", () => { if (ac) document.hidden ? ac.suspend() : ac.resume(); });
$("muteBtn").addEventListener("click", () => bgm.toggle());
$("fitBtn").addEventListener("click", () => { wideMode = !wideMode; try { localStorage.setItem("wide", wideMode ? "1" : "0"); } catch (e) {} fit(); });
fit();

function vibrate(p) { try { navigator.vibrate && navigator.vibrate(p); } catch (e) {} }
function flash(cls) {
  const f = $("flash");
  f.className = ""; void f.offsetWidth; f.className = cls;
}
function shake() {
  const s = document.querySelector(".game-shell");
  s.classList.remove("shake"); void s.offsetWidth; s.classList.add("shake");
}
function setLight(v) { bgm.setLight(v); document.documentElement.style.setProperty("--light", v); }
const val = (v) => (typeof v === "function" ? v(flags) : v);
const wait = (ms) => new Promise(r => setTimeout(r, ms));

/* ---------- 조회수 ---------- */
function setViews(v) {
  views = Math.max(0, Math.round(v));
  $("viewCount").textContent = views.toLocaleString();
}
function bumpViews(delta) {
  setViews(views + delta);
  const el = $("viewCount").parentElement;
  el.classList.remove("pulse"); void el.offsetWidth; el.classList.add("pulse");
}
function startViewTick() {
  clearInterval(viewTick);
  viewTick = setInterval(() => {
    const rate = flags.reported ? 2 : flags.supported ? 8 : 18 + sceneIndex * 8;
    setViews(views + Math.floor(Math.random() * rate) + 1);
  }, 400);
}

/* ---------- 화면 ---------- */
function show(screen) {
  [introScreen, storyScreen, endingScreen, creditsScreen].forEach(s => s.classList.add("hidden"));
  screen.classList.remove("hidden");
}
function stopAll() { clearInterval(viewTick); clearInterval(timerTick); runId++; }

function startGame() {
  bgm.start(); bgm.restore();
  stopAll();
  csTimers.forEach(clearTimeout); $("cutscene").classList.add("hidden");
  flags = { supported: false, joined: false, reported: false, ignored: false };
  sceneIndex = 0; reactions = []; lightAdj = 0; history = []; gameStart = performance.now();
  setViews(12);
  show(storyScreen);
  startViewTick();
  renderScene();
}

/* ---------- 메신저 UI ---------- */
const AVC = { "민수": "#6c8cff", "지훈": "#ff8a65", "하은": "#4dd0a8", "서연": "#b388ff", "나": "#72d9e8" };
let lastSender = null;
const fmtTime = (h, m) => `${h < 12 ? "오전" : "오후"} ${h % 12 || 12}:${String(m).padStart(2, "0")}`;
const msgTime = (scene, k) => (scene.room.live ? null : fmtTime(scene.time[0], scene.time[1] + Math.floor(k / 2)));
const setSub = (t) => { $("chatSub").textContent = t; };
function setHead(scene) {
  const r = scene.room, av = $("chatAv");
  $("chatHead").classList.remove("hidden");
  $("chatName").textContent = r.name; setSub(r.sub);
  av.textContent = r.group ? "👥" : r.live ? "📍" : r.name[0];
  av.style.background = r.group || r.live ? "#3a4468" : (AVC[r.name] || "#7d88a8");
}
function avatar(name, show) {
  const av = document.createElement("div"); av.className = "av";
  if (show) { av.style.background = AVC[name] || "#7d88a8"; av.textContent = name[0]; }
  return av;
}
function addTyping(chat, name) {
  const row = document.createElement("div"); row.className = "msg other";
  row.appendChild(avatar(name, lastSender !== name));
  const b = document.createElement("div"); b.className = "chat-bubble other typing"; b.innerHTML = "<i></i><i></i><i></i>";
  row.appendChild(b); chat.appendChild(row); return row;
}
function addSys(chat, text) {
  const d = document.createElement("div"); d.className = "cs-sys"; d.textContent = text;
  chat.appendChild(d); lastSender = null;
}
function addMsg(chat, name, message, opt = {}) {
  const me = name === "나", first = lastSender !== name;
  const row = document.createElement("div"); row.className = `msg ${me ? "me" : "other"}${opt.react ? " has-react" : ""}`;
  if (!me) row.appendChild(avatar(name, first));
  const col = document.createElement("div"); col.className = "col";
  if (!me && first) { const n = document.createElement("span"); n.className = "nm"; n.textContent = name; col.appendChild(n); }
  const b = document.createElement("div"); b.className = `chat-bubble ${me ? "me" : "other"}`;
  if (message.startsWith("[동영상]")) {
    b.classList.add("vbub");
    b.innerHTML = '<div class="vcard"><div class="vthumb"><span>▶</span></div><div class="vmeta"><b></b><small>0:48 · 조회 2회</small></div></div>';
    b.querySelector("b").textContent = message.replace("[동영상]", "").trim();
  } else b.textContent = message;
  col.appendChild(b);
  if (opt.react) { const r = document.createElement("span"); r.className = "react"; r.textContent = opt.react; col.appendChild(r); }
  row.appendChild(col);
  if (opt.time || opt.unread) {
    const m = document.createElement("div"); m.className = "meta";
    if (opt.unread) { const u = document.createElement("em"); u.className = "unread"; u.textContent = "1"; m.appendChild(u); }
    if (opt.time) { const t = document.createElement("span"); t.textContent = opt.time; m.appendChild(t); }
    me ? row.insertBefore(m, col) : row.appendChild(m);
  }
  chat.appendChild(row); lastSender = name; return row;
}

async function renderScene() {
  const id = ++runId, scene = scenes[sceneIndex];
  locked = true;
  setLight(Math.max(0, Math.min(1, [0, .2, .4, .6, .85][sceneIndex] + lightAdj)));
  const card = document.querySelector(".story-card");
  card.classList.remove("scene-in"); void card.offsetWidth; card.classList.add("scene-in");
  const text = val(scene.text), chatArr = val(scene.chat);
  storyScreen.classList.remove("danger");
  $("chapter").textContent = `${scene.label} / 0${scenes.length}`;
  $("sceneLabel").textContent = scene.label;
  $("sceneTitle").textContent = scene.title;
  $("sceneIcon").textContent = scene.icon;
  $("progressText").textContent = `STORY ${sceneIndex + 1} / ${scenes.length}`;
  $("storyText").textContent = "";
  $("feedback").classList.add("hidden");
  $("choices").innerHTML = "";
  $("timerText").textContent = (TIME_LIMIT / 1000).toFixed(1);
  const fill = $("timerFill");
  fill.style.transition = "none"; fill.style.width = "100%";
  const chat = $("chatArea"); chat.innerHTML = "";
  chat.classList.toggle("hidden", !chatArr);
  flash("ping"); beep(660, .1, "triangle", .06);

  // 타자 효과
  for (let i = 1; i <= text.length; i++) {
    $("storyText").textContent = text.slice(0, i);
    await wait(14); if (id !== runId) return;
  }
  // 메시지 순차 등장 (메신저 UI)
  lastSender = null; chatArr && setHead(scene); $("chatHead").classList.toggle("hidden", !chatArr);
  let mi = 0;
  for (const [name, message, react] of chatArr || []) {
    if (name !== "나") {
      const tr = addTyping(chat, name); setSub(name + " 입력 중…");
      await wait(Math.min(650, 220 + message.length * 12)); if (id !== runId) return;
      tr.remove(); setSub(scene.room.sub);
    } else { await wait(350); if (id !== runId) return; }
    addMsg(chat, name, message, { time: msgTime(scene, mi++), react });
    beep(name === "나" ? 520 : 880, .06, "sine", .04); vibrate(30);
    await wait(150); if (id !== runId) return;
  }
  await wait(150); if (id !== runId) return;

  scene.choices.forEach((choice, i) => {
    const btn = document.createElement("button");
    btn.className = "choice-btn"; btn.style.animationDelay = `${i * 70}ms`;
    btn.innerHTML = `<span class="choice-number">0${i + 1}</span>`;
    const l = document.createElement("span"); l.textContent = choice.text;
    btn.appendChild(l);
    btn.addEventListener("click", () => choose(i, false));
    $("choices").appendChild(btn);
  });
  startTimer(id);
}

function startTimer(id) { locked = false; sceneStart = performance.now(); }  // 시간제한 없음

function choose(i, timedOut) {
  if (locked) return; locked = true;
  clearInterval(timerTick);
  const scene = scenes[sceneIndex], choice = scene.choices[i], id = runId;
  reactions.push(timedOut ? TIME_LIMIT : performance.now() - sceneStart);
  storyScreen.classList.remove("danger");
  $("timerFill").style.transition = "none";
  $("timerFill").style.width = getComputedStyle($("timerFill")).width;

  const tone = timedOut || choice.bad ? "bad" : (choice.set && choice.set.supported) || choice.ending === "good" ? "good" : "mid";
  history.push(tone); lightAdj += tone === "bad" ? -.1 : tone === "good" ? .1 : 0;
  if (choice.set) Object.assign(flags, choice.set);
  bumpViews(choice.spread < -5000 ? -views : choice.spread);

  [...$("choices").children].forEach((b, k) => {
    b.disabled = true;
    b.classList.add(k === i ? "picked" : "dim");
  });
  const fb = $("feedback");
  fb.textContent = (timedOut ? "⏱ 망설이는 사이 시간이 지나갔다. " : "") + (choice.feedback || "");
  fb.classList.toggle("bad", !!(choice.bad || timedOut));
  fb.classList.remove("hidden");

  if (choice.bad || timedOut) { shake(); flash("alert"); beep(150, .25, "sawtooth", .06); vibrate([80, 40, 80]); }
  else { flash("good"); beep(990, .12, "sine", .06); }

  (async () => {
    const chat = $("chatArea"), n = (val(scene.chat) || []).length;
    await wait(150); if (id !== runId) return;
    if (choice.say) {
      const r = addMsg(chat, "나", choice.say, { time: msgTime(scene, n), unread: true });
      beep(520, .06, "sine", .05); vibrate(25);
      setTimeout(() => { const u = r.querySelector(".unread"); u && u.remove(); }, 450);
    } else if (choice.sys) addSys(chat, choice.sys);
    if (!choice.reply) return;
    await wait(550); if (id !== runId) return;
    const [rn, rm] = choice.reply, tr = addTyping(chat, rn); setSub(rn + " 입력 중…");
    await wait(400); if (id !== runId) return;
    tr.remove(); setSub(scene.room.sub);
    addMsg(chat, rn, rm, { time: msgTime(scene, n + 1) }); beep(880, .06, "sine", .04); vibrate(30);
  })();

  setTimeout(() => {
    if (id !== runId) return;
    if (choice.ending) showEnding(choice.ending);
    else { sceneIndex++; renderScene(); }
  }, FEEDBACK_MS);
}

let endTime;
function showEnding(type) {
  clearInterval(viewTick); clearInterval(timerTick);
  endTime = performance.now();
  if (type === "normal") return revealEnding(type);
  playCutscene(type, () => revealEnding(type));
}

/* ---------- 엔딩 컷씬 ---------- */
let csTimers = [];
function playCutscene(type, done) {
  const cs = $("cutscene"), log = $("csScreen"), cap = $("csCaption"), phone = $("csPhone");
  csTimers.forEach(clearTimeout); csTimers = [];
  cs.className = `cutscene ${type}`;
  log.innerHTML = ""; cap.className = "cs-caption"; cap.textContent = "";
  $("csFade").className = "cs-fade";
  let finished = false;
  const finish = () => {
    if (finished) return; finished = true;
    csTimers.forEach(clearTimeout); cs.classList.add("hidden"); done();
  };
  $("csSkip").onclick = finish;
  const at = (ms, fn) => csTimers.push(setTimeout(() => { if (!finished) fn(); }, ms * .68));  // 쇼츠용 압축
  const caption = (t) => { cap.textContent = t; cap.className = "cs-caption"; void cap.offsetWidth; cap.className = "cs-caption on"; };
  const say = (who, msg, snd) => {
    const b = document.createElement("div");
    if (who === "sys") { b.className = "cs-sys"; b.textContent = msg; }
    else {
      b.className = `chat-bubble ${who === "나" ? "me" : "other"}`;
      b.innerHTML = `<span class="chat-name"></span><span class="chat-message"></span>`;
      b.querySelector(".chat-name").textContent = who;
      b.querySelector(".chat-message").textContent = msg;
    }
    log.appendChild(b);
    while (log.children.length > 7) log.removeChild(log.firstChild);
    if (type === "bad") { phone.classList.remove("buzz"); void phone.offsetWidth; phone.classList.add("buzz"); vibrate(25); }
    snd && snd();
  };
  const ping = () => beep(880, .06, "sine", .04);
  const down = () => beep(140, .35, "sawtooth", .05);
  const up = (f) => () => beep(f, .25, "sine", .06);

  setLight(type === "bad" ? .02 : .25);
  const typing = () => { const t = document.createElement("div"); t.className = "chat-bubble other typing"; t.innerHTML = "<i></i><i></i><i></i>"; log.appendChild(t); return t; };
  if (type === "bad") {
    $("csTitle").textContent = "단체방 · 99+";
    caption("그날 밤, 단체방은 멈추지 않았다.");
    [["민수","ㅋㅋㅋㅋㅋㅋㅋ"],["지훈","[영상] 조회 3,204"],["다른반","헐 이거 뭐야"],["민수","캡처해서 올려ㅋㅋ"],["지훈","[영상] 조회 8,911"]]
      .forEach(([w, m], i) => at(500 + i * 380, () => say(w, m, ping)));
    at(3000, () => { log.innerHTML = ""; $("csTitle").textContent = "서연"; caption("그리고, 서연의 마지막 메시지."); });
    at(3700, () => say("서연", "…괜찮아. 신경 쓰지 마.", down));
    at(4800, () => say("sys", "읽음 · 답장 없음", down));
    let tp;
    at(5800, () => { tp = typing(); $("csTitle").textContent = "서연 · 입력 중…"; });
    at(7600, () => { tp && tp.remove(); $("csTitle").textContent = "서연"; bgm.hush(); say("sys", "서연님이 채팅방을 나갔습니다.", down); });
    at(8700, () => caption("마지막 메시지는, 끝내 도착하지 않았다."));
    at(10300, () => $("csFade").className = "cs-fade on");
    at(11200, finish);
  } else {
    $("csTitle").textContent = "서연";
    caption("다음 날 아침.");
    at(700, () => say("sys", "🗑 영상이 삭제되었습니다", up(660)));
    at(1700, () => say("서연", "선생님이 다 처리해 주셨어.", ping));
    at(2800, () => say("서연", "있잖아, 그날 내가 했던 별 얘기.", ping));
    at(3900, () => say("서연", "다시 해보고 싶어. 맨 앞에서 들어줄래?", up(784)));
    at(4800, () => { cs.classList.add("sunrise"); setLight(1); bgm.melody(); });
    at(5300, () => say("나", "응. 제일 앞에서 들을게.", ping));
    at(6500, () => say("서연", "내일 봐. 😊", up(988)));
    at(7400, () => caption("마지막 메시지는, 첫 인사가 되었다."));
    at(9600, () => $("csFade").className = "cs-fade on");
    at(10500, finish);
  }
}

function revealEnding(type) {
  show(endingScreen);
  const data = {
    good: { symbol: "✦", eyebrow: "GOOD ENDING · 작은 용기", title: "함께 만든 변화",
      description: "당신은 서연의 이야기를 끝까지 듣고, 믿을 수 있는 어른에게 함께 도움을 요청했습니다. 영상은 삭제되었고, 서연은 별 이야기를 다시 해보기로 했습니다. 이번엔 맨 앞자리에서 들어줄 사람이 있습니다.",
      message: "한마디의 용기와 안전한 도움 요청이 변화의 시작이 될 수 있습니다." },
    normal: { symbol: "◇", eyebrow: "NORMAL ENDING · 곁에 있기", title: "혼자가 아니라는 것",
      description: "당신은 서연의 곁을 지켰습니다. 마음은 조금 가벼워졌지만, 영상은 아직 온라인에 남아 있습니다.",
      message: "공감에 ‘어른에게 알리기’까지 더하면 문제를 끝낼 수 있어요." },
    bad: { symbol: "…", eyebrow: "BAD ENDING · 멈추지 않은 상황", title: "남겨진 메시지",
      description: "당신은 지켜보기만 했고, 영상은 계속 퍼졌습니다. 서연은 그날 이후, 별 이야기를 하지 않았습니다.",
      message: "지금이라도 상황을 알리고 도움을 요청하면 변화를 시작할 수 있어요." }
  }[type];
  data.description += type === "good" && flags.joined ? " 처음엔 함께 웃었지만, 마지막엔 돌아왔습니다." : type === "bad" && flags.supported ? " 한때는 용기를 냈지만, 끝까지 가지 못했습니다." : type === "normal" && flags.reported ? " 어른에게 알린 용기가 서연에게 작은 방패가 되었습니다." : "";
  $("endingQuote").textContent = { good: "“그때 네가 먼저 말해줘서, 나도 버틸 수 있었어.”", normal: "“옆에 있어 줘서 고마워. 그래도… 아직은 무서워.”", bad: "“…괜찮아. 나 혼자 할게.”" }[type];
  setLight(type === "good" ? 1 : type === "normal" ? .6 : .05);
  const total = ((endTime - gameStart) / 1000).toFixed(1);
  const avg = (reactions.reduce((a, b) => a + b, 0) / reactions.length / 1000).toFixed(1);
  const timeouts = reactions.filter(r => r >= TIME_LIMIT).length;
  $("chapter").textContent = "ENDING · 0" + (type === "good" ? "1" : type === "normal" ? "2" : "3");
  $("endingSymbol").textContent = data.symbol;
  $("endingEyebrow").textContent = data.eyebrow;
  $("endingTitle").textContent = data.title;
  $("endingDescription").textContent = data.description;
  $("endingMessage").textContent = data.message;
  $("endingStats").innerHTML =
    `<div><b>${total}s</b><span>플레이 시간</span></div>` +
    `<div><b>${views.toLocaleString()}</b><span>최종 영상 조회</span></div>` +
    `<div><b>${avg}s</b><span>평균 결정 속도</span></div>` +
    `<div><b>${history.filter(h => h === "good").length}/${history.length}</b><span>용기 낸 선택</span></div>` +
    `<div class="recap"><span>선택 기록</span>${history.map(h => `<i class="d ${h}"></i>`).join("")}</div>`;
  flash(type === "bad" ? "alert" : "good");
  beep(type === "good" ? 880 : 220, .4, "sine", .06);
}

$("startBtn").addEventListener("click", startGame);
$("restartBtn").addEventListener("click", startGame);
$("creditsBtn").addEventListener("click", () => show(creditsScreen));
$("homeBtn").addEventListener("click", () => { stopAll(); $("chapter").textContent = "PROLOGUE · 01"; setLight(0); show(introScreen); });
