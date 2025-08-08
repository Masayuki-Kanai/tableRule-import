// 定数定義
const CONSTANTS = {
    DELAYS: {
        EDIT_MODE_WAIT: 300,
        TYPE_INTERVAL: 200,
        ENTER_WAIT: 200,
        ROW_PROCESSING: 2000
    },
    COLORS: {
        SUCCESS_BACKGROUND: '#f0fff0'
    },
    HEADER_ID_MAP: {
        '発行元': 'partnerName',
        '勘定科目': 'accountItem',
        '備考': 'description'
    },
    MESSAGES: {
        NO_CSV_DATA: 'CSVデータを入力してください。',
        TABLE_NOT_FOUND: 'テーブルが見つかりません。',
        HEADER_NOT_FOUND: 'エラー: テーブルのヘッダーが見つかりませんでした。',
        HEADER_ROW_NOT_FOUND: 'エラー: テーブルのヘッダー行が見つかりませんでした。',
        COLUMNS_NOT_FOUND: 'エラー: 必要な列が見つかりませんでした。',
        UPDATE_COMPLETE: 'テーブルを更新しました！',
        EDIT_BUTTON_NOT_FOUND: '編集モードに移行するためのボタンが見つかりません。'
    }
};

// メインのイベントリスナー
document.getElementById('updateButton').addEventListener('click', handleUpdateButtonClick);

/**
 * 更新ボタンのクリックイベントを処理
 */
function handleUpdateButtonClick() {
    const csvData = document.getElementById('csvInput').value;
    
    if (!csvData) {
        alert(CONSTANTS.MESSAGES.NO_CSV_DATA);
        return;
    }

    executeContentScript(csvData);
}

/**
 * コンテンツスクリプトを実行
 * @param {string} csvData - CSVデータ
 */
function executeContentScript(csvData) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs[0];
        
        chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: updateTableFromCSV,
            args: [csvData]
        });
    });
}

/**
 * CSVデータを使用してテーブルを更新するメイン関数
 * @param {string} csvData - CSVデータ
 */
function updateTableFromCSV(csvData) {
    try {
        const updateMap = parseCSVData(csvData);
        const table = findTable();
        const headerInfo = getHeaderInfo(table);
        const targetRows = findTargetRows(table, headerInfo.issuerIndex, updateMap);
        
        processRowsSequentially(targetRows, headerInfo, updateMap);
        alert(CONSTANTS.MESSAGES.UPDATE_COMPLETE);
    } catch (error) {
        console.error('テーブル更新中にエラーが発生しました:', error);
        alert(`エラーが発生しました: ${error.message}`);
    }
}

/**
 * CSVデータをパースして更新マップを作成
 * @param {string} csvData - CSVデータ
 * @returns {Map} 発行元をキーとした更新データのマップ
 */
function parseCSVData(csvData) {
    const delimiter = detectDelimiter(csvData);
    const lines = csvData.trim().split('\n');
    const updateMap = new Map();

    for (let i = 1; i < lines.length; i++) {
        const [issuer, account, note] = lines[i].split(delimiter);
        if (issuer) {
            updateMap.set(issuer.trim(), {
                account: account ? account.trim() : '',
                note: note ? note.trim() : ''
            });
        }
    }

    return updateMap;
}

/**
 * CSVデータの区切り文字を判別
 * @param {string} csvData - CSVデータ
 * @returns {string} 区切り文字
 */
function detectDelimiter(csvData) {
    const firstLine = csvData.trim().split('\n')[0];
    return firstLine.includes('\t') ? '\t' : ',';
}

/**
 * ページ内のテーブルを検索
 * @returns {HTMLElement} テーブル要素
 */
function findTable() {
    const table = document.querySelector('table');
    if (!table) {
        throw new Error(CONSTANTS.MESSAGES.TABLE_NOT_FOUND);
    }
    return table;
}

/**
 * テーブルのヘッダー情報を取得
 * @param {HTMLElement} table - テーブル要素
 * @returns {Object} ヘッダー情報
 */
function getHeaderInfo(table) {
    const thead = table.querySelector('.Thead_1_7_0');
    if (!thead) {
        throw new Error(CONSTANTS.MESSAGES.HEADER_NOT_FOUND);
    }

    const headerRow = thead.querySelector('tr');
    if (!headerRow) {
        throw new Error(CONSTANTS.MESSAGES.HEADER_ROW_NOT_FOUND);
    }

    const issuerIndex = getColumnIndexById(headerRow, '発行元');
    const accountIndex = getColumnIndexById(headerRow, '勘定科目');
    const noteIndex = getColumnIndexById(headerRow, '備考');

    if (issuerIndex === -1 || accountIndex === -1 || noteIndex === -1) {
        throw new Error(CONSTANTS.MESSAGES.COLUMNS_NOT_FOUND);
    }

    return { issuerIndex, accountIndex, noteIndex };
}

/**
 * IDパターンからヘッダーの列名とインデックスを取得
 * @param {HTMLElement} headerRow - ヘッダーの<tr>要素
 * @param {string} columnName - 探す列名
 * @returns {number} 1ベースの列インデックス
 */
function getColumnIndexById(headerRow, columnName) {
    const headers = headerRow.querySelectorAll('th');
    const targetIdPart = CONSTANTS.HEADER_ID_MAP[columnName];

    if (!targetIdPart) {
        return -1;
    }

    for (let i = 0; i < headers.length; i++) {
        const id = headers[i].id;
        if (id && id.includes(targetIdPart)) {
            return i + 1;
        }
    }
    return -1;
}

/**
 * 更新対象の行を検索
 * @param {HTMLElement} table - テーブル要素
 * @param {number} issuerIndex - 発行元の列インデックス
 * @param {Map} updateMap - 更新データのマップ
 * @returns {Array} 更新対象の行インデックス配列
 */
function findTargetRows(table, issuerIndex, updateMap) {
    const rows = table.querySelectorAll('tr');
    const targetRowIndexes = [];
    
    rows.forEach((row, index) => {
        const issuerCell = row.querySelector(`td:nth-child(${issuerIndex})`);
        if (issuerCell && updateMap.has(issuerCell.textContent.trim())) {
            targetRowIndexes.push(index);
        }
    });

    return targetRowIndexes;
}

/**
 * 行を順次処理
 * @param {Array} targetRowIndexes - 対象行のインデックス配列
 * @param {Object} headerInfo - ヘッダー情報
 * @param {Map} updateMap - 更新データのマップ
 */
function processRowsSequentially(targetRowIndexes, headerInfo, updateMap) {
    const rows = document.querySelectorAll('tr');
    let currentIndex = 0;

    const processNextRow = () => {
        if (currentIndex < targetRowIndexes.length) {
            const row = rows[targetRowIndexes[currentIndex]];
            currentIndex++;
            
            processSingleRow(row, headerInfo, updateMap);
            
            setTimeout(processNextRow, CONSTANTS.DELAYS.ROW_PROCESSING);
        }
    };

    processNextRow();
}

/**
 * 単一行を処理
 * @param {HTMLElement} row - 処理対象の行
 * @param {Object} headerInfo - ヘッダー情報
 * @param {Map} updateMap - 更新データのマップ
 */
function processSingleRow(row, headerInfo, updateMap) {
    const { issuerIndex, accountIndex, noteIndex } = headerInfo;
    
    const issuerCell = row.querySelector(`td:nth-child(${issuerIndex})`);
    const accountCell = row.querySelector(`td:nth-child(${accountIndex})`);
    const noteSpan = row.querySelector(`td:nth-child(${noteIndex})`);

    if (!issuerCell || !accountCell || !noteSpan) {
        return;
    }

    const currentIssuer = issuerCell.textContent.trim();
    if (!updateMap.has(currentIssuer)) {
        return;
    }

    const updateData = updateMap.get(currentIssuer);
    
    // 備考を更新
    updateNoteCell(noteSpan, updateData.note);
    
    // 勘定科目を更新
    updateAccountCell(accountCell, updateData.account);
}

/**
 * 備考セルを更新
 * @param {HTMLElement} noteSpan - 備考セル
 * @param {string} newNote - 新しい備考
 */
function updateNoteCell(noteSpan, newNote) {
    noteSpan.textContent = newNote;
    noteSpan.style.backgroundColor = CONSTANTS.COLORS.SUCCESS_BACKGROUND;
}

/**
 * 勘定科目セルを更新
 * @param {HTMLElement} accountCell - 勘定科目セル
 * @param {string} newAccount - 新しい勘定科目
 */
function updateAccountCell(accountCell, newAccount) {
    const activeInput = accountCell.querySelector('input[role="combobox"]');
    const displayValueSpan = accountCell.querySelector('#tb-id_2__body__accountItem__0-0__cell__cellLabel span');
    
    // 値がすでに一致している場合はスキップ
    if (displayValueSpan && displayValueSpan.textContent === newAccount) {
        return;
    }

    // 編集モードに入っていない場合は編集モードに移行
    if (!activeInput) {
        enterEditMode(accountCell);
    }
    
    // 編集モードになるのを待ってから入力処理を実行
    setTimeout(() => {
        typeAccountValue(accountCell, newAccount);
    }, CONSTANTS.DELAYS.EDIT_MODE_WAIT);
}

/**
 * 編集モードに入る
 * @param {HTMLElement} accountCell - 勘定科目セル
 */
function enterEditMode(accountCell) {
    const clickerButton = accountCell.querySelector('button[aria-label="ダブルクリックでセルを編集"]');
    if (clickerButton) {
        const dblclickEvent = new MouseEvent('dblclick', { 
            bubbles: true, 
            cancelable: true 
        });
        clickerButton.dispatchEvent(dblclickEvent);
    } else {
        console.error(CONSTANTS.MESSAGES.EDIT_BUTTON_NOT_FOUND);
    }
}

/**
 * 勘定科目の値を入力
 * @param {HTMLElement} accountCell - 勘定科目セル
 * @param {string} newAccount - 新しい勘定科目
 */
function typeAccountValue(accountCell, newAccount) {
    const finalInput = accountCell.querySelector('input[role="combobox"]');
    if (!finalInput) {
        return;
    }

    finalInput.focus();
    finalInput.value = '';
    finalInput.dispatchEvent(new Event('input', { bubbles: true }));

    let charIndex = 0;
    const typeInterval = setInterval(() => {
        if (charIndex < newAccount.length) {
            typeCharacter(finalInput, newAccount[charIndex]);
            charIndex++;
        } else {
            clearInterval(typeInterval);
            confirmInput(finalInput);
        }
    }, CONSTANTS.DELAYS.TYPE_INTERVAL);
}

/**
 * 1文字を入力
 * @param {HTMLElement} input - 入力要素
 * @param {string} char - 入力する文字
 */
function typeCharacter(input, char) {
    const keydown = new KeyboardEvent('keydown', { key: char, bubbles: true });
    input.dispatchEvent(keydown);
    
    input.value += char;
    
    const inputEvent = new Event('input', { bubbles: true });
    input.dispatchEvent(inputEvent);

    const keyup = new KeyboardEvent('keyup', { key: char, bubbles: true });
    input.dispatchEvent(keyup);
}

/**
 * 入力を確定
 * @param {HTMLElement} input - 入力要素
 */
function confirmInput(input) {
    setTimeout(() => {
        const enterToConfirmEvent = new KeyboardEvent('keydown', { 
            key: 'Enter', 
            bubbles: true 
        });
        input.dispatchEvent(enterToConfirmEvent);
        input.blur();
        input.style.backgroundColor = CONSTANTS.COLORS.SUCCESS_BACKGROUND;
    }, CONSTANTS.DELAYS.ENTER_WAIT);
}
