/* =========================================================
   間取りビューア「3D模型」（俯瞰ドールハウス）
   - three.js r170 を js/vendor/ に同梱（オフライン／Netlify でも動作）
   - main.js から import() で遅延読み込み（Web見学セクションが近づいたとき）
   - インターフェースは 2D 版と共通：
       mount(container, data, { onSelect, reducedMotion })
       setFloor(floorId)   … '1f' | '2f'
       select(roomId)      … ハイライトのみ（onSelect は呼ばない）
       setFlows(bool)      … 「動線を表示」（家事動線・見守り視線の点線）
       resetView()         … 回転リセット
       setActive(bool)     … 表示中かどうか（非表示中は描画停止）
       destroy()
   - 部屋データは main.js の PLAN_DATA（2D と同じ座標）から手続き的に生成
   ========================================================= */
import * as THREE from './vendor/three.module.min.js';
import { OrbitControls } from './vendor/OrbitControls.js';

const S = 1 / 20;                 // 間取り座標(px：チラシ画像のピクセル) → 3D単位
const CENTER = { '1f': [234.5, 260], '2f': [770, 257.5] };   // 各階の建物中心（main.js の PLAN_DATA で上書き）
const LEVEL_Y = { '1f': 0, '2f': 1.7 };        // 階の高さ（模型的に圧縮）
const WALL_H = 0.85;              // 低い壁（実寸の約1/3）
const DOOR_H = 0.58;              // 扉・引き戸の開口高さ（この上に低いまぐさ）
const SILL_H = 0.3, WIN_H = 0.62; // 窓の腰高・上端
const MUSTARD = new THREE.Color('#C9912A');

const FLOW_COLORS = { chores: '#D79F2E', sight: '#6E8A35' };   // 家事動線＝マスタード／見守り視線＝オリーブ

const FLOOR_COLORS = {
  wood: '#E6D3B3', wood2: '#EDDFC6', tatami: '#D3D5AC', wet: '#E3E8E9', tile: '#D6D2C9',
  deck: '#B99271', lawn: '#9FB46F', carport: '#C4C1B8', balcony: '#B89470',
};
const ROOM_FLOOR = {
  ldk: 'wood', hall: 'wood2', entrance: 'tile', sc: 'tile', master: 'wood2', wic: 'wood2',
  washitsu: 'tatami', bath: 'wet', wash: 'wet', toilet1: 'wet', toilet2: 'wet',
  deck: 'deck', garden: 'lawn', carport: 'carport',
  free: 'wood2', storage: 'wood2', kids: 'wood', balcony: 'balcony',
};

const toXZ = (floorId, x, y) => [(x - CENTER[floorId][0]) * S, (y - CENTER[floorId][1]) * S];

export function create3DViewer() {
  let container, data, opts, renderer, scene, camera, controls, raycaster, pointer;
  let floorId = '1f', flowsOn = false, selectedId = null, active = true, onscreen = true, dirty = true, rafId = 0;
  let anim = null, io, ro;
  const floors = {};          // floorId -> { group, pickables:[], rooms:{id:{mesh, baseColor, edge}}, mats:[], labels:[] }
  const HOME = { az: -0.5, polar: 0.7, dist: 33 };

  /* ---------- 小物 ---------- */
  const shapeFrom = (fid, pts) => {
    const sh = new THREE.Shape();
    pts.forEach(([x, y], i) => { const [X, Z] = toXZ(fid, x, y); i ? sh.lineTo(X, -Z) : sh.moveTo(X, -Z); });
    sh.closePath();
    return sh;
  };
  const slab = (fid, pts, color, depth, y, mats) => {
    const geo = new THREE.ExtrudeGeometry(shapeFrom(fid, pts), { depth, bevelEnabled: false });
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0 });
    mats.push(mat);
    const m = new THREE.Mesh(geo, mat);
    m.position.y = y;
    m.receiveShadow = true;
    return m;
  };
  const box = (w, h, d, color, mats) => {
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.8 });
    mats.push(mat);
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.castShadow = true; m.receiveShadow = true;
    return m;
  };
  const rectPts = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];

  const makeLabel = (text) => {
    const c = document.createElement('canvas');
    const g = c.getContext('2d');
    const font = '700 44px "Noto Sans JP", "Hiragino Sans", sans-serif';
    g.font = font;
    const W = Math.ceil(g.measureText(text).width + 40), H = 72;
    c.width = W; c.height = H;
    g.font = font;
    g.fillStyle = 'rgba(255,255,255,0.93)';
    g.beginPath(); g.roundRect(2, 2, W - 4, H - 4, 30); g.fill();
    g.fillStyle = '#2A2A28'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, W / 2, H / 2 + 2);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
    const h = 0.95;                       // ラベルの高さ（3D単位）
    sp.scale.set(h * W / H, h, 1);
    sp.renderOrder = 10;
    return sp;
  };

  /* ---------- 模型の生成 ---------- */
  const glassMat = (mats) => {
    const m = new THREE.MeshStandardMaterial({ color: '#BFDDE8', roughness: 0.15, metalness: 0, transparent: true, opacity: 0.42, depthWrite: false });
    mats.push(m); return m;
  };

  // 壁・開口（壁は開口の範囲で本当に切れている。上に低いまぐさ／窓は腰壁＋ガラス）
  const buildWalls = (fl, fid, group, mats) => {
    const put = (axis, at, s0, e0, y0, y1, th, color, mat) => {
      const len = (e0 - s0) * S, h = y1 - y0;
      const [cx, cz] = axis === 'h' ? toXZ(fid, (s0 + e0) / 2, at) : toXZ(fid, at, (s0 + e0) / 2);
      const m = mat ? new THREE.Mesh(new THREE.BoxGeometry(axis === 'h' ? len : th, h, axis === 'h' ? th : len), mat) : box(axis === 'h' ? len : th, h, axis === 'h' ? th : len, color, mats);
      m.position.set(cx, y0 + h / 2, cz);
      group.add(m);
      return m;
    };
    fl.geom.pieces.forEach((p) => {
      const th = p.ext ? 0.14 : 0.11, ex = (th / 2) / S;
      put(p.axis, p.at, p.s - (p.sCut ? 0 : ex), p.e + (p.eCut ? 0 : ex), 0, WALL_H, th, p.ext ? '#FFFFFF' : '#FBFBF8');
    });
    fl.geom.openings.forEach((g) => {
      const th = g.ext ? 0.14 : 0.11, len = g.b - g.a, h = g.axis === 'h';
      if (g.kind === 'door' || g.kind === 'slide') {
        put(g.axis, g.at, g.a, g.b, DOOR_H, WALL_H, th, '#FBFBF8');                    // 低いまぐさ
      }
      if (g.kind === 'window') {
        put(g.axis, g.at, g.a, g.b, 0, SILL_H, th, '#FBFBF8');                          // 腰壁
        put(g.axis, g.at, g.a, g.b, WIN_H, WALL_H, th, '#FBFBF8');                      // まぐさ
        put(g.axis, g.at, g.a, g.b, SILL_H, WIN_H, 0.03, null, glassMat(mats));         // ガラス
      }
      if (g.kind === 'slide') {
        const pw = len * 0.56, off = 0.045;
        [[g.a, g.a + pw, -off], [g.b - pw, g.b, off]].forEach(([s0, e0, o]) => {
          const m = put(g.axis, g.at, s0, e0, 0.02, DOOR_H - 0.02, 0.035, '#F1ECE0');
          m.position[h ? 'z' : 'x'] += o;
        });
      }
      if (g.kind === 'door') {
        // 開いた扉板（90°）と床の開き軌跡（四分円）
        const c = g.hingePt, t = g.tipPt, e = g.endPt;
        const [hx, hz] = toXZ(fid, c[0], c[1]), [tx, tz] = toXZ(fid, t[0], t[1]);
        const dirX = g.dir[0] !== 0;
        const leaf = box(dirX ? Math.abs(tx - hx) : 0.05, DOOR_H - 0.04, dirX ? 0.05 : Math.abs(tz - hz), '#CDAE82', mats);
        leaf.position.set((hx + tx) / 2, (DOOR_H - 0.04) / 2 + 0.02, (hz + tz) / 2);
        group.add(leaf);
        const u = [g.dir[0], g.dir[1]], r = g.r * S;
        const v = [(e[0] - c[0]) / g.r, (e[1] - c[1]) / g.r];
        const pts = [];
        for (let i = 0; i <= 16; i++) {
          const a = (i / 16) * Math.PI / 2;
          pts.push(new THREE.Vector3(hx + r * (Math.cos(a) * u[0] + Math.sin(a) * v[0]), 0.075, hz + r * (Math.cos(a) * u[1] + Math.sin(a) * v[1])));
        }
        const lm = new THREE.LineBasicMaterial({ color: '#8B877C', transparent: true });
        mats.push(lm);
        group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lm));
      }
    });
  };

  // 動線オーバーレイ（家事動線／見守り視線）：床の上の点線＋矢じり
  const buildFlows = (fl, fid) => {
    const g = new THREE.Group();
    g.visible = false;
    (fl.flows || []).forEach((flow) => {
      const mat = new THREE.MeshBasicMaterial({ color: FLOW_COLORS[flow.kind] });
      const pts = flow.pts.map(([x, y]) => toXZ(fid, x, y));
      const DASH = 0.5, GAP = 0.34, Wd = 0.17, Y = 0.12;
      for (let i = 0; i < pts.length - 1; i++) {
        const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
        const L = Math.hypot(bx - ax, bz - az), ang = -Math.atan2(bz - az, bx - ax);
        const end = i === pts.length - 2 ? L - 0.42 : L;       // 最終区間は矢じりぶん手前まで
        for (let d = 0; d < end; d += DASH + GAP) {
          const len = Math.min(DASH, end - d);
          if (len < 0.12) continue;
          const m = new THREE.Mesh(new THREE.BoxGeometry(len, 0.035, Wd), mat);
          const k = (d + len / 2) / L;
          m.position.set(ax + (bx - ax) * k, Y, az + (bz - az) * k);
          m.rotation.y = ang;
          g.add(m);
        }
      }
      // 矢じり
      const [ax, az] = pts[pts.length - 2], [bx, bz] = pts[pts.length - 1];
      const tri = new THREE.Shape(); tri.moveTo(0.34, 0); tri.lineTo(-0.34, 0.3); tri.lineTo(-0.34, -0.3); tri.closePath();
      const geo = new THREE.ShapeGeometry(tri); geo.rotateX(-Math.PI / 2);
      const ah = new THREE.Mesh(geo, mat);
      ah.position.set(bx, Y + 0.01, bz); ah.rotation.y = -Math.atan2(bz - az, bx - ax);
      g.add(ah);
    });
    return g;
  };

  const buildFloor = (floor) => {
    const fid = floor.id;
    const group = new THREE.Group();
    group.position.y = LEVEL_Y[fid];
    const f = { group, pickables: [], rooms: {}, mats: [], labels: [], flows: null };
    const mats = f.mats;

    // 建物の床ベース（外壁の矩形）
    const [bx0, by0, bx1, by1] = floor.bounds;
    group.add(slab(fid, rectPts(bx0, by0, bx1 - bx0, by1 - by0), '#EFEBE3', 0.18, -0.18, mats));

    // 部屋の床
    floor.rooms.forEach((r) => {
      if (r.id === 'kitchen') {
        // ペニンシュラキッチン：天板つきの箱（床ではなく家具として）
        const [x0, y0] = r.shape[0], [x1, y1] = r.shape[2];
        const [X0, Z0] = toXZ(fid, x0, y0), [X1, Z1] = toXZ(fid, x1, y1);
        const k = box(X1 - X0, 0.55, Z1 - Z0, '#E9DCC6', mats);
        k.position.set((X0 + X1) / 2, 0.275, (Z0 + Z1) / 2);
        const top = box(X1 - X0 + 0.06, 0.05, Z1 - Z0 + 0.06, '#FAFAF7', mats);
        top.position.set(k.position.x, 0.575, k.position.z);
        group.add(k, top);
        k.userData.roomId = r.id; top.userData.roomId = r.id;
        f.pickables.push(k, top);
        f.rooms[r.id] = { meshes: [k], baseColor: new THREE.Color('#E9DCC6'), center: k.position.clone() };
        const kl = makeLabel('キッチン'); kl.position.set(k.position.x, 1.25, k.position.z + (Z1 - Z0) * 0.3);
        group.add(kl); f.labels.push(kl);
        return;
      }
      const ext = r.kind === 'ext' || r.kind === 'garden';
      const color = FLOOR_COLORS[ROOM_FLOOR[r.id] || 'wood2'];
      const y = r.id === 'garden' ? -0.17 : ext ? -0.1 : 0;
      const m = slab(fid, r.shape, color, r.id === 'garden' ? 0.03 : 0.06, y, mats);
      m.userData.roomId = r.id;
      group.add(m);
      f.pickables.push(m);
      const [lx, lz] = toXZ(fid, r.lx, r.ly);
      f.rooms[r.id] = { meshes: [m], baseColor: new THREE.Color(color), center: new THREE.Vector3(lx, 0, lz) };

      // 選択時のハイライト（マスタードの面＋縁）
      const flat = new THREE.ShapeGeometry(shapeFrom(fid, r.shape)); flat.rotateX(-Math.PI / 2);
      const hl = new THREE.Group();
      const hlFill = new THREE.Mesh(flat, new THREE.MeshBasicMaterial({ color: MUSTARD, transparent: true, opacity: 0.5, depthWrite: false }));
      const hlEdge = new THREE.LineSegments(new THREE.EdgesGeometry(flat), new THREE.LineBasicMaterial({ color: '#8A5F12' }));
      hl.add(hlFill, hlEdge);
      hl.position.y = y + (r.id === 'garden' ? 0.03 : 0.06) + 0.012; hl.visible = false;
      hlFill.renderOrder = 4; hlEdge.renderOrder = 4; // Groupに renderOrder を付けると子全体の順序が変わるため子に設定
      group.add(hl);
      f.rooms[r.id].edge = hl;

      if (r.id === 'balcony') {
        // バルコニーの手すり（低い）
        const [X0, Z0] = toXZ(fid, r.shape[0][0], r.shape[0][1]), [X1, Z1] = toXZ(fid, r.shape[2][0], r.shape[2][1]);
        const rail = box(X1 - X0, 0.35, 0.06, '#8E7A62', mats); rail.position.set((X0 + X1) / 2, 0.07, Z1);
        group.add(rail);
      }
      if (r.id === 'carport') {
        // カーポートの柱と屋根の輪郭のみ
        const [X0, Z0] = toXZ(fid, r.shape[0][0], r.shape[0][1]), [X1, Z1] = toXZ(fid, r.shape[2][0], r.shape[2][1]);
        [[X0, Z0], [X1, Z0], [X0, Z1], [X1, Z1]].forEach(([px, pz]) => {
          const post = box(0.1, 1.5, 0.1, '#9C9A94', mats); post.position.set(px, 0.65, pz); group.add(post);
        });
        const outline = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(X1 - X0, 0.04, Z1 - Z0)), new THREE.LineBasicMaterial({ color: '#8B877C', transparent: true }));
        outline.position.set((X0 + X1) / 2, 1.42, (Z0 + Z1) / 2);
        mats.push(outline.material);
        group.add(outline);
      }

      // ラベル
      const label = makeLabel(r.label ? r.label : r.name + (r.size && !/台|BBQ|物干し/.test(r.size) ? ' ' + r.size : ''));
      label.position.set(lx, ext ? 0.6 : WALL_H + 0.45, lz);
      if (r.id === 'carport') label.position.set(lx, 1.9, toXZ(fid, 0, r.shape[0][1])[1] + 0.3);   // SCのラベルと重ならないよう奥・上へ
      group.add(label);
      f.labels.push(label);
    });

    // 壁・開口
    buildWalls(floor, fid, group, mats);

    // 階段・収納・家具・設備
    (floor.fixtures || []).forEach((fx) => {
      if (fx.t === 'stairs') {
        const n = fx.ys.length, y0 = fx.ys[0] - 4.5, y1 = fx.ys[n - 1] + 4.5, dep = (y1 - y0) / n;
        for (let i = 0; i < n; i++) {
          // 1F：南（ホール側）が低く北へ上る／2F：南（フリースペース側）が高い
          const hgt = fid === '1f' ? 0.08 + (n - 1 - i) * 0.12 : 0.08 + i * 0.12;
          const [X0, Z0] = toXZ(fid, fx.x1, y0 + dep * i), [X1, Z1] = toXZ(fid, fx.x2, y0 + dep * (i + 1));
          const st = box(X1 - X0, hgt, Z1 - Z0, '#CDB08A', mats);
          st.position.set((X0 + X1) / 2, hgt / 2, (Z0 + Z1) / 2);
          group.add(st);
        }
      } else if (fx.t === 'box' || fx.t === 'ext') {
        const [X0, Z0] = toXZ(fid, fx.x, fx.y), [X1, Z1] = toXZ(fid, fx.x + fx.w, fx.y + fx.h);
        const hh = fx.h3d || 0.5;
        const b = box(X1 - X0, hh, Z1 - Z0, fx.t === 'ext' ? '#D5D3CC' : (fx.fill && fx.fill !== '#fff' ? '#E7DCC8' : '#EFE6D3'), mats);
        b.position.set((X0 + X1) / 2, hh / 2 + (fx.t === 'ext' ? -0.1 : 0.06), (Z0 + Z1) / 2);
        group.add(b);
        if (fx.lbl && fx.lbl[0] !== 'CL') {
          const l = makeLabel(fx.lbl[0]); l.position.set(b.position.x, hh + 0.55, b.position.z);
          l.scale.multiplyScalar(0.75); group.add(l); f.labels.push(l);
        }
      } else if (fx.t === 'dash' && fx.cls === 'split') {
        // 将来の可動間仕切りの位置（点線の代わりに細い帯）
        const [X, Z0] = toXZ(fid, fx.pts[0][0], fx.pts[0][1]), [, Z1] = toXZ(fid, fx.pts[1][0], fx.pts[1][1]);
        const sp = box(0.05, 0.02, Z1 - Z0, '#6B7A3A', mats); sp.position.set(X, 0.08, (Z0 + Z1) / 2); group.add(sp);
      }
    });

    f.flows = buildFlows(floor, fid);
    group.add(f.flows);
    mats.forEach((m) => (m.userData.baseOpacity = m.opacity));
    return f;
  };

  const buildScene = () => {
    scene = new THREE.Scene();
    scene.background = new THREE.Color('#FAF7F0');
    scene.add(new THREE.HemisphereLight('#FFFFFF', '#C9C2B0', 1.6));
    const sun = new THREE.DirectionalLight('#FFF6E8', 1.8);
    sun.position.set(-8, 16, 10);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 50 });
    sun.shadow.bias = -0.0008;
    scene.add(sun);
    // 地面（芝生＋外周）
    const ground = new THREE.Mesh(new THREE.CircleGeometry(19, 64), new THREE.MeshStandardMaterial({ color: '#B9C79A', roughness: 1 }));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -0.2; ground.receiveShadow = true;
    scene.add(ground);
    data.floors.forEach((fl) => { CENTER[fl.id] = fl.center; });
    data.floors.forEach((fl) => { floors[fl.id] = buildFloor(fl); scene.add(floors[fl.id].group); });
  };

  /* ---------- 表示状態 ---------- */
  const applyFloor = () => {
    const is2 = floorId === '2f';
    const f1 = floors['1f'], f2 = floors['2f'];
    f2.group.visible = is2;
    f1.mats.forEach((m) => {
      m.transparent = is2 || m.userData.baseOpacity < 1;
      m.opacity = is2 ? 0.22 : m.userData.baseOpacity;
      m.depthWrite = !is2;
      m.needsUpdate = true;
    });
    f1.labels.forEach((l) => (l.visible = !is2));
    Object.values(f1.rooms).forEach((r) => r.edge && (r.edge.visible = !is2 && r.edge.visible));
    controls.target.set(0, is2 ? LEVEL_Y['2f'] * 0.6 : 0, 0.4);
    applyFlows();
    applySelection();
    requestRender();
  };
  const applyFlows = () => {
    Object.entries(floors).forEach(([id, f]) => { f.flows.visible = flowsOn && id === floorId; });
    requestRender();
  };
  const applySelection = () => {
    Object.values(floors).forEach((f) => Object.entries(f.rooms).forEach(([id, r]) => {
      const on = id === selectedId;
      r.meshes.forEach((m) => m.material.color.copy(r.baseColor).lerp(MUSTARD, on && !r.edge ? 0.75 : 0));
      if (r.edge) r.edge.visible = on;
    }));
    requestRender();
  };

  /* ---------- カメラ ---------- */
  const setSpherical = (az, polar, dist) => {
    const t = controls.target;
    camera.position.set(
      t.x + dist * Math.sin(polar) * Math.sin(az),
      t.y + dist * Math.cos(polar),
      t.z + dist * Math.sin(polar) * Math.cos(az),
    );
    camera.lookAt(t);
  };
  const getSpherical = () => {
    const v = camera.position.clone().sub(controls.target);
    const dist = v.length();
    return { az: Math.atan2(v.x, v.z), polar: Math.acos(v.y / dist), dist };
  };
  const animateTo = (to, ms) => {
    if (opts.reducedMotion) { setSpherical(to.az, to.polar, to.dist); controls.update(); requestRender(); return; }
    const from = getSpherical();
    let dAz = to.az - from.az; dAz = Math.atan2(Math.sin(dAz), Math.cos(dAz));
    anim = { t0: performance.now(), ms, from, to: { ...to, az: from.az + dAz } };
    kick();
  };

  /* ---------- 描画ループ（オンデマンド） ---------- */
  const requestRender = () => { dirty = true; kick(); };
  const kick = () => { if (!rafId && active && onscreen) rafId = requestAnimationFrame(tick); };
  const tick = (now) => {
    rafId = 0;
    let moving = false;
    if (anim) {
      const k = Math.min(1, (now - anim.t0) / anim.ms), e = 1 - Math.pow(1 - k, 3);
      const L = (a, b) => a + (b - a) * e;
      setSpherical(L(anim.from.az, anim.to.az), L(anim.from.polar, anim.to.polar), L(anim.from.dist, anim.to.dist));
      if (k >= 1) anim = null;
      moving = true;
    }
    const changed = controls.update();
    if (changed || dirty || moving) { renderer.render(scene, camera); dirty = false; }
    if (changed || moving) kick();
  };

  /* ---------- タップ判定（ドラッグと区別） ---------- */
  let down = null;
  const onDown = (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId }; anim = null; };
  const onUp = (e) => {
    if (!down || down.id !== e.pointerId) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    const dt = performance.now() - down.t;
    down = null;
    if (moved > 8 || dt > 600) return;   // ドラッグ／長押しは選択しない
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(floors[floorId].pickables, false)[0];
    if (!hit) return;
    const id = hit.object.userData.roomId;
    selectedId = id; applySelection();
    const floor = data.floors.find((fl) => fl.id === floorId);
    opts.onSelect && opts.onSelect(floor.rooms.find((r) => r.id === id), floor);
  };
  const onMove = (e) => {
    if (e.pointerType !== 'mouse' || down) return;
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    renderer.domElement.style.cursor = raycaster.intersectObjects(floors[floorId].pickables, false).length ? 'pointer' : 'grab';
  };

  const resize = () => {
    const w = container.clientWidth, h = container.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // 縦長の画面でも建物が収まるよう画角を調整
    camera.fov = w / h < 1 ? 38 / Math.min(1, (w / h) * 1.15) : 38;
    camera.updateProjectionMatrix();
    requestRender();
  };

  const api = {
    mount(el, d, o) {
      container = el; data = d; opts = o || {};
      renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'low-power' });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      const cv = renderer.domElement;
      cv.className = 'viewer3d__canvas';
      cv.setAttribute('role', 'img');
      cv.setAttribute('aria-label', 'みまもりの家の3D模型。横スワイプまたはドラッグで回転、2本指で拡大縮小。下の部屋ボタンからも選べます。');
      container.appendChild(cv);

      camera = new THREE.PerspectiveCamera(38, 1, 0.1, 200);
      controls = new OrbitControls(camera, cv);
      controls.enablePan = false;
      controls.enableDamping = !opts.reducedMotion;
      controls.dampingFactor = 0.09;
      controls.rotateSpeed = 0.7;
      controls.minPolarAngle = 0.18;          // ほぼ真上まで
      controls.maxPolarAngle = 1.12;          // 床下には回り込まない（約64°）
      controls.minDistance = 16;
      controls.maxDistance = 46;
      controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_ROTATE };
      controls.addEventListener('change', requestRender);
      controls.addEventListener('start', () => { anim = null; kick(); });
      // OrbitControls は touch-action:none にするため上書き。
      // pan-y：1本指の縦スワイプはページスクロールとしてブラウザに渡し（pointercancel で回転は止まる）、
      //        横スワイプは回転、ピンチは拡大縮小として模型が受け取る。
      cv.style.touchAction = 'pan-y';

      raycaster = new THREE.Raycaster();
      pointer = new THREE.Vector2();
      cv.addEventListener('pointerdown', onDown);
      cv.addEventListener('pointerup', onUp);
      cv.addEventListener('pointercancel', () => (down = null));
      cv.addEventListener('pointermove', onMove);

      buildScene();
      controls.target.set(0, 0, 0.4);
      setSpherical(HOME.az, HOME.polar, HOME.dist);
      controls.update();
      applyFloor();

      ro = new ResizeObserver(resize); ro.observe(container);
      io = new IntersectionObserver((ents) => { onscreen = ents[0].isIntersecting; if (onscreen) requestRender(); }, { threshold: 0 });
      io.observe(container);
      resize();

      // 一度だけゆっくり導入回転（reduced-motion では行わない）
      if (!opts.reducedMotion) {
        setSpherical(HOME.az - 0.9, HOME.polar - 0.25, HOME.dist + 4); controls.update();
        animateTo(HOME, 1800);
      }
    },
    setFloor(id) { floorId = id; if (selectedId && !floors[id].rooms[selectedId]) selectedId = null; applyFloor(); },
    select(id) { selectedId = id; applySelection(); },
    setFlows(on) { flowsOn = !!on; if (floors['1f']) applyFlows(); },
    resetView() { animateTo(HOME, 700); },
    setView(az, polar, dist) { anim = null; setSpherical(az, polar, dist); controls.update(); requestRender(); }, // 検証用
    setActive(on) { active = on; if (on) { resize(); requestRender(); } },
    rotateBy(dAz) { const s = getSpherical(); animateTo({ ...s, az: s.az + dAz }, 300); }, // キーボード操作用
    projectRoom(id) { // 部屋中心のキャンバス内座標（検証用）
      const r = floors[floorId].rooms[id]; if (!r) return null;
      const v = r.center.clone(); v.y += LEVEL_Y[floorId]; v.project(camera);
      const el = renderer.domElement; return [(v.x + 1) / 2 * el.clientWidth, (1 - v.y) / 2 * el.clientHeight];
    },
    debugState() { return { ...getSpherical(), floorId, selectedId }; },
    destroy() {
      cancelAnimationFrame(rafId); io && io.disconnect(); ro && ro.disconnect(); controls.dispose();
      scene.traverse((o) => { o.geometry && o.geometry.dispose(); if (o.material) { o.material.map && o.material.map.dispose(); o.material.dispose(); } });
      renderer.dispose(); renderer.domElement.remove();
    },
  };
  return api;
}
