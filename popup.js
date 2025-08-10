// 定数定義
const CONSTANTS = {
    DELAYS: {
        EDIT_MODE_WAIT: 200,
        TYPE_INTERVAL: 100,
        ENTER_WAIT: 500,
        ROW_PROCESSING: 7000
    },
    COLORS: {
        SUCCESS_BACKGROUND: '#f0fff0'
    },
    HEADER_ID_MAP: {
        '発行元': 'partnerName',
        '収支': 'dealCode',
        '決済': 'paymentStatus',
        '口座': 'walletable',
        '勘定科目': 'accountItem',
        '適格': 'qualifiedInvoice',
        '税率': 'taxRate',
        '取引先': 'dealPartnerName',
        '品目': 'tags',
        '部門': 'section',
        '備考': 'description',
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
document.getElementById('updateButton').addEventListener('click', () => {
    const csvData = document.getElementById('csvInput').value;
    if (!csvData) {
        alert(CONSTANTS.MESSAGES.NO_CSV_DATA);
        return;
    }

    // ChromeのAPIを使って、現在アクティブなタブでスクリプトを実行
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs[0];
        
        chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: updateTableFromCSV,
            args: [csvData, CONSTANTS] // CONSTANTSを引数として渡す
        });
    });
});

/**
 * CSVデータを使用してテーブルを更新するメイン関数
 * @param {string} csvData - 拡張機能のポップアップから渡されるCSVデータ
 * @param {object} constants - ポップアップから渡される定数
 */
function updateTableFromCSV(csvData, constants) {
    const CONSTANTS = constants;
    
    // 要望に合わせて、行処理はsetIntervalで実行し、間隔はtimeintervalで管理
    const timeinterval = CONSTANTS.DELAYS.ROW_PROCESSING;
    const editModeWaitMs = CONSTANTS.DELAYS.EDIT_MODE_WAIT;
    const typeIntervalMs = CONSTANTS.DELAYS.TYPE_INTERVAL;
    const enterWaitMs = CONSTANTS.DELAYS.ENTER_WAIT;

    try {
        // CSVのマッピングをする
        const headerKeys = Object.keys(CONSTANTS.HEADER_ID_MAP);
        const updateMap = parseCSVData(csvData, headerKeys);

        // テーブルを取得
        const table = findTable();
        if (!table) {
            console.error(CONSTANTS.MESSAGES.TABLE_NOT_FOUND);
            return;
        }

        // ヘッダー情報を取得
        const headerInfo = getHeaderInfo(table);
        //console.log("headerInfo => ");
        //console.log(headerInfo);
        if (!headerInfo) {
            return;
        }

        // 対象行を取得
        const targetRowIndexes = findTargetRows(table, headerInfo.partnerName, updateMap);

        // 行処理を実行（非同期で処理）
        processRowsWithInterval(targetRowIndexes, headerInfo, updateMap);

        alert(CONSTANTS.MESSAGES.UPDATE_COMPLETE);
    } catch (error) {
        console.error('テーブル更新中にエラーが発生しました:', error);
        alert(`エラーが発生しました: ${error.message}`);
    }

    // ---- ここから下は、この関数の中だけで使うヘルパー関数群 ----
    /**
     * CSVデータとヘッダー情報を基に、更新用のMapを生成する
     * CSVの1行目をヘッダーとして扱い、HEADER_ID_MAPと突き合わせる
     * @param {string} csvData - CSVデータ
     * @param {string[]} headerKeys - HEADER_ID_MAPのキーの配列
     * @returns {Map<string, object>} - 発行元をキー、更新データを値とするMap
     */
    function parseCSVData(csvData, headerKeys) {
        const lines = csvData.trim().split('\n');
        if (lines.length < 2) return new Map();
    
        const firstLine = lines[0];
        let delimiter = ',';
        if (firstLine.includes('\t')) delimiter = '\t';
    
        const headers = firstLine.split(delimiter).map(h => h.trim());
        const updateMap = new Map();
    
        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(delimiter).map(v => v ? v.trim() : '');
            if (!values[0]) continue; // 1列目（発行元）が空の場合はスキップ
    
            const rowData = {};
            headers.forEach((header, index) => {
                const headerId = CONSTANTS.HEADER_ID_MAP[header];
                if (headerId && values[index]) {
                    rowData[headerId] = values[index];
                }
            });
            //console.log("parseCSV => ");
            //console.log(rowData);
            updateMap.set(values[0], rowData);
        }
        return updateMap;
    }

    function findTable() {
        const table = document.querySelector('table');
        if (!table) return null;
        return table;
    }

    function getHeaderInfo(table) {
        const thead = table.querySelector('.Thead_1_7_0');
        if (!thead) {
            alert(CONSTANTS.MESSAGES.HEADER_NOT_FOUND);
            return null;
        }
        const headerRow = thead.querySelector('tr');
        if (!headerRow) {
            alert(CONSTANTS.MESSAGES.HEADER_ROW_NOT_FOUND);
            return null;
        }
        
        const headerInfo = {};
        for (const [columnName, headerId] of Object.entries(CONSTANTS.HEADER_ID_MAP)) {
            const index = getColumnIndexById(headerRow, columnName);
            if (index !== -1) {
                //console.log(index);
                headerInfo[headerId] = index;
            }
        }
        
        // 必須列の確認
        if (!headerInfo.partnerName || !headerInfo.accountItem || !headerInfo.description) {
            alert(CONSTANTS.MESSAGES.COLUMNS_NOT_FOUND);
            return null;
        }
        
        return headerInfo;
    }

    function getColumnIndexById(headerRow, columnName) {
        const headers = headerRow.querySelectorAll('th');
        const targetIdPart = CONSTANTS.HEADER_ID_MAP[columnName];
        if (!targetIdPart) return -1;
        for (let i = 0; i < headers.length; i++) {
            //console.log("getColumnIndexById");
            const id = headers[i].id;
            if (id && id.includes(targetIdPart)){
                console.log("getColumnIndexById => ");
                console.log(id);
                return i + 1;
            }
        }
        return -1;
    }

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

    function processRowsWithInterval(targetRowIndexes, headerInfo, updateMap) {
        const rows = document.querySelectorAll('tr');
        //一回目
        let currentIndex = 0;
        const row = rows[targetRowIndexes[currentIndex]];
        currentIndex++;
        processSingleRow(row, headerInfo, updateMap);

        //二回目以降
        const intervalId = setInterval(() => {
            if (currentIndex < targetRowIndexes.length) {
                const row = rows[targetRowIndexes[currentIndex]];
                currentIndex++;
                processSingleRow(row, headerInfo, updateMap);
            } else {
                clearInterval(intervalId);
            }
        }, timeinterval);
    }

    function processSingleRow(row, headerInfo, updateMap) {
        const issuerIndex = headerInfo.partnerName; // 発行元はpartnerName
        const issuerCell = row.querySelector(`td:nth-child(${issuerIndex})`);
        if (!issuerCell) return;

        const currentIssuer = issuerCell.textContent.trim();
        if (!updateMap.has(currentIssuer)) return;

        const updateData = updateMap.get(currentIssuer);
        
        
        const tempindex = [];
        const tempheader = [];
        //Object.entries(headerInfo).forEach((headerId, columnIndex) => {
        for (const [headerId, columnIndex] of Object.entries(headerInfo)) {
            if (headerId in updateData) {
                tempindex.push(columnIndex);
                tempheader.push(headerId);
                //console.log(columnIndex);
                //console.log(headerId);
            }
        };
        let currentIndex = 0;
        const intervalId = setInterval(() => {
        //for (const [headerId, columnIndex] of Object.entries(headerInfo)) {
            if(currentIndex < tempindex.length){
                const columnIndex = tempindex[currentIndex]
                const headerId = tempheader[currentIndex];
                
                currentIndex++;
                if (headerId in updateData) {
                    const cell = row.querySelector(`td:nth-child(${columnIndex})`);
                    if (cell) {
                        updateCell(cell, updateData[headerId], headerId);
                    }
                } else {
                    return;
                }
            } else {
                clearInterval(intervalId);
            }
        }, 1000);
    }
    
    function updateCell(cell, newValue, headerId) {
        // 発行元以外の全ての列をインタラクティブセルとして処理
        if (headerId !== 'partnerName') {
            updateInteractiveCell(cell, newValue, headerId);
        }
    }

    function updateTextCell(cell, newValue) {
        cell.textContent = newValue;
        cell.style.backgroundColor = CONSTANTS.COLORS.SUCCESS_BACKGROUND;
    }

    function updateInteractiveCell(cell, newValue, headerId) {
        // 既に同じ値の場合はスキップ
        const currentValue = cell.textContent.trim();
        if (currentValue === newValue) return;

        // 編集可能な入力要素を探す
        const activeInput = cell.querySelector('input[role="combobox"]') || 
                           cell.querySelector('input[type="text"]') || 
                           cell.querySelector('input') ||
                           cell.querySelector('textarea');
        
        // 編集ボタンを探す
        const clickerButton = cell.querySelector('button[aria-label="ダブルクリックでセルを編集"]');
        //console.log("headerId=>"+headerId.toString());
        //console.log("newValue=>"+newValue.toString());
        if (activeInput || clickerButton) {
            // 既にアクティブな入力フィールドがない場合は編集モードに移行
            if (!activeInput) {
                enterEditMode(cell);
            }
            setTimeout(() => {
                typeCellValue(cell, newValue, headerId);
            }, editModeWaitMs);
        }
    }

    function enterEditMode(cell) {
        const clickerButton = cell.querySelector('button[aria-label="ダブルクリックでセルを編集"]');
        if (clickerButton) {
            const dblclickEvent = new MouseEvent('dblclick', { bubbles: true, cancelable: true });
            clickerButton.dispatchEvent(dblclickEvent);
        } else {
            console.error(CONSTANTS.MESSAGES.EDIT_BUTTON_NOT_FOUND);
        }
    }

    function typeCellValue(cell, newValue, headerId) {
        // 様々なタイプの入力要素を探す
        const finalInput = cell.querySelector('input[role="combobox"]') || 
                          cell.querySelector('input[type="text"]') || 
                          cell.querySelector('input') ||
                          cell.querySelector('textarea');
        
        if (!finalInput) return;
        
        finalInput.focus();
        finalInput.value = '';
        finalInput.dispatchEvent(new Event('input', { bubbles: true }));
        
        // 金額フィールドの場合は一括で値を設定し、changeイベントを発火させる
        if (headerId === 'amount') {
            newValue = newValue.toString();
        }
        let charIndex = 0;
        const intervalId = setInterval(() => {
            if (charIndex < newValue.length) {
                //console.log(newValue[charIndex]);
                typeCharacter(finalInput, newValue[charIndex]);
                charIndex++;
            } else {
                clearInterval(intervalId);
                confirmInput(finalInput);
            }
        }, typeIntervalMs);
    }

    function typeCharacter(input, char) {
        const keydown = new KeyboardEvent('keydown', { key: char, bubbles: true });
        input.dispatchEvent(keydown);
        input.value += char;
        const inputEvent = new Event('input', { bubbles: true });
        input.dispatchEvent(inputEvent);
        const keyup = new KeyboardEvent('keyup', { key: char, bubbles: true });
        input.dispatchEvent(keyup);
    }

    function confirmInput(input) {
        setTimeout(() => {
            const enterToConfirmEvent = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
            input.dispatchEvent(enterToConfirmEvent);
            input.blur();
            input.style.backgroundColor = CONSTANTS.COLORS.SUCCESS_BACKGROUND;
        }, enterWaitMs);
    }
}
