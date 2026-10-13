//#region src/audio/sfx.ts
var e = (e) => 440 * 2 ** ((e - 69) / 12), t = (t, n, r, i = "square", a = .5) => t.map((t, o) => ({
	at: o * n,
	freq: e(t),
	dur: r,
	type: i,
	vol: a
})), n = {
	move: { notes: [{
		at: 0,
		freq: 1320,
		dur: .018,
		vol: .18
	}] },
	rotate: { notes: [{
		at: 0,
		freq: 740,
		to: 1180,
		dur: .045,
		vol: .22
	}] },
	softDrop: { notes: [{
		at: 0,
		freq: 300,
		dur: .012,
		type: "triangle",
		vol: .25
	}] },
	hardDrop: {
		notes: [{
			at: 0,
			freq: 220,
			to: 70,
			dur: .11,
			type: "square",
			vol: .4
		}],
		noise: .06
	},
	lock: { notes: [{
		at: 0,
		freq: 196,
		dur: .05,
		type: "triangle",
		vol: .55
	}] },
	hold: { notes: t([76, 83], .045, .05, "square", .25) },
	holdRefused: { notes: t([43, 43], .06, .035, "square", .22) },
	clear1: { notes: t([72, 79], .06, .08) },
	clear2: { notes: t([
		72,
		76,
		79
	], .055, .08) },
	clear3: { notes: t([
		72,
		76,
		79,
		84
	], .05, .08) },
	clear4: { notes: [...t([
		72,
		76,
		79,
		84,
		88,
		91
	], .045, .09), ...t([60, 67], .09, .14, "triangle", .6)] },
	spin: { notes: [{
		at: 0,
		freq: 600,
		to: 2400,
		dur: .16,
		vol: .25
	}] },
	allClear: { notes: t([
		84,
		88,
		91,
		96,
		91,
		96
	], .07, .1) },
	levelUp: { notes: [
		...t([
			67,
			72,
			76,
			79
		], .06, .07, "square", .4),
		{
			at: .24,
			freq: e(84),
			dur: .32,
			vol: .45
		},
		{
			at: .24,
			freq: e(60),
			dur: .32,
			type: "triangle",
			vol: .6
		}
	] },
	gameOver: { notes: [...t([
		72,
		67,
		64,
		60,
		55
	], .16, .18, "square", .4), {
		at: .8,
		freq: e(48),
		dur: .5,
		type: "triangle",
		vol: .6
	}] },
	menuMove: { notes: [{
		at: 0,
		freq: 990,
		dur: .03,
		vol: .2
	}] },
	menuSelect: { notes: t([79, 84], .05, .07, "square", .3) },
	pause: { notes: t([79, 72], .06, .07, "square", .3) },
	ready: { notes: [{
		at: 0,
		freq: e(72),
		dur: .1,
		vol: .35
	}] },
	go: { notes: [{
		at: 0,
		freq: e(84),
		dur: .18,
		vol: .35
	}] },
	type: { notes: [{
		at: 0,
		freq: 1500,
		dur: .02,
		vol: .15
	}] }
}, r = class {
	isMuted;
	context = null;
	master = null;
	noiseBuffer = null;
	constructor(e = !1) {
		this.isMuted = e;
	}
	get muted() {
		return this.isMuted;
	}
	set muted(e) {
		e && !this.isMuted && this.context && this.master && (this.master.disconnect(), this.master = this.createMaster(this.context)), this.isMuted = e;
	}
	unlock() {
		try {
			if (!this.context) {
				let e = window.AudioContext ?? window.webkitAudioContext;
				if (!e) return;
				this.context = new e(), this.master = this.createMaster(this.context);
			}
			this.context.state === "suspended" && this.context.resume();
		} catch {
			this.context = null;
		}
	}
	play(e, t = 0) {
		let r = this.context, i = this.master;
		if (this.muted || !r || !i || r.state !== "running") return;
		let a = n[e], o = r.currentTime + .005 + t;
		for (let e of a.notes) this.tone(r, i, o, e);
		a.noise && this.noise(r, i, o, a.noise);
	}
	close() {
		this.context?.close(), this.context = null, this.master = null;
	}
	createMaster(e) {
		let t = e.createGain();
		return t.gain.value = .16, t.connect(e.destination), t;
	}
	tone(e, t, n, r) {
		let i = e.createOscillator(), a = e.createGain(), o = n + r.at, s = o + r.dur;
		i.type = r.type ?? "square", i.frequency.setValueAtTime(r.freq, o), r.to && i.frequency.exponentialRampToValueAtTime(r.to, s);
		let c = r.vol ?? .5;
		a.gain.setValueAtTime(0, o), a.gain.linearRampToValueAtTime(c, o + .004), a.gain.setValueAtTime(c, Math.max(o + .004, s - .02)), a.gain.linearRampToValueAtTime(0, s), i.connect(a), a.connect(t), i.start(o), i.stop(s + .01);
	}
	noise(e, t, n, r) {
		if (!this.noiseBuffer) {
			let t = Math.floor(e.sampleRate * .25);
			this.noiseBuffer = e.createBuffer(1, t, e.sampleRate);
			let n = this.noiseBuffer.getChannelData(0);
			for (let e = 0; e < t; e += 1) n[e] = Math.random() * 2 - 1;
		}
		let i = e.createBufferSource();
		i.buffer = this.noiseBuffer;
		let a = e.createGain();
		a.gain.setValueAtTime(.35, n), a.gain.exponentialRampToValueAtTime(.001, n + r), i.connect(a), a.connect(t), i.start(n), i.stop(n + r + .01);
	}
}, i = [
	"I",
	"O",
	"T",
	"S",
	"Z",
	"J",
	"L"
], a = {
	I: 4,
	O: 4,
	T: 3,
	S: 3,
	Z: 3,
	J: 3,
	L: 3
}, o = {
	I: [
		[0, 1],
		[1, 1],
		[2, 1],
		[3, 1]
	],
	O: [
		[1, 0],
		[2, 0],
		[1, 1],
		[2, 1]
	],
	T: [
		[1, 0],
		[0, 1],
		[1, 1],
		[2, 1]
	],
	S: [
		[1, 0],
		[2, 0],
		[0, 1],
		[1, 1]
	],
	Z: [
		[0, 0],
		[1, 0],
		[1, 1],
		[2, 1]
	],
	J: [
		[0, 0],
		[0, 1],
		[1, 1],
		[2, 1]
	],
	L: [
		[2, 0],
		[0, 1],
		[1, 1],
		[2, 1]
	]
}, s = (e, t) => e.map(([e, n]) => [t - 1 - n, e]), c = (e) => e.sort((e, t) => e[1] - t[1] || e[0] - t[0]), l = Object.fromEntries(i.map((e) => {
	let t = a[e], n = [], r = [...o[e]];
	for (let i = 0; i < 4; i += 1) n.push(c([...r])), r = e === "O" ? r : s(r, t);
	return [e, n];
}));
function u(e, t) {
	return l[e][t];
}
var d = (e, t) => ((e + t) % 4 + 4) % 4, f = {
	"0>1": [
		[0, 0],
		[-1, 0],
		[-1, -1],
		[0, 2],
		[-1, 2]
	],
	"1>0": [
		[0, 0],
		[1, 0],
		[1, 1],
		[0, -2],
		[1, -2]
	],
	"1>2": [
		[0, 0],
		[1, 0],
		[1, 1],
		[0, -2],
		[1, -2]
	],
	"2>1": [
		[0, 0],
		[-1, 0],
		[-1, -1],
		[0, 2],
		[-1, 2]
	],
	"2>3": [
		[0, 0],
		[1, 0],
		[1, -1],
		[0, 2],
		[1, 2]
	],
	"3>2": [
		[0, 0],
		[-1, 0],
		[-1, 1],
		[0, -2],
		[-1, -2]
	],
	"3>0": [
		[0, 0],
		[-1, 0],
		[-1, 1],
		[0, -2],
		[-1, -2]
	],
	"0>3": [
		[0, 0],
		[1, 0],
		[1, -1],
		[0, 2],
		[1, 2]
	]
}, ee = {
	"0>1": [
		[0, 0],
		[-2, 0],
		[1, 0],
		[-2, 1],
		[1, -2]
	],
	"1>0": [
		[0, 0],
		[2, 0],
		[-1, 0],
		[2, -1],
		[-1, 2]
	],
	"1>2": [
		[0, 0],
		[-1, 0],
		[2, 0],
		[-1, -2],
		[2, 1]
	],
	"2>1": [
		[0, 0],
		[1, 0],
		[-2, 0],
		[1, 2],
		[-2, -1]
	],
	"2>3": [
		[0, 0],
		[2, 0],
		[-1, 0],
		[2, -1],
		[-1, 2]
	],
	"3>2": [
		[0, 0],
		[-2, 0],
		[1, 0],
		[-2, 1],
		[1, -2]
	],
	"3>0": [
		[0, 0],
		[1, 0],
		[-2, 0],
		[1, 2],
		[-2, -1]
	],
	"0>3": [
		[0, 0],
		[-1, 0],
		[2, 0],
		[-1, -2],
		[2, 1]
	]
}, p = [[0, 0]];
function m(e, t, n) {
	return e === "O" ? p : (e === "I" ? ee : f)[`${t}>${n}`] ?? p;
}
var te = class e {
	rows;
	constructor() {
		this.rows = Array.from({ length: 40 }, () => h());
	}
	static fromRows(t) {
		let n = new e(), r = 40 - t.length;
		return t.forEach((e, t) => {
			if (e.length !== 10) throw Error(`row ${t} is ${e.length} wide, not 10`);
			n.rows[r + t] = [...e].map((e) => e === "." ? null : ne(e) ? e : "G");
		}), n;
	}
	get(e, t) {
		return this.rows[t]?.[e] ?? null;
	}
	isBlocked(e, t) {
		return e < 0 || e >= 10 || t >= 40 ? !0 : t < 0 ? !1 : this.rows[t][e] !== null;
	}
	collides(e, t, n, r) {
		return u(e, t).some(([e, t]) => this.isBlocked(n + e, r + t));
	}
	place(e, t, n, r) {
		for (let [i, a] of u(e, t)) {
			let t = this.rows[r + a];
			t && (t[n + i] = e);
		}
	}
	fullRows() {
		let e = [];
		return this.rows.forEach((t, n) => {
			t.every((e) => e !== null) && e.push(n);
		}), e;
	}
	removeRows(e) {
		let t = new Set(e), n = this.rows.filter((e, n) => !t.has(n)), r = Array.from({ length: 40 - n.length }, () => h());
		this.rows.splice(0, this.rows.length, ...r, ...n);
	}
	isEmpty() {
		return this.rows.every((e) => e.every((e) => e === null));
	}
	greyRow(e) {
		let t = this.rows[e];
		t && (this.rows[e] = t.map((e) => e === null ? null : "G"));
	}
	toRows(e = 20) {
		return this.rows.slice(e).map((e) => e.map((e) => e ?? ".").join(""));
	}
}, h = () => Array.from({ length: 10 }, () => null), ne = (e) => "IOTSZJL".includes(e), re = class {
	queue = [];
	random;
	constructor(e) {
		this.random = e;
	}
	next() {
		return this.fill(1), this.queue.shift();
	}
	peek(e) {
		return this.fill(e), this.queue.slice(0, e);
	}
	fill(e) {
		for (; this.queue.length < e;) this.queue.push(...ie(i, this.random));
	}
};
function ie(e, t) {
	let n = [...e];
	for (let e = n.length - 1; e > 0; --e) {
		let r = Math.floor(t() * (e + 1));
		[n[e], n[r]] = [n[r], n[e]];
	}
	return n;
}
var ae = [
	0,
	100,
	300,
	500,
	800
], oe = [
	100,
	200,
	400
], se = [
	400,
	800,
	1200,
	1600
], ce = [
	0,
	800,
	1200,
	1800,
	2e3
], le = 3200, ue = 1.5;
function de(e, t) {
	return e + Math.floor(t / 10);
}
function fe(e) {
	return (Math.floor(e / 10) + 1) * 10;
}
function pe(e) {
	let t = Math.min(Math.max(e, 1), 20);
	return (.8 - (t - 1) * .007) ** (t - 1) * 1e3;
}
function me(e, t) {
	return e === 4 || t !== "none" && e > 0;
}
function he(e, t) {
	return t === "full" ? se[Math.min(e, 3)] : t === "mini" ? oe[Math.min(e, 2)] : ae[Math.min(e, 4)];
}
function ge(e) {
	let { lines: t, spin: n, level: r, combo: i, backToBack: a, perfectClear: o } = e, s = he(t, n);
	return a && (s *= ue), t > 0 && i > 0 && (s += 50 * i), o && t > 0 && (s += a && t === 4 ? le : ce[t]), Math.floor(s * r);
}
var _e = 4, ve = [
	[0, 0],
	[2, 0],
	[0, 2],
	[2, 2]
], ye = {
	0: [[0, 0], [2, 0]],
	1: [[2, 0], [2, 2]],
	2: [[0, 2], [2, 2]],
	3: [[0, 0], [0, 2]]
}, be = class {
	board;
	startLevel;
	phase = "falling";
	piece = null;
	held = null;
	canHold = !0;
	score = 0;
	lines = 0;
	level;
	combo = -1;
	backToBackReady = !1;
	piecesPlaced = 0;
	elapsedMs = 0;
	lastClear = null;
	clearingRows = [];
	clearTimerMs = 0;
	bag;
	sequence;
	lockDelayMs;
	maxLockResets;
	clearDelayMs;
	dasMs;
	arrMs;
	softDropFactor;
	gravityProgress = 0;
	lockTimerMs = 0;
	lockResets = 0;
	lowestY = 0;
	lastMoveWasRotation = !1;
	lastKickIndex = 0;
	heldKeys = {
		left: !1,
		right: !1,
		softDrop: !1
	};
	shiftDirection = 0;
	bufferedTurns = 0;
	bufferedHold = !1;
	dasTimerMs = 0;
	arrTimerMs = 0;
	events = [];
	constructor(e = {}) {
		this.startLevel = Math.max(1, Math.floor(e.startLevel ?? 1)), this.level = this.startLevel, this.board = e.board ?? new te(), this.bag = new re(e.random ?? Math.random), this.sequence = [...e.sequence ?? []], this.lockDelayMs = e.lockDelayMs ?? 500, this.maxLockResets = e.maxLockResets ?? 15, this.clearDelayMs = e.clearDelayMs ?? 320, this.dasMs = e.dasMs ?? 167, this.arrMs = e.arrMs ?? 33, this.softDropFactor = e.softDropFactor ?? 20, this.spawn(this.deal());
	}
	get preview() {
		let e = this.sequence.slice(0, 5);
		return [...e, ...this.bag.peek(5 - e.length)];
	}
	get isOver() {
		return this.phase === "over";
	}
	get lockProgress() {
		return this.phase !== "falling" || !this.isGrounded() ? 0 : Math.min(1, this.lockTimerMs / Math.max(1, this.lockDelayMs));
	}
	ghostY() {
		let e = this.piece;
		if (!e) return null;
		let t = e.y;
		for (; !this.board.collides(e.kind, e.rotation, e.x, t + 1);) t += 1;
		return t;
	}
	drainEvents() {
		let e = this.events;
		return this.events = [], e;
	}
	press(e) {
		if (this.phase !== "over") switch (e) {
			case "left":
			case "right":
				this.heldKeys[e] = !0, this.startShift(e === "left" ? -1 : 1);
				break;
			case "softDrop":
				this.heldKeys.softDrop = !0;
				break;
			case "hardDrop":
				this.hardDrop();
				break;
			case "rotateCW":
			case "rotateCCW":
			case "hold": this.phase === "clearing" ? this.pressLater(e) : e === "hold" ? this.hold() : this.rotate(e === "rotateCW" ? 1 : -1);
		}
	}
	pressLater(e) {
		e === "hold" ? this.bufferedHold = !0 : (e === "rotateCW" || e === "rotateCCW") && (this.bufferedTurns += e === "rotateCW" ? 1 : -1);
	}
	applyPressedLater() {
		this.phase === "falling" && this.applyBufferedInput();
	}
	release(e) {
		if (e === "left" || e === "right") {
			this.heldKeys[e] = !1;
			let t = e === "left" ? -1 : 1;
			if (this.shiftDirection === t) {
				let t = e === "left" ? "right" : "left";
				this.shiftDirection = this.heldKeys[t] ? t === "left" ? -1 : 1 : 0, this.dasTimerMs = 0, this.arrTimerMs = 0;
			}
		} else e === "softDrop" && (this.heldKeys.softDrop = !1);
	}
	releaseAll() {
		this.heldKeys.left = !1, this.heldKeys.right = !1, this.heldKeys.softDrop = !1, this.shiftDirection = 0, this.dasTimerMs = 0, this.arrTimerMs = 0;
	}
	update(e) {
		this.phase === "over" || e <= 0 || (this.elapsedMs += e, this.updateAutoShift(e), this.phase === "clearing" ? (this.clearTimerMs -= e, this.clearTimerMs <= 0 && this.finishClear()) : (this.updateGravity(e), this.updateLock(e)));
	}
	startShift(e) {
		this.shiftDirection = e, this.dasTimerMs = 0, this.arrTimerMs = 0, this.phase === "falling" && this.shift(e);
	}
	updateAutoShift(e) {
		if (this.shiftDirection === 0) return;
		let t = this.dasTimerMs;
		if (this.dasTimerMs += e, !(this.dasTimerMs < this.dasMs || this.phase !== "falling")) {
			if (this.arrTimerMs += t < this.dasMs ? this.dasTimerMs - this.dasMs : e, this.arrMs <= 0) for (; this.shift(this.shiftDirection););
			else for (t < this.dasMs && this.shift(this.shiftDirection); this.arrTimerMs >= this.arrMs;) if (this.arrTimerMs -= this.arrMs, !this.shift(this.shiftDirection)) {
				this.arrTimerMs = 0;
				break;
			}
		}
	}
	shift(e) {
		let t = this.piece;
		if (!t || this.board.collides(t.kind, t.rotation, t.x + e, t.y)) return !1;
		let n = this.isGrounded();
		return this.piece = {
			...t,
			x: t.x + e
		}, this.lastMoveWasRotation = !1, this.afterManipulation(n), this.events.push({ type: "move" }), !0;
	}
	rotate(e) {
		let t = this.piece;
		if (!t || this.phase !== "falling") return;
		let n = d(t.rotation, e), r = m(t.kind, t.rotation, n);
		for (let e = 0; e < r.length; e += 1) {
			let [i, a] = r[e];
			if (!this.board.collides(t.kind, n, t.x + i, t.y + a)) {
				let r = this.isGrounded();
				this.piece = {
					kind: t.kind,
					rotation: n,
					x: t.x + i,
					y: t.y + a
				}, this.lastMoveWasRotation = !0, this.lastKickIndex = e, this.afterManipulation(r), this.events.push({
					type: "rotate",
					spin: this.detectSpin()
				});
				return;
			}
		}
	}
	afterManipulation(e) {
		this.trackLowest(), (e || this.isGrounded()) && this.lockResets < this.maxLockResets && (this.lockResets += 1, this.lockTimerMs = 0);
	}
	trackLowest() {
		this.piece && this.piece.y > this.lowestY && (this.lowestY = this.piece.y, this.lockResets = 0, this.lockTimerMs = 0);
	}
	isGrounded() {
		let e = this.piece;
		return !!e && this.board.collides(e.kind, e.rotation, e.x, e.y + 1);
	}
	stepDown() {
		let e = this.piece;
		return !e || this.isGrounded() ? !1 : (this.piece = {
			...e,
			y: e.y + 1
		}, this.lastMoveWasRotation = !1, this.trackLowest(), !0);
	}
	updateGravity(e) {
		let t = pe(this.level), n = this.heldKeys.softDrop, r = n ? Math.min(t, t / this.softDropFactor) : t;
		this.gravityProgress += e / r;
		let i = !1;
		for (; this.gravityProgress >= 1;) {
			if (!this.stepDown()) {
				this.gravityProgress = 0;
				break;
			}
			--this.gravityProgress, i = !0, n && (this.score += 1);
		}
		i && n && this.events.push({ type: "softDrop" });
	}
	updateLock(e) {
		this.isGrounded() && (this.lockTimerMs += e, (this.lockTimerMs >= this.lockDelayMs || this.lockResets >= this.maxLockResets) && this.lockPiece());
	}
	hardDrop() {
		let e = this.piece;
		if (!e || this.phase !== "falling") return;
		let t = this.ghostY(), n = t - e.y;
		n > 0 && (this.piece = {
			...e,
			y: t
		}, this.lastMoveWasRotation = !1), this.score += n * 2, this.events.push({
			type: "hardDrop",
			distance: n
		}), this.lockPiece();
	}
	hold() {
		let e = this.piece;
		if (!e || this.phase !== "falling") return;
		if (!this.canHold) {
			this.events.push({ type: "holdRefused" });
			return;
		}
		let t = this.held ?? this.deal();
		this.held = e.kind, this.events.push({
			type: "hold",
			kind: e.kind
		}), this.spawn(t), this.canHold = !1;
	}
	detectSpin() {
		let e = this.piece;
		if (!e || e.kind !== "T" || !this.lastMoveWasRotation) return "none";
		let t = (t, n) => this.board.isBlocked(e.x + t, e.y + n);
		return ve.filter(([e, n]) => t(e, n)).length < 3 ? "none" : ye[e.rotation].filter(([e, n]) => t(e, n)).length === 2 || this.lastKickIndex === _e ? "full" : "mini";
	}
	lockPiece() {
		let e = this.piece;
		if (!e) return;
		let t = this.detectSpin();
		this.board.place(e.kind, e.rotation, e.x, e.y), this.piece = null, this.piecesPlaced += 1;
		let n = this.board.fullRows(), r = n.length, i = this.lockedEntirelyAbove(e), a = !1;
		if (r > 0) {
			this.combo += 1;
			let e = me(r, t);
			a = e && this.backToBackReady, this.backToBackReady = e;
		} else this.combo = -1;
		let o = r > 0 && this.isPerfectClearAfter(n), s = ge({
			lines: r,
			spin: t,
			level: this.level,
			combo: this.combo,
			backToBack: a,
			perfectClear: o
		});
		this.score += s;
		let c = {
			kind: e.kind,
			cells: g(e),
			lines: r,
			rows: n,
			spin: t,
			combo: this.combo,
			backToBack: a,
			perfectClear: o,
			points: s
		};
		if (this.events.push({
			type: "lock",
			...c
		}), (r > 0 || t !== "none") && (this.lastClear = c), r > 0) {
			this.lines += r;
			let e = de(this.startLevel, this.lines);
			e > this.level && (this.level = e, this.events.push({
				type: "levelUp",
				level: e
			})), this.phase = "clearing", this.clearingRows = n, this.clearTimerMs = this.clearDelayMs, this.clearDelayMs <= 0 && this.finishClear();
		} else i ? this.endGame() : this.spawn(this.deal());
	}
	finishClear() {
		this.board.removeRows(this.clearingRows), this.clearingRows = [], this.phase = "falling", this.spawn(this.deal()), this.applyBufferedInput();
	}
	applyBufferedInput() {
		let e = this.bufferedHold, t = (this.bufferedTurns % 4 + 4) % 4;
		if (this.bufferedHold = !1, this.bufferedTurns = 0, this.phase === "falling") {
			if (e && this.hold(), t === 3) this.rotate(-1);
			else for (let e = 0; e < t; e += 1) this.rotate(1);
		}
	}
	lockedEntirelyAbove(e) {
		return g(e).every(([, e]) => e < 20);
	}
	isPerfectClearAfter(e) {
		let t = new Set(e);
		for (let e = 0; e < 40; e += 1) if (!t.has(e)) {
			for (let t = 0; t < 10; t += 1) if (this.board.get(t, e) !== null) return !1;
		}
		return !0;
	}
	deal() {
		return this.sequence.shift() ?? this.bag.next();
	}
	spawn(e) {
		let t = Math.floor((10 - a[e]) / 2), n = 20 - (e === "I");
		for (let r of [
			n,
			n - 1,
			n - 2
		]) if (!this.board.collides(e, 0, t, r)) {
			if (this.piece = {
				kind: e,
				rotation: 0,
				x: t,
				y: r
			}, this.canHold = !0, this.gravityProgress = 0, this.lockTimerMs = 0, this.lockResets = 0, this.lowestY = r, this.lastMoveWasRotation = !1, this.lastKickIndex = 0, this.events.push({
				type: "spawn",
				kind: e
			}), pe(this.level) <= .8333333333333334) for (; this.stepDown(););
			this.shiftDirection !== 0 && this.dasTimerMs >= this.dasMs && this.shift(this.shiftDirection);
			return;
		}
		this.piece = {
			kind: e,
			rotation: 0,
			x: t,
			y: n
		}, this.endGame();
	}
	endGame() {
		this.phase = "over", this.releaseAll(), this.events.push({ type: "gameOver" });
	}
};
function g(e) {
	return u(e.kind, e.rotation).map(([t, n]) => [e.x + t, e.y + n]);
}
//#endregion
//#region src/core/random.ts
function xe(e) {
	let t = e >>> 0;
	return () => {
		t = t + 1831565813 >>> 0;
		let e = t;
		return e = Math.imul(e ^ e >>> 15, e | 1), e ^= e + Math.imul(e ^ e >>> 7, e | 61), ((e ^ e >>> 14) >>> 0) / 4294967296;
	};
}
//#endregion
//#region src/assets/orange-kid.woff2
var Se = "data:font/woff2;base64,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", Ce = .078;
function we(e) {
	let t = e * Ce;
	return Math.round(Math.min(.5, t * .62) * 255);
}
function Te(e) {
	return Math.min(e, 255 - e);
}
function Ee(e) {
	let t = 0;
	for (let n = 3; n < e.length; n += 4) t += Te(e[n]);
	return t;
}
function De(e, t, n, r) {
	let i = new Uint8Array(t * n), a = t, o = n, s = -1, c = -1;
	for (let l = 0; l < n; l += 1) for (let n = 0; n < t; n += 1) e[(l * t + n) * 4 + 3] >= r && (i[l * t + n] = 1, a = Math.min(a, n), s = Math.max(s, n), o = Math.min(o, l), c = Math.max(c, l));
	return {
		mask: i,
		box: s < 0 ? null : {
			left: a,
			top: o,
			right: s,
			bottom: c
		}
	};
}
//#endregion
//#region src/render/pixelFont.ts
var Oe = "Pallet Blocks Orange Kid", _ = 12.5, ke = 6, Ae = 32, v = 22, y = 4, je = [
	0,
	.25,
	.5,
	.75
], b = null;
function Me() {
	return b ??= (async () => {
		try {
			let e = new FontFace(Oe, `url(${Se})`);
			return document.fonts.add(e), await e.load(), !0;
		} catch {
			return !1;
		}
	})(), b;
}
var Ne = class {
	capHeight;
	lineHeight;
	glyphs = /* @__PURE__ */ new Map();
	tinted = /* @__PURE__ */ new Map();
	scratch;
	constructor() {
		let e = document.createElement("canvas");
		e.width = 44, e.height = Ae, this.scratch = e.getContext("2d", { willReadFrequently: !0 });
		let t = this.glyph("H");
		this.capHeight = t.height || 8, this.lineHeight = this.capHeight + 4;
	}
	measure(e, t = 1) {
		let n = 0;
		for (let t of e) n += this.glyph(t).advance;
		return Math.max(0, n - 1) * t;
	}
	draw(e, t, n, r, i) {
		let a = i.scale ?? 1, o = this.measure(t, a), s = i.align ?? "left", c = Math.floor(s === "center" ? n - o / 2 : s === "right" ? n - o : n), l = Math.floor(r), u = (n, r, i) => this.stamp(e, t, c + n, l + r, i, a);
		if (i.depth) for (let e = 1; e <= i.depth.px; e += 1) for (let [t, n] of x) u(t * a, (n + e) * a, i.depth.color);
		if (i.outline) for (let [e, t] of x) u(e * a, t * a, i.outline);
		i.shadow && u(a, a, i.shadow), u(0, 0, i.color);
	}
	stamp(e, t, n, r, i, a) {
		let o = n;
		for (let n of t) {
			let t = this.glyph(n);
			if (t.width > 0) {
				let s = this.tint(n, t, i);
				e.drawImage(s, o, r + (this.capHeight + t.top) * a, t.width * a, t.height * a);
			}
			o += t.advance * a;
		}
	}
	tint(e, t, n) {
		let r = `${e}\u0000${typeof n == "string" ? n : n.join(",")}`, i = this.tinted.get(r);
		if (i) return i;
		i = document.createElement("canvas"), i.width = t.width, i.height = t.height;
		let a = i.getContext("2d"), o = typeof n == "string" ? [n] : n;
		for (let e = 0; e < t.height; e += 1) {
			let n = e + this.capHeight + t.top;
			a.fillStyle = o[Math.min(o.length - 1, Math.max(0, Math.floor(n / this.capHeight * o.length)))];
			for (let n = 0; n < t.width; n += 1) t.mask[e * t.width + n] && a.fillRect(n, e, 1, 1);
		}
		return this.tinted.set(r, i), i;
	}
	glyph(e) {
		let t = this.glyphs.get(e);
		return t || (t = this.rasterise(e), this.glyphs.set(e, t)), t;
	}
	rasterise(e) {
		if (e === " ") return {
			mask: /* @__PURE__ */ new Uint8Array(),
			width: 0,
			height: 0,
			top: 0,
			advance: y
		};
		let t = this.scratch, { width: n, height: r } = t.canvas;
		t.font = `${_}px "${Oe}", monospace`, t.textBaseline = "alphabetic", t.fillStyle = "#000";
		let i = null, a = Infinity;
		for (let o of je) {
			t.clearRect(0, 0, n, r), t.fillText(e, ke + o, v);
			let s = t.getImageData(0, 0, n, r).data, c = Ee(s);
			c < a && (a = c, i = s);
		}
		let { mask: o, box: s } = De(i, n, r, we(_));
		if (!s) return {
			mask: /* @__PURE__ */ new Uint8Array(),
			width: 0,
			height: 0,
			top: 0,
			advance: y
		};
		let c = s.right - s.left + 1, l = s.bottom - s.top + 1, u = new Uint8Array(c * l);
		for (let e = 0; e < l; e += 1) for (let t = 0; t < c; t += 1) u[e * c + t] = o[(s.top + e) * n + s.left + t];
		return {
			mask: u,
			width: c,
			height: l,
			top: s.top - v,
			advance: c + 1
		};
	}
}, x = [
	[-1, -1],
	[0, -1],
	[1, -1],
	[-1, 0],
	[1, 0],
	[-1, 1],
	[0, 1],
	[1, 1]
], S = [
	"RESUME",
	"RESTART",
	"QUIT"
], C = ["PLAY AGAIN", "TITLE"];
function Pe(e) {
	return {
		kind: "paused",
		cursor: 0,
		readyElapsedMs: e.kind === "ready" ? e.elapsedMs : null
	};
}
function Fe(e) {
	return {
		kind: "ready",
		elapsedMs: e.readyElapsedMs ?? 0
	};
}
function Ie(e, t, n) {
	return t.kind === "paused" ? e : e + n;
}
function w(e, t, n) {
	return ((e + t) % n + n) % n;
}
function Le(e, t) {
	return Math.min(15, Math.max(1, e + t));
}
function Re(e, t) {
	let n = t === null || t.trim() === "" ? NaN : Number(t);
	return Le(Math.floor(e ?? (Number.isFinite(n) ? n : 1)), 0);
}
//#endregion
//#region src/render/palette.ts
var T = "#202020", E = "#5d5c47", D = "#171717", ze = "#ebeac5", O = "#f8f7dd", Be = "#d3d2a9", Ve = "#183c52", He = "#1c455e", Ue = "#0b1220", We = "#ebeac5", Ge = "#9cafc7", k = "#f0c454", Ke = "#f2e5ab", A = "#b0201c", qe = "rgba(11, 18, 32, 0.55)", Je = "#05080f", j = "#0b1220", Ye = "#152238", Xe = [
	"#fffbe6",
	"#ffe58a",
	"#ffd04a",
	"#f4a933"
], Ze = "#2c5aa0", Qe = "#1c3768", M = {
	I: {
		light: "#b4f0a0",
		base: "#5cc062",
		dark: "#2c7438"
	},
	O: {
		light: "#a8d0ff",
		base: "#4f8fd8",
		dark: "#28508e"
	},
	T: {
		light: "#ffbc8a",
		base: "#e2603a",
		dark: "#8e2c16"
	},
	S: {
		light: "#fff2a8",
		base: "#f0c454",
		dark: "#9c7418"
	},
	Z: {
		light: "#ffbadc",
		base: "#e070b0",
		dark: "#8c346a"
	},
	J: {
		light: "#c2f8ec",
		base: "#55d6be",
		dark: "#1e8270"
	},
	L: {
		light: "#d2bcff",
		base: "#8a6ad0",
		dark: "#4a3486"
	},
	G: {
		light: "#c4c2b4",
		base: "#8c8a80",
		dark: "#4e4c46"
	}
}, N = 8, P = 16, F = {
	x: 85,
	y: 21,
	width: 86,
	height: 166
}, I = F.x + 3, $e = F.y + 3, L = 10 * N, et = 20 * N, tt = 19;
function R(e) {
	return e >= tt ? (e - 20) * N : null;
}
function nt(e) {
	return e.kind === "results" ? 20 : tt;
}
function z(e) {
	return e.kind !== "paused";
}
var B = 74, V = 5, rt = 177, H = {
	x: V,
	y: 21,
	width: B,
	height: 42
}, it = {
	x: V,
	y: 67,
	width: B,
	height: 58
}, at = {
	x: V,
	y: 129,
	width: B,
	height: 58
}, U = {
	x: rt,
	y: 21,
	width: B,
	height: 124
}, W = {
	x: rt,
	y: 149,
	width: B,
	height: 38
}, ot = 240, st = 21, ct = 90, lt = 140, ut = 70, dt = 40, ft = [
	-2,
	2,
	-1,
	1
], G = [
	0,
	.15,
	.3,
	.45
];
function pt(e) {
	let t = Math.floor(Math.min(Math.max(e, 0), 1) * G.length);
	return G[Math.min(t, G.length - 1)];
}
function mt(e) {
	return e < 0 ? 0 : ft[Math.floor(e / dt)] ?? 0;
}
var K = {
	color: Xe,
	outline: Ze,
	depth: {
		color: Qe,
		px: 1
	}
}, ht = class {
	ctx;
	font;
	constructor(e, t) {
		this.ctx = e, this.font = t;
	}
	draw(e) {
		let t = this.ctx;
		t.imageSmoothingEnabled = !1, this.backdrop(), e.screen.kind === "title" ? this.titleScreen(e) : (this.playfield(e), e.screen.kind === "paused" ? this.pauseMenu(e.screen.cursor) : e.screen.kind === "nameEntry" ? this.nameEntry(e, e.screen.name) : e.screen.kind === "results" && this.results(e, e.screen.cursor)), this.titleBar(e), this.helpBar(jt(e.screen, e.nowMs, e.focused));
	}
	backdrop() {
		let e = this.ctx;
		e.fillStyle = Ve, e.fillRect(0, 0, 256, 208), e.fillStyle = He;
		for (let t = 2; t < 208; t += 4) e.fillRect(0, t, 256, 2);
	}
	titleBar(e) {
		let t = this.ctx;
		t.fillStyle = Ue, t.fillRect(0, 0, 256, P), t.fillStyle = D, t.fillRect(0, P, 256, 1);
		let n = Math.floor((P - this.font.capHeight) / 2);
		this.text("PALLET BLOCKS", 6, n, { color: k });
		let r = [e.playerName, e.muted ? "SOUND OFF" : null].filter(Boolean).join("  ");
		r && this.text(r, 250, n, {
			color: Ge,
			align: "right"
		});
	}
	helpBar(e) {
		let t = this.ctx;
		t.fillStyle = D, t.fillRect(0, 191, 256, 1), t.fillStyle = Ue, t.fillRect(0, 192, 256, P), this.text(e, 128, 192 + Math.floor((P - this.font.capHeight) / 2), {
			color: We,
			align: "center"
		});
	}
	playfield(e) {
		let t = e.game;
		if (!t) return;
		this.window(H), this.heading("HOLD", H);
		let n = z(e.screen);
		if (t.held && n) {
			let n = e.holdRefusedAtMs === null ? 0 : mt(e.effectsMs - e.holdRefusedAtMs);
			this.previewPiece(t.held, H.x + n, H.y + 18, H.width, 18, !t.canHold);
		}
		this.stats(t, e), this.callout(e, t), this.window(U), this.heading("NEXT", U), n && t.preview.forEach((e, t) => {
			this.previewPiece(e, U.x, U.y + 18 + t * 21, U.width, 18, !1);
		}), this.window(W), this.heading(e.tableTitle === "LEADERBOARD" ? "TOP SCORE" : "BEST", W), this.text(q(kt(e.screen, e.best, t.score)), W.x + W.width - 6, W.y + 21, {
			color: T,
			align: "right"
		}), this.well(e, t);
	}
	stats(e, t) {
		let n = it;
		this.window(n);
		let r = n.x + 6, i = n.x + n.width - 6;
		this.heading("SCORE", n), this.text(q(e.score), i, n.y + 18, {
			color: T,
			align: "right"
		}), this.divider(n, n.y + 31);
		let a = t.banner?.kind === "level" ? t.banner : null, o = a ? t.effectsMs - a.atMs : Infinity, s = !!a && o < a.durationMs && Math.floor(o / 150) % 2 == 0;
		s && (this.ctx.fillStyle = Ke, this.ctx.fillRect(n.x + 3, n.y + 33, n.width - 6, 12)), this.text("LEVEL", r, n.y + 35, { color: s ? A : E }), this.text(String(e.level), i, n.y + 35, {
			color: s ? A : T,
			align: "right"
		}), this.text("LINES", r, n.y + 46, { color: E });
		let c = `/${fe(e.lines)}`;
		this.text(c, i, n.y + 46, {
			color: E,
			align: "right"
		}), this.text(String(e.lines), i - this.font.measure(c) - 1, n.y + 46, {
			color: T,
			align: "right"
		});
	}
	callout(e, t) {
		let n = at, r = e.callout;
		if (!r || e.effectsMs - r.atMs > 1800) {
			this.window(n), this.heading("TIME", n), this.text(At(t.elapsedMs), n.x + n.width - 6, n.y + 18, {
				color: T,
				align: "right"
			}), this.divider(n, n.y + 31), this.text("PIECES", n.x + 6, n.y + 35, { color: E }), this.text(String(t.piecesPlaced), n.x + n.width - 6, n.y + 35, {
				color: T,
				align: "right"
			});
			return;
		}
		if (this.window(n, O), gt(e.effectsMs - r.atMs)) return;
		let i = n.x + n.width / 2, a = n.y + 44, o = r.lines.slice(0, 4), s = this.font.capHeight + 2, c = n.y + 1 + Math.floor((a - n.y - 1 - (o.length * s - 2)) / 2);
		o.forEach((e, t) => {
			this.text(e, i, c + t * s, {
				color: t === 0 ? A : T,
				align: "center"
			});
		}), r.points > 0 && (this.divider(n, a), this.text(`+${q(r.points)}`, i, a + 3, {
			color: T,
			align: "center"
		}));
	}
	well(e, t) {
		let n = this.ctx, r = e.screen, i = e.trail && e.effectsMs - e.trail.atMs < ut ? 1 : 0;
		this.window({
			...F,
			y: F.y + i
		});
		let a = $e + i;
		if (n.fillStyle = j, n.fillRect(I, a, L, et), !z(r)) return;
		n.fillStyle = Ye;
		for (let e = 1; e < 10; e += 1) for (let t = 1; t < 20; t += 1) n.fillRect(I + e * N - 1, a + t * N - 1, 2, 2);
		let o = this.curtainRows(r), s = t.phase === "clearing" ? new Set(t.clearingRows) : null, c = s ? 1 - Math.max(0, t.clearTimerMs) / Math.max(1, t.clearDelayMs) : 0;
		for (let n = nt(r); n < 40; n += 1) {
			let r = 40 - n <= o;
			for (let i = 0; i < 10; i += 1) {
				let o = t.board.get(i, n);
				if (!o) continue;
				let l = I + i * N, u = a + R(n);
				if (s?.has(n)) {
					this.clearingCell(l, u, i, c, e.nowMs);
					continue;
				}
				let d = e.flash && e.effectsMs - e.flash.atMs < ct && e.flash.cells.some(([e, t]) => e === i && t === n);
				this.block(l, u, M[r ? "G" : o], d ? "flash" : "normal");
			}
		}
		this.dropTrail(e, a);
		let l = t.piece, u = r.kind === "playing" || r.kind === "ready";
		if (l && u) {
			let e = t.ghostY();
			if (e !== null && e !== l.y) for (let [t, n] of g({
				...l,
				y: e
			})) {
				let e = R(n);
				e !== null && this.ghost(I + t * N, a + e, M[l.kind]);
			}
			let r = pt(t.lockProgress);
			for (let [e, t] of g(l)) {
				let i = R(t);
				i !== null && (this.block(I + e * N, a + i, M[l.kind], "normal"), r > 0 && (n.fillStyle = j, n.globalAlpha = r, n.fillRect(I + e * N, a + i, N, N), n.globalAlpha = 1));
			}
		}
		if (u && e.banner && this.banner(e.banner, e.effectsMs, a), r.kind === "ready") {
			let e = r.elapsedMs < 700 ? "READY" : "GO!";
			r.elapsedMs < 1200 && this.text(e, I + L / 2, a + 56, {
				...K,
				align: "center",
				scale: 2
			});
		}
		r.kind === "toppingOut" && r.elapsedMs > 800 && (this.text("GAME", I + L / 2, a + 52, {
			...K,
			align: "center",
			scale: 2
		}), this.text("OVER", I + L / 2, a + 76, {
			...K,
			align: "center",
			scale: 2
		}));
	}
	banner(e, t, n) {
		let r = t - e.atMs;
		if (r >= e.durationMs || gt(r)) return;
		let i = this.font, a = I + L / 2, o = i.capHeight, s = (e) => i.measure(e, 2) + 4 <= L - 2 ? 2 : 1, c = [];
		for (let t of e.headers) c.push({
			text: t,
			height: o,
			big: !1,
			style: {
				color: k,
				outline: D
			}
		});
		for (let t of e.lines) {
			let e = s(t);
			c.push({
				text: t,
				height: e * o,
				big: !0,
				style: {
					...K,
					scale: e
				}
			});
		}
		e.footer && c.push({
			text: e.footer,
			height: o,
			big: !1,
			style: {
				color: O,
				outline: D
			}
		});
		let l = (e) => c[e].big && c[e + 1]?.big ? 8 : 5, u = c.reduce((e, t, n) => e + t.height + (n < c.length - 1 ? l(n) : 0), 0), d = Math.max(0, 4 - Math.floor(r / 40)), f = n + Math.round(et * .42 - u / 2) + d;
		c.forEach((e, t) => {
			this.text(e.text, a, f, {
				...e.style,
				align: "center"
			}), f += e.height + l(t);
		});
	}
	curtainRows(e) {
		return e.kind === "toppingOut" ? Math.min(st, Math.floor(e.elapsedMs / 40)) : e.kind === "nameEntry" || e.kind === "results" ? st : 0;
	}
	clearingCell(e, t, n, r, i) {
		if (Math.abs(n + .5 - 5) < r * 6) return;
		let a = this.ctx;
		a.fillStyle = Math.floor(i / 50) % 2 == 0 ? O : ze, a.fillRect(e, t, N, N);
	}
	dropTrail(e, t) {
		let n = e.trail;
		if (!n) return;
		let r = e.effectsMs - n.atMs;
		if (r >= lt) return;
		let i = this.ctx, a = M[n.kind], o = r / lt;
		for (let e of n.columns) {
			let n = e.fromY + (e.toY - e.fromY) * o, r = Math.max(n, 20) - 20, s = e.toY - 20;
			if (s <= r) continue;
			let c = t + Math.round(r * N), l = t + s * N;
			i.fillStyle = a.dark, i.fillRect(I + e.x * N + 2, c, 4, l - c), i.fillStyle = a.base, i.fillRect(I + e.x * N + 3, c, 2, l - c);
		}
	}
	block(e, t, n, r) {
		let i = this.ctx;
		if (r === "flash") {
			i.fillStyle = O, i.fillRect(e, t, N, N);
			return;
		}
		let a = r === "dim" ? M.G : n;
		i.fillStyle = a.base, i.fillRect(e, t, N, N), i.fillStyle = a.light, i.fillRect(e, t, 7, 1), i.fillRect(e, t + 1, 1, 6), i.fillStyle = a.dark, i.fillRect(e, t + N - 1, N, 1), i.fillRect(e + N - 1, t, 1, 7), i.fillStyle = O, i.fillRect(e + 1, t + 1, 2, 1), i.fillRect(e + 1, t + 2, 1, 1);
	}
	ghost(e, t, n) {
		let r = this.ctx;
		r.fillStyle = n.dark, r.fillRect(e + 1, t + 1, 6, 6), r.fillStyle = n.base, r.fillRect(e, t, N, 1), r.fillRect(e, t + N - 1, N, 1), r.fillRect(e, t + 1, 1, 6), r.fillRect(e + N - 1, t + 1, 1, 6), r.fillStyle = j, r.fillRect(e + 2, t + 2, 4, 4);
	}
	previewPiece(e, t, n, r, i, a) {
		let o = u(e, 0), s = o.map(([e]) => e), c = o.map(([, e]) => e), l = Math.min(...s), d = Math.min(...c), f = (Math.max(...s) - l + 1) * N, ee = (Math.max(...c) - d + 1) * N, p = t + Math.floor((r - f) / 2), m = n + Math.floor((i - ee) / 2);
		for (let [t, n] of o) this.block(p + (t - l) * N, m + (n - d) * N, M[e], a ? "dim" : "normal");
	}
	pauseMenu(e) {
		let t = {
			x: I + 6,
			y: 70,
			width: L - 12,
			height: 62
		};
		this.window(t), this.text("PAUSED", t.x + t.width / 2, t.y + 6, {
			color: A,
			align: "center"
		}), this.divider(t, t.y + 19), this.menu(S, e, t.x + 12, t.y + 24, 12);
	}
	nameEntry(e, t) {
		let n = {
			x: 40,
			y: 54,
			width: 176,
			height: 84
		};
		this.shade(), this.window(n);
		let r = n.x + n.width / 2;
		this.text("NEW HIGH SCORE!", r, n.y + 7, {
			color: A,
			align: "center"
		}), this.text(q(e.game?.score ?? 0), r, n.y + 21, {
			color: T,
			align: "center"
		}), this.divider(n, n.y + 35), this.text("ENTER YOUR NAME", r, n.y + 40, {
			color: E,
			align: "center"
		});
		let i = {
			x: r - 49,
			y: n.y + 54,
			width: 98,
			height: 18
		};
		this.window(i, O);
		let { textX: a, caretX: o } = St(r, this.font.measure(t));
		this.text(t, a, i.y + 5, { color: T }), Math.floor(e.nowMs / 400) % 2 == 0 && (this.ctx.fillStyle = T, this.ctx.fillRect(o, i.y + 4, 1, this.font.capHeight + 1));
	}
	results(e, t) {
		let n = e.game, r = {
			x: 28,
			y: 22,
			width: 200,
			height: 164
		};
		this.shade(), this.window(r);
		let i = r.x + r.width / 2;
		this.text("GAME OVER", i, r.y + 6, {
			...K,
			align: "center",
			scale: 2
		});
		let a = r.x + 10, o = r.x + r.width - 10;
		n && [
			["SCORE", q(n.score)],
			["LEVEL", String(n.level)],
			["LINES", String(n.lines)]
		].forEach(([e, t], n) => {
			let i = r.x + Math.round(r.width * (2 * n + 1) / 6);
			this.text(e, i, r.y + 29, {
				color: E,
				align: "center"
			}), this.text(t, i, r.y + 40, {
				color: T,
				align: "center"
			});
		}), this.divider(r, r.y + 54), this.text(e.tableTitle, i, r.y + 59, {
			color: A,
			align: "center"
		});
		let s = Ot(e.table, e.highlight, 6);
		s.length === 0 && this.text("NO SCORES YET", i, r.y + 86, {
			color: E,
			align: "center"
		}), s.forEach(({ entry: t, rank: n, mine: i }, s) => {
			let c = r.y + 73 + s * 11;
			i && (this.ctx.fillStyle = Math.floor(e.nowMs / 300) % 2 == 0 ? k : Be, this.ctx.fillRect(r.x + 4, c - 2, r.width - 8, 11)), this.text(`${n}`, a + 8, c, {
				color: E,
				align: "right"
			}), this.text(t.name, a + 16, c, { color: T }), this.text(q(t.score), o, c, {
				color: T,
				align: "right"
			});
		}), this.divider(r, r.y + r.height - 21);
		let c = r.y + r.height - 15;
		C.forEach((e, n) => {
			let i = n === 0 ? r.x + 24 : r.x + r.width - 70;
			this.text(e, i, c, { color: T }), n === t && this.cursor(i - 7, c + 1);
		});
	}
	titleScreen(e) {
		this.fallingDecor(e.nowMs), this.text("PALLET", 128, 26, {
			...K,
			align: "center",
			scale: 3
		}), this.text("BLOCKS", 128, 56, {
			...K,
			align: "center",
			scale: 3
		});
		let t = {
			x: 125,
			y: 94,
			width: 110,
			height: 92
		}, n = 14 + e.titleItems.length * 13, r = {
			x: 21,
			y: t.y + Math.floor((t.height - n) / 2),
			width: 96,
			height: n
		};
		this.window(r);
		let i = e.screen.kind === "title" ? e.screen.cursor : 0;
		this.menu(e.titleItems, i, r.x + 12, r.y + 8, 13), this.window(t), this.heading(e.tableTitle, t);
		let a = Ot(e.table, -1, 6);
		a.length === 0 && this.text("NO SCORES YET", t.x + t.width / 2, t.y + 40, {
			color: E,
			align: "center"
		}), a.forEach(({ entry: e, rank: n }, r) => {
			let i = t.y + 19 + r * 12, a = q(e.score), o = Dt(t, this.font.measure(a));
			this.text(`${n}`, o.rankRight, i, {
				color: E,
				align: "right"
			}), this.text(Ct(e.name, o.nameWidth, (e) => this.font.measure(e)), o.nameX, i, { color: T }), this.text(a, o.scoreRight, i, {
				color: T,
				align: "right"
			});
		});
	}
	fallingDecor(e) {
		[
			"T",
			"I",
			"S",
			"L",
			"O",
			"Z",
			"J",
			"T"
		].forEach((t, n) => {
			let r = 4 + n * 37 % 224, i = .012 + n % 3 * .004, a = Math.floor((e * i + n * 61) % 256 - 32), o = n % 4;
			for (let [e, n] of u(t, o)) {
				let t = r + e * N, i = a + n * N;
				this.ctx.fillStyle = Qe, this.ctx.fillRect(t, i, N, N), this.ctx.fillStyle = Ve, this.ctx.fillRect(t + 1, i + 1, 6, 6);
			}
		});
	}
	menu(e, t, n, r, i) {
		e.forEach((e, a) => {
			this.text(e, n, r + a * i, { color: T }), a === t && this.cursor(n - 7, r + a * i + 1);
		});
	}
	cursor(e, t) {
		let n = this.ctx;
		n.fillStyle = T, [
			1,
			2,
			3,
			2,
			1
		].forEach((r, i) => n.fillRect(e, t + i, r, 1));
	}
	window(e, t = ze) {
		let n = this.ctx, { x: r, y: i, width: a, height: o } = e;
		n.fillStyle = qe, n.fillRect(r + 2, i + o, a - 2, 2), n.fillRect(r + a, i + 2, 2, o - 2), n.fillStyle = t, n.fillRect(r + 1, i + 1, a - 2, o - 2), n.fillStyle = D, n.fillRect(r + 1, i, a - 2, 1), n.fillRect(r + 1, i + o - 1, a - 2, 1), n.fillRect(r, i + 1, 1, o - 2), n.fillRect(r + a - 1, i + 1, 1, o - 2);
	}
	heading(e, t) {
		this.text(e, t.x + 6, t.y + 5, { color: A });
	}
	divider(e, t) {
		this.ctx.fillStyle = Be, this.ctx.fillRect(e.x + 4, t, e.width - 8, 1);
	}
	shade() {
		this.ctx.fillStyle = "rgba(11, 18, 32, 0.6)", this.ctx.fillRect(0, 17, 256, 174);
	}
	text(e, t, n, r) {
		this.font.draw(this.ctx, e, t, n, r);
	}
};
function gt(e) {
	return e < ot && Math.floor(e / 60) % 2 == 1;
}
function q(e) {
	return Math.floor(e).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
var _t = [
	"ENTER SELECT   ARROWS CHOOSE   M SOUND",
	"LEFT RIGHT MOVE   DOWN SOFT DROP",
	"Z X UP TURN   SPACE HARD DROP",
	"C SHIFT HOLD   P ESC PAUSE"
], vt = 2600, yt = "CLICK HERE TO PLAY", bt = 4, xt = 2;
function St(e, t) {
	let n = t > 0 ? xt : 0, r = Math.floor(e - (t + n + 1) / 2);
	return {
		textX: r,
		caretX: r + t + n
	};
}
function Ct(e, t, n) {
	if (n(e) <= t) return e;
	for (let r = e.length - 1; r > 0; --r) {
		let i = `${e.slice(0, r).trimEnd()}.`;
		if (n(i) <= t) return i;
	}
	return "";
}
var wt = 10, Tt = 5, Et = 6;
function Dt(e, t) {
	let n = e.x + wt, r = n + Tt, i = e.x + e.width - Et;
	return {
		rankRight: n,
		nameX: r,
		nameWidth: i - t - bt - r,
		scoreRight: i
	};
}
function Ot(e, t, n) {
	let r = e.slice(0, n).map((e, n) => ({
		entry: e,
		rank: n + 1,
		mine: n === t
	})), i = e[t];
	return t >= n && i && r.length > 0 && (r[r.length - 1] = {
		entry: i,
		rank: t + 1,
		mine: !0
	}), r;
}
function kt(e, t, n) {
	return e.kind === "results" ? t : Math.max(t, n);
}
function At(e) {
	let t = Math.floor(e / 1e3);
	return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
}
function jt(e, t, n) {
	if (!n) return yt;
	switch (e.kind) {
		case "title": return _t[Math.floor(t / vt) % _t.length];
		case "ready":
		case "playing": return "Z X TURN  C HOLD  SPACE DROP  P PAUSE";
		case "paused": return "ENTER SELECT   ESC RESUME";
		case "toppingOut": return "";
		case "nameEntry": return "TYPE YOUR NAME   ENTER SAVE   ESC SKIP";
		case "results": return "ARROWS CHOOSE   ENTER SELECT   ESC TITLE";
	}
}
//#endregion
//#region src/app/callouts.ts
var Mt = [
	"",
	"SINGLE",
	"DOUBLE",
	"TRIPLE",
	"QUAD"
];
function Nt(e) {
	let t = [];
	return e.spin !== "none" && t.push(e.spin === "mini" ? "T-SPIN MINI" : "T-SPIN"), e.lines > 0 && t.push(Mt[Math.min(e.lines, 4)]), e.perfectClear && t.push("PERFECT", "CLEAR"), e.backToBack && t.push(`B2B x${ue}`), e.combo > 0 && t.push(`COMBO x${e.combo}`), t.slice(0, 4);
}
var Pt = 1100, Ft = 1500;
function It(e) {
	let t = e.backToBack ? ["BACK-TO-BACK"] : [], n;
	if (e.perfectClear) t.push("PERFECT"), n = ["CLEAR!"];
	else if (e.spin === "full" && e.lines > 0) n = ["T-SPIN", Mt[Math.min(e.lines, 3)]];
	else if (e.lines >= 4) n = ["QUAD!"];
	else return null;
	return {
		kind: "clear",
		headers: t,
		lines: n,
		footer: `+${q(e.points)}`,
		durationMs: Pt
	};
}
function Lt(e) {
	return {
		kind: "level",
		headers: ["LEVEL UP!"],
		lines: [`LV ${e}`],
		footer: null,
		durationMs: Ft
	};
}
//#endregion
//#region src/app/borrow.ts
function Rt(e, t) {
	let n = e.getAttribute("class") !== null, r = e.classList.contains(t.className), i = Object.keys(t.attributes).map((t) => ({
		name: t,
		value: e.getAttribute(t)
	})), a = Object.keys(t.style).map((t) => ({
		name: t,
		value: e.style.getPropertyValue(t),
		priority: e.style.getPropertyPriority(t)
	}));
	e.classList.add(t.className);
	for (let [n, r] of Object.entries(t.attributes)) e.setAttribute(n, r);
	for (let [n, r] of Object.entries(t.style)) e.style.setProperty(n, r);
	return () => {
		r || e.classList.remove(t.className), !n && e.getAttribute("class") === "" && e.removeAttribute("class");
		for (let { name: t, value: n } of i) n === null ? e.removeAttribute(t) : e.setAttribute(t, n);
		for (let { name: t, value: n, priority: r } of a) n === "" ? e.style.removeProperty(t) : e.style.setProperty(t, n, r);
	};
}
var zt = 1e3 / 60;
function Bt(e, t) {
	return e === null ? 0 : Math.min(250, Math.max(0, t - e));
}
function Vt(e, t) {
	let n = t;
	for (; n > 0 && !e.isOver;) {
		let t = Math.min(n, zt);
		e.update(t), n -= t;
	}
}
var Ht = "pallet-blocks:high-scores:v1";
function J(e) {
	return [...e].sort((e, t) => t.score - e.score);
}
function Ut(e, t, n = 10) {
	return t <= 0 ? !1 : e.length < n || t > J(e)[n - 1].score;
}
function Wt(e, t, n = 10) {
	if (!Ut(e, t.score, n)) return {
		table: J(e).slice(0, n),
		rank: -1
	};
	let r = J(e), i = r.findIndex((e) => t.score > e.score);
	return i < 0 && (i = r.length), r.splice(i, 0, t), {
		table: r.slice(0, n),
		rank: i
	};
}
function Y(e, t = "PLAYER") {
	return e.toUpperCase().replace(/[^A-Z0-9 .!?'-]/g, "").replace(/\s+/g, " ").trim().slice(0, 10).trim() || t;
}
function Gt(e) {
	return e.length === 1 && /^[A-Za-z0-9 .!?'-]$/.test(e);
}
function Kt(e) {
	if (!e) return [];
	try {
		let t = JSON.parse(e);
		return Array.isArray(t) ? J(t.filter((e) => typeof e == "object" && !!e && typeof e.name == "string" && typeof e.score == "number" && Number.isFinite(e.score)).map((e) => ({
			name: Y(e.name),
			score: Math.max(0, Math.floor(e.score)),
			lines: typeof e.lines == "number" ? e.lines : void 0,
			level: typeof e.level == "number" ? e.level : void 0
		}))).slice(0, 10) : [];
	} catch {
		return [];
	}
}
var qt = class {
	key;
	constructor(e = Ht) {
		this.key = e;
	}
	load() {
		try {
			return Kt(window.localStorage.getItem(this.key));
		} catch {
			return [];
		}
	}
	save(e) {
		try {
			window.localStorage.setItem(this.key, JSON.stringify(e));
		} catch {}
	}
}, Jt = {
	ArrowLeft: "left",
	ArrowRight: "right",
	ArrowDown: "softDrop",
	ArrowUp: "rotateCW",
	KeyX: "rotateCW",
	KeyZ: "rotateCCW",
	ControlLeft: "rotateCCW",
	ControlRight: "rotateCCW",
	Space: "hardDrop",
	KeyC: "hold",
	ShiftLeft: "hold",
	ShiftRight: "hold"
};
function X(e) {
	return Jt[e] ?? null;
}
var Yt = {
	ArrowUp: "up",
	ArrowDown: "down",
	ArrowLeft: "left",
	ArrowRight: "right",
	Enter: "confirm",
	NumpadEnter: "confirm",
	Space: "confirm",
	KeyZ: "confirm",
	Escape: "back",
	KeyX: "back",
	Backspace: "back"
};
function Z(e) {
	return Yt[e] ?? null;
}
function Xt(e) {
	let t = Z(e);
	return (t === "confirm" || t === "back") && X(e) ? null : t;
}
var Zt = (e) => e === "Escape" || e === "KeyP", Qt = (e) => e === "KeyM";
function $t(e, t) {
	return e.metaKey || e.altKey ? !0 : !e.ctrlKey || e.code.startsWith("Control") ? !1 : !(t && X(e.code) !== null);
}
var en = /* @__PURE__ */ new Set([
	"left",
	"right",
	"softDrop"
]), tn = class {
	down = /* @__PURE__ */ new Map();
	press(e) {
		let t = X(e);
		t && en.has(t) && (this.down.delete(e), this.down.set(e, t));
	}
	release(e) {
		this.down.delete(e);
	}
	clear() {
		this.down.clear();
	}
	actions() {
		return [...new Set(this.down.values())];
	}
}, nn = class {
	down = /* @__PURE__ */ new Set();
	press(e, t) {
		t || this.down.add(e);
	}
	release(e) {
		this.down.delete(e);
	}
	clear() {
		this.down.clear();
	}
	counts(e, t) {
		return !t || this.down.has(e);
	}
};
//#endregion
//#region src/app/scale.ts
function rn(e, t, n, r) {
	let i = Math.min(e / n, t / r);
	return !Number.isFinite(i) || i <= 0 ? 1 : i >= 1 ? Math.floor(i) : i;
}
//#endregion
//#region src/app/app.ts
var an = "pallet-blocks:muted", on = "pallet-blocks:start-level", sn = "pallet-blocks:last-name", cn = 45, ln = 700, un = .32, dn = class {
	root;
	options;
	display;
	displayCtx;
	buffer;
	bufferCtx;
	sfx;
	localScores;
	resizeObserver;
	giveBack;
	renderer = null;
	current = {
		kind: "title",
		cursor: 0
	};
	inputGuardUntil = 0;
	game = null;
	startLevel;
	nowMs = 0;
	effectsMs = 0;
	lastFrame = null;
	frame = 0;
	destroyed = !1;
	table = [];
	leaderboard = null;
	highlight = -1;
	reported = !1;
	lastName = "";
	callout = null;
	banner = null;
	bannerQueue = [];
	trail = null;
	flash = null;
	holdRefusedAtMs = null;
	pendingDropDistance = null;
	lastSoftDropSound = -Infinity;
	held = new tn();
	fresh = new nn();
	constructor(e, t = {}) {
		this.root = e, this.options = t, this.startLevel = Re(t.startLevel, Q(on)), this.sfx = new r(t.muted ?? fn(an)), this.localScores = new qt(t.storageKey ?? "pallet-blocks:high-scores:v1"), this.table = this.localScores.load(), this.lastName = Q(sn) ?? "", this.giveBack = Rt(e, {
			className: "pallet-blocks",
			attributes: {
				tabindex: "0",
				role: "application",
				"aria-label": "Pallet Blocks, a falling-blocks puzzle game"
			},
			style: {
				display: "flex",
				"align-items": "center",
				"justify-content": "center",
				"overflow-x": "hidden",
				"overflow-y": "hidden",
				"outline-style": "none",
				"background-color": Je,
				"background-image": "none",
				"user-select": "none",
				"touch-action": "none"
			}
		}), this.display = document.createElement("canvas"), this.display.style.display = "block", this.display.style.imageRendering = "pixelated", this.displayCtx = this.display.getContext("2d", { alpha: !1 }), e.appendChild(this.display), this.buffer = document.createElement("canvas"), this.buffer.width = 256, this.buffer.height = 208, this.bufferCtx = this.buffer.getContext("2d"), e.addEventListener("keydown", this.onKeyDown), e.addEventListener("keyup", this.onKeyUp), e.addEventListener("pointerdown", this.onPointerDown), e.addEventListener("focusout", this.onFocusOut), document.addEventListener("visibilitychange", this.onVisibilityChange), this.resizeObserver = typeof ResizeObserver > "u" ? null : new ResizeObserver(() => this.resize()), this.resizeObserver?.observe(e), window.addEventListener("resize", this.onWindowResize), this.resize(), (t.autoFocus ?? !0) && e.focus({ preventScroll: !0 }), this.refreshLeaderboard(), Me().then(() => {
			this.destroyed || (this.renderer = new ht(this.bufferCtx, new Ne()), this.frame = requestAnimationFrame(this.tick));
		});
	}
	get screen() {
		return this.current;
	}
	set screen(e) {
		e.kind !== this.current.kind && this.fresh.clear(), this.current = e;
	}
	pause() {
		this.isLive() && (this.game?.releaseAll(), this.screen = Pe(this.screen), this.sfx.play("pause"));
	}
	resume() {
		this.screen.kind === "paused" && (this.toPlaying(this.screen), this.sfx.play("pause"));
	}
	restart() {
		this.startGame();
	}
	focus() {
		this.root.focus({ preventScroll: !0 });
	}
	destroy() {
		this.destroyed = !0, cancelAnimationFrame(this.frame), this.root.removeEventListener("keydown", this.onKeyDown), this.root.removeEventListener("keyup", this.onKeyUp), this.root.removeEventListener("pointerdown", this.onPointerDown), this.root.removeEventListener("focusout", this.onFocusOut), document.removeEventListener("visibilitychange", this.onVisibilityChange), window.removeEventListener("resize", this.onWindowResize), this.resizeObserver?.disconnect(), this.sfx.close(), this.display.remove(), this.giveBack();
	}
	tick = (e) => {
		if (this.destroyed) return;
		let t = Bt(this.lastFrame, e);
		this.lastFrame = e, this.nowMs += t, this.effectsMs = Ie(this.effectsMs, this.screen, t), this.update(t), this.render(), this.frame = requestAnimationFrame(this.tick);
	};
	update(e) {
		this.isLive() && this.updateBanner();
		let t = this.screen;
		if (t.kind === "ready") {
			let n = t.elapsedMs + e;
			t.elapsedMs < 700 && n >= 700 && (this.sfx.play("go"), this.pressHeld(), this.game?.applyPressedLater()), this.screen = n >= 1200 ? { kind: "playing" } : {
				kind: "ready",
				elapsedMs: n
			}, n >= 700 && this.stepGame(e);
		} else if (t.kind === "playing") this.stepGame(e);
		else if (t.kind === "toppingOut") {
			let n = t.elapsedMs + e;
			this.screen = {
				kind: "toppingOut",
				elapsedMs: n
			}, n >= 1400 && this.finishGame();
		}
	}
	stepGame(e) {
		let t = this.game;
		t && (Vt(t, e), this.handleEvents(t.drainEvents()));
	}
	render() {
		let e = this.renderer;
		if (!e) return;
		e.draw({
			screen: this.screen,
			game: this.game,
			nowMs: this.nowMs,
			effectsMs: this.effectsMs,
			muted: this.sfx.muted,
			focused: this.root.contains(document.activeElement),
			playerName: this.options.playerName ? Y(this.options.playerName) : null,
			titleItems: this.titleItems().map((e) => this.titleLabel(e)),
			best: this.table[0]?.score ?? 0,
			table: this.table,
			tableTitle: this.leaderboard ? "LEADERBOARD" : "HIGH SCORES",
			highlight: this.screen.kind === "results" ? this.highlight : -1,
			callout: this.callout,
			banner: this.banner,
			trail: this.trail,
			flash: this.flash,
			holdRefusedAtMs: this.holdRefusedAtMs
		});
		let t = this.displayCtx;
		t.imageSmoothingEnabled = !1, t.drawImage(this.buffer, 0, 0, this.display.width, this.display.height);
	}
	handleEvents(e) {
		let t = 0;
		for (let n of e) switch (n.type) {
			case "move":
				this.sfx.play("move");
				break;
			case "rotate":
				this.sfx.play(n.spin === "none" ? "rotate" : "spin");
				break;
			case "hold":
				this.sfx.play("hold");
				break;
			case "holdRefused":
				this.holdRefusedAtMs = this.effectsMs, this.sfx.play("holdRefused");
				break;
			case "softDrop":
				this.nowMs - this.lastSoftDropSound > cn && (this.sfx.play("softDrop"), this.lastSoftDropSound = this.nowMs);
				break;
			case "hardDrop":
				this.pendingDropDistance = n.distance, this.sfx.play("hardDrop");
				break;
			case "lock":
				this.onLock(n);
				break;
			case "levelUp":
				t = n.level;
				break;
			case "gameOver": this.screen = {
				kind: "toppingOut",
				elapsedMs: 0
			}, this.sfx.play("gameOver");
		}
		t && this.showBanner(Lt(t));
	}
	showBanner(e) {
		this.banner ? this.bannerQueue.push(e) : this.raiseBanner(e, un);
	}
	updateBanner() {
		let e = this.banner;
		if (e && this.effectsMs - e.atMs >= e.durationMs) {
			let e = this.bannerQueue.shift();
			this.banner = null, e && this.raiseBanner(e, 0);
		}
	}
	raiseBanner(e, t) {
		this.banner = {
			...e,
			atMs: this.effectsMs
		}, e.kind === "level" && this.sfx.play("levelUp", t);
	}
	onLock(e) {
		this.flash = {
			cells: e.cells,
			atMs: this.effectsMs
		};
		let t = this.pendingDropDistance;
		if (this.pendingDropDistance = null, t) {
			let n = /* @__PURE__ */ new Map();
			for (let [t, r] of e.cells) n.set(t, Math.min(r, n.get(t) ?? Infinity));
			this.trail = {
				kind: e.kind,
				atMs: this.effectsMs,
				columns: [...n].map(([e, n]) => ({
					x: e,
					fromY: n - t,
					toY: n
				}))
			};
		}
		let n = e.perfectClear ? "allClear" : e.lines > 0 ? `clear${Math.min(e.lines, 4)}` : t === null ? "lock" : null;
		n && this.sfx.play(n), e.spin !== "none" && e.lines > 0 && this.sfx.play("spin");
		let r = Nt(e);
		r.length > 0 && (this.callout = {
			lines: r,
			points: e.points,
			atMs: this.effectsMs
		});
		let i = It(e);
		i && this.showBanner(i);
	}
	startGame() {
		let e = this.options.seed;
		this.game = new be({
			startLevel: this.startLevel,
			random: e === void 0 ? Math.random : xe(e)
		}), this.game.drainEvents(), this.screen = {
			kind: "ready",
			elapsedMs: 0
		}, this.callout = null, this.banner = null, this.bannerQueue = [], this.trail = null, this.flash = null, this.holdRefusedAtMs = null, this.highlight = -1, this.reported = !1, this.sfx.play("ready");
	}
	finishGame() {
		let e = this.game;
		if (!e) return;
		let t = this.options.playerName ? Y(this.options.playerName) : null;
		!t && Ut(this.localScores.load(), e.score) ? (this.screen = {
			kind: "nameEntry",
			name: this.lastName
		}, this.inputGuardUntil = this.nowMs + ln) : this.record(t);
	}
	record(e) {
		let t = this.game;
		if (!t) return;
		let n = -1;
		if (e) {
			let r = Wt(this.localScores.load(), {
				name: e,
				score: t.score,
				lines: t.lines,
				level: t.level
			});
			n = r.rank, n >= 0 && this.localScores.save(r.table);
		}
		this.leaderboard || (this.table = this.localScores.load(), this.highlight = n), this.screen.kind !== "nameEntry" && (this.inputGuardUntil = this.nowMs + ln), this.screen = {
			kind: "results",
			cursor: 0,
			rank: n
		}, this.report({
			score: t.score,
			lines: t.lines,
			level: t.level,
			name: e,
			durationMs: Math.round(t.elapsedMs)
		});
	}
	report(e) {
		if (this.reported) return;
		this.reported = !0;
		let t;
		try {
			t = Promise.resolve(this.options.onGameOver?.(e));
		} catch (e) {
			t = Promise.reject(e instanceof Error ? e : Error(String(e)));
		}
		t.catch((e) => console.error("pallet-blocks: onGameOver failed", e)).then(() => this.refreshLeaderboard(e));
	}
	async refreshLeaderboard(e) {
		let t = this.options.loadLeaderboard;
		if (t) try {
			let n = await t();
			if (this.destroyed) return;
			if (this.leaderboard = J(n.filter((e) => typeof e?.name == "string" && Number.isFinite(e?.score)).map((e) => ({
				name: Y(e.name),
				score: Math.floor(e.score)
			}))), this.table = this.leaderboard, e && this.screen.kind === "results") {
				let t = e.name ? Y(e.name) : null;
				this.highlight = this.table.findIndex((n) => n.score === e.score && n.name === t);
			}
		} catch (e) {
			console.error("pallet-blocks: loadLeaderboard failed", e);
		}
	}
	toTitle() {
		this.screen = {
			kind: "title",
			cursor: 0
		}, this.game = null, this.leaderboard || (this.table = this.localScores.load()), this.refreshLeaderboard();
	}
	toPlaying(e) {
		this.screen = Fe(e), this.acceptsGameInput() && this.pressHeld();
	}
	pressHeld() {
		for (let e of this.held.actions()) this.game?.press(e);
	}
	isLive() {
		return this.screen.kind === "playing" || this.screen.kind === "ready";
	}
	acceptsGameInput() {
		return this.screen.kind === "playing" || this.screen.kind === "ready" && this.screen.elapsedMs >= 700;
	}
	titleItems() {
		return this.options.onExit ? [
			"play",
			"level",
			"sound",
			"exit"
		] : [
			"play",
			"level",
			"sound"
		];
	}
	titleLabel(e) {
		switch (e) {
			case "play": return "PLAY";
			case "level": return `LEVEL  < ${this.startLevel} >`;
			case "sound": return `SOUND  ${this.sfx.muted ? "OFF" : "ON"}`;
			case "exit": return "EXIT";
		}
	}
	titleKey(e, t) {
		let n = this.titleItems(), r = n[t];
		if (e === "up" || e === "down") this.screen = {
			kind: "title",
			cursor: w(t, e === "up" ? -1 : 1, n.length)
		}, this.sfx.play("menuMove");
		else if (e === "left" || e === "right") {
			if (r === "level") {
				let t = Le(this.startLevel, e === "left" ? -1 : 1);
				t !== this.startLevel && (this.setStartLevel(t), this.sfx.play("menuMove"));
			} else r === "sound" && this.toggleMute();
		} else e === "confirm" ? r === "play" ? (this.sfx.play("menuSelect"), this.startGame()) : r === "level" ? (this.setStartLevel(this.startLevel >= 15 ? 1 : this.startLevel + 1), this.sfx.play("menuMove")) : r === "sound" ? this.toggleMute() : this.options.onExit?.() : e === "back" && this.options.onExit?.();
	}
	pausedKey(e, t) {
		let n = t.cursor;
		if (e === "up" || e === "down") this.screen = {
			...t,
			cursor: w(n, e === "up" ? -1 : 1, S.length)
		}, this.sfx.play("menuMove");
		else if (e === "confirm") {
			let e = S[n];
			this.sfx.play("menuSelect"), e === "RESUME" ? this.toPlaying(t) : e === "RESTART" ? this.startGame() : this.toTitle();
		} else e === "back" && this.resume();
	}
	resultsKey(e, t, n) {
		if (e === "left" || e === "right" || e === "up" || e === "down") {
			let r = e === "left" || e === "up" ? -1 : 1;
			this.screen = {
				kind: "results",
				cursor: w(t, r, C.length),
				rank: n
			}, this.sfx.play("menuMove");
		} else e === "confirm" ? (this.sfx.play("menuSelect"), C[t] === "PLAY AGAIN" ? this.startGame() : this.toTitle()) : e === "back" && this.toTitle();
	}
	nameKey(e, t) {
		if (e.key === "Enter") {
			let e = Y(t);
			return this.lastName = e, $(sn, e), this.sfx.play("menuSelect"), this.record(e), !0;
		}
		return e.key === "Escape" ? (this.record(null), !0) : e.key === "Backspace" ? (this.screen = {
			kind: "nameEntry",
			name: t.slice(0, -1)
		}, this.sfx.play("type"), !0) : Gt(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey ? (t.length < 10 && (e.key !== " " || t.length !== 0) && (this.screen = {
			kind: "nameEntry",
			name: t + e.key.toUpperCase()
		}, this.sfx.play("type")), !0) : !1;
	}
	setStartLevel(e) {
		this.startLevel = e, $(on, String(e));
	}
	toggleMute() {
		this.sfx.muted = !this.sfx.muted, $(an, this.sfx.muted ? "1" : "0"), this.sfx.play("menuSelect");
	}
	onKeyDown = (e) => {
		e.stopPropagation(), !$t(e, this.isLive()) && (this.sfx.unlock(), this.held.press(e.code), this.fresh.press(e.code, e.repeat), this.handleKeyDown(e) && e.preventDefault());
	};
	handleKeyDown(e) {
		let t = this.screen, n = e.code;
		if (this.nowMs < this.inputGuardUntil) return X(n) !== null || Z(n) !== null;
		if (t.kind === "nameEntry") return !this.fresh.counts(n, e.repeat) || this.nameKey(e, t.name);
		if (Qt(n)) return e.repeat || this.toggleMute(), !0;
		if (this.isLive()) {
			if (Zt(n)) return e.repeat || this.pause(), !0;
			let t = X(n);
			return t ? (!e.repeat && this.acceptsGameInput() ? (this.game?.press(t), this.handleEvents(this.game?.drainEvents() ?? [])) : e.repeat || this.game?.pressLater(t), !0) : !1;
		}
		let r = Z(n) ?? (t.kind === "paused" && n === "KeyP" ? "back" : null);
		if (!r) return !1;
		if (!this.fresh.counts(n, e.repeat) || e.repeat && (r === "confirm" || r === "back")) return !0;
		switch (t.kind) {
			case "title":
				this.titleKey(r, t.cursor);
				break;
			case "paused":
				this.pausedKey(r, t);
				break;
			case "results": {
				let e = Xt(n);
				e && this.resultsKey(e, t.cursor, t.rank);
				break;
			}
		}
		return !0;
	}
	onKeyUp = (e) => {
		e.stopPropagation(), this.held.release(e.code), this.fresh.release(e.code);
		let t = X(e.code);
		t && this.game && this.game.release(t);
	};
	onPointerDown = () => {
		this.sfx.unlock(), this.focus();
	};
	onFocusOut = (e) => {
		e.relatedTarget instanceof Node && this.root.contains(e.relatedTarget) || (this.held.clear(), this.fresh.clear(), this.pause());
	};
	onVisibilityChange = () => {
		document.hidden && (this.held.clear(), this.fresh.clear(), this.pause(), this.lastFrame = null);
	};
	onWindowResize = () => this.resize();
	resize() {
		let e = window.devicePixelRatio || 1, t = this.root.clientWidth, n = this.root.clientHeight, r = rn(t * e, n > 0 ? n * e : Infinity, 256, 208), i = Math.round(256 * r), a = Math.round(208 * r);
		(this.display.width !== i || this.display.height !== a) && (this.display.width = i, this.display.height = a), this.display.style.width = `${i / e}px`, this.display.style.height = `${a / e}px`, this.render();
	}
};
function fn(e) {
	return Q(e) === "1";
}
function Q(e) {
	try {
		return window.localStorage.getItem(e);
	} catch {
		return null;
	}
}
function $(e, t) {
	try {
		window.localStorage.setItem(e, t);
	} catch {}
}
//#endregion
//#region src/embed.ts
function pn(e, t = {}) {
	let n = new dn(e, t);
	return {
		pause: () => n.pause(),
		resume: () => n.resume(),
		restart: () => n.restart(),
		focus: () => n.focus(),
		destroy: () => n.destroy()
	};
}
var mn = {
	width: 256,
	height: 208
};
//#endregion
export { mn as PALLET_BLOCKS_SIZE, pn as mountPalletBlocks };
