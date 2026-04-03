# growi-plugin-page-load-timer Design Spec

## Purpose

Growiにプラグインやページが増えた環境で、view → view のページ遷移パフォーマンスを可視化し、ユーザーストレスを定量的に把握するための軽量プラグイン。

## Requirements

- view → view のSPAページ遷移時間を計測する
- 直近の遷移時間と直近10回の平均を画面上に表示する
- 計測ツール自体が軽量であること（素のTypeScript + DOM API、React不使用）

## Architecture

### Approach: Simple DOM Insertion

Navigation APIで遷移を検知し、計測結果を`page-meta`領域にDOM挿入する。

### Measurement Logic

- `navigation.addEventListener('navigate', ...)` でview → view遷移を検知
- `navigateEvent.navigationType` が `push` または `traverse` の遷移のみ対象（`reload` は除外）
- 遷移先URLがview以外（`/_api/`、`#edit` 等）の場合はスキップ
- `navigateEvent.intercept()` のPromise完了までの時間を `performance.now()` で計測

### Data Storage

- `sessionStorage` に直近10回分の計測結果を配列で保存
- 各エントリ: `{ from: string, to: string, duration: number, timestamp: number }`
- タブを閉じればクリア、ページリロードでも維持

### Display Values

- 前回の遷移時間（ms → 秒、小数点1桁）
- 直近10回の平均値（小数点1桁）

## DOM Display

### Insertion Point

- `.page-meta` の最初の子要素の前に `prepend` で挿入

### Format

```
⏱ 前回: 1.2s / 平均: 0.8s (10)
```

- 括弧内の数字はサンプル数（最大10）
- 初回遷移前（データなし）は表示しない

### Styling

- `text-secondary` クラスで既存のpage-metaと統一感を持たせる
- `font-size: 0.85em` 程度で控えめに
- 遷移時間に応じた色分け:
  - 1秒未満: 緑系（快適）
  - 1〜3秒: 黄系（やや遅い）
  - 3秒以上: 赤系（ストレス）

### Update Timing

- `intercept()` のPromise解決後、計測結果を保存してからDOMに挿入
- SPA遷移のたびに `page-meta` が再描画されるため、毎回新しく挿入する

## Plugin Structure

```
growi-plugin-page-load-timer/
├── src/
│   └── client-entry.ts
├── package.json
├── tsconfig.json
└── vite.config.ts
```

### package.json

```json
{
  "name": "growi-plugin-page-load-timer",
  "growiPlugin": {
    "schemaVersion": 4,
    "types": ["script"]
  }
}
```

### activate / deactivate

- `activate()`: Navigation APIのイベントリスナー登録、既存のsessionStorageデータがあれば表示
- `deactivate()`: イベントリスナー解除、挿入済みDOM要素の削除

### Build

- Vite でバンドル、`dist/` に出力
- 外部依存なし（素のTypeScript + DOM API のみ）

## Out of Scope

- サーバーサイドへのデータ送信・永続化
- 他ブラウザ（Firefox/Safari）のフォールバック
- view <-> edit の遷移計測
- 初回ロード時間の計測

## Browser Support

- Chrome / Edge（Navigation API対応ブラウザのみ）
