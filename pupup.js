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
            // func: には、コンテンツスクリプトとして実行したい関数を渡す
            // args: で、funcに引数を渡せる
            func: updateTableFromCSV,
            args: [csvData]
        });
    });
});


// * この関数がコンテンツスクリプトとして実行され、ウェブページのDOMを操作します。
// * @param {string} csvData - 拡張機能のポップアップから渡されるCSVデータ
function updateTableFromCSV(csvData) {
    /**
     * idのパターンからヘッダーの列名とインデックスを取得する関数
     * @param {HTMLElement} headerRow - ヘッダーの<tr>要素
     * @param {string} columnName - 探す列名
     * @returns {number} 1ベースの列インデックス
     */
    function getColumnIndexById(headerRow, columnName) {
        const headers = headerRow.querySelectorAll('th');
        // 列名とidの対応マップ
        const headerIdMap = {
            '発行元': 'partnerName',
            '勘定科目': 'accountItem',
            '備考': 'description'
        };
        const targetIdPart = headerIdMap[columnName];
        console.log('check1');

        if (!targetIdPart) {
            return -1;
        }
        console.log(headers.length);
        
        for (let i = 0; i < headers.length; i++) {
            const id = headers[i].id;
            // ヘッダーのidが、対応マップの値（例: 'partnerName'）を含んでいるかチェック
            console.log(id, headers[i]);
            if (id && id.includes(targetIdPart)) {
                return i + 1;
            }
        }
        return -1;
    }
    
    
    // データの最初の行をチェックして区切り文字を判別
    const firstLine = csvData.trim().split('\n')[0];
    let delimiter = ','; // デフォルトはカンマ

    if (firstLine.includes('\t')) {
        // タブが含まれていればタブを区切り文字とする
        delimiter = '\t';
    }

    // CSV/TSVデータをパースして、発行元をキーにしたマップを作成
    const lines = csvData.trim().split('\n');
    const updateMap = new Map();

    for (let i = 1; i < lines.length; i++) {
        // 判別した区切り文字で分割
        const [issuer, account, note] = lines[i].split(delimiter);
        if (issuer) {
            updateMap.set(issuer.trim(), {
                account: account ? account.trim() : '',
                note: note ? note.trim() : ''
            });
        }
    }

    // ページのテーブルを検索
    const table = document.querySelector('table');
    if (!table) {
        console.error('テーブルが見つかりません。');
        return;
    }

    const thead = table.querySelector('.Thead_1_7_0');
    if (!thead) {
        alert('エラー: テーブルのヘッダーが見つかりませんでした。');
        return;
    }

    const headerRow = thead.querySelector('tr');
    if (!headerRow) {
        alert('エラー: テーブルのヘッダー行が見つかりませんでした。');
        return;
    }

    // idベースの関数に置き換え
    const issuerIndex = getColumnIndexById(headerRow, '発行元');
    const accountIndex = getColumnIndexById(headerRow, '勘定科目');
    const noteIndex = getColumnIndexById(headerRow, '備考');

    if (issuerIndex === -1 || accountIndex === -1 || noteIndex === -1) {
        alert(`エラー: 必要な列が見つかりませんでした。発行元: ${issuerIndex}, 勘定科目: ${accountIndex}, 備考: ${noteIndex}`);
        return;
    }

    // テーブルの各行をループして、備考列を更新
    const rows = table.querySelectorAll('tr');
    // 💡 処理対象の行番号を事前に取得する
    const targetRowIndexes = [];
    rows.forEach((row, index) => {
        const issuerCell = row.querySelector(`td:nth-child(${issuerIndex})`);
        if (issuerCell && updateMap.has(issuerCell.textContent.trim())) {
            targetRowIndexes.push(index);
        }
    });

    //javascriptでのループ処理用に、setIntervalを使う
    let i = 0;
    const rowInterval = setInterval(() => {
        //テーブル内の全行回す
        if (i < targetRowIndexes.length) {
            const row = rows[targetRowIndexes[i]];
            i++;

            //rows.forEach(row => {
            // 発行元と備考の要素をCSSセレクターで直接指定
            // 発行元を1番目のtd、備考を2番目のtdの中にあるspanと仮定
            const issuerCell = row.querySelector(`td:nth-child(${issuerIndex})`);
            const accountCell = row.querySelector(`td:nth-child(${accountIndex})`);
            const noteSpan = row.querySelector(`td:nth-child(${noteIndex})`);
        
        
            // 両方の要素が存在するか確認
            if (!issuerCell || !accountCell || !noteSpan) {
                //alert('error_3check');
                return;
            }

            const currentIssuer = issuerCell.textContent.trim();

            // CSVデータに一致する発行元があれば、備考を更新
            if (updateMap.has(currentIssuer)) {
                const updateData = updateMap.get(currentIssuer);
                const newAccount = updateData.account;
            
            // 勘定科目セルの現在の状態を判定
            const activeInput = accountCell.querySelector('input[role="combobox"]');
            const displayValueSpan = accountCell.querySelector('#tb-id_2__body__accountItem__0-0__cell__cellLabel span');
            
            // 備考を先に更新
            const newNote = updateData.note;
            noteSpan.textContent = newNote;
            noteSpan.style.backgroundColor = '#f0fff0';

            // 値がすでに一致している場合はスキップ
            if (displayValueSpan && displayValueSpan.textContent === newAccount) {
                return;
            }

            // 編集モードに入っていない場合
            if (!activeInput) {
                const clickerButton = accountCell.querySelector('button[aria-label="ダブルクリックでセルを編集"]');
                if (clickerButton) {
                    const dblclickEvent = new MouseEvent('dblclick', { 'bubbles': true, 'cancelable': true });
                    clickerButton.dispatchEvent(dblclickEvent);
                } else {
                    console.error('編集モードに移行するためのボタンが見つかりません。');
                    return;
                }
            }
            
            // 編集モードになるのを待ってから入力処理を実行
            setTimeout(() => {
                const finalInput = accountCell.querySelector('input[role="combobox"]');
                if (finalInput) {
                    finalInput.focus();
                    
                    finalInput.value = '';
                    finalInput.dispatchEvent(new Event('input', { bubbles: true }));

                    let charIndex = 0;
                    const typeInterval = setInterval(() => {
                        if (charIndex < newAccount.length) {
                            const char = newAccount[charIndex];
                            
                            const keydown = new KeyboardEvent('keydown', { key: char, bubbles: true });
                            finalInput.dispatchEvent(keydown);
                            
                            finalInput.value += char;
                            
                            const inputEvent = new Event('input', { bubbles: true });
                            finalInput.dispatchEvent(inputEvent);

                            const keyup = new KeyboardEvent('keyup', { key: char, bubbles: true });
                            finalInput.dispatchEvent(keyup);

                            charIndex++;
                        } else {
                            clearInterval(typeInterval);
                            
                            //setTimeout(() => {
                                //const arrowDownEvent = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true });
                                //finalInput.dispatchEvent(arrowDownEvent);
                                
                                setTimeout(() => {
                                    const enterToConfirmEvent = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
                                    finalInput.dispatchEvent(enterToConfirmEvent);
                                    finalInput.blur();
                                    finalInput.style.backgroundColor = '#f0fff0';
                                }, 200); // 💡 Enterキーの待機時間を0.5秒に調整
                            //}, 1000); // 💡 ArrowDownの待機時間を0.5秒に調整
                        }
                    }, 200); // 💡 入力間隔を200msに
                }
            }, 300); // 💡 編集モードの待機時間を0.5秒に調整

        }
        return;
    //});
      }else{
        clearInterval(rowInterval);
      }}, 2000);
    alert('テーブルを更新しました！');
}
