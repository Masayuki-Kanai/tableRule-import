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
        '発生日': 'issueDate',
        '金額': 'amount',
        '収支': 'incomeExpense',
        '決済': 'payment',
        '口座': 'account',
        '決済期日': 'paymentDate',
        '勘定科目': 'accountItem',
        '適格': 'qualified',
        '税率': 'taxRate',
        '取引先': 'tradingPartner',
        '品目': 'item',
        '部門': 'department',
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
        alert('CSVデータを入力してください。');
        return;
    }

    // ChromeのAPIを使って、現在アクティブなタブでスクリプトを実行
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs[0];
        
        chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: updateTableFromCSV,
            args: [csvData]
        });
    });
});

/**
 * CSVデータを使用してテーブルを更新するメイン関数
 * @param {string} csvData - 拡張機能のポップアップから渡されるCSVデータ
 */
function updateTableFromCSV(csvData) {
    // 定数定義（コンテンツスクリプト内で利用可能）
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
            '発生日': 'issueDate',
            '金額': 'amount',
            '収支': 'incomeExpense',
            '決済': 'payment',
            '口座': 'account',
            '決済期日': 'paymentDate',
            '勘定科目': 'accountItem',
            '適格': 'qualified',
            '税区分': 'taxCategory',
            '税率': 'taxRate',
            '取引先': 'tradingPartner',
            '品目': 'item',
            '部門': 'department',
            '備考': 'description',
            '操作': 'operation'
        },
        MESSAGES: {
            TABLE_NOT_FOUND: 'テーブルが見つかりません。',
            HEADER_NOT_FOUND: 'エラー: テーブルのヘッダーが見つかりませんでした。',
            HEADER_ROW_NOT_FOUND: 'エラー: テーブルのヘッダー行が見つかりませんでした。',
            COLUMNS_NOT_FOUND: 'エラー: 必要な列が見つかりませんでした。',
            EDIT_BUTTON_NOT_FOUND: '編集モードに移行するためのボタンが見つかりません。'
        }
    };

    // 要望に合わせて、行処理はsetIntervalで実行し、間隔はtimeintervalで管理
    const timeinterval = 2000; // 行処理のインターバル(ms)
    const editModeWaitMs = 300; // 編集モード待機
    const typeIntervalMs = 200; // 文字入力のインターバル
    const enterWaitMs = 200; // Enter確定の待機

    try {
        const updateMap = parseCSVData(csvData);
        const table = findTable();
        if (!table) {
            console.error(CONSTANTS.MESSAGES.TABLE_NOT_FOUND);
            return;
        }

        const headerInfo = getHeaderInfo(table);
        if (!headerInfo) {
            return;
        }

        const targetRowIndexes = findTargetRows(table, headerInfo['発行元'], updateMap);
        processRowsWithInterval(targetRowIndexes, headerInfo, updateMap);

        alert('テーブルを更新しました！');
    } catch (error) {
        console.error('テーブル更新中にエラーが発生しました:', error);
        alert(`エラーが発生しました: ${error.message}`);
    }

    // ---- ここから下は、この関数の中だけで使うヘルパー関数群 ----

    function parseCSVData(csvData) {
        const firstLine = csvData.trim().split('\n')[0];
        let delimiter = ',';
        if (firstLine.includes('\t')) delimiter = '\t';

        const lines = csvData.trim().split('\n');
        const updateMap = new Map();
        // ヘッダー行を解析して列の順序を取得
        const headers = firstLine.split(delimiter).map(h => h.trim());
        
        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(delimiter).map(v => v ? v.trim() : '');
            if (values[0]) { // 発行元が存在する場合
                const updateData = {};
                headers.forEach((header, index) => {
                    if (index < values.length) {
                        // ヘッダー名を英語のプロパティ名に変換
                        const propertyName = CONSTANTS.HEADER_ID_MAP[header];
                        if (propertyName) {
                            updateData[propertyName] = values[index];
                        }
                    }
                });
                updateMap.set(values[0], updateData);
            }
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
        // 全ての列のインデックスを取得
        const headerIndices = {};
        Object.keys(CONSTANTS.HEADER_ID_MAP).forEach(columnName => {
            const index = getColumnIndexById(headerRow, columnName);
            headerIndices[columnName] = index;
        });
        
        if (headerIndices['発行元'] === -1) {
            alert(CONSTANTS.MESSAGES.COLUMNS_NOT_FOUND);
            return null;
        }
        
        return headerIndices;
    }

    function getColumnIndexById(headerRow, columnName) {
        const headers = headerRow.querySelectorAll('th');
        const targetIdPart = CONSTANTS.HEADER_ID_MAP[columnName];
        if (!targetIdPart) return -1;
        for (let i = 0; i < headers.length; i++) {
            const id = headers[i].id;
            if (id && id.includes(targetIdPart)) return i + 1;
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
        let currentIndex = 0;
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
        const issuerIndex = headerInfo['発行元'];
        const issuerCell = row.querySelector(`td:nth-child(${issuerIndex})`);
        if (!issuerCell) return;

        const currentIssuer = issuerCell.textContent.trim();
        if (!updateMap.has(currentIssuer)) return;

        const updateData = updateMap.get(currentIssuer);
        
        // 更新対象の列を配列に格納（発行元以外）
        const columnsToUpdate = [];
        Object.keys(updateData).forEach(propertyName => {
            // 英語プロパティ名から日本語列名を逆引き
            const columnName = Object.keys(CONSTANTS.HEADER_ID_MAP).find(
                key => CONSTANTS.HEADER_ID_MAP[key] === propertyName
            );
            
            if (columnName && columnName !== '発行元' && headerInfo[columnName] !== -1) {
                const cellIndex = headerInfo[columnName];
                const cell = row.querySelector(`td:nth-child(${cellIndex})`);
                if (cell && updateData[propertyName]) {
                    columnsToUpdate.push({
                        cell: cell,
                        value: updateData[propertyName],
                        columnName: columnName
                    });
                }
            }
        });
        
        // 列を順次処理（200ms間隔で処理して一行あたり約3秒以内）
        processColumnsSequentially(columnsToUpdate, 0);
    }

    function processColumnsSequentially(columnsToUpdate, currentIndex) {
        if (currentIndex >= columnsToUpdate.length) {
            return; // 全ての列の処理が完了
        }
        
        const columnData = columnsToUpdate[currentIndex];
        updateCellWithSimulation(columnData.cell, columnData.value, columnData.columnName, () => {
            // 次の列を処理（200ms間隔）
            setTimeout(() => {
                processColumnsSequentially(columnsToUpdate, currentIndex + 1);
            }, 200);
        });
    }

    function updateCellWithSimulation(cell, newValue, columnName, callback) {
        // 編集可能なセルかチェック
        const activeInput = cell.querySelector('input[role="combobox"]');
        const clickerButton = cell.querySelector('button[aria-label="ダブルクリックでセルを編集"]');
        
        if (activeInput || clickerButton) {
            // 編集可能なセル - ユーザー操作をシミュレート
            if (!activeInput) {
                enterEditMode(cell);
            }
            setTimeout(() => {
                typeValueWithSimulation(cell, newValue, callback);
            }, 100); // 編集モード待機時間を短縮
        } else {
            // 読み取り専用セル - 直接更新
            cell.textContent = newValue;
            cell.style.backgroundColor = CONSTANTS.COLORS.SUCCESS_BACKGROUND;
            if (callback) callback();
        }
    }

    function typeValueWithSimulation(cell, newValue, callback) {
        const finalInput = cell.querySelector('input[role="combobox"]');
        if (!finalInput) {
            if (callback) callback();
            return;
        }
        
        finalInput.focus();
        finalInput.value = '';
        finalInput.dispatchEvent(new Event('input', { bubbles: true }));
        
        let charIndex = 0;
        const intervalId = setInterval(() => {
            if (charIndex < newValue.length) {
                typeCharacter(finalInput, newValue[charIndex]);
                charIndex++;
            } else {
                clearInterval(intervalId);
                confirmInput(finalInput, callback);
            }
        }, 50); // 文字入力間隔を短縮（50ms）
    }

    function confirmInput(input, callback) {
        setTimeout(() => {
            const enterToConfirmEvent = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
            input.dispatchEvent(enterToConfirmEvent);
            input.blur();
            input.style.backgroundColor = CONSTANTS.COLORS.SUCCESS_BACKGROUND;
            if (callback) callback();
        }, 50); // Enter確定待機時間を短縮
    }

    function updateNoteCell(noteSpan, newNote) {
        noteSpan.textContent = newNote;
        noteSpan.style.backgroundColor = CONSTANTS.COLORS.SUCCESS_BACKGROUND;
    }

    function updateAccountCell(accountCell, newAccount) {
        const activeInput = accountCell.querySelector('input[role="combobox"]');
        const displayValueSpan = accountCell.querySelector('#tb-id_2__body__accountItem__0-0__cell__cellLabel span');
        if (displayValueSpan && displayValueSpan.textContent === newAccount) return;

        if (!activeInput) {
            enterEditMode(accountCell);
        }
        setTimeout(() => {
            typeAccountValue(accountCell, newAccount);
        }, editModeWaitMs);
    }

    function enterEditMode(accountCell) {
        const clickerButton = accountCell.querySelector('button[aria-label="ダブルクリックでセルを編集"]');
        if (clickerButton) {
            const dblclickEvent = new MouseEvent('dblclick', { bubbles: true, cancelable: true });
            clickerButton.dispatchEvent(dblclickEvent);
        } else {
            console.error(CONSTANTS.MESSAGES.EDIT_BUTTON_NOT_FOUND);
        }
    }

    function typeAccountValue(accountCell, newAccount) {
        const finalInput = accountCell.querySelector('input[role="combobox"]');
        if (!finalInput) return;
        finalInput.focus();
        finalInput.value = '';
        finalInput.dispatchEvent(new Event('input', { bubbles: true }));
        let charIndex = 0;
        const intervalId = setInterval(() => {
            if (charIndex < newAccount.length) {
                typeCharacter(finalInput, newAccount[charIndex]);
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
