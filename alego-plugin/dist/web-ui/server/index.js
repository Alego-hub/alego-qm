// plugins/web-ui/server/index.ts
import {
  createServer,
  request as httpRequest
} from "node:http";
import { request as httpsRequest } from "node:https";
import { AsyncLocalStorage } from "node:async_hooks";
import { Readable } from "node:stream";
import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, extname, join, normalize } from "node:path";
import { randomBytes } from "node:crypto";

// plugins/web-ui/node_modules/lru-cache/dist/esm/node/index.min.js
import { tracingChannel as G, channel as P } from "node:diagnostics_channel";
var S = P("lru-cache:metrics");
var W = G("lru-cache");
var L = typeof performance == "object" && performance && typeof performance.now == "function" ? performance : Date;
var R = () => S.hasSubscribers || W.hasSubscribers;
var U = /* @__PURE__ */ new Set();
var M = typeof process == "object" && process ? process : {};
var k = (d3, e, t, i) => {
  typeof M.emitWarning == "function" ? M.emitWarning(d3, e, t, i) : console.error(`[${t}] ${e}: ${d3}`);
};
var H = (d3) => !U.has(d3);
var T = (d3) => !!d3 && d3 === Math.floor(d3) && d3 > 0 && isFinite(d3);
var j = (d3) => T(d3) ? d3 <= Math.pow(2, 8) ? Uint8Array : d3 <= Math.pow(2, 16) ? Uint16Array : d3 <= Math.pow(2, 32) ? Uint32Array : d3 <= Number.MAX_SAFE_INTEGER ? O : null : null;
var O = class extends Array {
  constructor(e) {
    super(e), this.fill(0);
  }
};
var x = class d {
  heap;
  length;
  static #o = false;
  static create(e) {
    let t = j(e);
    if (!t) return [];
    d.#o = true;
    let i = new d(e, t);
    return d.#o = false, i;
  }
  constructor(e, t) {
    if (!d.#o) throw new TypeError("instantiate Stack using Stack.create(n)");
    this.heap = new t(e), this.length = 0;
  }
  push(e) {
    this.heap[this.length++] = e;
  }
  pop() {
    return this.heap[--this.length];
  }
};
var I = class d2 {
  #o;
  #c;
  #S;
  #O;
  #w;
  #M;
  #I;
  #m;
  get perf() {
    return this.#m;
  }
  ttl;
  ttlResolution;
  ttlAutopurge;
  updateAgeOnGet;
  updateAgeOnHas;
  allowStale;
  noDisposeOnSet;
  noUpdateTTL;
  maxEntrySize;
  sizeCalculation;
  noDeleteOnFetchRejection;
  noDeleteOnStaleGet;
  allowStaleOnFetchAbort;
  allowStaleOnFetchRejection;
  ignoreFetchAbort;
  backgroundFetchSize;
  #n;
  #b;
  #s;
  #i;
  #t;
  #l;
  #u;
  #a;
  #h;
  #y;
  #r;
  #_;
  #F;
  #d;
  #g;
  #T;
  #U;
  #f;
  #D;
  static unsafeExposeInternals(e) {
    return { starts: e.#F, ttls: e.#d, autopurgeTimers: e.#g, sizes: e.#_, keyMap: e.#s, keyList: e.#i, valList: e.#t, next: e.#l, prev: e.#u, get head() {
      return e.#a;
    }, get tail() {
      return e.#h;
    }, free: e.#y, isBackgroundFetch: (t) => e.#e(t), backgroundFetch: (t, i, s, n) => e.#P(t, i, s, n), moveToTail: (t) => e.#L(t), indexes: (t) => e.#A(t), rindexes: (t) => e.#z(t), isStale: (t) => e.#p(t) };
  }
  get max() {
    return this.#o;
  }
  get maxSize() {
    return this.#c;
  }
  get calculatedSize() {
    return this.#b;
  }
  get size() {
    return this.#n;
  }
  get fetchMethod() {
    return this.#M;
  }
  get memoMethod() {
    return this.#I;
  }
  get dispose() {
    return this.#S;
  }
  get onInsert() {
    return this.#O;
  }
  get disposeAfter() {
    return this.#w;
  }
  constructor(e) {
    let { max: t = 0, ttl: i, ttlResolution: s = 1, ttlAutopurge: n, updateAgeOnGet: o, updateAgeOnHas: l, allowStale: h, dispose: r, onInsert: c, disposeAfter: m, noDisposeOnSet: _, noUpdateTTL: u, maxSize: g = 0, maxEntrySize: f = 0, sizeCalculation: y, fetchMethod: a, memoMethod: w, noDeleteOnFetchRejection: F, noDeleteOnStaleGet: b, allowStaleOnFetchRejection: p, allowStaleOnFetchAbort: A, ignoreFetchAbort: z, backgroundFetchSize: C = 1, perf: E } = e;
    if (this.backgroundFetchSize = C, E !== void 0 && typeof E?.now != "function") throw new TypeError("perf option must have a now() method if specified");
    if (this.#m = E ?? L, t !== 0 && !T(t)) throw new TypeError("max option must be a nonnegative integer");
    let v = t ? j(t) : Array;
    if (!v) throw new Error("invalid max value: " + t);
    if (this.#o = t, this.#c = g, this.maxEntrySize = f || this.#c, this.sizeCalculation = y, this.sizeCalculation) {
      if (!this.#c && !this.maxEntrySize) throw new TypeError("cannot set sizeCalculation without setting maxSize or maxEntrySize");
      if (typeof this.sizeCalculation != "function") throw new TypeError("sizeCalculation set to non-function");
    }
    if (w !== void 0 && typeof w != "function") throw new TypeError("memoMethod must be a function if defined");
    if (this.#I = w, a !== void 0 && typeof a != "function") throw new TypeError("fetchMethod must be a function if specified");
    if (this.#M = a, this.#U = !!a, this.#s = /* @__PURE__ */ new Map(), this.#i = Array.from({ length: t }).fill(void 0), this.#t = Array.from({ length: t }).fill(void 0), this.#l = new v(t), this.#u = new v(t), this.#a = 0, this.#h = 0, this.#y = x.create(t), this.#n = 0, this.#b = 0, typeof r == "function" && (this.#S = r), typeof c == "function" && (this.#O = c), typeof m == "function" ? (this.#w = m, this.#r = []) : (this.#w = void 0, this.#r = void 0), this.#T = !!this.#S, this.#D = !!this.#O, this.#f = !!this.#w, this.noDisposeOnSet = !!_, this.noUpdateTTL = !!u, this.noDeleteOnFetchRejection = !!F, this.allowStaleOnFetchRejection = !!p, this.allowStaleOnFetchAbort = !!A, this.ignoreFetchAbort = !!z, this.maxEntrySize !== 0) {
      if (this.#c !== 0 && !T(this.#c)) throw new TypeError("maxSize must be a positive integer if specified");
      if (!T(this.maxEntrySize)) throw new TypeError("maxEntrySize must be a positive integer if specified");
      this.#X();
    }
    if (this.allowStale = !!h, this.noDeleteOnStaleGet = !!b, this.updateAgeOnGet = !!o, this.updateAgeOnHas = !!l, this.ttlResolution = T(s) || s === 0 ? s : 1, this.ttlAutopurge = !!n, this.ttl = i || 0, this.ttl) {
      if (!T(this.ttl)) throw new TypeError("ttl must be a positive integer if specified");
      this.#k();
    }
    if (this.#o === 0 && this.ttl === 0 && this.#c === 0) throw new TypeError("At least one of max, maxSize, or ttl is required");
    if (!this.ttlAutopurge && !this.#o && !this.#c) {
      let D = "LRU_CACHE_UNBOUNDED";
      H(D) && (U.add(D), k("TTL caching without ttlAutopurge, max, or maxSize can result in unbounded memory consumption.", "UnboundedCacheWarning", D, d2));
    }
  }
  getRemainingTTL(e) {
    return this.#s.has(e) ? 1 / 0 : 0;
  }
  #k() {
    let e = new O(this.#o), t = new O(this.#o);
    this.#d = e, this.#F = t;
    let i = this.ttlAutopurge ? Array.from({ length: this.#o }) : void 0;
    this.#g = i, this.#H = (h, r, c = this.#m.now()) => {
      t[h] = r !== 0 ? c : 0, e[h] = r, s(h, r);
    }, this.#R = (h) => {
      t[h] = e[h] !== 0 ? this.#m.now() : 0, s(h, e[h]);
    };
    let s = this.ttlAutopurge ? (h, r) => {
      if (i?.[h] && (clearTimeout(i[h]), i[h] = void 0), r && r !== 0 && i) {
        let c = setTimeout(() => {
          this.#p(h) ? (this.#E(this.#i[h], "expire"), i[h] = void 0) : s(h, l(h));
        }, r + 1);
        c.unref && c.unref(), i[h] = c;
      }
    } : () => {
    };
    this.#v = (h, r) => {
      if (e[r]) {
        let c = e[r], m = t[r];
        if (!c || !m) return;
        h.ttl = c, h.start = m, h.now = n || o();
        let _ = h.now - m;
        h.remainingTTL = c - _;
      }
    };
    let n = 0, o = () => {
      let h = this.#m.now();
      if (this.ttlResolution > 0) {
        n = h;
        let r = setTimeout(() => n = 0, this.ttlResolution);
        r.unref && r.unref();
      }
      return h;
    };
    this.getRemainingTTL = (h) => {
      let r = this.#s.get(h);
      return r === void 0 ? 0 : l(r);
    };
    let l = (h) => {
      let r = e[h], c = t[h];
      if (!r || !c) return 1 / 0;
      let m = (n || o()) - c;
      return r - m;
    };
    this.#p = (h) => {
      let r = t[h], c = e[h];
      return !!c && !!r && (n || o()) - r > c;
    };
  }
  #R = () => {
  };
  #v = () => {
  };
  #H = () => {
  };
  #p = () => false;
  #X() {
    let e = new O(this.#o);
    this.#b = 0, this.#_ = e, this.#x = (t) => {
      this.#b -= e[t], e[t] = 0;
    }, this.#N = (t, i, s, n) => {
      if (!T(s)) {
        if (this.#e(i)) return this.backgroundFetchSize;
        if (n) {
          if (typeof n != "function") throw new TypeError("sizeCalculation must be a function");
          if (s = n(i, t), !T(s)) throw new TypeError("sizeCalculation return invalid (expect positive integer)");
        } else throw new TypeError("invalid size value (must be positive integer). When maxSize or maxEntrySize is used, sizeCalculation or size must be set.");
      }
      return s;
    }, this.#j = (t, i, s) => {
      if (e[t] = i, this.#c) {
        let n = this.#c - e[t];
        for (; this.#b > n; ) this.#G(true);
      }
      this.#b += e[t], s && (s.entrySize = i, s.totalCalculatedSize = this.#b);
    };
  }
  #x = (e) => {
  };
  #j = (e, t, i) => {
  };
  #N = (e, t, i, s) => {
    if (i || s) throw new TypeError("cannot set size without setting maxSize or maxEntrySize on cache");
    return 0;
  };
  *#A({ allowStale: e = this.allowStale } = {}) {
    if (this.#n) for (let t = this.#h; this.#V(t) && ((e || !this.#p(t)) && (yield t), t !== this.#a); ) t = this.#u[t];
  }
  *#z({ allowStale: e = this.allowStale } = {}) {
    if (this.#n) for (let t = this.#a; this.#V(t) && ((e || !this.#p(t)) && (yield t), t !== this.#h); ) t = this.#l[t];
  }
  #V(e) {
    return e !== void 0 && this.#s.get(this.#i[e]) === e;
  }
  *entries() {
    for (let e of this.#A()) this.#t[e] !== void 0 && this.#i[e] !== void 0 && !this.#e(this.#t[e]) && (yield [this.#i[e], this.#t[e]]);
  }
  *rentries() {
    for (let e of this.#z()) this.#t[e] !== void 0 && this.#i[e] !== void 0 && !this.#e(this.#t[e]) && (yield [this.#i[e], this.#t[e]]);
  }
  *keys() {
    for (let e of this.#A()) {
      let t = this.#i[e];
      t !== void 0 && !this.#e(this.#t[e]) && (yield t);
    }
  }
  *rkeys() {
    for (let e of this.#z()) {
      let t = this.#i[e];
      t !== void 0 && !this.#e(this.#t[e]) && (yield t);
    }
  }
  *values() {
    for (let e of this.#A()) this.#t[e] !== void 0 && !this.#e(this.#t[e]) && (yield this.#t[e]);
  }
  *rvalues() {
    for (let e of this.#z()) this.#t[e] !== void 0 && !this.#e(this.#t[e]) && (yield this.#t[e]);
  }
  [Symbol.iterator]() {
    return this.entries();
  }
  [Symbol.toStringTag] = "LRUCache";
  find(e, t = {}) {
    for (let i of this.#A()) {
      let s = this.#t[i], n = this.#e(s) ? s.__staleWhileFetching : s;
      if (n !== void 0 && e(n, this.#i[i], this)) return this.#C(this.#i[i], t);
    }
  }
  forEach(e, t = this) {
    for (let i of this.#A()) {
      let s = this.#t[i], n = this.#e(s) ? s.__staleWhileFetching : s;
      n !== void 0 && e.call(t, n, this.#i[i], this);
    }
  }
  rforEach(e, t = this) {
    for (let i of this.#z()) {
      let s = this.#t[i], n = this.#e(s) ? s.__staleWhileFetching : s;
      n !== void 0 && e.call(t, n, this.#i[i], this);
    }
  }
  purgeStale() {
    let e = false;
    for (let t of this.#z({ allowStale: true })) this.#p(t) && (this.#E(this.#i[t], "expire"), e = true);
    return e;
  }
  info(e) {
    let t = this.#s.get(e);
    if (t === void 0) return;
    let i = this.#t[t], s = this.#e(i) ? i.__staleWhileFetching : i;
    if (s === void 0) return;
    let n = { value: s };
    if (this.#d && this.#F) {
      let o = this.#d[t], l = this.#F[t];
      if (o && l) {
        let h = o - (this.#m.now() - l);
        n.ttl = h, n.start = Date.now();
      }
    }
    return this.#_ && (n.size = this.#_[t]), n;
  }
  dump() {
    let e = [];
    for (let t of this.#A({ allowStale: true })) {
      let i = this.#i[t], s = this.#t[t], n = this.#e(s) ? s.__staleWhileFetching : s;
      if (n === void 0 || i === void 0) continue;
      let o = { value: n };
      if (this.#d && this.#F) {
        o.ttl = this.#d[t];
        let l = this.#m.now() - this.#F[t];
        o.start = Math.floor(Date.now() - l);
      }
      this.#_ && (o.size = this.#_[t]), e.unshift([i, o]);
    }
    return e;
  }
  load(e) {
    this.clear();
    for (let [t, i] of e) {
      if (i.start) {
        let s = Date.now() - i.start;
        i.start = this.#m.now() - s;
      }
      this.#W(t, i.value, i);
    }
  }
  set(e, t, i = {}) {
    let { status: s = S.hasSubscribers ? {} : void 0 } = i;
    i.status = s, s && (s.op = "set", s.key = e, t !== void 0 && (s.value = t), s.cache = this);
    let n = this.#W(e, t, i);
    return s && S.hasSubscribers && S.publish(s), n;
  }
  #W(e, t, i, s) {
    let { ttl: n = this.ttl, start: o, noDisposeOnSet: l = this.noDisposeOnSet, sizeCalculation: h = this.sizeCalculation, status: r } = i, c = this.#e(t);
    if (t === void 0) return r && (r.set = "deleted"), this.delete(e), this;
    let { noUpdateTTL: m = this.noUpdateTTL } = i;
    r && !c && (r.value = t);
    let _ = this.#N(e, t, i.size || 0, h, r);
    if (this.maxEntrySize && _ > this.maxEntrySize) return this.#E(e, "set"), r && (r.set = "miss", r.maxEntrySizeExceeded = true), this;
    let u = this.#n === 0 ? void 0 : this.#s.get(e);
    if (u === void 0) u = this.#n === 0 ? this.#h : this.#y.length !== 0 ? this.#y.pop() : this.#n === this.#o ? this.#G(false) : this.#n, this.#i[u] = e, this.#t[u] = t, this.#s.set(e, u), this.#l[this.#h] = u, this.#u[u] = this.#h, this.#h = u, this.#n++, this.#j(u, _, r), r && (r.set = "add"), m = false, this.#D && !c && this.#O?.(t, e, "add");
    else {
      this.#L(u);
      let g = this.#t[u];
      if (t !== g) {
        if (!l) if (this.#e(g)) {
          g !== s && g.__abortController.abort(new Error("replaced"));
          let { __staleWhileFetching: f } = g;
          f !== void 0 && f !== t && (this.#T && this.#S?.(f, e, "set"), this.#f && this.#r?.push([f, e, "set"]));
        } else this.#T && this.#S?.(g, e, "set"), this.#f && this.#r?.push([g, e, "set"]);
        if (this.#x(u), this.#j(u, _, r), this.#t[u] = t, !c) {
          let f = g && this.#e(g) ? g.__staleWhileFetching : g, y = f === void 0 ? "add" : t !== f ? "replace" : "update";
          r && (r.set = y, f !== void 0 && (r.oldValue = f)), this.#D && this.onInsert?.(t, e, y);
        }
      } else c || (r && (r.set = "update"), this.#D && this.onInsert?.(t, e, "update"));
    }
    if (n !== 0 && !this.#d && this.#k(), this.#d && (m || this.#H(u, n, o), r && this.#v(r, u)), !l && this.#f && this.#r) {
      let g = this.#r, f;
      for (; f = g?.shift(); ) this.#w?.(...f);
    }
    return this;
  }
  pop() {
    try {
      for (; this.#n; ) {
        let e = this.#t[this.#a];
        if (this.#G(true), this.#e(e)) {
          if (e.__staleWhileFetching) return e.__staleWhileFetching;
        } else if (e !== void 0) return e;
      }
    } finally {
      if (this.#f && this.#r) {
        let e = this.#r, t;
        for (; t = e?.shift(); ) this.#w?.(...t);
      }
    }
  }
  #G(e) {
    let t = this.#a, i = this.#i[t], s = this.#t[t], n = this.#e(s);
    n && s.__abortController.abort(new Error("evicted"));
    let o = n ? s.__staleWhileFetching : s;
    return (this.#T || this.#f) && o !== void 0 && (this.#T && this.#S?.(o, i, "evict"), this.#f && this.#r?.push([o, i, "evict"])), this.#x(t), this.#g?.[t] && (clearTimeout(this.#g[t]), this.#g[t] = void 0), e && (this.#i[t] = void 0, this.#t[t] = void 0, this.#y.push(t)), this.#n === 1 ? (this.#a = this.#h = 0, this.#y.length = 0) : this.#a = this.#l[t], this.#s.delete(i), this.#n--, t;
  }
  has(e, t = {}) {
    let { status: i = S.hasSubscribers ? {} : void 0 } = t;
    t.status = i, i && (i.op = "has", i.key = e, i.cache = this);
    let s = this.#Y(e, t);
    return S.hasSubscribers && S.publish(i), s;
  }
  #Y(e, t = {}) {
    let { updateAgeOnHas: i = this.updateAgeOnHas, status: s } = t, n = this.#s.get(e);
    if (n !== void 0) {
      let o = this.#t[n];
      if (this.#e(o) && o.__staleWhileFetching === void 0) return false;
      if (this.#p(n)) s && (s.has = "stale", this.#v(s, n));
      else return i && this.#R(n), s && (s.has = "hit", this.#v(s, n)), true;
    } else s && (s.has = "miss");
    return false;
  }
  peek(e, t = {}) {
    let { status: i = R() ? {} : void 0 } = t;
    i && (i.op = "peek", i.key = e, i.cache = this), t.status = i;
    let s = this.#J(e, t);
    return S.hasSubscribers && S.publish(i), s;
  }
  #J(e, t) {
    let { status: i, allowStale: s = this.allowStale } = t, n = this.#s.get(e);
    if (n === void 0 || !s && this.#p(n)) {
      i && (i.peek = n === void 0 ? "miss" : "stale");
      return;
    }
    let o = this.#t[n], l = this.#e(o) ? o.__staleWhileFetching : o;
    return i && (l !== void 0 ? (i.peek = "hit", i.value = l) : i.peek = "miss"), l;
  }
  #P(e, t, i, s) {
    let n = t === void 0 ? void 0 : this.#t[t];
    if (this.#e(n)) return n;
    let o = new AbortController(), { signal: l } = i;
    l?.addEventListener("abort", () => o.abort(l.reason), { signal: o.signal });
    let h = { signal: o.signal, options: i, context: s }, r = (f, y = false) => {
      let { aborted: a } = o.signal, w = i.ignoreFetchAbort && f !== void 0, F = i.ignoreFetchAbort || !!(i.allowStaleOnFetchAbort && f !== void 0);
      if (i.status && (a && !y ? (i.status.fetchAborted = true, i.status.fetchError = o.signal.reason, w && (i.status.fetchAbortIgnored = true)) : i.status.fetchResolved = true), a && !w && !y) return m(o.signal.reason, F);
      let b = u, p = this.#t[t];
      return (p === u || p === void 0 && w && y) && (f === void 0 ? b.__staleWhileFetching !== void 0 ? this.#t[t] = b.__staleWhileFetching : this.#E(e, "fetch") : (i.status && (i.status.fetchUpdated = true), this.#W(e, f, h.options, b))), f;
    }, c = (f) => (i.status && (i.status.fetchRejected = true, i.status.fetchError = f), m(f, false)), m = (f, y) => {
      let { aborted: a } = o.signal, w = a && i.allowStaleOnFetchAbort, F = w || i.allowStaleOnFetchRejection, b = F || i.noDeleteOnFetchRejection, p = u;
      if (this.#t[t] === u && (!b || !y && p.__staleWhileFetching === void 0 ? this.#E(e, "fetch") : w || (this.#t[t] = p.__staleWhileFetching)), F) return i.status && p.__staleWhileFetching !== void 0 && (i.status.returnedStale = true), p.__staleWhileFetching;
      if (p.__returned === p) throw f;
    }, _ = (f, y) => {
      let a = this.#M?.(e, n, h);
      o.signal.addEventListener("abort", () => {
        (!i.ignoreFetchAbort || i.allowStaleOnFetchAbort) && (f(void 0), i.allowStaleOnFetchAbort && (f = (w) => r(w, true)));
      }), a && a instanceof Promise ? a.then((w) => f(w === void 0 ? void 0 : w), y) : a !== void 0 && f(a);
    };
    i.status && (i.status.fetchDispatched = true);
    let u = new Promise(_).then(r, c), g = Object.assign(u, { __abortController: o, __staleWhileFetching: n, __returned: void 0 });
    return t === void 0 ? (this.#W(e, g, { ...h.options, status: void 0 }), t = this.#s.get(e)) : this.#t[t] = g, g;
  }
  #e(e) {
    if (!this.#U) return false;
    let t = e;
    return !!t && t instanceof Promise && t.hasOwnProperty("__staleWhileFetching") && t.__abortController instanceof AbortController;
  }
  fetch(e, t = {}) {
    let i = W.hasSubscribers, { status: s = R() ? {} : void 0 } = t;
    t.status = s, s && t.context && (s.context = t.context);
    let n = this.#B(e, t);
    return s && i && (s.trace = true, W.tracePromise(() => n, s).catch(() => {
    })), n;
  }
  async #B(e, t = {}) {
    let { allowStale: i = this.allowStale, updateAgeOnGet: s = this.updateAgeOnGet, noDeleteOnStaleGet: n = this.noDeleteOnStaleGet, ttl: o = this.ttl, noDisposeOnSet: l = this.noDisposeOnSet, size: h = 0, sizeCalculation: r = this.sizeCalculation, noUpdateTTL: c = this.noUpdateTTL, noDeleteOnFetchRejection: m = this.noDeleteOnFetchRejection, allowStaleOnFetchRejection: _ = this.allowStaleOnFetchRejection, ignoreFetchAbort: u = this.ignoreFetchAbort, allowStaleOnFetchAbort: g = this.allowStaleOnFetchAbort, context: f, forceRefresh: y = false, status: a, signal: w } = t;
    if (a && (a.op = "fetch", a.key = e, y && (a.forceRefresh = true), a.cache = this), !this.#U) return a && (a.fetch = "get"), this.#C(e, { allowStale: i, updateAgeOnGet: s, noDeleteOnStaleGet: n, status: a });
    let F = { allowStale: i, updateAgeOnGet: s, noDeleteOnStaleGet: n, ttl: o, noDisposeOnSet: l, size: h, sizeCalculation: r, noUpdateTTL: c, noDeleteOnFetchRejection: m, allowStaleOnFetchRejection: _, allowStaleOnFetchAbort: g, ignoreFetchAbort: u, status: a, signal: w }, b = this.#s.get(e);
    if (b === void 0) {
      a && (a.fetch = "miss");
      let p = this.#P(e, b, F, f);
      return p.__returned = p;
    } else {
      let p = this.#t[b];
      if (this.#e(p)) {
        let v = i && p.__staleWhileFetching !== void 0;
        return a && (a.fetch = "inflight", v && (a.returnedStale = true)), v ? p.__staleWhileFetching : p.__returned = p;
      }
      let A = this.#p(b);
      if (!y && !A) return a && (a.fetch = "hit"), this.#L(b), s && this.#R(b), a && this.#v(a, b), p;
      let z = this.#P(e, b, F, f), E = z.__staleWhileFetching !== void 0 && i;
      return a && (a.fetch = A ? "stale" : "refresh", E && A && (a.returnedStale = true)), E ? z.__staleWhileFetching : z.__returned = z;
    }
  }
  forceFetch(e, t = {}) {
    let i = W.hasSubscribers, { status: s = R() ? {} : void 0 } = t;
    t.status = s, s && t.context && (s.context = t.context);
    let n = this.#K(e, t);
    return s && i && (s.trace = true, W.tracePromise(() => n, s).catch(() => {
    })), n;
  }
  async #K(e, t = {}) {
    let i = await this.#B(e, t);
    if (i === void 0) throw new Error("fetch() returned undefined");
    return i;
  }
  memo(e, t = {}) {
    let { status: i = S.hasSubscribers ? {} : void 0 } = t;
    t.status = i, i && (i.op = "memo", i.key = e, t.context && (i.context = t.context), i.cache = this);
    let s = this.#Q(e, t);
    return i && (i.value = s), S.hasSubscribers && S.publish(i), s;
  }
  #Q(e, t = {}) {
    let i = this.#I;
    if (!i) throw new Error("no memoMethod provided to constructor");
    let { context: s, status: n, forceRefresh: o, ...l } = t;
    n && o && (n.forceRefresh = true);
    let h = this.#C(e, l), r = o || h === void 0;
    if (n && (n.memo = r ? "miss" : "hit", r || (n.value = h)), !r) return h;
    let c = i(e, h, { options: l, context: s });
    return n && (n.value = c), this.#W(e, c, l), c;
  }
  get(e, t = {}) {
    let { status: i = S.hasSubscribers ? {} : void 0 } = t;
    t.status = i, i && (i.op = "get", i.key = e, i.cache = this);
    let s = this.#C(e, t);
    return i && (s !== void 0 && (i.value = s), S.hasSubscribers && S.publish(i)), s;
  }
  #C(e, t = {}) {
    let { allowStale: i = this.allowStale, updateAgeOnGet: s = this.updateAgeOnGet, noDeleteOnStaleGet: n = this.noDeleteOnStaleGet, status: o } = t, l = this.#s.get(e);
    if (l === void 0) {
      o && (o.get = "miss");
      return;
    }
    let h = this.#t[l], r = this.#e(h);
    return o && this.#v(o, l), this.#p(l) ? r ? (o && (o.get = "stale-fetching"), i && h.__staleWhileFetching !== void 0 ? (o && (o.returnedStale = true), h.__staleWhileFetching) : void 0) : (n || this.#E(e, "expire"), o && (o.get = "stale"), i ? (o && (o.returnedStale = true), h) : void 0) : (o && (o.get = r ? "fetching" : "hit"), this.#L(l), s && this.#R(l), r ? h.__staleWhileFetching : h);
  }
  #$(e, t) {
    this.#u[t] = e, this.#l[e] = t;
  }
  #L(e) {
    e !== this.#h && (e === this.#a ? this.#a = this.#l[e] : this.#$(this.#u[e], this.#l[e]), this.#$(this.#h, e), this.#h = e);
  }
  delete(e) {
    return this.#E(e, "delete");
  }
  #E(e, t) {
    S.hasSubscribers && S.publish({ op: "delete", delete: t, key: e, cache: this });
    let i = false;
    if (this.#n !== 0) {
      let s = this.#s.get(e);
      if (s !== void 0) if (this.#g?.[s] && (clearTimeout(this.#g[s]), this.#g[s] = void 0), i = true, this.#n === 1) this.#q(t);
      else {
        this.#x(s);
        let n = this.#t[s];
        if (this.#e(n) ? n.__abortController.abort(new Error("deleted")) : (this.#T || this.#f) && (this.#T && this.#S?.(n, e, t), this.#f && this.#r?.push([n, e, t])), this.#s.delete(e), this.#i[s] = void 0, this.#t[s] = void 0, s === this.#h) this.#h = this.#u[s];
        else if (s === this.#a) this.#a = this.#l[s];
        else {
          let o = this.#u[s];
          this.#l[o] = this.#l[s];
          let l = this.#l[s];
          this.#u[l] = this.#u[s];
        }
        this.#n--, this.#y.push(s);
      }
    }
    if (this.#f && this.#r?.length) {
      let s = this.#r, n;
      for (; n = s?.shift(); ) this.#w?.(...n);
    }
    return i;
  }
  clear() {
    return this.#q("delete");
  }
  #q(e) {
    for (let t of this.#z({ allowStale: true })) {
      let i = this.#t[t];
      if (this.#e(i)) i.__abortController.abort(new Error("deleted"));
      else {
        let s = this.#i[t];
        this.#T && this.#S?.(i, s, e), this.#f && this.#r?.push([i, s, e]);
      }
    }
    if (this.#s.clear(), this.#t.fill(void 0), this.#i.fill(void 0), this.#d && this.#F) {
      this.#d.fill(0), this.#F.fill(0);
      for (let t of this.#g ?? []) t !== void 0 && clearTimeout(t);
      this.#g?.fill(void 0);
    }
    if (this.#_ && this.#_.fill(0), this.#a = 0, this.#h = 0, this.#y.length = 0, this.#b = 0, this.#n = 0, this.#f && this.#r) {
      let t = this.#r, i;
      for (; i = t?.shift(); ) this.#w?.(...i);
    }
  }
};

// plugins/chassis/src/source-auth-sign.ts
import { createHmac } from "node:crypto";
function canonicalPayload(method, pathWithQuery, body) {
  return `${method}
${pathWithQuery}
${body}`;
}
function signRequest(secret2, timestampSec, canonical) {
  return `v0=${createHmac("sha256", secret2).update(`v0:${timestampSec}:${canonical}`).digest("hex")}`;
}
function signedRequestHeaders(secret2, method, pathWithQuery, body = "", base = {}, nowSec = Math.floor(Date.now() / 1e3)) {
  if (!secret2) return { ...base };
  const canonical = canonicalPayload(method, pathWithQuery, body);
  return { ...base, "x-timestamp": String(nowSec), "x-signature": signRequest(secret2, nowSec, canonical) };
}

// plugins/chassis/src/core-client.ts
var CAPABILITY_HEADER = "x-agent-capability";
function signedHeaders(secret2, method, pathWithQuery, rawBody = "", signatureTail = rawBody) {
  return signedRequestHeaders(secret2, method, pathWithQuery, signatureTail, { "content-type": "application/json" });
}
function withSourceAuthNonce(pathWithQuery, secret2) {
  if (!secret2) return pathWithQuery;
  const url = new URL(pathWithQuery, "http://core.local");
  url.searchParams.set("_sourceAuthNonce", `${Date.now()}-${Math.random().toString(16).slice(2)}`);
  return `${url.pathname}${url.search}`;
}

// plugins/chassis/src/router.ts
function compilePath(path) {
  const want = path.split("/").map((seg) => seg.startsWith(":") ? { param: seg.slice(1) } : { literal: seg });
  return {
    test(_method, pathname, out) {
      const got = pathname.split("/");
      if (got.length !== want.length) return false;
      for (let i = 0; i < want.length; i++) {
        const seg = want[i];
        const value = got[i];
        if ("literal" in seg) {
          if (value !== seg.literal) return false;
        } else {
          try {
            out[seg.param] = decodeURIComponent(value);
          } catch {
            return false;
          }
        }
      }
      return true;
    }
  };
}
function matcherFor(route) {
  if ("path" in route) {
    const compiled = compilePath(route.path);
    return (method, pathname, params) => method === route.method && compiled.test(method, pathname, params);
  }
  return (method, pathname) => route.match(method, pathname);
}
function findRoute(routes, method, pathname) {
  for (const route of routes) {
    const params = {};
    if (matcherFor(route)(method, pathname, params)) return { route, params };
  }
  return null;
}

// plugins/chassis/src/http.ts
var PayloadTooLargeError = class extends Error {
  constructor() {
    super("request body too large");
    this.name = "PayloadTooLargeError";
  }
};
function json(res, status, body) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}
async function readBody(req, maxBytes = Infinity) {
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > maxBytes) throw new PayloadTooLargeError();
    chunks.push(c);
  }
  return Buffer.concat(chunks).toString("utf8");
}
function cookie(req, name) {
  const m = (req.headers.cookie ?? "").match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return m ? decodeURIComponent(m[1] ?? "") || null : null;
}
function serveEmojiFavicon(res, emoji, cacheControl) {
  res.writeHead(200, { "content-type": "image/svg+xml; charset=utf-8", "cache-control": cacheControl });
  res.end(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90" text-anchor="middle" x="50">${emoji}</text></svg>`
  );
}

// plugins/chassis/src/portal-identity.ts
import { createHmac as createHmac2, timingSafeEqual } from "node:crypto";
function digest(payload, secret2) {
  return createHmac2("sha256", secret2).update(payload).digest("base64url");
}
function verifyPortalIdentity(token, secret2, nowMs) {
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const payload = token.slice(0, dot);
  const expected = digest(payload, secret2);
  const got = token.slice(dot + 1);
  if (got.length !== expected.length || !timingSafeEqual(Buffer.from(got), Buffer.from(expected))) return null;
  let claims;
  try {
    claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (!claims || typeof claims.p !== "string" || !claims.p || typeof claims.exp !== "number") return null;
  if (nowMs > claims.exp) return null;
  return claims;
}
var PORTAL_IDENTITY_HEADER = "x-portal-identity";

// plugins/chassis/src/branding.ts
var REFRESH_MS = 3e4;
var RETRY_MS = 5e3;
var FIRST_RENDER_WAIT_MS = 1500;
function createBrandingCache(fetchBranding) {
  let value = {};
  let warmed = false;
  let nextAt = 0;
  let inflight = null;
  const kick = () => {
    if (inflight || Date.now() < nextAt) return;
    inflight = (async () => {
      try {
        value = await fetchBranding();
        if (process.env.BRANDING_DEBUG) console.error("[branding] fetched:", JSON.stringify(value));
        warmed = true;
        nextAt = Date.now() + REFRESH_MS;
      } catch (err) {
        if (process.env.BRANDING_DEBUG) console.error("[branding] fetch failed:", String(err));
        nextAt = Date.now() + RETRY_MS;
      } finally {
        inflight = null;
      }
    })();
  };
  setTimeout(kick, 0);
  return {
    current: () => value,
    async forRender() {
      kick();
      if (!warmed && inflight) {
        await Promise.race([inflight, new Promise((r) => setTimeout(r, FIRST_RENDER_WAIT_MS))]);
      }
      return value;
    },
    async refreshNow() {
      if (inflight) await inflight;
      nextAt = 0;
      kick();
      if (inflight) await inflight;
    }
  };
}
var escapeAttr = (v) => v.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
function injectBranding(html, branding, opts) {
  const { accent, mark, selfLabel } = branding;
  let out = html;
  if (selfLabel) {
    out = out.replace(
      /(<meta name="brand-self-label" content=")[^"]*(")/,
      (_m, pre, post) => `${pre}${escapeAttr(selfLabel)}${post}`
    );
    if (opts?.titleSuffix) {
      const title = escapeAttr(`${selfLabel} ${opts.titleSuffix}`);
      out = out.replace(/<title>[^<]*<\/title>/, () => `<title>${title}</title>`);
    }
  }
  const decls = [...accent ? [`--brand-accent:${accent}`] : [], ...mark ? [`--brand-mark:"${mark}"`] : []].join(
    ";"
  );
  if (decls) out = out.replace("</head>", () => `<style>:root{${decls}}</style></head>`);
  return out;
}

// plugins/chassis/src/http-proxy.ts
var HOP_BY_HOP_HEADERS = /* @__PURE__ */ new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "proxy-connection",
  "te",
  "trailer",
  "trailers",
  "transfer-encoding",
  "upgrade"
]);
function proxyHeaders(headers, extra = []) {
  const excluded = /* @__PURE__ */ new Set([...HOP_BY_HOP_HEADERS, ...[...extra].map((header) => header.toLowerCase())]);
  const connection = Object.entries(headers).find(([header]) => header.toLowerCase() === "connection")?.[1];
  let connectionList = "";
  if (typeof connection === "string") connectionList = connection;
  else if (Array.isArray(connection)) connectionList = connection.join(",");
  for (const header of connectionList.split(",")) {
    if (header.trim()) excluded.add(header.trim().toLowerCase());
  }
  return Object.fromEntries(
    Object.entries(headers).filter(([header, value]) => value !== void 0 && !excluded.has(header.toLowerCase()))
  );
}

// plugins/chassis/src/env.ts
var CORE_API_URL = (process.env.CORE_API_URL ?? "http://localhost:8080").replace(/\/$/, "");
var CORE_ORG_ID = process.env.CORE_ORG_ID ?? "acme";
var secret = (raw) => raw?.trim() ? raw : void 0;
var CORE_SIGNING_SECRET = secret(process.env.CORE_SIGNING_SECRET);
var PORTAL_IDENTITY_SECRET = secret(process.env.PORTAL_IDENTITY_SECRET) ?? CORE_SIGNING_SECRET;
if (!secret(process.env.PORTAL_IDENTITY_SECRET) && CORE_SIGNING_SECRET) {
  console.warn(
    "[chassis] PORTAL_IDENTITY_SECRET unset \u2014 signing portal identity with CORE_SIGNING_SECRET (dev fallback)"
  );
}
function portFromEnv(fallback) {
  return Number(process.env.PORT ?? fallback);
}

// plugins/web-ui/server/index.ts
var PORT = portFromEnv(8096);
var HOST = process.env.WEB_UI_HOST;
var PUBLIC_URL = (process.env.WEB_UI_PUBLIC_URL ?? `http://localhost:${PORT}`).replace(/\/$/, "");
var WEB_UI_DEV = process.env.WEB_UI_DEV === "1";
var ALLOW_UNSIGNED_TEST_IDENTITY = process.env.NODE_ENV === "test" && process.env.ALLOW_UNSIGNED_TEST_IDENTITY === "1";
var COOKIE_AUTH = process.env.WEB_UI_COOKIE_AUTH === "1" || !CORE_SIGNING_SECRET || ALLOW_UNSIGNED_TEST_IDENTITY;
var AUTH_MODE = COOKIE_AUTH ? "dev" : "portal";
var ALLOW = (process.env.WEB_UI_PRINCIPALS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
var ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
var DIST = join(ROOT, "dist-web");
var brandingCache = createBrandingCache(async () => {
  const r = await coreFetch("GET", "/v1/surface-config", "", 2e3);
  if (r.status !== 200) throw new Error(`surface-config ${r.status}`);
  const b = JSON.parse(r.text).branding;
  return {
    ...typeof b?.accent === "string" ? { accent: b.accent } : {},
    ...typeof b?.mark === "string" ? { mark: b.mark } : {},
    ...typeof b?.selfLabel === "string" ? { selfLabel: b.selfLabel } : {}
  };
});
async function brandIndexHtml(html) {
  const branding = await brandingCache.forRender();
  return injectBranding(html, branding, { titleSuffix: "\xB7 Web" });
}
var portalTokenStore = new AsyncLocalStorage();
var runOwners = /* @__PURE__ */ new Map();
var runThreadKeys = /* @__PURE__ */ new Map();
var activeRunsByThread = /* @__PURE__ */ new Map();
function ownsRun(runId, user) {
  return runOwners.get(runId) === user;
}
function threadKey(user, threadRef) {
  return `${user}\0${threadRef}`;
}
function forgetRun(runId) {
  runOwners.delete(runId);
  const key = runThreadKeys.get(runId);
  if (key) {
    const remaining = (activeRunsByThread.get(key) ?? []).filter((id) => id !== runId);
    if (remaining.length) activeRunsByThread.set(key, remaining);
    else activeRunsByThread.delete(key);
  }
  runThreadKeys.delete(runId);
}
function rememberRun(runId, user, threadRef) {
  if (runOwners.size > 5e3) {
    const oldest = runOwners.keys().next().value;
    if (oldest !== void 0) forgetRun(oldest);
  }
  runOwners.set(runId, user);
  const key = threadKey(user, threadRef);
  runThreadKeys.set(runId, key);
  activeRunsByThread.set(key, [...activeRunsByThread.get(key) ?? [], runId]);
}
var deliveryClients = /* @__PURE__ */ new Map();
function ownerOfWebThread(threadRef) {
  if (!threadRef.startsWith("web:")) return null;
  const rest = threadRef.slice("web:".length);
  const i = rest.indexOf(":");
  return i > 0 ? rest.slice(0, i) : null;
}
var CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".map": "application/json; charset=utf-8",
  ".wasm": "application/wasm"
};
var SPA_CSP = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-src 'self' https:",
  "worker-src 'self' blob:",
  "frame-ancestors 'self'",
  "base-uri 'none'",
  "form-action 'self'",
  "object-src 'none'"
].join("; ");
function withSecurityHeaders(headers) {
  return {
    ...headers,
    "content-security-policy": SPA_CSP,
    "strict-transport-security": "max-age=63072000; includeSubDomains",
    "referrer-policy": "no-referrer",
    "x-frame-options": "SAMEORIGIN",
    "x-content-type-options": "nosniff"
  };
}
var UNTRUSTED_CONTENT_SANDBOX_CSP = "sandbox allow-scripts allow-forms allow-popups allow-modals allow-downloads";
function relay(res, r) {
  res.writeHead(r.status, { "content-type": "application/json", "x-content-type-options": "nosniff" });
  res.end(r.text);
}
function sendHtml(res, status, html) {
  res.writeHead(status, withSecurityHeaders({ "content-type": "text/html; charset=utf-8" }));
  res.end(html);
}
function relayCoreRequest(req, res) {
  const core = new URL(CORE_API_URL);
  const headers = proxyHeaders(req.headers);
  headers.host = core.host;
  const request = core.protocol === "https:" ? httpsRequest : httpRequest;
  const upstream = request(
    {
      protocol: core.protocol,
      hostname: core.hostname,
      port: core.port || void 0,
      method: req.method,
      path: req.url,
      headers
    },
    (upstreamResponse) => {
      const responseHeaders = proxyHeaders(upstreamResponse.headers);
      res.writeHead(upstreamResponse.statusCode ?? 502, responseHeaders);
      upstreamResponse.on("error", () => res.destroy());
      upstreamResponse.pipe(res);
    }
  );
  upstream.on("error", () => {
    if (!res.headersSent) json(res, 502, { error: "bad_gateway", message: "core unavailable" });
    else res.end();
  });
  req.on("error", () => upstream.destroy());
  res.on("close", () => {
    if (!res.writableFinished) upstream.destroy();
  });
  req.pipe(upstream);
}
var SSE_CORE_POLL_MS = 100;
var SSE_STALE_POLL_MS = 1e3;
var SSE_IDLE_MS = 6 * 6e4;
var SSE_STALE_GRACE_MS = 10 * 6e4;
var SSE_HEARTBEAT_MS = 15e3;
function sleep(ms) {
  return new Promise((r) => {
    const t = setTimeout(r, ms);
    t.unref?.();
  });
}
function sseEvent(res, event, data) {
  res.write(`event: ${event}
data: ${JSON.stringify(data)}

`);
}
function mayManageDeployment(d3) {
  return d3.permission === "write";
}
async function gateManageDeployment(res, user, id) {
  const r = await coreFetch("GET", `/v1/deployments?principalId=${encodeURIComponent(user)}`);
  if (r.status !== 200) {
    relay(res, r);
    return false;
  }
  let list;
  try {
    list = JSON.parse(r.text).deployments ?? [];
  } catch {
    json(res, 502, { error: "bad_core_response" });
    return false;
  }
  const d3 = list.find((x2) => x2.id === id || x2.name === id);
  if (!d3) {
    json(res, 404, { error: "not_found" });
    return false;
  }
  if (!mayManageDeployment(d3)) {
    json(res, 403, { error: "forbidden", message: "you do not manage this deployment" });
    return false;
  }
  return true;
}
function callbackHtml(query) {
  const safe = query.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c
  );
  return `<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0; url=../../../?${safe}"><title>Connector</title>`;
}
function conversationForScope(user, threadRef, scope, channelName) {
  if (!scope || scope === `personal:${user}`) return { kind: "dm", threadRef };
  const sep = scope.indexOf(":");
  const kind = scope.slice(0, sep);
  const ref = scope.slice(sep + 1);
  if (kind !== "channel" && kind !== "group" || !ref) return null;
  return { kind, channelRef: ref, threadRef, ...channelName ? { channelName } : {} };
}
function authenticate(req) {
  let user;
  let name;
  let impersonator;
  const raw = req.headers[PORTAL_IDENTITY_HEADER];
  const token = Array.isArray(raw) ? raw[0] : raw;
  const claims = token && PORTAL_IDENTITY_SECRET ? verifyPortalIdentity(token, PORTAL_IDENTITY_SECRET, Date.now()) : null;
  if (claims) {
    user = claims.p;
    name = claims.n ?? null;
    impersonator = claims.imp ?? null;
  } else {
    if (!COOKIE_AUTH) return { denied: "unauthenticated" };
    user = cookie(req, "webuiuser");
    name = cookie(req, "webuiuser_name");
    impersonator = cookie(req, "webui_impersonator");
  }
  if (!user) return { denied: "unauthenticated" };
  if (ALLOW.length > 0 && !ALLOW.includes(user)) return { denied: "not_allowed" };
  return { identity: { user, name: name?.trim() || null, impersonator: impersonator ?? null } };
}
function resolveIdentity(req) {
  const outcome = authenticate(req);
  return "identity" in outcome ? outcome.identity : null;
}
function cookieUser(req) {
  return resolveIdentity(req)?.user ?? null;
}
function unauthorized(res, req) {
  const outcome = authenticate(req);
  const denied = "denied" in outcome ? outcome.denied : "unauthenticated";
  return json(res, 401, { error: "sign in", mode: AUTH_MODE, reason: denied });
}
var SESSION_TTL_S = 90 * 24 * 60 * 60;
function sessionCookie(id) {
  return `webuiuser=${encodeURIComponent(id)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${SESSION_TTL_S}`;
}
var MAX_BODY_BYTES = 1e6;
var readBody2 = (req) => readBody(req, MAX_BODY_BYTES);
var slackUrlCache = new I({ max: 1, ttl: 5 * 6e4 });
async function slackWorkspaceUrl() {
  const hit = slackUrlCache.get("url");
  if (hit) return hit.url;
  let urlValue = null;
  try {
    const r = await coreFetch("GET", "/v1/directory/meta");
    if (r.status === 200) urlValue = JSON.parse(r.text).workspaceUrl ?? null;
  } catch {
  }
  slackUrlCache.set("url", { url: urlValue });
  return urlValue;
}
var WEB_DELIVERY_POLL_MS = Number(process.env.WEB_DELIVERY_POLL_MS ?? 2500);
var WEB_DELIVERY_GIVEUP_MS = 6e4;
var deliveriesPollInFlight = false;
async function drainWebDeliveries() {
  if (deliveriesPollInFlight) return;
  deliveriesPollInFlight = true;
  try {
    const r = await coreFetch("GET", "/v1/deliveries?type=web");
    if (r.status !== 200) return;
    let pending = [];
    try {
      pending = JSON.parse(r.text).deliveries ?? [];
    } catch {
      return;
    }
    const now = Date.now();
    for (const d3 of pending) {
      const target = d3.destination?.target ?? "";
      const isRecovery = d3.idempotencyKey.startsWith("run:");
      const conns = !isRecovery ? deliveryClients.get(ownerOfWebThread(target) ?? "") : void 0;
      if (conns && conns.size) {
        for (const res of conns) sseEvent(res, "delivery", { threadRef: target });
      } else if (!isRecovery && now - (d3.createdAt ?? 0) < WEB_DELIVERY_GIVEUP_MS) {
        continue;
      }
      await coreFetch("POST", `/v1/deliveries/${encodeURIComponent(d3.id)}/ack`).catch(() => {
      });
    }
  } catch {
  } finally {
    deliveriesPollInFlight = false;
  }
}
var STATE_FEED_RECONNECT_MS = Number(process.env.STATE_FEED_RECONNECT_MS ?? 3e3);
function forwardSessionState(frame) {
  const threadRef = typeof frame.threadRef === "string" ? frame.threadRef : "";
  if (!threadRef) return;
  const targets = new Set(
    Array.isArray(frame.participants) ? frame.participants.filter((p) => typeof p === "string") : []
  );
  if (targets.size === 0) {
    const owner = ownerOfWebThread(threadRef);
    if (owner) targets.add(owner);
  }
  const { participants: _participants, ...visible } = frame;
  for (const user of targets) {
    for (const res of deliveryClients.get(user) ?? []) sseEvent(res, "session_state", visible);
  }
}
async function runStateFeed() {
  let dropped = false;
  for (; ; ) {
    try {
      const signedPath = withSourceAuthNonce("/v1/session-state/events", CORE_SIGNING_SECRET);
      const r = await fetch(`${CORE_API_URL}${signedPath}`, {
        headers: signedHeaders(CORE_SIGNING_SECRET, "GET", signedPath, "")
      });
      if (r.status === 200 && r.body) {
        if (dropped) {
          dropped = false;
          for (const conns of deliveryClients.values())
            for (const res of conns) sseEvent(res, "session_state_resync", {});
        }
        const reader = r.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        for (; ; ) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const frames = buf.split("\n\n");
          buf = frames.pop() ?? "";
          for (const frame of frames) {
            if (!frame.split("\n").some((l) => l === "event: session_state")) continue;
            const data = frame.split("\n").find((l) => l.startsWith("data: "))?.slice("data: ".length);
            if (!data) continue;
            try {
              forwardSessionState(JSON.parse(data));
            } catch {
            }
          }
        }
      }
      dropped = true;
    } catch {
      dropped = true;
    }
    await new Promise((resolve) => setTimeout(resolve, STATE_FEED_RECONNECT_MS));
  }
}
async function coreFetch(method, pathWithQuery, rawBody = "", timeoutMs) {
  const signedPath = withSourceAuthNonce(pathWithQuery, CORE_SIGNING_SECRET);
  const portalTok = portalTokenStore.getStore();
  const r = await fetch(`${CORE_API_URL}${signedPath}`, {
    method,
    headers: {
      ...signedHeaders(CORE_SIGNING_SECRET, method, signedPath, rawBody),
      ...portalTok ? { [PORTAL_IDENTITY_HEADER]: portalTok } : {}
    },
    ...rawBody ? { body: rawBody } : {},
    ...timeoutMs ? { signal: AbortSignal.timeout(timeoutMs) } : {},
    redirect: "manual"
  });
  return { status: r.status, text: await r.text() };
}
async function coreFetchCap(method, pathWithQuery, rawBody = "") {
  const cap = await coreFetch("POST", "/v1/session-cap", "");
  if (cap.status !== 200) return { status: cap.status === 401 ? 401 : 503, text: cap.text };
  let token;
  try {
    token = JSON.parse(cap.text).token;
  } catch {
    token = void 0;
  }
  if (!token)
    return { status: 503, text: JSON.stringify({ error: "not_configured", message: "no session capability" }) };
  const r = await fetch(`${CORE_API_URL}${pathWithQuery}`, {
    method,
    headers: { "content-type": "application/json", [CAPABILITY_HEADER]: token },
    ...rawBody ? { body: rawBody } : {},
    redirect: "manual"
  });
  return { status: r.status, text: await r.text() };
}
async function relayCore(res, method, pathWithQuery, rawBody = "") {
  relay(res, await coreFetch(method, pathWithQuery, rawBody));
}
async function relayCap(res, method, pathWithQuery, rawBody = "") {
  relay(res, await coreFetchCap(method, pathWithQuery, rawBody));
}
async function readJson(req, res, allowEmpty = true) {
  try {
    const raw = await readBody2(req);
    if (!raw && !allowEmpty) {
      json(res, 400, { error: "bad_request" });
      return null;
    }
    const parsed = JSON.parse(raw || "{}");
    if (typeof parsed !== "object" || parsed === null) {
      json(res, 400, { error: "bad_request" });
      return null;
    }
    return parsed;
  } catch (e) {
    if (e instanceof PayloadTooLargeError) throw e;
    json(res, 400, { error: "bad_request" });
    return null;
  }
}
async function postTurnAndMint(res, turn, user, threadRef) {
  const r = await coreFetch("POST", `/v1/turns?async=1`, JSON.stringify(turn));
  if (r.status >= 200 && r.status < 300) {
    try {
      const parsed = JSON.parse(r.text);
      const runId = parsed.runId;
      if (runId) {
        rememberRun(runId, user, threadRef);
        return json(res, r.status, parsed);
      }
    } catch {
    }
  }
  relay(res, r);
}
async function userPermissions() {
  if (!CORE_SIGNING_SECRET) return [];
  try {
    const r = await coreFetchCap("GET", "/v1/admin/whoami");
    if (r.status !== 200) return [];
    const j2 = JSON.parse(r.text);
    return Array.isArray(j2.permissions) ? j2.permissions.filter((p) => typeof p === "string") : [];
  } catch {
    return [];
  }
}
async function setWebhookEnabledViaCore(res, user, id, verb) {
  const r = await coreFetch("GET", `/v1/webhooks?viewer=${encodeURIComponent(user)}`);
  if (r.status < 200 || r.status >= 300) return relay(res, r);
  let webhooks = [];
  try {
    webhooks = JSON.parse(r.text).webhooks ?? [];
  } catch {
  }
  if (!webhooks.some((w) => w.id === id)) return json(res, 404, { error: "not_found" });
  return relayCore(
    res,
    "POST",
    `/v1/webhooks/${encodeURIComponent(id)}/${verb}?principalId=${encodeURIComponent(user)}`
  );
}
function uploadFileName(url) {
  return url.searchParams.get("name")?.trim() || "file";
}
async function stageUploadStream(req, sha256) {
  const corePath = withSourceAuthNonce("/v1/blobs", CORE_SIGNING_SECRET);
  const headers = {
    ...signedHeaders(CORE_SIGNING_SECRET, "POST", corePath, "", sha256),
    "content-type": "application/octet-stream",
    "x-content-sha256": sha256
  };
  return fetch(`${CORE_API_URL}${corePath}`, {
    method: "POST",
    headers,
    body: req,
    duplex: "half"
  });
}
function declaredSha(url) {
  return url.searchParams.get("sha") ?? "";
}
async function uploadBlobFromRequest(req, res, sha256) {
  if (!/^[0-9a-f]{64}$/.test(sha256)) {
    req.resume();
    return json(res, 400, { error: "bad_request", message: "sha (hex sha-256) required" });
  }
  const staged = await stageUploadStream(req, sha256);
  res.writeHead(staged.status, { "content-type": staged.headers.get("content-type") ?? "application/json" });
  return void res.end(await staged.text());
}
async function uploadFileFromRequest(req, res, user, scope, sha256, name) {
  if (!/^[0-9a-f]{64}$/.test(sha256)) {
    req.resume();
    return json(res, 400, { error: "bad_request", message: "sha (hex sha-256) required" });
  }
  const staged = await stageUploadStream(req, sha256);
  const stagedText = await staged.text();
  if (!staged.ok) {
    res.writeHead(staged.status, { "content-type": staged.headers.get("content-type") ?? "application/json" });
    return void res.end(stagedText);
  }
  const stagedBody = JSON.parse(stagedText);
  const body = JSON.stringify({
    principalId: user,
    ...scope ? { scopeId: scope } : {},
    name,
    mimetype: typeof req.headers["content-type"] === "string" ? req.headers["content-type"] : "application/octet-stream",
    blobId: stagedBody.blobId
  });
  const registered = await coreFetch("POST", "/v1/files/upload", body);
  res.writeHead(registered.status, { "content-type": "application/json" });
  return void res.end(registered.text);
}
async function serveStatic(res, urlPath) {
  const rel = normalize(decodeURIComponent(urlPath)).replace(/^(\.\.[/\\])+/, "");
  let filePath = join(DIST, rel);
  if (!filePath.startsWith(DIST)) return void json(res, 403, { error: "forbidden" });
  const isFile = existsSync(filePath) && statSync(filePath).isFile();
  const immutable = isFile && /(?:^|[/\\])assets[/\\]/.test(rel);
  if (!isFile) {
    if (extname(rel)) return void json(res, 404, { error: "not_found" });
    filePath = join(DIST, "index.html");
    if (!existsSync(filePath)) {
      return void json(res, 503, { error: "not_built", message: "run `npm run build` to produce dist-web/" });
    }
  }
  if (filePath.endsWith("index.html")) {
    const branded = await brandIndexHtml(readFileSync(filePath, "utf8"));
    res.writeHead(
      200,
      withSecurityHeaders({ "content-type": "text/html; charset=utf-8", "cache-control": "no-cache" })
    );
    return void res.end(branded);
  }
  const type = CONTENT_TYPES[extname(filePath)] ?? "application/octet-stream";
  res.writeHead(
    200,
    withSecurityHeaders({
      "content-type": type,
      "cache-control": immutable ? "public, max-age=31536000, immutable" : "no-cache"
    })
  );
  createReadStream(filePath).pipe(res);
}
var APPS_FRAME_DOMAIN = (process.env.DEPLOY_APPS_DOMAIN ?? "").toLowerCase();
async function serveAppEditHtml(req, res, url) {
  const slug = (url.searchParams.get("slug") ?? "").toLowerCase();
  if (!APPS_FRAME_DOMAIN || !/^[a-z0-9-]{1,63}$/.test(slug)) return false;
  let html;
  if (vite) {
    const raw = readFileSync(join(ROOT, "index.html"), "utf8").replace("%BASE_URL%favicon.svg", "favicon.svg");
    html = await vite.transformIndexHtml(req.url ?? "/", raw);
  } else {
    const filePath = join(DIST, "index.html");
    if (!existsSync(filePath)) return false;
    html = readFileSync(filePath, "utf8");
  }
  const headers = withSecurityHeaders({ "content-type": "text/html; charset=utf-8", "cache-control": "no-cache" });
  headers["content-security-policy"] = SPA_CSP.replace(
    "frame-ancestors 'self'",
    `frame-ancestors 'self' ${slug}.${APPS_FRAME_DOMAIN}`
  );
  delete headers["x-frame-options"];
  res.removeHeader("x-frame-options");
  res.writeHead(200, headers);
  res.end(await brandIndexHtml(html));
  return true;
}
var vite;
async function createVite(server2) {
  if (!WEB_UI_DEV) return void 0;
  const importVite = new Function("specifier", "return import(specifier)");
  const { createServer: createViteServer } = await importVite("vite");
  return createViteServer({
    root: ROOT,
    configFile: join(ROOT, "vite.config.ts"),
    appType: "custom",
    server: {
      middlewareMode: true,
      hmr: { server: server2 }
    }
  });
}
async function serveVite(req, res, path) {
  if (!vite) return false;
  await new Promise((resolve, reject) => {
    let done = false;
    const cleanup = () => {
      res.off("finish", finish);
      res.off("close", finish);
    };
    const finish = () => {
      if (done) return;
      done = true;
      cleanup();
      resolve();
    };
    res.once("finish", finish);
    res.once("close", finish);
    vite.middlewares(req, res, (err) => {
      if (done) return;
      done = true;
      cleanup();
      if (err) reject(err);
      else resolve();
    });
  });
  if (res.headersSent || res.writableEnded) return true;
  if (extname(path)) return false;
  let html = readFileSync(join(ROOT, "index.html"), "utf8");
  html = html.replace("%BASE_URL%favicon.svg", "favicon.svg");
  html = await vite.transformIndexHtml(req.url ?? "/", html);
  sendHtml(res, 200, await brandIndexHtml(html));
  return true;
}
var apiRoutes = [
  {
    match: (_method, pathname) => pathname === "/me",
    handle: async (c) => {
      const { req, res, user } = c;
      res.setHeader("set-cookie", sessionCookie(user));
      const permissions = await userPermissions();
      return json(res, 200, {
        user,
        org: CORE_ORG_ID,
        mode: AUTH_MODE,
        slackWorkspaceUrl: await slackWorkspaceUrl(),
        impersonatedBy: resolveIdentity(req)?.impersonator ?? null,
        permissions
      });
    }
  },
  {
    method: "POST",
    path: "/api/blobs",
    handle: async (c) => {
      const { req, res, url } = c;
      return uploadBlobFromRequest(req, res, declaredSha(url));
    }
  },
  {
    method: "POST",
    path: "/api/files/upload",
    handle: async (c) => {
      const { req, res, url, user } = c;
      return uploadFileFromRequest(
        req,
        res,
        user,
        url.searchParams.get("scope"),
        declaredSha(url),
        uploadFileName(url)
      );
    }
  },
  {
    method: "GET",
    path: "/api/search",
    handle: async (c) => {
      const { res, url, user } = c;
      const q = url.searchParams.get("q") ?? "";
      const limit = url.searchParams.get("limit");
      return relayCore(
        res,
        "GET",
        `/v1/sessions/search?principalId=${encodeURIComponent(user)}&q=${encodeURIComponent(q)}${limit ? `&limit=${encodeURIComponent(limit)}` : ""}`
      );
    }
  },
  {
    method: "GET",
    path: "/api/sessions",
    handle: async (c) => {
      const { res, user } = c;
      return relayCore(res, "GET", `/v1/sessions?principalId=${encodeURIComponent(user)}`);
    }
  },
  {
    method: "GET",
    path: "/api/contexts",
    handle: async (c) => {
      const { res, user } = c;
      return relayCore(res, "GET", `/v1/contexts?principalId=${encodeURIComponent(user)}`);
    }
  },
  {
    method: "GET",
    path: "/api/contexts/:scope/ambient-policy",
    handle: async (c) => {
      const { res, user } = c;
      const scope = c.params.scope;
      return relayCore(
        res,
        "GET",
        `/v1/contexts/policy?principalId=${encodeURIComponent(user)}&scope=${encodeURIComponent(scope)}`
      );
    }
  },
  {
    method: "PUT",
    path: "/api/contexts/:scope/ambient-policy",
    handle: async (c) => {
      const { req, res, user } = c;
      const scope = c.params.scope;
      const p = await readJson(
        req,
        res
      );
      if (!p) return;
      return relayCore(
        res,
        "PUT",
        "/v1/contexts/policy",
        JSON.stringify({
          principalId: user,
          scope,
          orders: p.orders,
          bots: p.bots,
          ambientEnabled: p.ambientEnabled,
          baseUpdatedAt: p.baseUpdatedAt
        })
      );
    }
  },
  {
    method: "POST",
    path: "/api/projects",
    handle: async (c) => {
      const { req, res, user } = c;
      const p = await readJson(req, res);
      if (!p) return;
      const name = typeof p.name === "string" ? p.name.trim().slice(0, 200) : "";
      if (!name) return json(res, 400, { error: "bad_request", message: "name required" });
      return relayCore(res, "POST", "/v1/projects", JSON.stringify({ principalId: user, name }));
    }
  },
  {
    method: "PATCH",
    path: "/api/projects/:id",
    handle: async (c) => {
      const { req, res, user } = c;
      const id = c.params.id;
      const p = await readJson(req, res);
      if (!p) return;
      const name = typeof p.name === "string" ? p.name.trim().slice(0, 200) : "";
      if (!name) return json(res, 400, { error: "bad_request", message: "name required" });
      return relayCore(
        res,
        "PATCH",
        `/v1/projects/${encodeURIComponent(id)}`,
        JSON.stringify({ principalId: user, name })
      );
    }
  },
  {
    method: "POST",
    path: "/api/projects/:id/members",
    handle: async (c) => {
      const { req, res, user } = c;
      const id = c.params.id;
      const p = await readJson(req, res);
      if (!p) return;
      const memberId = typeof p.memberId === "string" ? p.memberId.trim() : "";
      if (!memberId) return json(res, 400, { error: "bad_request", message: "memberId required" });
      return relayCore(
        res,
        "POST",
        `/v1/projects/${encodeURIComponent(id)}/members`,
        JSON.stringify({ principalId: user, memberId })
      );
    }
  },
  {
    method: "PUT",
    path: "/api/projects/:id/slack-channel",
    handle: async (c) => {
      const { req, res, user } = c;
      const id = c.params.id;
      const p = await readJson(req, res);
      if (!p) return;
      const channel = typeof p.channel === "string" ? p.channel.trim().slice(0, 200) : "";
      if (!channel) return json(res, 400, { error: "bad_request", message: "channel required" });
      return relayCore(
        res,
        "PUT",
        `/v1/projects/${encodeURIComponent(id)}/slack-channel`,
        JSON.stringify({ principalId: user, channel })
      );
    }
  },
  {
    method: "DELETE",
    path: "/api/projects/:id/slack-channel",
    handle: async (c) => {
      const { res, user } = c;
      const id = c.params.id;
      return relayCore(
        res,
        "DELETE",
        `/v1/projects/${encodeURIComponent(id)}/slack-channel`,
        JSON.stringify({ principalId: user })
      );
    }
  },
  {
    method: "DELETE",
    path: "/api/projects/:id/members/:memberId",
    handle: async (c) => {
      const { res, user } = c;
      const id = c.params.id;
      const memberId = c.params.memberId;
      return relayCore(
        res,
        "DELETE",
        `/v1/projects/${encodeURIComponent(id)}/members/${encodeURIComponent(memberId)}`,
        JSON.stringify({ principalId: user })
      );
    }
  },
  {
    method: "GET",
    path: "/api/directory/resolve",
    handle: async (c) => {
      const { res, url } = c;
      const q = (url.searchParams.get("q") ?? "").trim().slice(0, 80);
      if (!q) return json(res, 400, { error: "bad_request", message: "q required" });
      return relayCore(res, "GET", `/v1/directory/resolve?q=${encodeURIComponent(q)}`);
    }
  },
  {
    method: "GET",
    path: "/api/surface-config",
    handle: async (c) => {
      const { res } = c;
      return relayCore(res, "GET", "/v1/surface-config");
    }
  },
  {
    method: "GET",
    path: "/api/ui-state",
    handle: async (c) => {
      const { res, url, user } = c;
      const key = url.searchParams.get("key") ?? "";
      const qs = new URLSearchParams({ principalId: user, key });
      return relayCore(res, "GET", `/v1/ui-state?${qs.toString()}`);
    }
  },
  {
    method: "PUT",
    path: "/api/ui-state",
    handle: async (c) => {
      const { req, res, user } = c;
      const body = await readJson(req, res);
      if (!body) return;
      return relayCore(res, "PUT", "/v1/ui-state", JSON.stringify({ ...body, principalId: user }));
    }
  },
  {
    method: "GET",
    path: "/api/runtime-config",
    handle: async (c) => {
      const { res, url, user } = c;
      const scopeId = url.searchParams.get("scopeId") || `personal:${user}`;
      const qs = new URLSearchParams({ principalId: user, scopeId });
      return relayCore(res, "GET", `/v1/runtime-config?${qs.toString()}`);
    }
  },
  {
    method: "PUT",
    path: "/api/runtime-config",
    handle: async (c) => {
      const { req, res, user } = c;
      const body = await readJson(req, res);
      if (!body) return;
      const scopeId = typeof body.scopeId === "string" && body.scopeId ? body.scopeId : `personal:${user}`;
      return relayCore(res, "PUT", "/v1/runtime-config", JSON.stringify({ ...body, principalId: user, scopeId }));
    }
  },
  {
    method: "GET",
    path: "/api/channel-header-pin",
    handle: async (c) => {
      const { res, url, user } = c;
      const scopeId = url.searchParams.get("scopeId") || `personal:${user}`;
      const qs = new URLSearchParams({ principalId: user, scopeId });
      return relayCore(res, "GET", `/v1/channel-header-pin?${qs.toString()}`);
    }
  },
  {
    method: "PUT",
    path: "/api/channel-header-pin",
    handle: async (c) => {
      const { req, res, user } = c;
      const body = await readJson(req, res);
      if (!body) return;
      const scopeId = typeof body.scopeId === "string" && body.scopeId ? body.scopeId : `personal:${user}`;
      return relayCore(res, "PUT", "/v1/channel-header-pin", JSON.stringify({ ...body, principalId: user, scopeId }));
    }
  },
  {
    method: "GET",
    path: "/api/scope-resources",
    handle: async (c) => {
      const { res, url, user } = c;
      const scope = url.searchParams.get("scope");
      if (!scope) return json(res, 400, { error: "bad_request", message: "scope required" });
      const qs = new URLSearchParams({ principalId: user, scope });
      return relayCore(res, "GET", `/v1/scope-resources?${qs.toString()}`);
    }
  },
  {
    method: "GET",
    path: "/api/skills",
    handle: async (c) => {
      const { res, url, user } = c;
      const qs = new URLSearchParams({ principalId: user });
      if (url.searchParams.get("includeShadowed") === "1") qs.set("includeShadowed", "1");
      return relayCore(res, "GET", `/v1/skills?${qs.toString()}`);
    }
  },
  {
    method: "GET",
    path: "/api/skills/:id",
    handle: async (c) => {
      const { res, user } = c;
      const id = c.params.id;
      return relayCore(res, "GET", `/v1/skills/${encodeURIComponent(id)}?principalId=${encodeURIComponent(user)}`);
    }
  },
  {
    method: "POST",
    path: "/api/skills",
    handle: async (c) => {
      const { req, res, user } = c;
      const p = await readJson(req, res);
      if (!p) return;
      const draft = {};
      if (typeof p.name === "string") draft.name = p.name;
      if (typeof p.description === "string") draft.description = p.description;
      if (typeof p.body === "string") draft.body = p.body;
      if (typeof p.scopeId === "string") draft.scopeId = p.scopeId;
      return relayCore(res, "POST", "/v1/skills", JSON.stringify({ principalId: user, ...draft }));
    }
  },
  {
    method: "PUT",
    path: "/api/skills/:id",
    handle: async (c) => {
      const { req, res, user } = c;
      const id = c.params.id;
      const p = await readJson(req, res);
      if (!p) return;
      const patch = {};
      if (typeof p.description === "string") patch.description = p.description;
      if (typeof p.body === "string") patch.body = p.body;
      return relayCore(
        res,
        "PUT",
        `/v1/skills/${encodeURIComponent(id)}`,
        JSON.stringify({ principalId: user, ...patch })
      );
    }
  },
  {
    method: "DELETE",
    path: "/api/skills/:id",
    handle: async (c) => {
      const { res, user } = c;
      const id = c.params.id;
      return relayCore(res, "DELETE", `/v1/skills/${encodeURIComponent(id)}`, JSON.stringify({ principalId: user }));
    }
  },
  {
    method: "POST",
    path: "/api/skills/:id/restore",
    handle: async (c) => {
      const { res, user } = c;
      const id = c.params.id;
      return relayCore(
        res,
        "POST",
        `/v1/skills/${encodeURIComponent(id)}/restore`,
        JSON.stringify({ principalId: user })
      );
    }
  },
  {
    method: "POST",
    path: "/api/sessions/:id/title",
    handle: async (c) => {
      const { res, user } = c;
      const id = c.params.id;
      return relayCore(
        res,
        "POST",
        `/v1/sessions/${encodeURIComponent(id)}/title`,
        JSON.stringify({ principalId: user })
      );
    }
  },
  {
    method: "POST",
    path: "/api/sessions/:id/fork",
    handle: async (c) => {
      const { req, res, user } = c;
      const id = c.params.id;
      const p = await readJson(req, res);
      if (!p) return;
      const upToSeq = typeof p.upToSeq === "number" ? p.upToSeq : void 0;
      return relayCore(
        res,
        "POST",
        `/v1/sessions/${encodeURIComponent(id)}/fork`,
        JSON.stringify({ principalId: user, ...upToSeq !== void 0 ? { upToSeq } : {} })
      );
    }
  },
  {
    method: "GET",
    path: "/api/sessions/:id/approvals",
    handle: async (c) => {
      const { res, user } = c;
      const id = c.params.id;
      return relayCore(
        res,
        "GET",
        `/v1/sessions/${encodeURIComponent(id)}/approvals?viewer=${encodeURIComponent(user)}`
      );
    }
  },
  {
    method: "GET",
    path: "/api/sessions/:id/background/:pid/output",
    handle: async (c) => {
      const { res, url, user } = c;
      const id = c.params.id;
      const pid = c.params.pid;
      const sinceCursor = url.searchParams.get("sinceCursor") ?? "0";
      return relayCore(
        res,
        "GET",
        `/v1/sessions/${encodeURIComponent(id)}/background/${encodeURIComponent(pid)}/output?viewer=${encodeURIComponent(user)}&sinceCursor=${encodeURIComponent(sinceCursor)}`
      );
    }
  },
  {
    method: "GET",
    path: "/api/sessions/:id/background",
    handle: async (c) => {
      const { res, user } = c;
      const id = c.params.id;
      return relayCore(
        res,
        "GET",
        `/v1/sessions/${encodeURIComponent(id)}/background?viewer=${encodeURIComponent(user)}`
      );
    }
  },
  {
    method: "GET",
    path: "/api/sessions/:id/entries/:seq",
    handle: async (c) => {
      const { res, user } = c;
      const { id, seq } = c.params;
      if (!/^\d+$/.test(seq)) return json(c.res, 404, { error: "not found" });
      return relayCore(
        res,
        "GET",
        `/v1/sessions/${encodeURIComponent(id)}/entries/${seq}?viewer=${encodeURIComponent(user)}`
      );
    }
  },
  {
    method: "GET",
    path: "/api/sessions/:id",
    handle: async (c) => {
      const { res, url, user } = c;
      const id = c.params.id;
      const qs = new URLSearchParams({ viewer: user });
      for (const p of ["tailTurns", "sinceSeq", "beforeSeq"]) {
        const v = url.searchParams.get(p);
        if (v !== null) qs.set(p, v);
      }
      return relayCore(res, "GET", `/v1/sessions/${encodeURIComponent(id)}?${qs.toString()}`);
    }
  },
  {
    method: "GET",
    path: "/api/files/by-name/content",
    handle: async (c) => {
      const { res, url, user } = c;
      const name = url.searchParams.get("name")?.trim();
      if (!name) return json(res, 400, { error: "bad_request", message: "name required" });
      let cursor;
      let match;
      for (let page = 0; page < 50; page++) {
        const qs = new URLSearchParams({ viewer: user, limit: "200" });
        if (cursor) qs.set("cursor", cursor);
        const listed = await coreFetch("GET", `/v1/files?${qs.toString()}`);
        if (listed.status !== 200) return relay(res, listed);
        let body;
        try {
          body = JSON.parse(listed.text);
        } catch {
          return json(res, 502, { error: "upstream_error" });
        }
        for (const file of [...body.owned ?? [], ...body.shared ?? []]) {
          if (file.name !== name || file.openable === false || typeof file.id !== "string") continue;
          const createdAt = typeof file.createdAt === "number" ? file.createdAt : 0;
          if (!match || createdAt > match.createdAt) match = { id: file.id, createdAt };
        }
        cursor = body.nextCursor;
        if (!cursor) break;
      }
      if (!match) return json(res, 404, { error: "not_found" });
      res.writeHead(302, { location: `/api/files/${encodeURIComponent(match.id)}/content` });
      return res.end();
    }
  },
  {
    method: "GET",
    path: "/api/files/:id/content",
    handle: async (c) => {
      const { res, user } = c;
      const id = c.params.id;
      const corePath = withSourceAuthNonce(
        `/v1/files/${encodeURIComponent(id)}/content?viewer=${encodeURIComponent(user)}`,
        CORE_SIGNING_SECRET
      );
      const portalTok = portalTokenStore.getStore();
      const r = await fetch(`${CORE_API_URL}${corePath}`, {
        headers: {
          ...signedHeaders(CORE_SIGNING_SECRET, "GET", corePath, ""),
          ...portalTok ? { [PORTAL_IDENTITY_HEADER]: portalTok } : {}
        },
        redirect: "manual"
      });
      if (!r.ok || !r.body) {
        res.writeHead(r.status === 404 ? 404 : 502, { "content-type": "application/json" });
        return res.end(JSON.stringify({ error: r.status === 404 ? "not_found" : "upstream_error" }));
      }
      res.writeHead(200, {
        "content-type": r.headers.get("content-type") ?? "application/octet-stream",
        ...r.headers.get("content-length") ? { "content-length": r.headers.get("content-length") } : {},
        ...r.headers.get("content-disposition") ? { "content-disposition": r.headers.get("content-disposition") } : {},
        "content-security-policy": UNTRUSTED_CONTENT_SANDBOX_CSP,
        "x-content-type-options": "nosniff"
      });
      return Readable.fromWeb(r.body).pipe(res);
    }
  },
  {
    method: "GET",
    path: "/api/files",
    handle: async (c) => {
      const { res, url, user } = c;
      const qs = new URLSearchParams({ viewer: user });
      const limit = url.searchParams.get("limit");
      if (limit) qs.set("limit", limit);
      const cursor = url.searchParams.get("cursor");
      if (cursor) qs.set("cursor", cursor);
      const scope = url.searchParams.get("scope");
      if (scope) qs.set("scope", scope);
      return relayCore(res, "GET", `/v1/files?${qs.toString()}`);
    }
  },
  {
    method: "GET",
    path: "/api/memory",
    handle: async (c) => {
      const { res, user } = c;
      return relayCore(res, "GET", `/v1/memory?principalId=${encodeURIComponent(user)}`);
    }
  },
  {
    method: "GET",
    path: "/api/memory/history",
    handle: async (c) => {
      const { res, user } = c;
      return relayCore(res, "GET", `/v1/memory/history?principalId=${encodeURIComponent(user)}`);
    }
  },
  {
    method: "POST",
    path: "/api/memory/restore",
    handle: async (c) => {
      const { req, res, user } = c;
      const p = await readJson(req, res, false);
      if (!p) return;
      const revision = typeof p.revision === "string" ? p.revision : "";
      const expectedRevision = typeof p.expectedRevision === "string" ? p.expectedRevision : "";
      return relayCore(
        res,
        "POST",
        "/v1/memory/restore",
        JSON.stringify({ principalId: user, revision, expectedRevision })
      );
    }
  },
  {
    method: "PUT",
    path: "/api/memory",
    handle: async (c) => {
      const { req, res, user } = c;
      const p = await readJson(req, res, false);
      if (!p) return;
      if (typeof p.content !== "string")
        return json(res, 400, { error: "bad_request", message: "content must be a string" });
      const content = p.content;
      const revision = typeof p.revision === "string" ? p.revision : await coreFetch("GET", `/v1/memory?principalId=${encodeURIComponent(user)}`).then((head) => {
        try {
          return String(JSON.parse(head.text).revision ?? "");
        } catch {
          return "";
        }
      });
      return relayCore(res, "PUT", "/v1/memory", JSON.stringify({ principalId: user, content, revision }));
    }
  },
  {
    method: "POST",
    path: "/api/sessions/:id",
    handle: async (c) => {
      const { req, res, user } = c;
      const id = c.params.id;
      const p = await readJson(
        req,
        res,
        false
      );
      if (!p) return;
      const patch = {};
      if (p.title === null || typeof p.title === "string") patch.title = p.title;
      if (typeof p.archived === "boolean") patch.archived = p.archived;
      if (typeof p.pinned === "boolean") patch.pinned = p.pinned;
      if (p.color === null || typeof p.color === "string") patch.color = p.color;
      if (patch.title === void 0 && patch.archived === void 0 && patch.pinned === void 0 && patch.color === void 0) {
        return json(res, 400, { error: "bad_request", message: "title, archived, pinned, or color required" });
      }
      return relayCore(
        res,
        "POST",
        `/v1/sessions/${encodeURIComponent(id)}`,
        JSON.stringify({ principalId: user, ...patch })
      );
    }
  },
  {
    method: "GET",
    path: "/api/connectors",
    handle: async (c) => {
      const { res, user } = c;
      return relayCore(res, "GET", `/v1/connectors/oauth/status?principalId=${encodeURIComponent(user)}`);
    }
  },
  {
    method: "POST",
    path: "/api/connectors/:provider/start",
    handle: async (c) => {
      const { res, user } = c;
      const provider = c.params.provider;
      const callback = `${PUBLIC_URL}/v1/connectors/oauth/${encodeURIComponent(provider)}/callback`;
      const params = new URLSearchParams({ principalId: user, redirectUri: callback, returnTo: "/keychain" });
      const corePath = `/v1/connectors/oauth/${encodeURIComponent(provider)}/start?${params.toString()}`;
      return relayCore(res, "GET", corePath);
    }
  },
  {
    method: "POST",
    path: "/api/connectors/revoke",
    handle: async (c) => {
      const { req, res, user } = c;
      const p = await readJson(req, res, false);
      if (!p) return;
      const provider = typeof p.provider === "string" ? p.provider : "";
      const host = typeof p.host === "string" ? p.host : "";
      if (!provider && !host) return json(res, 400, { error: "bad_request", message: "provider or host required" });
      const rawBody = JSON.stringify({ principalId: user, ...provider ? { provider } : { host } });
      return relayCore(res, "POST", "/v1/connectors/oauth/revoke", rawBody);
    }
  },
  {
    method: "GET",
    path: "/api/keychain/credentials",
    handle: async (c) => {
      const { res } = c;
      return relayCap(res, "GET", "/v1/keychain/credentials");
    }
  },
  {
    method: "GET",
    path: "/api/keychain/overview",
    handle: async (c) => {
      const { res } = c;
      return relayCap(res, "GET", "/v1/keychain/overview");
    }
  },
  {
    method: "POST",
    path: "/api/keychain/grants/:id/revoke",
    handle: async (c) => {
      const { res } = c;
      const id = c.params.id;
      return relayCap(res, "POST", `/v1/keychain/grants/${encodeURIComponent(id)}/revoke`, "{}");
    }
  },
  {
    method: "POST",
    path: "/api/keychain/drops",
    handle: async (c) => {
      const { req, res } = c;
      const p = await readJson(req, res, false);
      if (!p) return;
      const draft = {
        ...typeof p.service === "string" ? { service: p.service } : {},
        ...typeof p.purpose === "string" ? { purpose: p.purpose } : {},
        ...typeof p.envKey === "string" ? { envKey: p.envKey } : {}
      };
      return relayCap(res, "POST", "/v1/keychain/drops", JSON.stringify(draft));
    }
  },
  {
    method: "DELETE",
    path: "/api/keychain/credentials/:id",
    handle: async (c) => {
      const { res } = c;
      const id = c.params.id;
      if (!id) return json(res, 400, { error: "bad_request", message: "credential id required" });
      return relayCap(res, "DELETE", `/v1/keychain/credentials/${encodeURIComponent(id)}`);
    }
  },
  {
    method: "GET",
    path: "/api/deployments/:id/owner-url",
    handle: async (c) => {
      const { res, user } = c;
      const id = c.params.id;
      if (!id || id.includes("/")) return json(res, 404, { error: "not_found" });
      return relayCore(
        res,
        "GET",
        `/v1/deployments/${encodeURIComponent(id)}/owner-url?principalId=${encodeURIComponent(user)}`
      );
    }
  },
  {
    method: "GET",
    path: "/api/deployments",
    handle: async (c) => {
      const { res, user } = c;
      const r = await coreFetch("GET", `/v1/deployments?principalId=${encodeURIComponent(user)}`);
      if (r.status !== 200) {
        return relay(res, r);
      }
      let deployments;
      try {
        const parsed = JSON.parse(r.text);
        deployments = parsed.deployments ?? [];
      } catch {
        return json(res, 502, { error: "bad_core_response" });
      }
      return json(res, 200, {
        deployments: deployments.map((d3) => ({ ...d3, webUrl: `/deployments/${encodeURIComponent(String(d3.id))}/` }))
      });
    }
  },
  {
    method: "GET",
    path: "/api/deployments/:id",
    handle: async (c) => {
      const { res, user } = c;
      const id = c.params.id;
      if (!id || id.includes("/")) return json(res, 404, { error: "not_found" });
      const r = await coreFetch(
        "GET",
        `/v1/deployments/${encodeURIComponent(id)}?principalId=${encodeURIComponent(user)}`
      );
      if (r.status !== 200) return relay(res, r);
      try {
        const parsed = JSON.parse(r.text);
        if (!parsed.deployment) return json(res, 502, { error: "bad_core_response" });
        return json(res, 200, {
          deployment: {
            ...parsed.deployment,
            webUrl: `/deployments/${encodeURIComponent(String(parsed.deployment.id))}/`
          }
        });
      } catch {
        return json(res, 502, { error: "bad_core_response" });
      }
    }
  },
  {
    method: "POST",
    path: "/api/deployments/:id/display-name",
    handle: async (c) => {
      const { req, res, user } = c;
      const id = c.params.id;
      if (!await gateManageDeployment(res, user, id)) return;
      const p = await readJson(req, res, false);
      if (!p) return;
      const displayName = String(p.displayName ?? "");
      return relayCore(
        res,
        "POST",
        `/v1/deployments/${encodeURIComponent(id)}/display-name`,
        JSON.stringify({ displayName })
      );
    }
  },
  {
    method: "POST",
    path: "/api/deployments/:id/name",
    handle: async (c) => {
      const { req, res, user } = c;
      const id = c.params.id;
      if (!await gateManageDeployment(res, user, id)) return;
      const p = await readJson(req, res, false);
      if (!p) return;
      const name = String(p.name ?? "");
      return relayCore(res, "POST", `/v1/deployments/${encodeURIComponent(id)}/name`, JSON.stringify({ name }));
    }
  },
  {
    method: "POST",
    path: "/api/deployments/:id/archive",
    handle: async (c) => {
      const { res, user } = c;
      const id = c.params.id;
      if (!await gateManageDeployment(res, user, id)) return;
      return relayCore(res, "POST", `/v1/deployments/${encodeURIComponent(id)}/archive`);
    }
  },
  {
    method: "POST",
    path: "/api/deployments/:id/restore",
    handle: async (c) => {
      const { res, user } = c;
      const id = c.params.id;
      if (!await gateManageDeployment(res, user, id)) return;
      return relayCore(
        res,
        "POST",
        `/v1/deployments/${encodeURIComponent(id)}/restore`,
        JSON.stringify({ principalId: user })
      );
    }
  },
  {
    method: "POST",
    path: "/api/approvals/:requestId",
    handle: async (c) => {
      const { req, res, user } = c;
      const requestId = c.params.requestId;
      if (!requestId || requestId.includes("/")) return json(res, 404, { error: "not_found" });
      let approved = false;
      let scope;
      try {
        const p = JSON.parse(await readBody2(req));
        approved = p.approved === true;
        if (p.scope === "once" || p.scope === "session" || p.scope === "always") scope = p.scope;
      } catch (e) {
        if (e instanceof PayloadTooLargeError) throw e;
      }
      const fetched = await coreFetch("GET", `/v1/approvals/${encodeURIComponent(requestId)}`);
      if (fetched.status !== 200) {
        res.writeHead(fetched.status, { "content-type": "application/json" });
        return res.end(fetched.text);
      }
      let record;
      try {
        record = JSON.parse(fetched.text);
      } catch {
        return json(res, 502, { error: "bad_core_response" });
      }
      const threadRef = typeof record.request?.conversation?.threadRef === "string" ? record.request.conversation.threadRef : "";
      const actor = typeof record.request?.actor?.externalId === "string" ? record.request.actor.externalId : "";
      if (!threadRef.startsWith("web:") || actor !== user || !record.request) {
        return json(res, 404, { error: "not_found" });
      }
      if (!threadRef.startsWith(`web:${user}:`)) {
        const sessionId = typeof record.sessionId === "string" ? record.sessionId : "";
        const visible = sessionId ? await coreFetch(
          "GET",
          `/v1/sessions/${encodeURIComponent(sessionId)}?viewer=${encodeURIComponent(user)}&tailTurns=1`
        ) : null;
        if (visible?.status !== 200) return json(res, 404, { error: "not_found" });
      }
      const approval = { requestId, approved, ...scope ? { scope } : {} };
      return postTurnAndMint(res, { ...record.request, approval }, user, threadRef);
    }
  },
  {
    method: "POST",
    path: "/api/turn",
    handle: async (c) => {
      const { req, res, user } = c;
      const ownPrefix = `web:${user}:`;
      let text = "";
      let threadRef = `${ownPrefix}default`;
      let model;
      let harness;
      let thinkingLevel;
      let fastMode;
      let timezone;
      let scope;
      let channelName;
      const attachments = [];
      let approval;
      let proactiveOpener = false;
      try {
        const p = JSON.parse(await readBody2(req));
        text = String(p.text ?? "");
        if (p.proactiveOpener === true) proactiveOpener = true;
        if (p.approval && typeof p.approval.requestId === "string" && typeof p.approval.approved === "boolean") {
          approval = {
            requestId: p.approval.requestId,
            approved: p.approval.approved,
            ...p.approval.scope === "once" || p.approval.scope === "session" || p.approval.scope === "always" ? { scope: p.approval.scope } : {}
          };
        }
        if (typeof p.threadRef === "string" && p.threadRef.startsWith("web:")) threadRef = p.threadRef;
        if (typeof p.scopeId === "string" && p.scopeId) scope = p.scopeId;
        if (typeof p.channelName === "string" && p.channelName.trim()) channelName = p.channelName.trim().slice(0, 200);
        if (typeof p.model === "string" && p.model) model = p.model;
        if (typeof p.harness === "string") harness = p.harness;
        if (typeof p.thinkingLevel === "string") thinkingLevel = p.thinkingLevel;
        if (typeof p.fastMode === "boolean") fastMode = p.fastMode;
        if (typeof p.timezone === "string" && p.timezone.trim()) timezone = p.timezone.trim().slice(0, 64);
        if (Array.isArray(p.attachments)) {
          for (const raw of p.attachments) {
            if (!raw || typeof raw !== "object") continue;
            const a = raw;
            if (typeof a.name !== "string" || typeof a.blobId !== "string" || !a.blobId) continue;
            attachments.push({
              name: a.name,
              mimetype: typeof a.mimetype === "string" && a.mimetype ? a.mimetype : "application/octet-stream",
              sizeBytes: typeof a.sizeBytes === "number" ? a.sizeBytes : 0,
              blobId: a.blobId
            });
          }
        }
      } catch (e) {
        if (e instanceof PayloadTooLargeError) throw e;
      }
      if (!text.trim() && attachments.length === 0 && !approval && !proactiveOpener)
        return json(res, 400, { error: "empty message" });
      if (!threadRef.startsWith(ownPrefix) && !(scope?.startsWith("channel:") || scope?.startsWith("group:"))) {
        return json(res, 403, {
          error: "forbidden_thread",
          message: "this conversation can only be continued from its own context"
        });
      }
      const conversation = conversationForScope(user, threadRef, scope, channelName);
      if (!conversation) {
        return json(res, 403, {
          error: "forbidden_scope",
          message: "you can only chat in your personal context or a shared context you're in"
        });
      }
      const displayName = resolveIdentity(req)?.name ?? null;
      const turn = {
        surface: "web",
        actor: { externalId: user, ...displayName ? { displayName } : {} },
        conversation,
        liveActor: true,
        deliveryTarget: threadRef,
        text,
        ...harness ? { harness } : {},
        ...model ? { model } : {},
        ...thinkingLevel ? { thinkingLevel } : {},
        ...typeof fastMode === "boolean" ? { fastMode } : {},
        ...timezone ? { timezone } : {},
        ...attachments.length ? { attachments } : {},
        ...approval ? { approval } : {},
        ...proactiveOpener ? { proactiveOpener: true } : {}
      };
      return postTurnAndMint(res, turn, user, threadRef);
    }
  },
  {
    method: "GET",
    path: "/api/deliveries/events",
    handle: async (c) => {
      const { req, res, user } = c;
      res.writeHead(200, {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache, no-transform",
        connection: "keep-alive",
        "x-accel-buffering": "no"
      });
      res.write(": open\n\n");
      let set = deliveryClients.get(user);
      if (!set) {
        set = /* @__PURE__ */ new Set();
        deliveryClients.set(user, set);
      }
      set.add(res);
      const beat = setInterval(() => res.write(": ping\n\n"), SSE_HEARTBEAT_MS);
      beat.unref?.();
      req.on("close", () => {
        clearInterval(beat);
        const s = deliveryClients.get(user);
        if (s) {
          s.delete(res);
          if (!s.size) deliveryClients.delete(user);
        }
      });
      return;
    }
  },
  {
    method: "GET",
    path: "/api/runs/active",
    handle: async (c) => {
      const { res, url, user } = c;
      const threadRef = url.searchParams.get("threadRef") ?? "";
      if (!threadRef.startsWith("web:")) return json(res, 404, { error: "not_found" });
      let queued = [];
      let durableRunId = null;
      const durable = await coreFetch("GET", `/v1/runs?threadRef=${encodeURIComponent(threadRef)}`);
      if (durable.status >= 200 && durable.status < 300) {
        try {
          const parsed = JSON.parse(durable.text);
          durableRunId = parsed.runId ?? null;
          queued = parsed.queued ?? [];
        } catch {
        }
      }
      const tryRun = async (runId, ownedByUser = true) => {
        const r = await coreFetch("GET", `/v1/runs/${encodeURIComponent(runId)}`);
        if (r.status < 200 || r.status >= 300) {
          if (ownedByUser) forgetRun(runId);
          return false;
        }
        let run;
        try {
          run = JSON.parse(r.text);
        } catch {
          json(res, 502, { error: "bad_core_response" });
          return true;
        }
        if (run.status === "done" || run.status === "failed") {
          forgetRun(runId);
          return false;
        }
        rememberRun(runId, user, threadRef);
        const waiting = queued.filter((q) => q.runId !== runId);
        json(res, 200, { runId, run, ...waiting.length ? { queued: waiting } : {} });
        return true;
      };
      if (durableRunId && await tryRun(durableRunId, false)) return;
      for (const runId of Array.from(activeRunsByThread.get(threadKey(user, threadRef)) ?? [])) {
        if (await tryRun(runId)) return;
      }
      json(res, 200, { runId: null, run: null, ...queued.length ? { queued } : {} });
      return;
    }
  },
  {
    method: "POST",
    path: "/api/runs/:id/signal",
    handle: async (c) => {
      const { req, res } = c;
      const id = c.params.id;
      const p = await readJson(req, res, false);
      if (!p) return;
      const kind = typeof p.kind === "string" ? p.kind : "";
      const text = typeof p.text === "string" ? p.text : void 0;
      return relayCore(
        res,
        "POST",
        `/v1/runs/${encodeURIComponent(id)}/signal`,
        JSON.stringify({ kind, ...text !== void 0 ? { text } : {} })
      );
    }
  },
  {
    method: "POST",
    path: "/api/runs/:id/withdraw",
    handle: async (c) => {
      const { res } = c;
      const id = c.params.id;
      const r = await coreFetch("POST", `/v1/runs/${encodeURIComponent(id)}/withdraw`);
      if (r.status >= 200 && r.status < 300) forgetRun(id);
      return relay(res, r);
    }
  },
  {
    method: "GET",
    path: "/api/runs/:id/events",
    handle: async (c) => {
      const { req, res, user } = c;
      const id = c.params.id;
      let closed = false;
      req.on("close", () => {
        closed = true;
      });
      if (!ownsRun(id, user)) {
        const auth = await coreFetch("GET", `/v1/runs/${encodeURIComponent(id)}`);
        if (auth.status < 200 || auth.status >= 300)
          return json(res, auth.status === 404 ? 404 : 502, {
            error: auth.status === 404 ? "not_found" : "upstream_error"
          });
      }
      if (closed) return;
      res.writeHead(200, {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache, no-transform",
        connection: "keep-alive",
        "x-accel-buffering": "no"
      });
      res.write(": open\n\n");
      let acc = "";
      let activityLen = 0;
      let lastStale = null;
      let staleSince = null;
      let lastProgressAt = Date.now();
      let lastBeat = lastProgressAt;
      for (; ; ) {
        if (closed) return;
        let r;
        try {
          r = await coreFetch("GET", `/v1/runs/${encodeURIComponent(id)}`);
        } catch {
          try {
            r = await coreFetch("GET", `/v1/runs/${encodeURIComponent(id)}`);
          } catch {
            sseEvent(res, "failed", { reason: "upstream_unreachable" });
            break;
          }
        }
        if (closed) return;
        if (r.status < 200 || r.status >= 300) {
          sseEvent(res, "failed", { reason: `HTTP ${r.status}` });
          break;
        }
        let run = {};
        let parsed = true;
        try {
          run = JSON.parse(r.text);
        } catch {
          parsed = false;
        }
        const now = Date.now();
        const partial = typeof run.partial === "string" ? run.partial : "";
        const activity = Array.isArray(run.activity) ? run.activity : [];
        if (partial.length > acc.length) {
          acc = partial;
          sseEvent(res, "partial", { partial: acc });
          lastProgressAt = now;
          lastBeat = now;
        }
        if (activity.length > activityLen) {
          activityLen = activity.length;
          sseEvent(res, "activity", { activity, startedAt: run.startedAt ?? null });
          lastProgressAt = now;
          lastBeat = now;
        }
        if (parsed) {
          if (run.stale === true) staleSince ??= now;
          else staleSince = null;
          if (run.stale === true !== lastStale) {
            lastStale = run.stale === true;
            sseEvent(res, "stale", { stale: lastStale });
            lastBeat = now;
          }
        }
        if (now - lastBeat > SSE_HEARTBEAT_MS) {
          if (run.alive === true) sseEvent(res, "alive", { at: now });
          else if (lastStale === true) sseEvent(res, "stale", { stale: true });
          else res.write(": ping\n\n");
          lastBeat = now;
        }
        if (run.alive === true || staleSince !== null && now - staleSince < SSE_STALE_GRACE_MS) lastProgressAt = now;
        const terminal = run.status === "done" || run.status === "failed" || run.result != null;
        if (terminal || run.replyComplete) {
          forgetRun(id);
          sseEvent(res, "done", {
            status: run.status ?? null,
            result: run.result ?? null,
            partial: acc,
            activity,
            replyComplete: run.replyComplete ?? false,
            startedAt: run.startedAt ?? null,
            finishedAt: run.finishedAt ?? null
          });
          break;
        }
        if (now - lastProgressAt > SSE_IDLE_MS) break;
        await sleep(lastStale === true ? SSE_STALE_POLL_MS : SSE_CORE_POLL_MS);
      }
      if (!closed) res.end();
      return;
    }
  },
  {
    method: "GET",
    path: "/api/runs/:id",
    handle: async (c) => {
      const { res } = c;
      const id = c.params.id;
      const r = await coreFetch("GET", `/v1/runs/${encodeURIComponent(id)}`);
      try {
        const s = JSON.parse(r.text).status;
        if (s === "done" || s === "failed") forgetRun(id);
      } catch {
      }
      return relay(res, r);
    }
  },
  {
    method: "GET",
    path: "/api/webhooks",
    handle: async (c) => {
      const { res, user } = c;
      return relay(res, await coreFetch("GET", `/v1/webhooks?viewer=${encodeURIComponent(user)}`));
    }
  },
  {
    method: "POST",
    path: "/api/webhooks",
    handle: async (c) => {
      const { req, res, user } = c;
      let action;
      let verification = { scheme: "hmac-sha256" };
      let filters;
      try {
        const p = JSON.parse(await readBody2(req));
        action = String(p.action ?? "").trim();
        if (p.verification !== void 0) {
          if (typeof p.verification !== "object" || p.verification === null || typeof p.verification.scheme !== "string") {
            return json(res, 400, {
              error: "unsupported_verification",
              message: "verification requires a scheme (HMAC-SHA256, GitHub, Slack, or Stripe)"
            });
          }
          verification = {
            scheme: p.verification.scheme,
            ...p.verification.secret ? { secret: String(p.verification.secret) } : {}
          };
        }
        if (p.filters !== void 0) {
          if (!Array.isArray(p.filters) || !p.filters.every((filter) => {
            if (!filter || typeof filter !== "object") return false;
            const candidate = filter;
            return typeof candidate.path === "string" && candidate.path.trim().length > 0 && Array.isArray(candidate.in) && candidate.in.length > 0 && candidate.in.every((value) => typeof value === "string" && value.trim().length > 0);
          }))
            return json(res, 400, {
              error: "invalid_filters",
              message: "every filter requires a path and at least one value"
            });
          filters = p.filters;
        }
        if (p.destination !== void 0) {
          return json(res, 400, {
            error: "invalid_destination",
            message: "choose webhook destinations with the agent so teammate and channel names can be resolved safely"
          });
        }
      } catch (e) {
        if (e instanceof PayloadTooLargeError) throw e;
        return json(res, 400, { error: "bad_request", message: "expected JSON body" });
      }
      if (!action)
        return json(res, 400, {
          error: "action_required",
          message: "an action (the agent's instructions) is required"
        });
      if (!["hmac-sha256", "github", "slack", "stripe"].includes(verification.scheme)) {
        return json(res, 400, {
          error: "unsupported_verification",
          message: "choose HMAC-SHA256, GitHub, Slack, or Stripe signature verification"
        });
      }
      if (!verification.secret) {
        verification = { ...verification, secret: randomBytes(32).toString("hex") };
      }
      const reqBody = JSON.stringify({
        ownerScopeId: `personal:${user}`,
        owner: user,
        createdBy: user,
        action,
        verification,
        ...filters ? { filters } : {}
      });
      return relay(res, await coreFetch("POST", "/v1/webhooks", reqBody));
    }
  },
  {
    method: "POST",
    path: "/api/webhooks/:id/disable",
    handle: (c) => setWebhookEnabledViaCore(c.res, c.user, c.params.id, "disable")
  },
  {
    method: "POST",
    path: "/api/webhooks/:id/enable",
    handle: (c) => setWebhookEnabledViaCore(c.res, c.user, c.params.id, "enable")
  },
  {
    method: "GET",
    path: "/api/crons",
    handle: async (c) => {
      const { res, user } = c;
      const r = await coreFetch("GET", `/v1/crons?viewer=${encodeURIComponent(user)}`);
      if (r.status < 200 || r.status >= 300) {
        return relay(res, r);
      }
      let crons = [];
      let visible = [];
      try {
        const parsed = JSON.parse(r.text);
        crons = parsed.crons ?? [];
        visible = parsed.visible ?? [];
      } catch {
      }
      return json(res, 200, { crons, visible });
    }
  },
  {
    method: "GET",
    path: "/api/crons/:id/runs",
    handle: async (c) => {
      const { res, user } = c;
      const id = c.params.id;
      return relay(
        res,
        await coreFetch(
          "GET",
          `/v1/crons/${encodeURIComponent(id)}/runs?principalId=${encodeURIComponent(user)}&limit=20`
        )
      );
    }
  },
  {
    method: "PATCH",
    path: "/api/crons/:id",
    handle: async (c) => {
      const { req, res, user } = c;
      const id = c.params.id;
      let patch = {};
      try {
        const p = JSON.parse(await readBody2(req));
        if ("title" in p) {
          if (typeof p.title !== "string")
            return json(res, 400, { error: "bad_request", message: "title must be a string" });
          patch = { ...patch, title: p.title.trim() };
        }
        if ("task" in p) {
          if (typeof p.task !== "string" || !p.task.trim())
            return json(res, 400, { error: "bad_request", message: "task must be a non-empty string" });
          patch = { ...patch, task: p.task.trim() };
        }
        if ("schedule" in p) patch = { ...patch, schedule: p.schedule };
        if ("enabled" in p) {
          if (typeof p.enabled !== "boolean")
            return json(res, 400, { error: "bad_request", message: "enabled must be a boolean" });
          patch = { ...patch, enabled: p.enabled };
        }
        if ("archived" in p) {
          if (typeof p.archived !== "boolean")
            return json(res, 400, { error: "bad_request", message: "archived must be a boolean" });
          patch = { ...patch, archived: p.archived };
        }
      } catch (e) {
        if (e instanceof PayloadTooLargeError) throw e;
        return json(res, 400, { error: "bad_request", message: "expected JSON body" });
      }
      if (Object.keys(patch).length === 0)
        return json(res, 400, {
          error: "bad_request",
          message: "expected title, task, schedule, enabled, or archived"
        });
      if (patch.archived === true) patch = { ...patch, enabled: false };
      return relayCore(
        res,
        "PATCH",
        `/v1/crons/${encodeURIComponent(id)}?principalId=${encodeURIComponent(user)}`,
        JSON.stringify(patch)
      );
    }
  },
  {
    method: "POST",
    path: "/api/crons/:id/disable",
    handle: async (c) => {
      const { res, user } = c;
      const id = c.params.id;
      return relayCore(
        res,
        "POST",
        `/v1/crons/${encodeURIComponent(id)}/disable?principalId=${encodeURIComponent(user)}`
      );
    }
  },
  {
    method: "POST",
    path: "/api/crons/:id/enable",
    handle: async (c) => {
      const { res, user } = c;
      const id = c.params.id;
      return relayCore(
        res,
        "PATCH",
        `/v1/crons/${encodeURIComponent(id)}?principalId=${encodeURIComponent(user)}`,
        JSON.stringify({ enabled: true, archived: false })
      );
    }
  },
  {
    method: "POST",
    path: "/api/crons/:id/run",
    handle: async (c) => {
      const { res, user } = c;
      const id = c.params.id;
      return relayCore(res, "POST", `/v1/crons/${encodeURIComponent(id)}/run?principalId=${encodeURIComponent(user)}`);
    }
  },
  {
    method: "DELETE",
    path: "/api/crons/:id",
    handle: async (c) => {
      const { res, user } = c;
      const id = c.params.id;
      return relayCore(res, "DELETE", `/v1/crons/${encodeURIComponent(id)}?principalId=${encodeURIComponent(user)}`);
    }
  }
];
var routeRequest = async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
  const path = url.pathname;
  const method = req.method ?? "GET";
  if (method === "GET" && path === "/healthz") return json(res, 200, { ok: true });
  if (method === "GET" && path === "/favicon.svg") {
    return serveEmojiFavicon(res, process.env.WEB_UI_FAVICON_EMOJI ?? "\u{1F3F4}\u200D\u2620\uFE0F", "no-cache");
  }
  if (method === "POST" && path === "/signin") {
    if (!COOKIE_AUTH) return json(res, 404, { error: "not_found" });
    const body = await readBody2(req);
    const id = (() => {
      try {
        return String(JSON.parse(body).user ?? "").trim();
      } catch {
        return "";
      }
    })();
    if (!id) return json(res, 400, { error: "bad_request", message: "Enter a principal to sign in as." });
    if (ALLOW.length > 0 && !ALLOW.includes(id))
      return json(res, 403, {
        error: "not_allowed",
        message: `${id.slice(0, 120)} isn't in this instance's allowed principals. Add it to WEB_UI_PRINCIPALS, or leave that unset to allow any principal.`
      });
    res.writeHead(200, {
      "set-cookie": sessionCookie(id),
      "content-type": "application/json"
    });
    return res.end(JSON.stringify({ ok: true, user: id }));
  }
  if (method === "POST" && path === "/signout") {
    res.writeHead(200, { "set-cookie": "webuiuser=; HttpOnly; Path=/; Max-Age=0", "content-type": "application/json" });
    return res.end(JSON.stringify({ ok: true }));
  }
  if (path === "/v1" || path.startsWith("/v1/")) return relayCoreRequest(req, res);
  const oauthCallbackPrefix = path.startsWith("/connectors/oauth/") ? "/connectors/oauth/" : null;
  if (method === "GET" && oauthCallbackPrefix && path.endsWith("/callback")) {
    const provider = path.slice(oauthCallbackPrefix.length, -"/callback".length);
    const corePath = `/v1/connectors/oauth/${encodeURIComponent(provider)}/callback${url.search}`;
    let ok;
    try {
      const r = await fetch(`${CORE_API_URL}${corePath}`, { redirect: "manual" });
      ok = r.status >= 200 && r.status < 300;
    } catch {
      ok = false;
    }
    const q = `view=keychain&connector=${encodeURIComponent(provider)}&status=${ok ? "connected" : "error"}`;
    return sendHtml(res, ok ? 200 : 400, callbackHtml(q));
  }
  if (path === "/me" || path.startsWith("/api/")) {
    const user = cookieUser(req);
    if (!user) return unauthorized(res, req);
    const found = findRoute(apiRoutes, method, path);
    if (!found) return json(res, 404, { error: "not found" });
    return found.route.handle({ req, res, url, user, params: found.params });
  }
  if (method === "GET" && path.startsWith("/deployments/")) {
    const user = cookieUser(req);
    if (!user) return unauthorized(res, req);
    const rest = path.slice("/deployments/".length);
    const slash = rest.indexOf("/");
    const id = decodeURIComponent(slash === -1 ? rest : rest.slice(0, slash));
    const subPath = slash === -1 ? "/" : rest.slice(slash);
    const corePath = `/d/${encodeURIComponent(id)}${subPath}${url.search}`;
    const portalTok = portalTokenStore.getStore();
    const headers = {
      ...signedHeaders(CORE_SIGNING_SECRET, method, corePath, "", user),
      "x-as-principal": user,
      ...portalTok ? { [PORTAL_IDENTITY_HEADER]: portalTok } : {}
    };
    delete headers["content-type"];
    const up = await fetch(`${CORE_API_URL}${corePath}`, { method, headers, redirect: "manual" });
    const outHeaders = Object.fromEntries(up.headers.entries());
    delete outHeaders["content-encoding"];
    delete outHeaders["content-length"];
    res.writeHead(up.status, {
      ...outHeaders,
      "content-security-policy": UNTRUSTED_CONTENT_SANDBOX_CSP,
      "x-content-type-options": "nosniff"
    });
    return res.end(Buffer.from(await up.arrayBuffer()));
  }
  if (method === "GET" && path === "/app-edit" && await serveAppEditHtml(req, res, url)) return;
  if (method === "GET") {
    if (await serveVite(req, res, path)) return;
    return await serveStatic(res, path === "/" ? "/index.html" : path);
  }
  json(res, 404, { error: "not found" });
};
var handler = async (req, res) => {
  res.setHeader("strict-transport-security", "max-age=63072000; includeSubDomains");
  res.setHeader("referrer-policy", "no-referrer");
  res.setHeader("x-content-type-options", "nosniff");
  res.setHeader("x-frame-options", "DENY");
  const raw = req.headers[PORTAL_IDENTITY_HEADER];
  const token = Array.isArray(raw) ? raw[0] : raw;
  try {
    await portalTokenStore.run(token, () => routeRequest(req, res));
  } catch (err) {
    if (err instanceof PayloadTooLargeError) {
      if (!res.headersSent) json(res, 413, { error: "payload_too_large", message: err.message });
      else res.end();
      return;
    }
    throw err;
  }
};
var server = createServer((req, res) => {
  void handler(req, res).catch((err) => {
    console.error("[web-ui] 502 %s %s: %s", req.method ?? "?", req.url ?? "?", String(err));
    if (!res.headersSent) json(res, 502, { error: "bad_gateway", message: "upstream error" });
    else res.end();
  });
});
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  createVite(server).then((v) => {
    vite = v;
    const ready = () => {
      const address = server.address();
      const shownHost = address && typeof address !== "string" ? address.address : HOST ?? "localhost";
      const shownPort = address && typeof address !== "string" ? address.port : PORT;
      const shownHostname = shownHost.includes(":") ? `[${shownHost}]` : shownHost;
      console.log(
        `[web-ui] surface on http://${shownHostname}:${shownPort} \u2192 core ${CORE_API_URL} (org ${CORE_ORG_ID})${WEB_UI_DEV ? " [vite hmr]" : ""}`
      );
      if (!WEB_UI_DEV && !existsSync(join(DIST, "index.html")))
        console.warn("[web-ui] dist-web/ not built \u2014 run `npm run build`");
      if (COOKIE_AUTH && ALLOW.length === 0)
        console.warn("[web-ui] WEB_UI_PRINCIPALS unset \u2014 any principal id may sign in (dev only)");
      const t = setInterval(() => void drainWebDeliveries(), WEB_DELIVERY_POLL_MS);
      t.unref?.();
      void runStateFeed();
    };
    if (HOST) server.listen(PORT, HOST, ready);
    else server.listen(PORT, ready);
  }).catch((err) => {
    console.error("[web-ui] failed to start:", String(err));
    process.exit(1);
  });
}
export {
  handler
};
