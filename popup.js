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

        const targetRowIndexes = findTargetRows(table, headerInfo.issuerIndex, updateMap);
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
        const issuerIndex = getColumnIndexById(headerRow, '発行元');
        const accountIndex = getColumnIndexById(headerRow, '勘定科目');
        const noteIndex = getColumnIndexById(headerRow, '備考');
        if (issuerIndex === -1 || accountIndex === -1 || noteIndex === -1) {
            alert(CONSTANTS.MESSAGES.COLUMNS_NOT_FOUND);
            return null;
        }
        return { issuerIndex, accountIndex, noteIndex };
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
        const { issuerIndex, accountIndex, noteIndex } = headerInfo;
        const issuerCell = row.querySelector(`td:nth-child(${issuerIndex})`);
        const accountCell = row.querySelector(`td:nth-child(${accountIndex})`);
        const noteSpan = row.querySelector(`td:nth-child(${noteIndex})`);
        if (!issuerCell || !accountCell || !noteSpan) return;

        const currentIssuer = issuerCell.textContent.trim();
        if (!updateMap.has(currentIssuer)) return;

        const updateData = updateMap.get(currentIssuer);
        updateNoteCell(noteSpan, updateData.note);
        updateAccountCell(accountCell, updateData.account);
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
