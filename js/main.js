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

  // ▼ 開催日。変更時は index.html の「開催日」ブロック・FVの日付も合わせて変更。
  const EVENT_DATES = [
    { value: '2026-12-12', label: '2026年12月12日(土)' },
    { value: '2026-12-13', label: '2026年12月13日(日)' },
    { value: '2026-12-19', label: '2026年12月19日(土)' },
    { value: '2026-12-20', label: '2026年12月20日(日)' },
  ];
  // ▼ 時間枠。開催 10:00〜17:00・最終受付16:30 から作成。
  const TIME_SLOTS = ['10:00〜', '11:00〜', '12:00〜', '13:00〜', '14:00〜', '15:00〜', '16:00〜', '16:30〜（最終受付）'];

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ---------------------------------------------------------
     間取りデータ（2D/3D 共通）。チラシの間取り図（floorplan_flyer.png 1033×545）の画像ピクセル座標をそのまま使用。
       ・walls     … 壁の中心線 [向き('h'横/'v'縦), 固定座標, 始点, 終点, 'ext'外壁/'int'間仕切り]
       ・openings  … 壁の開口。kind: door(開き戸)／slide(引き戸)／window(窓)／open(壁なしの開口)
                     axis/at … 載っている壁、a〜b … 開口の範囲、hinge … 吊元('a'|'b')、dir … 開いた扉の向き [dx,dy]
                     ※壁は開口の範囲で切り欠かれます（2D・3Dとも本当に隙間になります）
       ・rooms     … 部屋の面（選択・色分け用。壁線とは別）。lbl … ラベル [文字, x, y, 'b'太字/'s'小/'m'中]
       ・fixtures  … 階段・収納・家具・記号など。flows … 「動線を表示」用の経路（開口を通る経路のみ）
     copy は基本チラシ記載。新規文は「// 仮コピー」
     --------------------------------------------------------- */
  const ROOM_TEXT = {
    carport: {"name": "耐雪カーポート", "size": "2台", "kind": "ext", "copy": "雪国仕様の耐雪カーポートに2台駐車できます。", "meta": "場所：玄関前"},
    bath: {"name": "浴室", "kind": "wet", "copy": "洗面・室内干しスペースと隣り合う水まわり。", "meta": "場所：1F・水まわり"},
    wash: {"name": "洗面", "size": "3帖", "kind": "wet", "copy": "雪の日も梅雨の日も頼れる室内干しスペースと、キッチンから続く回遊の家事動線。洗う・干す・しまうが、ひとつづき。", "meta": "ポイント：雪国の冬でも、部屋干しがよく乾く"},
    hall: {"name": "玄関ホール・廊下", "label": "ホール", "copy": "玄関ホールから廊下を通って水まわりへ。キッチンを中心にぐるりと回れる動線です。", "meta": "場所：1F北側"},
    entrance: {"name": "玄関", "copy": "落雪に配慮した屋根形状と風除室で、雪の日も出入りしやすい玄関。", "meta": "場所：屋根・玄関・窓まわり"},
    sc: {"name": "SC（靴収納）", "copy": "玄関横のシューズクローク。靴や外遊びの道具をまとめて収納できます。", "meta": "場所：玄関横"},
    toilet1: {"name": "トイレ", "kind": "wet", "copy": "玄関ホールに面した1階のトイレ。", "meta": "場所：1F北側"},
    master: {"name": "主寝室", "size": "8帖", "copy": "8帖の主寝室にウォークインクローゼット（WIC）を備えています。", "meta": "場所：1F西側"},
    wic: {"name": "WIC", "copy": "主寝室とつながるウォークインクローゼット。", "meta": "場所：主寝室横"},
    ldk: {"name": "LDK", "size": "18帖", "photo": "interior-ldk", "copy": "床暖房と天然木の床のLDK18帖。キッチンから、リビングも和室もウッドデッキも見渡せます。", "meta": "視線の先：LDK・和室・ウッドデッキ"},
    kitchen: {"name": "ペニンシュラキッチン", "label": "キッチン", "photo": "interior-ldk", "copy": "調理の手を止めずに家族と目が合う回遊動線。実際の見え方は、キッチンに立ってお確かめください。", "meta": "場所：1F中央（南北ペニンシュラ）"},
    washitsu: {"name": "和室", "size": "6帖", "kind": "tatami", "copy": "おもちゃを広げても、そのままお昼寝しても。引き戸を閉めれば客間にもなる、家族のもうひとつの居場所です。", "meta": "場所：1F・LDK南側　用途：遊び場、お昼寝、客間"},
    deck: {"name": "ウッドデッキ", "size": "BBQ", "kind": "ext", "copy": "LDKから続くウッドデッキ。BBQも楽しめます。キッチンからデッキの子どもにも声が届きます。", "meta": "視線の先：キッチンから"},
    garden: {"name": "庭", "kind": "garden", "copy": "芝生の庭。デッキと合わせて、外遊びの場所に。", "meta": "場所：南側"},
    free: {"name": "フリースペース", "copy": "家事や学習に使える2階のフリースペース。", "meta": "用途：家事・学習"},
    toilet2: {"name": "トイレ", "kind": "wet", "copy": "2階にもトイレがあります。", "meta": "場所：2F北側"},
    storage: {"name": "納戸", "size": "2.5帖", "copy": "季節ものや雪国の冬支度をしまえる2.5帖の納戸。", "meta": "場所：2F北東"},
    kids: {"name": "子供部屋", "size": "12帖", "photo": "interior-2f", "copy": "造作カウンターと可動間仕切りで、家族の成長に合わせて姿を変える一室。仕切りを動かす体験は、ぜひ現地で。", "meta": "現在：ふたりのワークルーム／将来：2つの個室に"},
    balcony: {"name": "バルコニー", "size": "物干し", "kind": "ext", "copy": "子供部屋に面したバルコニー。洗濯物を干せます。", "meta": "場所：2F南側"},
  };
  const R = (id, o) => ({ id, ...ROOM_TEXT[id], ...o });

  const PLAN_DATA = {
    floors: [
      {
        id: '1f', label: '1F', viewBox: '76 84 368 356', center: [234.5, 260], bounds: [83, 139, 386, 381],
        rooms: [
          R('carport',  { shape: [[252,92],[385,92],[385,128],[252,128]], lx: 319, ly: 114, lbl: [['カーポート (2台)', 319, 114, 's']] }),
          R('bath',     { shape: [[83,139],[138,139],[138,195],[83,195]], lx: 109, ly: 156, lbl: [['浴室', 109, 157, 'b']] }),
          R('wash',     { shape: [[138,139],[207,139],[207,195],[138,195]], lx: 170, ly: 158, lbl: [['洗面', 170, 158, 'b'], ['脱衣 3帖', 170, 173, 's']] }),
          R('hall',     { shape: [[207,139],[277,139],[277,166],[331,166],[331,195],[207,195]], lx: 299, ly: 179, lbl: [['廊下', 220, 167, 's'], ['ホール', 299, 180, 's']] }),
          R('entrance', { shape: [[277,139],[331,139],[331,166],[277,166]], lx: 304, ly: 151, lbl: [['玄関', 304, 152, 'b']] }),
          R('sc',       { shape: [[331,139],[386,139],[386,173],[331,173]], lx: 358, ly: 153, lbl: [['SC (靴収納)', 358, 154, 'x']] }),
          R('toilet1',  { shape: [[331,173],[386,173],[386,206],[331,206]], lx: 357, ly: 190, lbl: [['トイレ', 356, 190, 's']] }),
          R('master',   { kind: 'bed', shape: [[83,195],[193,195],[193,305],[83,305]], lx: 136, ly: 238, lbl: [['主寝室', 136, 239, 'b'], ['8帖', 136, 252, 's']] }),
          R('wic',      { kind: 'bed', shape: [[193,195],[234,195],[234,250],[193,250]], lx: 214, ly: 221, lbl: [['WIC', 214, 222, 's']] }),
          R('ldk',      { shape: [[234,195],[331,195],[331,206],[386,206],[386,381],[207,381],[207,305],[193,305],[193,250],[234,250]], lx: 258, ly: 291,
                          lbl: [['LDK 18帖', 258, 292, 'b'], ['床暖房＋天然木', 260, 305, 's'], ['来客', 289, 210, 's']] }),
          R('kitchen',  { kind: 'kitchen', shape: [[336,236],[357,236],[357,319],[336,319]], lx: 346, ly: 330, lbl: [['キッチン', 350, 330, 's']] }),
          R('washitsu', { shape: [[110,305],[207,305],[207,381],[110,381]], lx: 165, ly: 324, lbl: [['和室 6帖', 165, 325, 'b'], ['客間', 143, 362, 's']] }),
          R('deck',     { shape: [[221,384],[371,384],[371,415],[221,415]], lx: 296, ly: 399, lbl: [['ウッドデッキ (BBQ)', 296, 400, 's']] }),
          R('garden',   { shape: [[221,417],[371,417],[371,437],[221,437]], lx: 296, ly: 427, lbl: [['庭', 296, 429, 's']] }),
        ],
        walls: [
          ['h', 139, 83, 386, 'ext'], ['h', 381, 83, 386, 'ext'], ['v', 83, 139, 381, 'ext'], ['v', 386, 139, 381, 'ext'],
          ['h', 195, 83, 331, 'int'],
          ['v', 138, 139, 195, 'int'], ['v', 207, 139, 195, 'int'], ['v', 234, 139, 164, 'int'],
          ['v', 276, 139, 164, 'int'], ['v', 276, 187, 195, 'int'],
          ['v', 331, 139, 206, 'int'], ['h', 173, 331, 386, 'int'], ['h', 206, 331, 386, 'int'],
          ['v', 193, 195, 305, 'int'], ['h', 250, 193, 234, 'int'], ['v', 234, 195, 250, 'int'],
          ['h', 305, 83, 207, 'int'],
          ['v', 110, 305, 381, 'int'], ['v', 207, 305, 381, 'int'],
        ],
        openings: [
          // 窓（外壁）
          { kind: 'window', axis: 'h', at: 139, a: 100, b: 121 }, { kind: 'window', axis: 'h', at: 139, a: 158, b: 181 }, { kind: 'window', axis: 'h', at: 139, a: 350, b: 369 },
          { kind: 'window', axis: 'v', at: 83, a: 220, b: 257 },
          { kind: 'window', axis: 'h', at: 381, a: 121, b: 170 }, { kind: 'window', axis: 'h', at: 381, a: 231, b: 280 }, { kind: 'window', axis: 'h', at: 381, a: 309, b: 358 },
          { kind: 'window', axis: 'v', at: 386, a: 178, b: 194 }, { kind: 'window', axis: 'v', at: 386, a: 245, b: 269 }, { kind: 'window', axis: 'v', at: 386, a: 321, b: 345 },
          // 玄関ドア（外壁・北）
          { kind: 'door', id: 'd-entrance', axis: 'h', at: 139, a: 292, b: 314, hinge: 'a', dir: [0, 1] },
          // 開き戸
          { kind: 'door', id: 'd-wash', axis: 'v', at: 207, a: 151, b: 173, hinge: 'a', dir: [-1, 0] },        // 廊下→洗面（洗面側へ開く）
          { kind: 'door', id: 'd-toilet1', axis: 'v', at: 331, a: 174, b: 196, hinge: 'b', dir: [1, 0] },      // ホール→トイレ（トイレ側へ開く）
          { kind: 'door', id: 'd-hall', axis: 'h', at: 195, a: 297, b: 327, hinge: 'a', dir: [0, 1] },         // ホール→来客／LDK（LDK側へ開く）
          { kind: 'door', id: 'd-master', axis: 'v', at: 193, a: 258, b: 280, hinge: 'a', dir: [-1, 0] },      // LDK→主寝室（主寝室側へ開く）
          // 引き戸
          { kind: 'slide', id: 's-bath', axis: 'v', at: 138, a: 158, b: 180 },
          { kind: 'slide', id: 's-wic', axis: 'v', at: 193, a: 208, b: 229 },
          { kind: 'slide', id: 's-oshiire', axis: 'v', at: 110, a: 321, b: 363 },
          { kind: 'slide', id: 's-washitsu', axis: 'v', at: 207, a: 318, b: 367 },
          // 壁なしの開口（SC：玄関土間側に開放）
          { kind: 'open', id: 'o-sc', axis: 'v', at: 331, a: 144, b: 165 },
        ],
        fixtures: [
          { t: 'stairs', x1: 238, x2: 272, ys: [147, 156, 165, 174, 183] },
          { t: 'dash', pts: [[277, 166], [331, 166]] },                                         // 玄関土間の境（壁ではない）
          { t: 'box', x: 333, y: 208, w: 52, h: 20, h3d: 0.6, fill: '#fff', lbl: ['背面収納', 359, 219] },
          { t: 'box', x: 234, y: 250, w: 49, h: 27, r: 5, h3d: 0.3, thin: true },              // LDKの家具（テーブル）
          { t: 'island', x: 336, y: 236, w: 21, h: 83 },                                         // キッチン（ペニンシュラ）
          { t: 'line', pts: [[127, 306], [127, 341]], thin: true }, { t: 'line', pts: [[112, 341], [200, 341]], thin: true }, { t: 'line', pts: [[175, 341], [175, 380]], thin: true },
          { t: 'sym', k: 'drain', x: 126, y: 150 }, { t: 'sym', k: 'drain', x: 378, y: 196 },
          { t: 'sym', k: 'noent', x: 99, y: 284 }, { t: 'sym', k: 'noent', x: 195, y: 314 }, { t: 'sym', k: 'noent', x: 234, y: 365 },
          { t: 'ext', x: 393, y: 142, w: 38, h: 37, h3d: 0.95, lbl: ['エコキュート', 412, 174] },
          { t: 'text', s: '押', x: 96, y: 339 }, { t: 'text', s: '入', x: 96, y: 352 },
          { t: 'text', s: '見守り視線', x: 228, y: 341, k: 'sight' },
          { t: 'text', s: 'N', x: 425, y: 99, k: 'b' },
        ],
        // 動線（「動線を表示」）。点列は開口（扉・開口部）を通る経路のみ
        flows: [
          { id: 'chores-a', kind: 'chores', pts: [[298, 162], [331, 161], [358, 161]] },                         // 玄関→SC（開口を通る）
          { id: 'chores-a2', kind: 'chores', pts: [[358, 161], [331, 162], [318, 168], [318, 186], [290, 186], [276, 185], [264, 189], [230, 189], [230, 171], [207, 171], [190, 177], [150, 180], [138, 177], [112, 176]] }, // SC→ホール→廊下→洗面→浴室
          { id: 'chores-b', kind: 'chores', pts: [[346, 240], [352, 230], [330, 226], [312, 208], [312, 196], [317, 188]] },      // キッチン→背面収納→ホール（以降は洗面へ）
          { id: 'sight-ldk', kind: 'sight', pts: [[341, 280], [298, 268]] },                                   // キッチン→LDK
          { id: 'sight-washitsu', kind: 'sight', pts: [[341, 282], [207, 332], [168, 350]] },                   // キッチン→和室（引き戸の開口）
          { id: 'sight-deck', kind: 'sight', pts: [[347, 319], [347, 381], [352, 402]] },                      // キッチン→ウッドデッキ（窓越し）
        ],
      },
      {
        id: '2f', label: '2F', viewBox: '652 148 236 244', center: [770, 257.5], bounds: [660, 161, 880, 354], fs: 0.72,
        rooms: [
          R('free',     { shape: [[660,161],[756,161],[756,216],[797,216],[797,202],[838,202],[838,243],[660,243]], lx: 714, ly: 186, lbl: [['フリースペース', 714, 186, 'b'], ['家事・学習', 711, 200, 's']] }),
          R('toilet2',  { shape: [[797,161],[838,161],[838,201],[797,201]], lx: 818, ly: 179, lbl: [['トイレ', 818, 180, 's']] }),
          R('storage',  { shape: [[838,161],[880,161],[880,243],[838,243]], lx: 860, ly: 185, lbl: [['納戸', 860, 185, 'b'], ['2.5帖', 860, 200, 's']] }),
          R('kids',     { shape: [[660,243],[880,243],[880,354],[660,354]], lx: 771, ly: 293, lbl: [['子供部屋 12帖', 771, 293, 'b'], ['将来 6帖×2 に分割', 772, 306, 's'], ['(将来間仕切り)', 772, 316, 's']] }),
          R('balcony',  { shape: [[673,358],[873,358],[873,382],[673,382]], lx: 773, ly: 370, lbl: [['バルコニー (物干し)', 773, 371, 's']] }),
        ],
        walls: [
          ['h', 161, 660, 880, 'ext'], ['h', 354, 660, 880, 'ext'], ['v', 660, 161, 354, 'ext'], ['v', 880, 161, 354, 'ext'],
          ['v', 756, 161, 216, 'int'], ['v', 797, 161, 216, 'int'], ['v', 838, 161, 243, 'int'],
          ['h', 201, 797, 838, 'int'], ['h', 243, 660, 880, 'int'],
        ],
        openings: [
          { kind: 'window', axis: 'h', at: 161, a: 680, b: 716 }, { kind: 'window', axis: 'h', at: 161, a: 809, b: 826 }, { kind: 'window', axis: 'h', at: 161, a: 849, b: 869 },
          { kind: 'window', axis: 'v', at: 660, a: 280, b: 316 },
          { kind: 'window', axis: 'v', at: 880, a: 192, b: 210 }, { kind: 'window', axis: 'v', at: 880, a: 280, b: 316 },
          { kind: 'window', axis: 'h', at: 354, a: 690, b: 749 }, { kind: 'window', axis: 'h', at: 354, a: 790, b: 849 },
          { kind: 'door', id: 'd-kidsL', axis: 'h', at: 243, a: 690, b: 709, hinge: 'a', dir: [0, 1] },        // 廊下→子供部屋（子供部屋側へ開く）
          { kind: 'door', id: 'd-kidsR', axis: 'h', at: 243, a: 816, b: 835, hinge: 'b', dir: [0, 1] },
          { kind: 'door', id: 'd-toilet2', axis: 'h', at: 201, a: 805, b: 825, hinge: 'b', dir: [0, 1] },      // トイレ（廊下側へ開く）
          { kind: 'door', id: 'd-storage', axis: 'v', at: 838, a: 208, b: 230, hinge: 'a', dir: [1, 0] },      // 廊下→納戸（納戸側へ開く）
        ],
        fixtures: [
          { t: 'stairs', x1: 757, x2: 794, ys: [169, 178, 187, 195.5] },
          { t: 'box', x: 713, y: 243, w: 57, h: 21, h3d: 0.62, fill: '#F4F4F9', lbl: ['CL', 741, 254] },
          { t: 'box', x: 770, y: 243, w: 43, h: 21, h3d: 0.62, fill: '#F4F4F9', lbl: ['CL', 791, 254] },
          { t: 'dash', pts: [[770, 265], [770, 350]], cls: 'split' },                                  // 将来の間仕切り（点線）
          { t: 'sym', k: 'drain', x: 831, y: 194 },
          { t: 'sym', k: 'noent', x: 671, y: 221 }, { t: 'sym', k: 'noent', x: 719.5, y: 341 }, { t: 'sym', k: 'noent', x: 820, y: 341 },
        ],
        flows: [],
      },
    ],
  };

  /* 開口で壁を切り欠いた壁片と、扉の幾何を前計算（2D・3Dで共有）。 */
  PLAN_DATA.floors.forEach((fl) => {
    fl.geom = { pieces: [], openings: [] };
    fl.openings.forEach((o) => {
      const g = { ...o, ext: false };
      if (o.kind === 'door') {
        const hinge = o.hinge === 'a' ? o.a : o.b, other = o.hinge === 'a' ? o.b : o.a, r = o.b - o.a;
        const P = (c) => (o.axis === 'h' ? [c, o.at] : [o.at, c]);
        g.hingePt = P(hinge); g.endPt = P(other); g.r = r;
        g.tipPt = [g.hingePt[0] + o.dir[0] * r, g.hingePt[1] + o.dir[1] * r];
      }
      fl.geom.openings.push(g);
    });
    fl.walls.forEach(([axis, at, from, to, kind]) => {
      const cuts = fl.geom.openings.filter((o) => o.axis === axis && Math.abs(o.at - at) < 0.01 && o.b > from && o.a < to).sort((p, q) => p.a - q.a);
      cuts.forEach((o) => { o.ext = kind === 'ext'; });
      let cur = from, sCut = false;
      cuts.forEach((o) => {
        if (o.a > cur) fl.geom.pieces.push({ axis, at, s: cur, e: o.a, ext: kind === 'ext', sCut, eCut: true });
        cur = Math.max(cur, o.b); sCut = true;
      });
      if (cur < to) fl.geom.pieces.push({ axis, at, s: cur, e: to, ext: kind === 'ext', sCut, eCut: false });
    });
  });

  /* ---------------------------------------------------------
     間取りビューア レジストリ
     インターフェース： factory() => { mount(container, data, {onSelect}), setFloor(id), select(roomId), destroy() }
     3D模型は js/viewer3d.js（ES module）を遅延 import して FloorViewers['3d'] に登録します。
     360°ビューア等を追加する場合も同じメソッドを持つ実装を登録してください。
     --------------------------------------------------------- */
  const FloorViewers = {};
  window.FloorViewers = FloorViewers;

  FloorViewers['2d'] = () => {
    let container, data, opts, floorId, svg, flowsOn = false;
    const NS = 'http://www.w3.org/2000/svg';
    const FS = { b: 10.5, m: 9.5, s: 8.5, x: 7.2 };      // ラベルの文字サイズ（図面座標）
    const r1 = (n) => Math.round(n * 100) / 100;

    const textSvg = (t, x, y, k, fs) =>
      `<text class="lbl${k === 'b' ? '' : ' lbl-s'}" x="${x}" y="${y}" text-anchor="middle" dominant-baseline="central" style="font-size:${r1(FS[k] * fs)}px">${t}</text>`;

    // 壁・開口（扉・窓・引き戸）・家具など。壁は開口の範囲が本当に切れている（隙間）
    const drawing = (floor) => {
      const fs = floor.fs || 1;
      let o = '';
      // 家具・設備（壁の下）
      floor.fixtures.forEach((f) => {
        if (f.t === 'stairs') o += f.ys.map((y) => `<line class="fixture fixture--stair" x1="${f.x1}" y1="${y}" x2="${f.x2}" y2="${y}"/>`).join('');
        else if (f.t === 'dash') o += `<line class="${f.cls || 'dashln'}" x1="${f.pts[0][0]}" y1="${f.pts[0][1]}" x2="${f.pts[1][0]}" y2="${f.pts[1][1]}"/>`;
        else if (f.t === 'line') o += `<polyline class="fixture fixture--thin" points="${f.pts.map((p) => p.join(',')).join(' ')}"/>`;
        else if (f.t === 'box') {
          o += `<rect class="fixture${f.thin ? ' fixture--thin' : ''}" x="${f.x}" y="${f.y}" width="${f.w}" height="${f.h}" rx="${f.r || 0}"${f.fill ? ` style="fill:${f.fill}"` : ''}/>`;
          if (f.lbl) o += textSvg(f.lbl[0], f.lbl[1], f.lbl[2], 's', fs);
        } else if (f.t === 'island') {
          const cx = f.x + f.w / 2;
          o += `<rect class="fixture fixture--bold" x="${f.x}" y="${f.y}" width="${f.w}" height="${f.h}" rx="4"/>` +
            `<circle class="fixture fixture--thin" cx="${cx}" cy="${f.y + 21}" r="5.5"/>` +
            [49, 56, 63.5].map((dy) => `<circle class="fixture fixture--thin" cx="${cx}" cy="${f.y + dy}" r="2.4"/>`).join('') +
            `<circle class="fixture fixture--thin" cx="${cx}" cy="${f.y + 74}" r="5.5"/><path class="fixture fixture--thin" d="M${cx - 5.5} ${f.y + 74}H${cx + 5.5}M${cx} ${f.y + 68.5}V${f.y + 79.5}"/>`;
        } else if (f.t === 'ext') {
          o += `<rect class="outer" x="${f.x}" y="${f.y}" width="${f.w}" height="${f.h}" rx="2"/>`;
          if (f.lbl) o += textSvg(f.lbl[0], f.lbl[1], f.lbl[2], 'x', fs);
        } else if (f.t === 'sym') {
          const R = f.k === 'drain' ? 4 : 4.2;
          o += `<circle class="sym" cx="${f.x}" cy="${f.y}" r="${R}"/>` + (f.k === 'drain'
            ? `<path class="sym" d="M${f.x - R} ${f.y}H${f.x + R}M${f.x} ${f.y - R}V${f.y + R}"/>`
            : `<path class="sym" d="M${f.x - R * 0.7} ${f.y + R * 0.7}L${f.x + R * 0.7} ${f.y - R * 0.7}"/>`);
        } else if (f.t === 'text') {
          o += f.k === 'b' ? textSvg(f.s, f.x, f.y, 'b', 1) : textSvg(f.s, f.x, f.y, 's', fs);
        }
      });
      // 壁（開口で切り欠き済み）
      floor.geom.pieces.forEach((p) => {
        const th = (p.ext ? 3.4 : 2.8) * fs, ex = th / 2;
        const s0 = p.s - (p.sCut ? 0 : ex), e0 = p.e + (p.eCut ? 0 : ex);
        o += p.axis === 'h'
          ? `<line class="wl${p.ext ? ' wl--ext' : ''}" x1="${s0}" y1="${p.at}" x2="${e0}" y2="${p.at}"/>`
          : `<line class="wl${p.ext ? ' wl--ext' : ''}" x1="${p.at}" y1="${s0}" x2="${p.at}" y2="${e0}"/>`;
      });
      // 開口
      floor.geom.openings.forEach((g) => {
        const h = g.axis === 'h', len = g.b - g.a;
        if (g.kind === 'window') {
          const wh = 4.8 * fs;
          o += h ? `<rect class="win" x="${g.a}" y="${g.at - wh / 2}" width="${len}" height="${wh}"/><line class="win-c" x1="${g.a}" y1="${g.at}" x2="${g.b}" y2="${g.at}"/>`
                 : `<rect class="win" x="${g.at - wh / 2}" y="${g.a}" width="${wh}" height="${len}"/><line class="win-c" x1="${g.at}" y1="${g.a}" x2="${g.at}" y2="${g.b}"/>`;
        } else if (g.kind === 'slide') {
          const pw = len * 0.58, st = 2.2 * fs, o1 = 2.6 * fs, o2 = 0.4 * fs;
          o += h ? `<rect class="slide" x="${g.a}" y="${g.at - o1}" width="${pw}" height="${st}"/><rect class="slide" x="${g.b - pw}" y="${g.at + o2}" width="${pw}" height="${st}"/>`
                 : `<rect class="slide" x="${g.at - o1}" y="${g.a}" width="${st}" height="${pw}"/><rect class="slide" x="${g.at + o2}" y="${g.b - pw}" width="${st}" height="${pw}"/>`;
        } else if (g.kind === 'door') {
          const c = g.hingePt, t = g.tipPt, e = g.endPt;
          const sweep = ((t[0] - c[0]) * (e[1] - c[1]) - (t[1] - c[1]) * (e[0] - c[0])) > 0 ? 1 : 0;
          o += `<line class="leaf" x1="${c[0]}" y1="${c[1]}" x2="${t[0]}" y2="${t[1]}"/>` +
               `<path class="arc" d="M${t[0]} ${t[1]}A${g.r} ${g.r} 0 0 ${sweep} ${e[0]} ${e[1]}"/>`;
        }
      });
      return o;
    };

    // 動線オーバーレイ（家事動線／見守り視線）。既定は非表示（CSS）
    const flowsSvg = (floor) => floor.flows.map((fl) => {
      const d = fl.pts.map((p, i) => (i ? 'L' : 'M') + p[0] + ' ' + p[1]).join('');
      return `<path class="flow flow--${fl.kind}" d="${d}" marker-end="url(#fa-${fl.kind})"/>`;
    }).join('');

    const render = () => {
      const floor = data.floors.find((f) => f.id === floorId);
      const fs = floor.fs || 1;
      const roomsSvg = floor.rooms.map((r) => {
        const pts = r.shape.map((p) => p.join(',')).join(' ');
        const sizeTxt = r.size ? ` ${r.size}` : '';
        return `<g class="room-g" role="button" tabindex="0" aria-pressed="false" data-room="${r.id}" aria-label="${floor.label} ${r.name}${sizeTxt}の詳細を見る">
          <polygon class="room${r.kind ? ' room--' + r.kind : ''}" points="${pts}"/>
          ${r.lbl.map(([t, x, y, k]) => textSvg(t, x, y, k, fs)).join('')}
        </g>`;
      }).join('');
      const [, , w, h] = floor.viewBox.split(' ');
      container.innerHTML = `<svg class="plan-svg${flowsOn ? ' is-flows' : ''}" style="--k:${fs}" xmlns="${NS}" viewBox="${floor.viewBox}" width="${w}" height="${h}" role="group" aria-label="${floor.label}の間取り図（部屋を選ぶと詳細を表示）">
        <defs>
          <marker id="fa-chores" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L10 5L0 10z" fill="#C9912A"/></marker>
          <marker id="fa-sight" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L10 5L0 10z" fill="#5A6A2E"/></marker>
        </defs>
        ${roomsSvg}${drawing(floor)}<g class="flows" aria-hidden="true">${flowsSvg(floor)}</g>
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
      setFlows(on) { flowsOn = !!on; if (svg) svg.classList.toggle('is-flows', flowsOn); },
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
    const flowBtn = root.querySelector('[data-action="flows"]');
    const legend = root.querySelector('.viewer__legend');
    const list = root.querySelector('.room-list');
    const stages = { '3d': root.querySelector('[data-stage="3d"]'), '2d': root.querySelector('[data-stage="2d"]') };

    // 共有状態：表示モード・階・選択中の部屋（切替をまたいで保持）
    const state = { mode: root.dataset.viewer || '3d', floor: '1f', room: null, flows: false };
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

    // 動線の表示切替（2D・3D共通。1Fのみ経路あり）
    const syncFlows = () => {
      const has = floorOf(state.floor).flows.length > 0;
      flowBtn.setAttribute('aria-pressed', String(state.flows));
      flowBtn.disabled = !has;
      legend.hidden = !state.flows;
      legend.querySelectorAll('.key--chores,.key--sight').forEach((k) => (k.hidden = !has));
      legend.querySelector('.key-note').hidden = has;
      Object.values(viewers).forEach((v) => v.setFlows && v.setFlows(state.flows));
    };
    flowBtn.addEventListener('click', () => { state.flows = !state.flows; syncFlows(); });

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
        v.setFlows(state.flows);
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
      syncFlows();
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
    syncFlows();
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
    EVENT_DATES.forEach((d) => dateSel.add(new Option(d.label, d.value)));
    TIME_SLOTS.forEach((t) => timeSel.add(new Option(t, t)));
    const slotsEl = document.querySelector('[data-time-slots]');
    if (slotsEl) slotsEl.textContent = 'ご案内開始：' + TIME_SLOTS.map((t) => t.replace('（最終受付）', '')).join('／');

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

  /* ---------- ページ先頭へ戻るボタン：600px 以上スクロールしたら表示。Lenis 有効時は Lenis で、動きを減らす設定では即時 ---------- */
  const initToTop = () => {
    const btn = document.querySelector('.to-top');
    if (!btn) return;
    const THRESHOLD = 600;
    let shown = null;
    const update = () => {
      const on = (window.scrollY || document.documentElement.scrollTop) > THRESHOLD;
      if (on === shown) return;
      shown = on;
      btn.classList.toggle('is-shown', on);
      btn.tabIndex = on ? 0 : -1;
      btn.setAttribute('aria-hidden', String(!on));
    };
    window.addEventListener('scroll', update, { passive: true });
    update();
    btn.addEventListener('click', () => {
      if (reduceMotion.matches) {
        if (window.__lenis) { window.__lenis.destroy(); window.__lenis = null; }
        window.scrollTo({ top: 0, behavior: 'auto' });
      } else if (window.__lenis) {
        window.__lenis.scrollTo(0, { duration: 1.2 });
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
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
    initToTop();
    initHeader();
    initForm();
  });
})();
