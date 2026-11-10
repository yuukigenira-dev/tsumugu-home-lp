/* =========================================================
   みまもりの家 LP  main.js（フレームワーク不使用）
   ========================================================= */
(() => {
  'use strict';

  /* ---------------------------------------------------------
     差し替えポイント
     --------------------------------------------------------- */

  // ▼ 予約フォームの送信先。'#' の間はダミー（実送信せず完了表示のみ）。
  //   本番では例： 'https://example.com/api/reserve' に差し替え（POST / FormData）。
  const FORM_ENDPOINT = '#';

  // ▼ 開催日（仮）。確定後に差し替え。index.html の「開催日（仮）」ブロックも合わせて変更。
  const EVENT_DATES = [
    { value: '2026-12-12', label: '2026年12月12日(土)' },
    { value: '2026-12-13', label: '2026年12月13日(日)' },
    { value: '2026-12-19', label: '2026年12月19日(土)' },
    { value: '2026-12-20', label: '2026年12月20日(日)' },
  ];
  // ▼ 時間枠（仮）。開催 10:00〜17:00・最終受付16:30 から作成。
  const TIME_SLOTS = ['10:00〜', '11:00〜', '12:00〜', '13:00〜', '14:00〜', '15:00〜', '16:00〜', '16:30〜（最終受付）'];

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ---------------------------------------------------------
     間取りデータ（2D/3D 共通）。photo は images/ 配下の basename。
     copy は基本チラシ記載。新規文は「// 仮コピー」
     --------------------------------------------------------- */
  const PLAN_DATA = {
    floors: [
      {
        id: '1f', label: '1F', viewBox: '0 0 360 400',
        rooms: [
          { id: 'carport', name: '耐雪カーポート', size: '2台', kind: 'ext', shape: [[200,14],[340,14],[340,58],[200,58]], lx: 270, ly: 40,
            copy: '雪国仕様の耐雪カーポートに2台駐車できます。', meta: '場所：玄関前' }, // 仮コピー（事実：耐雪カーポート2台）
          { id: 'bath', name: '浴室', size: '', kind: 'wet', shape: [[20,70],[70,70],[70,125],[20,125]], lx: 45, ly: 101,
            copy: '洗面・室内干しスペースと隣り合う水まわり。', meta: '場所：1F・水まわり' }, // 仮コピー
          { id: 'wash', name: '洗面', size: '3帖', kind: 'wet', shape: [[70,70],[135,70],[135,125],[70,125]], lx: 102, ly: 96, sub: '脱衣 3帖',
            copy: '雪の日も梅雨の日も頼れる室内干しスペースと、キッチンから続く回遊の家事動線。洗う・干す・しまうが、ひとつづき。', meta: 'ポイント：雪国の冬でも、部屋干しがよく乾く' },
          { id: 'hall', name: '玄関ホール・廊下', label: 'ホール', size: '', kind: '', shape: [[135,70],[165,70],[165,105],[260,105],[260,135],[210,135],[210,125],[135,125]], lx: 235, ly: 124,
            copy: '玄関ホールから廊下を通って水まわりへ。キッチンを中心にぐるりと回れる動線です。', meta: '場所：1F北側' }, // 仮コピー
          { id: 'entrance', name: '玄関', size: '', kind: '', shape: [[210,70],[260,70],[260,105],[210,105]], lx: 235, ly: 91,
            copy: '落雪に配慮した屋根形状と風除室で、雪の日も出入りしやすい玄関。', meta: '場所：屋根・玄関・窓まわり' },
          { id: 'sc', name: 'SC（靴収納）', size: '', kind: '', shape: [[260,70],[340,70],[340,105],[260,105]], lx: 300, ly: 91,
            copy: '玄関横のシューズクローク。靴や外遊びの道具をまとめて収納できます。', meta: '場所：玄関横' }, // 仮コピー
          { id: 'toilet1', name: 'トイレ', size: '', kind: 'wet', shape: [[260,105],[300,105],[300,140],[260,140]], lx: 280, ly: 126,
            copy: '玄関ホールに面した1階のトイレ。', meta: '場所：1F北側' }, // 仮コピー
          { id: 'master', name: '主寝室', size: '8帖', kind: '', shape: [[20,125],[110,125],[110,235],[20,235]], lx: 62, ly: 178, sub: 'WIC付き',
            copy: '8帖の主寝室にウォークインクローゼット（WIC）を備えています。', meta: '場所：1F西側' }, // 仮コピー（事実：主寝室8帖・WIC）
          { id: 'wic', name: 'WIC', size: '', kind: '', shape: [[110,125],[150,125],[150,175],[110,175]], lx: 130, ly: 154,
            copy: '主寝室とつながるウォークインクローゼット。', meta: '場所：主寝室横' }, // 仮コピー
          { id: 'ldk', name: 'LDK', size: '18帖', kind: '', photo: 'interior-ldk', shape: [[150,125],[210,125],[210,135],[260,135],[260,140],[340,140],[340,310],[130,310],[130,235],[110,235],[110,175],[150,175]], lx: 200, ly: 190, sub: '床暖房＋天然木',
            copy: '床暖房と天然木の床のLDK18帖。キッチンから、リビングも和室もウッドデッキも見渡せます。', meta: '視線の先：LDK・和室・ウッドデッキ' },
          { id: 'kitchen', name: 'ペニンシュラキッチン', size: '', kind: '', photo: 'interior-ldk', shape: [[280,170],[300,170],[300,262],[280,262]], lx: 290, ly: 282, label: 'キッチン',
            copy: '調理の手を止めずに家族と目が合う回遊動線。実際の見え方は、キッチンに立ってお確かめください。', meta: '場所：1F中央（南北ペニンシュラ）' },
          { id: 'washitsu', name: '和室', size: '6帖', kind: 'tatami', shape: [[20,235],[130,235],[130,310],[20,310]], lx: 82, ly: 270, sub: '押入・客間',
            copy: 'おもちゃを広げても、そのままお昼寝しても。引き戸を閉めれば客間にもなる、家族のもうひとつの居場所です。', meta: '場所：1F・LDK南側　用途：遊び場、お昼寝、客間' },
          { id: 'deck', name: 'ウッドデッキ', size: 'BBQ', kind: 'ext', shape: [[150,318],[320,318],[320,348],[150,348]], lx: 235, ly: 337,
            copy: 'LDKから続くウッドデッキ。BBQも楽しめます。キッチンからデッキの子どもにも声が届きます。', meta: '視線の先：キッチンから' }, // 仮コピー（事実：ウッドデッキ（BBQ）・お施主様の声）
          { id: 'garden', name: '庭', size: '', kind: 'garden', shape: [[20,354],[340,354],[340,390],[20,390]], lx: 180, ly: 376,
            copy: '芝生の庭。デッキと合わせて、外遊びの場所に。', meta: '場所：南側' }, // 仮コピー
        ],
        decor: (svg) => {
          // 階段
          let st = '';
          for (let i = 0; i < 6; i++) st += `<line class="fixture" x1="${165}" y1="${74 + i * 9}" x2="${210}" y2="${74 + i * 9}"/>`;
          return st +
            `<rect class="wall" x="20" y="70" width="320" height="240"/>` +
            `<rect class="fixture" x="165" y="70" width="45" height="55"/>` +
            `<text class="lbl-s" x="150" y="100" text-anchor="middle">廊下</text>` +
            `<rect class="fixture" x="300" y="105" width="40" height="35"/><text class="lbl-s" x="320" y="126" text-anchor="middle">背面収納</text>` +
            `<path class="sight" d="M282 200 L150 268" marker-end="url(#arrow)"/>` +
            `<text class="sight-t" x="165" y="296">見守り視線</text>` +
            `<g transform="translate(18,40)"><text class="lbl" x="0" y="0">N</text><path d="M4 4 V22 M4 4 L0 12" stroke="#2A2A28" fill="none" stroke-width="1.4"/></g>`;
        },
      },
      {
        id: '2f', label: '2F', viewBox: '0 0 360 300',
        rooms: [
          { id: 'free', name: 'フリースペース', size: '', kind: '', shape: [[20,30],[150,30],[150,130],[20,130]], lx: 85, ly: 76, sub: '家事・学習',
            copy: '家事や学習に使える2階のフリースペース。', meta: '用途：家事・学習' }, // 仮コピー（事実：家事・学習）
          { id: 'toilet2', name: 'トイレ', size: '', kind: 'wet', shape: [[210,30],[260,30],[260,85],[210,85]], lx: 235, ly: 61,
            copy: '2階にもトイレがあります。', meta: '場所：2F北側' }, // 仮コピー
          { id: 'storage', name: '納戸', size: '2.5帖', kind: '', shape: [[260,30],[340,30],[340,110],[260,110]], lx: 300, ly: 72,
            copy: '季節ものや雪国の冬支度をしまえる2.5帖の納戸。', meta: '場所：2F北東' }, // 仮コピー（事実：納戸2.5帖）
          { id: 'kids', name: '子供部屋', size: '12帖', kind: '', photo: 'interior-2f', shape: [[20,150],[340,150],[340,250],[20,250]], lx: 180, ly: 196, sub: '将来 6帖×2に分割',
            copy: '造作カウンターと可動間仕切りで、家族の成長に合わせて姿を変える一室。仕切りを動かす体験は、ぜひ現地で。', meta: '現在：ふたりのワークルーム／将来：2つの個室に' },
          { id: 'balcony', name: 'バルコニー', size: '物干し', kind: 'ext', shape: [[60,258],[300,258],[300,288],[60,288]], lx: 180, ly: 277,
            copy: '子供部屋に面したバルコニー。洗濯物を干せます。', meta: '場所：2F南側' }, // 仮コピー（事実：バルコニー（物干し））
        ],
        decor: () => {
          let st = '';
          for (let i = 0; i < 6; i++) st += `<line class="fixture" x1="150" y1="${34 + i * 9}" x2="210" y2="${34 + i * 9}"/>`;
          return st +
            `<rect class="wall" x="20" y="30" width="320" height="220"/>` +
            `<rect class="fixture" x="150" y="30" width="60" height="55"/>` +
            `<rect class="fixture" x="130" y="150" width="50" height="14"/><rect class="fixture" x="180" y="150" width="50" height="14"/>` +
            `<text class="lbl-s" x="148" y="160">CL</text><text class="lbl-s" x="198" y="160">CL</text>` +
            `<line class="split" x1="180" y1="166" x2="180" y2="250"/>` +
            `<text class="lbl-s" x="240" y="140">廊下</text>`;
        },
      },
    ],
  };

  /* ---------------------------------------------------------
     間取りビューア レジストリ
     インターフェース： factory() => { mount(container, data, {onSelect}), setFloor(id), select(roomId), destroy() }
     3D模型は js/viewer3d.js（ES module）を遅延 import して FloorViewers['3d'] に登録します。
     360°ビューア等を追加する場合も同じメソッドを持つ実装を登録してください。
     --------------------------------------------------------- */
  const FloorViewers = {};
  window.FloorViewers = FloorViewers;

  FloorViewers['2d'] = () => {
    let container, data, opts, floorId, svg;
    const NS = 'http://www.w3.org/2000/svg';

    const render = () => {
      const floor = data.floors.find((f) => f.id === floorId);
      const roomsSvg = floor.rooms.map((r) => {
        const pts = r.shape.map((p) => p.join(',')).join(' ');
        const label = r.label || r.name;
        const sizeTxt = r.size ? ` ${r.size}` : '';
        return `<g class="room-g" role="button" tabindex="0" aria-pressed="false" data-room="${r.id}" aria-label="${floor.label} ${r.name}${sizeTxt}の詳細を見る">
          <polygon class="room${r.kind ? ' room--' + r.kind : ''}" points="${pts}"/>
          <text class="lbl" x="${r.lx}" y="${r.ly}" text-anchor="middle">${label}${r.size && r.id !== 'kitchen' ? ' ' + r.size : ''}</text>
          ${r.sub ? `<text class="lbl-s" x="${r.lx}" y="${r.ly + 13}" text-anchor="middle">${r.sub}</text>` : ''}
        </g>`;
      }).join('');
      const [, , w, h] = floor.viewBox.split(' ');
      container.innerHTML = `<svg class="plan-svg" xmlns="${NS}" viewBox="${floor.viewBox}" width="${w}" height="${h}" role="group" aria-label="${floor.label}の間取り図（部屋を選ぶと詳細を表示）">
        <defs><marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="#8A5F12"/></marker></defs>
        ${roomsSvg}${floor.decor ? floor.decor() : ''}
      </svg>`;
      svg = container.querySelector('svg');
      svg.addEventListener('click', onActivate);
      svg.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onActivate(e); }
      });
    };
    const onActivate = (e) => {
      const g = e.target.closest('[data-room]');
      if (!g) return;
      api.select(g.dataset.room);
      const floor = data.floors.find((f) => f.id === floorId);
      const room = floor.rooms.find((r) => r.id === g.dataset.room);
      if (room && opts.onSelect) opts.onSelect(room, floor);
    };
    const api = {
      mount(el, d, o) { container = el; data = d; opts = o || {}; floorId = d.floors[0].id; render(); },
      setFloor(id) { if (id !== floorId) { floorId = id; render(); } },
      // ハイライトのみ（onSelect は呼ばない）
      select(roomId) {
        if (!svg) return;
        svg.querySelectorAll('[data-room]').forEach((g) => g.setAttribute('aria-pressed', String(g.dataset.room === roomId)));
      },
      destroy() { if (container) container.innerHTML = ''; },
    };
    return api;
  };

  /* ---------- 間取り UI（3D模型／平面図の切替・階タブ・部屋リスト・詳細パネル） ---------- */
  const hasWebGL = (() => {
    try {
      const c = document.createElement('canvas');
      return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
    } catch (e) { return false; }
  })();

  const initPlan = () => {
    const root = document.getElementById('floor-viewer');
    if (!root) return;
    const detail = document.getElementById('room-detail');
    const tabs = [...root.querySelectorAll('[role="tab"]')];
    const modeBtns = [...root.querySelectorAll('[data-mode]')];
    const resetBtn = root.querySelector('[data-action="reset"]');
    const list = root.querySelector('.room-list');
    const stages = { '3d': root.querySelector('[data-stage="3d"]'), '2d': root.querySelector('[data-stage="2d"]') };

    // 共有状態：表示モード・階・選択中の部屋（切替をまたいで保持）
    const state = { mode: root.dataset.viewer || '3d', floor: '1f', room: null };
    const viewers = {};        // mode -> viewer instance
    let loading3d = null;

    // WebGL なし → 平面図のみ。reduced-motion → 平面図を初期表示（3Dは選択可・自動回転なし）
    if (!hasWebGL) {
      state.mode = '2d';
      const b3 = modeBtns.find((b) => b.dataset.mode === '3d');
      b3.disabled = true; b3.hidden = true;
      root.querySelector('.viewer__mode').hidden = true;
    } else if (reduceMotion.matches) {
      state.mode = '2d';
    }

    const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const floorOf = (id) => PLAN_DATA.floors.find((f) => f.id === id);

    const showDetail = (room, floor, scroll) => {
      const media = room.photo
        ? `<picture><source type="image/webp" srcset="images/${room.photo}-720.webp"><img src="images/${room.photo}-720.jpg" width="720" height="${room.photo === 'interior-ldk' ? 568 : 453}" alt="${esc(floor.label + ' ' + room.name)}の写真" loading="lazy"></picture>`
        : `<div class="room-detail__ph" aria-hidden="true"><div><strong>${esc(room.name)}</strong>写真は現地でご覧ください</div></div>`;
      detail.innerHTML = `
        <div class="room-detail__media">${media}</div>
        <div class="room-detail__body">
          <p class="room-detail__floor">${esc(floor.label)}</p>
          <h3 class="room-detail__name">${esc(room.name)}${room.size ? `<span class="room-detail__size">${esc(room.size)}</span>` : ''}</h3>
          <p>${esc(room.copy)}</p>
          ${room.meta ? `<p class="room-detail__meta">${esc(room.meta)}</p>` : ''}
          <a class="btn btn--primary" href="#reserve" data-room-cta="${esc(floor.label + ' ' + room.name)}">この部屋を見に行く</a>
        </div>`;
      // 予約フォームに「見たいお部屋」を引き継ぐ
      detail.querySelector('[data-room-cta]').addEventListener('click', (e) => {
        const msg = document.getElementById('f-message');
        const line = `見たいお部屋：${e.currentTarget.dataset.roomCta}`;
        if (msg && !msg.value.includes(line)) msg.value = (msg.value ? msg.value + '\n' : '') + line;
      });
      if (scroll && window.matchMedia('(max-width: 1023px)').matches) {
        detail.scrollIntoView({ behavior: reduceMotion.matches ? 'auto' : 'smooth', block: 'nearest' });
      }
    };

    const renderList = () => {
      const fl = floorOf(state.floor);
      list.innerHTML = fl.rooms.map((r) =>
        `<button type="button" data-room="${r.id}" aria-pressed="${r.id === state.room}">${esc(r.name)}${r.size && !/台|BBQ|物干し/.test(r.size) ? ' ' + esc(r.size) : ''}</button>`).join('');
    };

    // どのビューア／リストから選んでも同じ処理
    const selectRoom = (id, { scroll = true } = {}) => {
      state.room = id;
      Object.values(viewers).forEach((v) => v.select(id));
      list.querySelectorAll('[data-room]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.room === id)));
      const fl = floorOf(state.floor);
      const room = fl.rooms.find((r) => r.id === id);
      if (room) showDetail(room, fl, scroll); else detail.innerHTML = '';
    };
    const onSelect = (room) => selectRoom(room.id);

    list.addEventListener('click', (e) => {
      const b = e.target.closest('[data-room]');
      if (b) selectRoom(b.dataset.room);
    });

    // 平面図（常に用意。軽量）
    viewers['2d'] = FloorViewers['2d']();
    viewers['2d'].mount(stages['2d'], PLAN_DATA, { onSelect });

    // 3D模型（セクションが近づいたら読み込み）
    const ensure3d = () => {
      if (!hasWebGL) return Promise.resolve(null);
      if (loading3d) return loading3d;
      loading3d = import('./viewer3d.js').then((mod) => {
        FloorViewers['3d'] = mod.create3DViewer;
        const v = mod.create3DViewer();
        v.mount(stages['3d'], PLAN_DATA, { onSelect, reducedMotion: reduceMotion.matches });
        viewers['3d'] = v;
        stages['3d'].classList.add('is-ready');
        v.setFloor(state.floor);
        v.select(state.room);
        v.setActive(state.mode === '3d');
        return v;
      }).catch((err) => {
        console.warn('3D viewer failed, falling back to 2D', err);
        stages['3d'].classList.add('is-error');
        setMode('2d');
        modeBtns.find((b) => b.dataset.mode === '3d').disabled = true;
        return null;
      });
      return loading3d;
    };

    const setMode = (mode) => {
      state.mode = mode;
      modeBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));
      Object.entries(stages).forEach(([k, el]) => (el.hidden = k !== mode));
      root.dataset.viewer = mode;
      resetBtn.hidden = mode !== '3d';
      if (viewers['3d']) viewers['3d'].setActive(mode === '3d');
      if (mode === '3d') ensure3d();
      // 階と選択状態を引き継ぐ
      const v = viewers[mode];
      if (v) { v.setFloor(state.floor); v.select(state.room); }
    };
    modeBtns.forEach((b) => b.addEventListener('click', () => !b.disabled && setMode(b.dataset.mode)));
    resetBtn.addEventListener('click', () => viewers['3d'] && viewers['3d'].resetView());

    const activate = (tab, focus) => {
      tabs.forEach((t) => {
        const on = t === tab;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
      });
      root.querySelector('[role="tabpanel"]').setAttribute('aria-labelledby', tab.id);
      state.floor = tab.dataset.floor;
      const keep = floorOf(state.floor).rooms.some((r) => r.id === state.room);
      if (!keep) state.room = null;
      Object.values(viewers).forEach((v) => v.setFloor(state.floor));
      renderList();
      selectRoom(state.room, { scroll: false });
      if (focus) tab.focus();
    };
    tabs.forEach((t, i) => {
      t.addEventListener('click', () => activate(t));
      t.addEventListener('keydown', (e) => {
        let n = null;
        if (e.key === 'ArrowRight') n = tabs[(i + 1) % tabs.length];
        if (e.key === 'ArrowLeft') n = tabs[(i - 1 + tabs.length) % tabs.length];
        if (e.key === 'Home') n = tabs[0];
        if (e.key === 'End') n = tabs[tabs.length - 1];
        if (n) { e.preventDefault(); activate(n, true); }
      });
    });

    renderList();
    // 初期表示。3D は表示枠だけ先に出し、three.js はセクション接近時に遅延 import
    const initial = state.mode;
    const lazy = initial === '3d' && 'IntersectionObserver' in window;
    if (lazy) {
      const orig = ensure3d;
      modeBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === '3d')));
      Object.entries(stages).forEach(([k, el]) => (el.hidden = k !== '3d'));
      root.dataset.viewer = '3d';
      const io = new IntersectionObserver((ents) => {
        if (ents.some((en) => en.isIntersecting)) { io.disconnect(); orig(); }
      }, { rootMargin: '600px 0px' });
      io.observe(root);
    } else {
      setMode(initial);
    }
    window.__planDebug = { state, viewers }; // 検証用（本番で削除可）
  };

  /* ---------- 外観ムービー ---------- */
  const initMovie = () => {
    const v = document.querySelector('.movie__video');
    if (!v) return;
    const btn = document.querySelector('.movie__toggle');
    const setBtn = () => { btn.textContent = v.paused ? '再生' : '一時停止'; btn.setAttribute('aria-pressed', String(v.paused)); };
    btn.hidden = false;
    btn.addEventListener('click', () => { v.paused ? v.play() : v.pause(); });
    v.addEventListener('play', setBtn); v.addEventListener('pause', setBtn);

    const apply = () => {
      if (reduceMotion.matches) {
        v.removeAttribute('autoplay'); v.autoplay = false; v.pause(); setBtn();
        return;
      }
      // 画面内に入ったら読み込み・再生（preload="none" で初期表示を軽く）
      if ('IntersectionObserver' in window) {
        const io = new IntersectionObserver((ents) => {
          ents.forEach((en) => {
            if (en.isIntersecting) { v.play().catch(() => {}); } else { v.pause(); }
          });
        }, { threshold: 0.25 });
        io.observe(v);
      } else { v.play().catch(() => {}); }
    };
    v.autoplay = false; v.pause();
    apply(); setBtn();
  };

  /* ---------- 固定予約バー：フォーム表示中は隠す ---------- */
  const initStickyBar = () => {
    const bar = document.querySelector('.sticky-bar');
    const form = document.getElementById('reserve');
    const fv = document.querySelector('.fv');
    if (!bar || !form || !('IntersectionObserver' in window)) return;
    // FVが半分以上見えている間（キャッチと重なる位置）と、フォーム表示中は隠す
    let inForm = false, inFv = true;
    const update = () => {
      // 下部バーはFV表示中から出す（フォーム表示中だけ隠す）。ヘッダーの予約ボタンはFV中はスマホで隠す（重複を避ける）
      const hide = inForm;
      document.documentElement.dataset.fv = inFv ? 'in' : 'out';
      bar.classList.toggle('is-hidden', hide);
      bar.setAttribute('aria-hidden', String(hide));
      bar.querySelectorAll('a').forEach((a) => (a.tabIndex = hide ? -1 : 0));
    };
    new IntersectionObserver((ents) => { inForm = ents[0].isIntersecting; update(); },
      { threshold: 0, rootMargin: '0px 0px -30% 0px' }).observe(form);
    if (fv) new IntersectionObserver((ents) => { inFv = ents[0].intersectionRatio > 0.5; update(); },
      { threshold: [0, 0.5, 1] }).observe(fv);
    update();
  };

  /* ---------- 予約フォーム ---------- */
  const initForm = () => {
    const form = document.getElementById('reserve-form');
    if (!form) return;
    const $ = (id) => document.getElementById(id);
    const dateSel = $('f-date'), timeSel = $('f-time');
    EVENT_DATES.forEach((d) => dateSel.add(new Option(d.label + '（仮）', d.value)));
    TIME_SLOTS.forEach((t) => timeSel.add(new Option(t, t)));
    const slotsEl = document.querySelector('[data-time-slots]');
    if (slotsEl) slotsEl.textContent = 'ご案内開始：' + TIME_SLOTS.map((t) => t.replace('（最終受付）', '')).join('／') + '（仮）';

    const steps = {
      input: form.querySelector('[data-step="input"]'),
      confirm: form.querySelector('[data-step="confirm"]'),
      done: form.querySelector('[data-step="done"]'),
    };
    const errBox = $('form-errors');

    const rules = [
      { id: 'f-date', label: '希望日', test: (v) => v !== '', msg: '希望日を選択してください。' },
      { id: 'f-time', label: '希望時間', test: (v) => v !== '', msg: '希望時間を選択してください。' },
      { id: 'f-adults', label: '大人の人数', test: (v) => v !== '', msg: '大人の人数を選択してください。' },
      { id: 'f-name', label: 'お名前', test: (v) => v.trim().length > 0, msg: 'お名前を入力してください。' },
      { id: 'f-kana', label: 'フリガナ', test: (v) => /^[ァ-ヶー　\s]+$/.test(v.trim()), msg: 'フリガナを全角カタカナで入力してください。', empty: 'フリガナを入力してください。' },
      { id: 'f-tel', label: '電話番号', test: (v) => /^0\d{9,10}$/.test(v.replace(/[-\s()（）ー－]/g, '').replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))), msg: '電話番号を正しく入力してください（例：090-1234-5678）。', empty: '電話番号を入力してください。' },
      { id: 'f-email', label: 'メールアドレス', test: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()), msg: 'メールアドレスを正しく入力してください。', empty: 'メールアドレスを入力してください。' },
      { id: 'f-privacy', label: '個人情報の取り扱い', test: (_, el) => el.checked, msg: '個人情報の取り扱いへの同意が必要です。' },
    ];

    const validateOne = (r) => {
      const el = $(r.id);
      const v = el.type === 'checkbox' ? '' : el.value;
      const ok = r.test(v, el);
      const err = $('err-' + r.id.replace('f-', ''));
      const message = ok ? '' : (r.empty && v.trim() === '' ? r.empty : r.msg);
      if (err) err.textContent = message;
      if (ok) el.removeAttribute('aria-invalid'); else el.setAttribute('aria-invalid', 'true');
      return ok ? null : { id: r.id, message };
    };

    // 入力後のリアルタイム再検証（一度エラーになった項目のみ）
    rules.forEach((r) => {
      const el = $(r.id);
      el.addEventListener(el.tagName === 'SELECT' || el.type === 'checkbox' ? 'change' : 'blur', () => {
        if (el.getAttribute('aria-invalid') === 'true') validateOne(r);
      });
    });

    const show = (name) => {
      Object.entries(steps).forEach(([k, el]) => (el.hidden = k !== name));
      const title = steps[name].querySelector('.form__step-title');
      document.getElementById('reserve').scrollIntoView({ behavior: reduceMotion.matches ? 'auto' : 'smooth', block: 'start' });
      if (title) title.focus({ preventScroll: true });
    };

    const values = () => {
      const fd = new FormData(form);
      return {
        見学方法: fd.get('style'),
        希望日: dateSel.options[dateSel.selectedIndex].text,
        希望時間: fd.get('time'),
        人数: `大人${$('f-adults').selectedOptions[0].text}・お子様${$('f-children').selectedOptions[0].text}`,
        お名前: fd.get('name'),
        フリガナ: fd.get('kana'),
        電話番号: fd.get('tel'),
        メール: fd.get('email'),
        'ご質問など': fd.get('message') || '（なし）',
      };
    };

    form.addEventListener('submit', (e) => {
      e.preventDefault(); // action="#" の実送信を止める
      const errors = rules.map(validateOne).filter(Boolean);
      if (errors.length) {
        errBox.hidden = false;
        errBox.innerHTML = `<p><strong>入力内容をご確認ください（${errors.length}件）</strong></p><ul>${errors.map((er) => `<li><a href="#${er.id}">${er.message}</a></li>`).join('')}</ul>`;
        errBox.querySelectorAll('a').forEach((a) => a.addEventListener('click', (ev) => { ev.preventDefault(); $(a.getAttribute('href').slice(1)).focus(); }));
        errBox.focus();
        return;
      }
      errBox.hidden = true; errBox.innerHTML = '';
      const list = $('confirm-list');
      list.innerHTML = Object.entries(values()).map(([k, v]) => `<div><dt>${k}</dt><dd></dd></div>`).join('');
      Object.values(values()).forEach((v, i) => (list.querySelectorAll('dd')[i].textContent = v));
      show('confirm');
    });

    form.querySelector('[data-action="back"]').addEventListener('click', () => show('input'));
    form.querySelector('[data-action="send"]').addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      btn.disabled = true; btn.textContent = '送信中…';
      try {
        if (FORM_ENDPOINT && FORM_ENDPOINT !== '#') {
          const res = await fetch(FORM_ENDPOINT, { method: 'POST', body: new FormData(form) });
          if (!res.ok) throw new Error('HTTP ' + res.status);
        } else {
          await new Promise((r) => setTimeout(r, 400)); // ダミー送信
        }
        show('done');
      } catch (err) {
        btn.disabled = false; btn.textContent = 'この内容で予約する';
        alert('送信できませんでした。お手数ですが、お電話（025-211-3233）でご予約ください。');
      }
    });
  };

  /* ---------- PC：右下の円形予約ボタン（フォーム表示中は隠す）。表示は CSS で ≥1024px のみ ---------- */
  const initFab = () => {
    const fab = document.querySelector('.fab');
    const form = document.getElementById('reserve');
    const main = document.querySelector('[data-main-cta]');
    if (!fab || !form || !('IntersectionObserver' in window)) return;
    // 表示条件：03のメイン予約ボタンが画面外 かつ フォームが見えていない（最初の画面ではメインCTAだけ目立たせる）
    let mainVisible = true, formVisible = false;
    const update = () => {
      const hide = mainVisible || formVisible;
      fab.classList.toggle('is-hidden', hide);
      fab.tabIndex = hide ? -1 : 0;
      fab.setAttribute('aria-hidden', String(hide));
    };
    new IntersectionObserver((ents) => { formVisible = ents[0].isIntersecting; update(); },
      { threshold: 0, rootMargin: '0px 0px -25% 0px' }).observe(form);
    if (main) new IntersectionObserver((ents) => { mainVisible = ents[0].isIntersecting; update(); },
      { threshold: 0 }).observe(main);
    else mainVisible = false;
    update();
  };

  /* ---------- ヘッダーメニュー／プライバシーポリシー ---------- */
  const initHeader = () => {
    const btn = document.querySelector('.site-header__menu');
    const nav = document.getElementById('global-nav');
    if (btn && nav) {
      const label = btn.querySelector('.visually-hidden');
      const set = (open) => {
        btn.setAttribute('aria-expanded', String(open));
        nav.hidden = !open;
        if (label) label.textContent = open ? 'メニューを閉じる' : 'メニューを開く';
      };
      btn.addEventListener('click', () => set(nav.hidden));
      nav.addEventListener('click', (e) => { if (e.target.closest('a')) set(false); });
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !nav.hidden) { set(false); btn.focus(); } });
      document.addEventListener('click', (e) => { if (!nav.hidden && !e.target.closest('.site-header')) set(false); });
    }
    const policy = document.getElementById('privacy-policy');
    document.querySelectorAll('a[href="#privacy-policy"]').forEach((a) => a.addEventListener('click', () => { if (policy) policy.open = true; }));
  };

  document.addEventListener('DOMContentLoaded', () => {
    initPlan();
    initMovie();
    initStickyBar();
    initFab();
    initHeader();
    initForm();
  });
})();
