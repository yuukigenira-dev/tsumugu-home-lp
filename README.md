# つむぐホーム「みまもりの家」モデルハウス見学予約LP

静的HTML/CSS/JS。`index.html` を http(s) で配信してください（3D間取りビューはESモジュールのため `file://` では2D平面図に切り替わります）。

- `css/styles.css` … スタイル（「FV表示モード」で文字入り1枚画像に切替可）
- `js/main.js` … 開催日 `EVENT_DATES`、時間 `TIME_SLOTS`、送信先 `FORM_ENDPOINT`（現在 `#` のダミー）
- `js/viewer3d.js` … 3D間取り（three.js r170 同梱、MIT: `js/vendor/three-LICENSE.txt`）

日付・コピーの一部は仮です（`仮` コメント参照）。

## モーション（やさしい版）
- `css/motion.css` … スクロール表示（ぼかし→くっきり＋ふわっと上昇）、写真のクリップワイプ、FVの入場アニメ。**調整値は先頭の `:root`**（`--mo-blur` ぼかし量、`--mo-rise` 上昇量、`--mo-dur` 長さ、`--mo-wipe-dur`／`--mo-wipe-scale` 写真ワイプ、`--mo-fv-blur`、FVの順番は各 `animation` の遅延）。
- `js/motion.js` … IntersectionObserver で一度だけ表示（`CONFIG`：段差 `staggerMs`、発火位置 `rootMargin`）。対象要素のセレクタは `REVEAL` / `REVEAL_FADE` / `WIPE`。デスクトップ（hover可・マウス）のみ Lenis を起動し、ページ内リンクは固定ヘッダー分を考慮してスクロール。
- `js/vendor/lenis.min.js` … Lenis v1.3.27（MIT、`lenis-LICENSE.txt`）。3D模型（`data-lenis-prevent-wheel`）とメニュー（`data-lenis-prevent`）ではホイールを奪いません。
- JS無効／`prefers-reduced-motion: reduce`／motion.js が起動しない場合は全て表示（`<html>` の `.js` と `.motion-off` で制御）。

## FV（ファーストビュー）
- 原画は Photoshop の `firstview_v2.jpg`（1440×2999）。文字なし背景（`images/fv-bg-*`）＋HTML文字で再現。位置・サイズは原画の実測値（`--u`＝原画1px）。文字入り1枚画像（`images/fv-comp-*`）に切り替える場合は `styles.css` の「FV表示モード」の2行を入れ替え。
- 会場表記は「つむぐホーム モデルハウス『みまもりの家』」（番地は確定後に記載）。FV原画内の「完成見学会開催」は原画どおり。

## 間取り（06 WEB見学）
- 図面は **チラシの間取り図（`floorplan_flyer.png` 1033×545）の画像ピクセル座標**をそのまま `js/main.js` の `PLAN_DATA` に記述（2D・3D共通）。
  - `walls` … 壁の中心線、`openings` … 開口（`door` 開き戸＋四分円／`slide` 引き戸／`window` 窓／`open` 壁なし）。**壁は開口の範囲で切れており、3Dでも実際の隙間**（上に低いまぐさ、窓は腰壁＋ガラス）。
  - `rooms` … 部屋の面・ラベル・説明文、`fixtures` … 階段・収納・家具、`flows` … 「動線を表示」用の経路（開口を通れる経路のみ）。
- 「動線を表示」：家事動線（マスタード）／見守り視線（オリーブ）の点線を2D・3Dに重ねて表示（既定オフ、1Fのみ）。
- 扉の位置・向きを直すときは `openings` の `a`〜`b`（範囲）・`hinge`（吊元）・`dir`（開く向き）を編集。
