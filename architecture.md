# TableRule Import 拡張機能 - アーキテクチャ図

## 処理フロー図

```mermaid
flowchart TD
    A[ユーザーが更新ボタンをクリック] --> B[handleUpdateButtonClick]
    B --> C{CSVデータが入力されているか?}
    C -->|No| D[エラーメッセージ表示]
    C -->|Yes| E[executeContentScript]
    E --> F[Chrome APIでコンテンツスクリプト実行]
    F --> G[updateTableFromCSV]
    
    G --> H[parseCSVData]
    H --> I[detectDelimiter]
    I --> J[CSVデータをMapに変換]
    
    G --> K[findTable]
    K --> L{テーブルが見つかるか?}
    L -->|No| M[エラーをスロー]
    L -->|Yes| N[getHeaderInfo]
    
    N --> O[getColumnIndexById]
    O --> P{必要な列が見つかるか?}
    P -->|No| Q[エラーをスロー]
    P -->|Yes| R[findTargetRows]
    
    R --> S[processRowsSequentially]
    S --> T[processSingleRow]
    T --> U[updateNoteCell]
    T --> V[updateAccountCell]
    
    V --> W{編集モードか?}
    W -->|No| X[enterEditMode]
    W -->|Yes| Y[typeAccountValue]
    X --> Y
    
    Y --> Z[typeCharacter]
    Z --> AA[confirmInput]
    AA --> BB[処理完了]
    
    style A fill:#e1f5fe
    style BB fill:#c8e6c9
    style M fill:#ffcdd2
    style Q fill:#ffcdd2
```

## 関数階層図

```mermaid
graph TD
    A[メイン処理] --> B[handleUpdateButtonClick]
    A --> C[executeContentScript]
    A --> D[updateTableFromCSV]
    
    D --> E[データ処理]
    D --> F[DOM操作]
    D --> G[行処理]
    
    E --> H[parseCSVData]
    E --> I[detectDelimiter]
    
    F --> J[findTable]
    F --> K[getHeaderInfo]
    F --> L[getColumnIndexById]
    F --> M[findTargetRows]
    
    G --> N[processRowsSequentially]
    G --> O[processSingleRow]
    G --> P[updateNoteCell]
    G --> Q[updateAccountCell]
    
    Q --> R[enterEditMode]
    Q --> S[typeAccountValue]
    S --> T[typeCharacter]
    S --> U[confirmInput]
    
    style A fill:#bbdefb
    style E fill:#c8e6c9
    style F fill:#fff3e0
    style G fill:#f3e5f5
```

## データフロー図

```mermaid
flowchart LR
    A[CSV入力] --> B[parseCSVData]
    B --> C[updateMap<br/>発行元 → 勘定科目・備考]
    
    D[DOM要素] --> E[findTable]
    E --> F[getHeaderInfo]
    F --> G[列インデックス情報]
    
    C --> H[processSingleRow]
    G --> H
    H --> I[updateNoteCell]
    H --> J[updateAccountCell]
    
    J --> K[typeAccountValue]
    K --> L[typeCharacter]
    L --> M[confirmInput]
    
    style A fill:#e1f5fe
    style C fill:#c8e6c9
    style G fill:#fff3e0
    style M fill:#f3e5f5
```

## 定数構造図

```mermaid
graph TD
    A[CONSTANTS] --> B[DELAYS]
    A --> C[COLORS]
    A --> D[HEADER_ID_MAP]
    A --> E[MESSAGES]
    
    B --> B1[EDIT_MODE_WAIT: 300]
    B --> B2[TYPE_INTERVAL: 200]
    B --> B3[ENTER_WAIT: 200]
    B --> B4[ROW_PROCESSING: 2000]
    
    C --> C1[SUCCESS_BACKGROUND: '#f0fff0']
    
    D --> D1[発行元: 'partnerName']
    D --> D2[勘定科目: 'accountItem']
    D --> D3[備考: 'description']
    
    E --> E1[NO_CSV_DATA]
    E --> E2[TABLE_NOT_FOUND]
    E --> E3[HEADER_NOT_FOUND]
    E --> E4[COLUMNS_NOT_FOUND]
    E --> E5[UPDATE_COMPLETE]
    E --> E6[EDIT_BUTTON_NOT_FOUND]
    
    style A fill:#bbdefb
    style B fill:#c8e6c9
    style C fill:#fff3e0
    style D fill:#f3e5f5
    style E fill:#ffcdd2
```

## エラーハンドリング図

```mermaid
flowchart TD
    A[処理開始] --> B{CSVデータチェック}
    B -->|空| C[NO_CSV_DATA エラー]
    B -->|有効| D{テーブル存在チェック}
    
    D -->|存在しない| E[TABLE_NOT_FOUND エラー]
    D -->|存在| F{ヘッダー存在チェック}
    
    F -->|存在しない| G[HEADER_NOT_FOUND エラー]
    F -->|存在| H{ヘッダー行存在チェック}
    
    H -->|存在しない| I[HEADER_ROW_NOT_FOUND エラー]
    H -->|存在| J{必要な列存在チェック}
    
    J -->|存在しない| K[COLUMNS_NOT_FOUND エラー]
    J -->|存在| L[正常処理継続]
    
    L --> M{編集ボタン存在チェック}
    M -->|存在しない| N[EDIT_BUTTON_NOT_FOUND エラー]
    M -->|存在| O[処理完了]
    
    style C fill:#ffcdd2
    style E fill:#ffcdd2
    style G fill:#ffcdd2
    style I fill:#ffcdd2
    style K fill:#ffcdd2
    style N fill:#ffcdd2
    style O fill:#c8e6c9
```

## タイミング図

```mermaid
sequenceDiagram
    participant U as ユーザー
    participant P as ポップアップ
    participant C as コンテンツスクリプト
    participant D as DOM
    
    U->>P: 更新ボタンクリック
    P->>P: CSVデータ検証
    P->>C: コンテンツスクリプト実行
    C->>D: テーブル検索
    C->>D: ヘッダー情報取得
    C->>D: 対象行検索
    
    loop 各行の処理
        C->>D: 備考セル更新
        C->>D: 編集モード移行
        C->>D: 文字入力
        C->>D: 入力確定
        Note over C,D: 2秒待機
    end
    
    C->>P: 処理完了通知
    P->>U: 完了メッセージ表示
```

## 主要な改善点

### 1. **モジュール化**
- 単一責任の原則に従った関数分割
- 再利用可能なコンポーネント設計

### 2. **エラーハンドリング**
- 包括的なエラー検出と処理
- ユーザーフレンドリーなエラーメッセージ

### 3. **設定管理**
- 定数による設定の一元管理
- メンテナンス性の向上

### 4. **非同期処理**
- 順次処理による安定性確保
- 適切なタイミング制御

### 5. **可読性**
- 明確な関数名とコメント
- 論理的な処理フロー
