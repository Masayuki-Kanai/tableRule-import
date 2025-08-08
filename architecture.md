# TableRule Import 拡張機能 - アーキテクチャ図（更新版）

## 処理フロー図

```mermaid
flowchart TD
    A[ユーザーが更新ボタンをクリック] --> B[ポップアップ: CSVデータ検証]
    B --> C{CSVデータが入力されているか?}
    C -->|No| D[エラーメッセージ表示]
    C -->|Yes| E[Chrome APIでコンテンツスクリプト実行]
    E --> F[updateTableFromCSV関数実行]
    
    F --> G[定数定義<br/>timeinterval = 2000ms]
    G --> H[parseCSVData]
    H --> I[区切り文字判別<br/>カンマ or タブ]
    I --> J[CSVデータをMapに変換]
    
    F --> K[findTable]
    K --> L{テーブルが見つかるか?}
    L -->|No| M[エラーログ出力]
    L -->|Yes| N[getHeaderInfo]
    
    N --> O[getColumnIndexById]
    O --> P{必要な列が見つかるか?}
    P -->|No| Q[エラーメッセージ表示]
    P -->|Yes| R[findTargetRows]
    
    R --> S[processRowsWithInterval]
    S --> T[setInterval開始<br/>timeinterval間隔]
    T --> U[processSingleRow]
    U --> V[updateNoteCell]
    U --> W[updateAccountCell]
    
    W --> X{編集モードか?}
    X -->|No| Y[enterEditMode]
    X -->|Yes| Z[typeAccountValue]
    Y --> Z
    
    Z --> AA[setInterval開始<br/>typeIntervalMs間隔]
    AA --> BB[typeCharacter]
    BB --> CC[confirmInput]
    CC --> DD[次の行処理]
    DD --> U
    
    style A fill:#e1f5fe
    style G fill:#fff3e0
    style T fill:#e8f5e8
    style AA fill:#e8f5e8
    style M fill:#ffcdd2
    style Q fill:#ffcdd2
```

## 関数階層図（更新版）

```mermaid
graph TD
    A[ポップアップ処理] --> B[イベントリスナー]
    A --> C[Chrome API呼び出し]
    
    D[updateTableFromCSV<br/>メイン関数] --> E[定数定義]
    D --> F[データ処理]
    D --> G[DOM操作]
    D --> H[行処理]
    
    E --> E1[timeinterval: 2000ms]
    E --> E2[editModeWaitMs: 300ms]
    E --> E3[typeIntervalMs: 200ms]
    E --> E4[enterWaitMs: 200ms]
    
    F --> F1[parseCSVData<br/>内包関数]
    
    G --> G1[findTable<br/>内包関数]
    G --> G2[getHeaderInfo<br/>内包関数]
    G --> G3[getColumnIndexById<br/>内包関数]
    G --> G4[findTargetRows<br/>内包関数]
    
    H --> H1[processRowsWithInterval<br/>setInterval使用]
    H --> H2[processSingleRow<br/>内包関数]
    H --> H3[updateNoteCell<br/>内包関数]
    H --> H4[updateAccountCell<br/>内包関数]
    
    H4 --> H5[enterEditMode<br/>内包関数]
    H4 --> H6[typeAccountValue<br/>setInterval使用]
    H6 --> H7[typeCharacter<br/>内包関数]
    H6 --> H8[confirmInput<br/>内包関数]
    
    style A fill:#bbdefb
    style D fill:#c8e6c9
    style E fill:#fff3e0
    style F fill:#e1f5fe
    style G fill:#f3e5f5
    style H fill:#ffecb3
```

## データフロー図（更新版）

```mermaid
flowchart LR
    A[CSV入力] --> B[parseCSVData]
    B --> C[updateMap<br/>発行元 → 勘定科目・備考]
    
    D[DOM要素] --> E[findTable]
    E --> F[getHeaderInfo]
    F --> G[列インデックス情報]
    
    C --> H[processRowsWithInterval]
    G --> H
    H --> I[setInterval<br/>timeinterval: 2000ms]
    I --> J[processSingleRow]
    J --> K[updateNoteCell]
    J --> L[updateAccountCell]
    
    L --> M[typeAccountValue]
    M --> N[setInterval<br/>typeIntervalMs: 200ms]
    N --> O[typeCharacter]
    O --> P[confirmInput]
    
    style A fill:#e1f5fe
    style C fill:#c8e6c9
    style G fill:#fff3e0
    style I fill:#e8f5e8
    style N fill:#e8f5e8
    style P fill:#f3e5f5
```

## 定数構造図（更新版）

```mermaid
graph TD
    A[updateTableFromCSV内定数] --> B[タイミング定数]
    A --> C[CONSTANTS]
    
    B --> B1[timeinterval: 2000ms<br/>行処理間隔]
    B --> B2[editModeWaitMs: 300ms<br/>編集モード待機]
    B --> B3[typeIntervalMs: 200ms<br/>文字入力間隔]
    B --> B4[enterWaitMs: 200ms<br/>Enter確定待機]
    
    C --> D[DELAYS]
    C --> E[COLORS]
    C --> F[HEADER_ID_MAP]
    C --> G[MESSAGES]
    
    D --> D1[EDIT_MODE_WAIT: 300]
    D --> D2[TYPE_INTERVAL: 200]
    D --> D3[ENTER_WAIT: 200]
    D --> D4[ROW_PROCESSING: 2000]
    
    E --> E1[SUCCESS_BACKGROUND: '#f0fff0']
    
    F --> F1[発行元: 'partnerName']
    F --> F2[勘定科目: 'accountItem']
    F --> F3[備考: 'description']
    
    G --> G1[TABLE_NOT_FOUND]
    G --> G2[HEADER_NOT_FOUND]
    G --> G3[HEADER_ROW_NOT_FOUND]
    G --> G4[COLUMNS_NOT_FOUND]
    G --> G5[EDIT_BUTTON_NOT_FOUND]
    
    style A fill:#bbdefb
    style B fill:#c8e6c9
    style C fill:#fff3e0
```

## エラーハンドリング図（更新版）

```mermaid
flowchart TD
    A[処理開始] --> B{CSVデータチェック}
    B -->|空| C[NO_CSV_DATA エラー]
    B -->|有効| D{テーブル存在チェック}
    
    D -->|存在しない| E[console.error<br/>TABLE_NOT_FOUND]
    D -->|存在| F{ヘッダー存在チェック}
    
    F -->|存在しない| G[alert<br/>HEADER_NOT_FOUND]
    F -->|存在| H{ヘッダー行存在チェック}
    
    H -->|存在しない| I[alert<br/>HEADER_ROW_NOT_FOUND]
    H -->|存在| J{必要な列存在チェック}
    
    J -->|存在しない| K[alert<br/>COLUMNS_NOT_FOUND]
    J -->|存在| L[正常処理継続]
    
    L --> M{編集ボタン存在チェック}
    M -->|存在しない| N[console.error<br/>EDIT_BUTTON_NOT_FOUND]
    M -->|存在| O[処理完了]
    
    style C fill:#ffcdd2
    style E fill:#ffcdd2
    style G fill:#ffcdd2
    style I fill:#ffcdd2
    style K fill:#ffcdd2
    style N fill:#ffcdd2
    style O fill:#c8e6c9
```

## タイミング図（更新版）

```mermaid
sequenceDiagram
    participant U as ユーザー
    participant P as ポップアップ
    participant C as コンテンツスクリプト
    participant D as DOM
    
    U->>P: 更新ボタンクリック
    P->>P: CSVデータ検証
    P->>C: コンテンツスクリプト実行
    C->>C: 定数定義（timeinterval等）
    C->>D: テーブル検索
    C->>D: ヘッダー情報取得
    C->>D: 対象行検索
    
    loop 各行の処理（timeinterval: 2000ms）
        C->>D: 備考セル更新
        C->>D: 編集モード移行
        C->>D: 文字入力開始
        loop 文字入力（typeIntervalMs: 200ms）
            C->>D: 1文字入力
        end
        C->>D: 入力確定
        Note over C,D: 2秒待機後次の行
    end
    
    C->>P: 処理完了通知
    P->>U: 完了メッセージ表示
```

## スコープ構造図

```mermaid
graph TD
    A[ポップアップスコープ] --> B[イベントリスナー]
    A --> C[Chrome API呼び出し]
    
    D[コンテンツスクリプトスコープ] --> E[updateTableFromCSV]
    E --> F[定数定義]
    E --> G[内包関数群]
    
    G --> H[parseCSVData]
    G --> I[findTable]
    G --> J[getHeaderInfo]
    G --> K[getColumnIndexById]
    G --> L[findTargetRows]
    G --> M[processRowsWithInterval]
    G --> N[processSingleRow]
    G --> O[updateNoteCell]
    G --> P[updateAccountCell]
    G --> Q[enterEditMode]
    G --> R[typeAccountValue]
    G --> S[typeCharacter]
    G --> T[confirmInput]
    
    style A fill:#bbdefb
    style D fill:#c8e6c9
    style E fill:#fff3e0
    style G fill:#e1f5fe
```

## 主要な改善点（更新版）

### 1. **スコープ問題の解決**
- すべての依存関数を`updateTableFromCSV`内に内包
- コンテンツスクリプトの実行環境で確実に動作

### 2. **setIntervalベースの処理**
- 行処理: `timeinterval = 2000ms`で順次実行
- 文字入力: `typeIntervalMs = 200ms`で1文字ずつ入力

### 3. **タイミング制御の改善**
- 編集モード待機: `editModeWaitMs = 300ms`
- Enter確定待機: `enterWaitMs = 200ms`

### 4. **エラーハンドリング**
- 適切なエラーメッセージ表示
- 処理の継続性を保証

### 5. **保守性の向上**
- 定数の一元管理
- 明確な関数責任分離
- 読みやすいコード構造
