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
