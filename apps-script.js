// ============================================
// Google Apps Script - 반도체 시세 자동수집 & 입력 자동화
// ============================================
// 사용법:
// 1. Google Sheets에서 [확장 프로그램] > [Apps Script] 클릭
// 2. 이 코드 전체를 붙여넣기
// 3. 저장 후 "초기설정" 함수 실행 (최초 1회)
// 4. 권한 허용
// ============================================

// === 상수 ===
const SHEET_NAME = '시세';
const PRODUCTS = ['ddr5_16gb', 'ddr4_8gb', 'ddr3_4gb', 'nand_tlc_512', 'nand_mlc_64'];
const HEADERS = ['date', ...PRODUCTS, 'status'];

// DRAMeXchange HTML 파싱용 매핑
const DRAM_SPOT_MAP = {
  'DDR5 16Gb (2Gx8) 4800/5600': 'ddr5_16gb',
  'DDR4 8Gb (1Gx8) 3200': 'ddr4_8gb',
  'DDR3 4Gb 512Mx8 1600/1866': 'ddr3_4gb',
};
const FLASH_SPOT_MAP = {
  'MLC 64Gb 8GBx8': 'nand_mlc_64',
};
const WAFER_SPOT_MAP = {
  '512Gb TLC': 'nand_tlc_512',
};


// ============================================
// 1. 초기 설정 (최초 1회 실행)
// ============================================
function 초기설정() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }

  // 헤더 설정
  sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');

  // 열 너비: date 120px, 품목 각 100px, status 80px
  sheet.setColumnWidth(1, 120);
  for (let i = 2; i <= PRODUCTS.length + 1; i++) {
    sheet.setColumnWidth(i, 100);
  }
  sheet.setColumnWidth(HEADERS.length, 80); // status 열

  // 트리거 설정
  삭제_기존트리거();
  ScriptApp.newTrigger('자동수집_실행')
    .timeBased()
    .atHour(9)
    .everyDays(1)
    .create();

  Logger.log('✅ 초기 설정 완료! 매일 오전 9시에 자동수집이 실행됩니다.');
}


// ============================================
// 2. 자동수집 실행 (트리거로 매일 오전 9시 호출)
// ============================================
function 자동수집_실행() {
  const day = new Date().getDay();
  if (day === 0 || day === 6) {
    Logger.log('주말 → 수집 건너뜀');
    return;
  }

  const today = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd');
  let prices = {};

  try {
    const response = UrlFetchApp.fetch('https://www.dramexchange.com/', {
      muteHttpExceptions: true,
      followRedirects: true,
    });
    const html = response.getContentText();
    prices = parseDramExchangeHtml(html);
    Logger.log('파싱 결과: ' + JSON.stringify(prices));
  } catch (e) {
    Logger.log('⚠️ fetch 실패: ' + e.message);
    // fetch 실패해도 빈 행은 남김
  }

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (!sheet) return;

  const lastRow = sheet.getLastRow();

  // 오늘 날짜 행 찾기
  let targetRow = -1;
  for (let row = lastRow; row >= 2; row--) {
    if (sheet.getRange(row, 1).getValue() === today) {
      targetRow = row;
      break;
    }
  }

  // 이미 "확정" 상태면 건드리지 않음
  if (targetRow !== -1) {
    const statusCol = HEADERS.indexOf('status') + 1;
    const currentStatus = sheet.getRange(targetRow, statusCol).getValue();
    if (currentStatus === '확정') {
      Logger.log('이미 확정된 행 → 수집 건너뜀');
      return;
    }
  }

  // 행이 없으면 새로 추가
  if (targetRow === -1) {
    targetRow = lastRow + 1;
    sheet.getRange(targetRow, 1).setValue(today);
  }

  // 가격 기록
  const values = PRODUCTS.map(key => {
    const v = prices[key];
    return (v !== undefined && v !== null) ? v : '';
  });
  sheet.getRange(targetRow, 2, 1, PRODUCTS.length).setValues([values]);

  // status = "임시"
  const statusCol = HEADERS.indexOf('status') + 1;
  sheet.getRange(targetRow, statusCol).setValue('임시');

  // 임시 행 배경색 연한 노랑
  sheet.getRange(targetRow, 1, 1, HEADERS.length).setBackground('#fff3cd');

  Logger.log('✅ ' + today + ' 자동수집 완료');
}


// ============================================
// 3. HTML 파싱 헬퍼
// ============================================
function parseDramExchangeHtml(html) {
  const result = {};

  // <tr> 한 줄씩 순회
  const trPattern = /<tr[\s\S]*?<\/tr>/gi;
  const tdPattern = /<td[^>]*>([\s\S]*?)<\/td>/gi;

  let trMatch;
  while ((trMatch = trPattern.exec(html)) !== null) {
    const row = trMatch[0];
    const cells = [];
    let tdMatch;
    const tdRe = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    while ((tdMatch = tdRe.exec(row)) !== null) {
      // 태그 제거 후 공백 정리
      cells.push(tdMatch[1].replace(/<[^>]+>/g, '').trim());
    }
    if (cells.length < 6) continue;

    const itemName = cells[0];
    // Session Average = cells[5] (0-indexed: Item, High, Low, S.High, S.Low, S.Avg, ...)
    const rawVal = cells[5].replace(/[^0-9.]/g, '');
    const val = parseFloat(rawVal);

    // 모든 매핑 테이블에서 항목명 검색
    const allMaps = [DRAM_SPOT_MAP, FLASH_SPOT_MAP, WAFER_SPOT_MAP];
    for (const map of allMaps) {
      for (const [label, key] of Object.entries(map)) {
        if (itemName.includes(label) || label.includes(itemName)) {
          if (!isNaN(val)) {
            result[key] = val;
          }
          break;
        }
      }
    }
  }

  return result;
}


// ============================================
// 4. 모바일 웹앱
// ============================================
function doGet() {
  return HtmlService.createHtmlOutput(getInputFormHtml())
    .setTitle('반도체 시세 입력')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function getInputFormHtml() {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, 'Noto Sans KR', sans-serif;
      background: #f5f5f5;
      padding: 20px;
      max-width: 400px;
      margin: 0 auto;
    }
    h1 { font-size: 20px; margin-bottom: 4px; }
    .subtitle { color: #888; font-size: 14px; margin-bottom: 20px; }

    /* 모드 탭 */
    .mode-tabs {
      display: flex;
      background: #e0e0e0;
      border-radius: 8px;
      padding: 3px;
      margin-bottom: 20px;
      gap: 3px;
    }
    .mode-tab {
      flex: 1;
      padding: 8px;
      text-align: center;
      font-size: 13px;
      font-weight: 700;
      border: none;
      background: none;
      color: #888;
      border-radius: 6px;
      cursor: pointer;
    }
    .mode-tab.active {
      background: white;
      color: #1a1a2e;
      box-shadow: 0 1px 3px rgba(0,0,0,0.15);
    }

    /* 상태 배지 */
    .status-badge {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 700;
      margin-left: 8px;
    }
    .badge-pending { background: #fff3cd; color: #856404; }
    .badge-confirmed { background: #d4edda; color: #155724; }

    .date-row {
      display: flex;
      align-items: center;
      margin-bottom: 20px;
      font-size: 15px;
      font-weight: 700;
    }

    .field { margin-bottom: 16px; }
    label {
      display: block;
      font-size: 13px;
      font-weight: 700;
      color: #555;
      margin-bottom: 6px;
    }
    input[type="number"], input[type="date"] {
      width: 100%;
      padding: 14px;
      font-size: 18px;
      border: 2px solid #ddd;
      border-radius: 10px;
      background: white;
      -webkit-appearance: none;
    }
    input:focus {
      outline: none;
      border-color: #4da3ff;
    }
    .prev-price {
      font-size: 12px;
      color: #999;
      margin-top: 4px;
    }
    .btn {
      width: 100%;
      padding: 16px;
      font-size: 16px;
      font-weight: 700;
      background: #1a1a2e;
      color: white;
      border: none;
      border-radius: 10px;
      margin-top: 12px;
      cursor: pointer;
    }
    .btn-approve { background: #1677ff; }
    .btn-save { background: #1a1a2e; }
    .btn:disabled { background: #ccc; cursor: not-allowed; }
    .btn-success { background: #52c41a !important; }
    .msg {
      text-align: center;
      margin-top: 12px;
      font-size: 14px;
      padding: 10px;
      border-radius: 8px;
    }
    .msg-ok { background: #d4edda; color: #155724; }
    .msg-err { background: #f8d7da; color: #721c24; }
    .no-pending {
      text-align: center;
      padding: 32px 0;
      color: #888;
      font-size: 14px;
      line-height: 1.8;
    }
    .section { display: none; }
    .section.active { display: block; }
  </style>
</head>
<body>
  <h1>시세 입력</h1>
  <p class="subtitle">DRAMeXchange 기준</p>

  <div class="mode-tabs">
    <button class="mode-tab active" id="tabApprove" onclick="switchMode('approve')">승인 모드</button>
    <button class="mode-tab" id="tabManual" onclick="switchMode('manual')">직접 입력</button>
  </div>

  <!-- 승인 모드 -->
  <div class="section active" id="sectionApprove">
    <div id="approveContent">
      <div style="text-align:center;padding:32px 0;color:#888;">불러오는 중...</div>
    </div>
  </div>

  <!-- 수동 입력 모드 -->
  <div class="section" id="sectionManual">
    <div class="field">
      <label>날짜</label>
      <input type="date" id="manualDate">
    </div>
    ${makeFields('manual')}
    <button class="btn btn-save" id="saveBtn" onclick="savePricesManual()">저장하기</button>
    <div id="saveMsg"></div>
  </div>

  <script>
    const PRODUCTS_KEY = ['ddr5_16gb', 'ddr4_8gb', 'ddr3_4gb', 'nand_tlc_512', 'nand_mlc_64'];
    const LABELS = {
      ddr5_16gb: 'DDR5 16Gb Spot (USD)',
      ddr4_8gb: 'DDR4 8Gb Spot (USD)',
      ddr3_4gb: 'DDR3 4Gb Spot (USD)',
      nand_tlc_512: 'NAND TLC 512Gb Wafer (USD)',
      nand_mlc_64: 'MLC 64Gb Spot (USD)',
    };

    // 오늘 날짜를 date input 기본값으로
    const todayStr = new Date().toISOString().split('T')[0];
    document.getElementById('manualDate').value = todayStr;

    // 전일 확정가 불러오기
    function loadPrevPrices(date) {
      google.script.run.withSuccessHandler(function(prev) {
        if (!prev) return;
        PRODUCTS_KEY.forEach(function(key) {
          // 승인 모드 전일가
          const el1 = document.getElementById('prev_approve_' + key);
          if (el1 && prev[key] != null) el1.textContent = '전일 확정: $' + Number(prev[key]).toFixed(3);
          // 수동 입력 전일가
          const el2 = document.getElementById('prev_manual_' + key);
          if (el2 && prev[key] != null) el2.textContent = '전일 확정: $' + Number(prev[key]).toFixed(3);
        });
      }).getPreviousPrices(date);
    }

    // 승인 모드: 임시 데이터 불러오기
    google.script.run.withSuccessHandler(function(pending) {
      const container = document.getElementById('approveContent');
      if (!pending) {
        container.innerHTML = '<div class="no-pending">승인 대기 중인 임시 데이터가 없습니다.<br>직접 입력 탭을 사용하세요.</div>';
        return;
      }

      let fieldsHtml = '';
      PRODUCTS_KEY.forEach(function(key) {
        const val = pending[key] != null ? pending[key] : '';
        fieldsHtml += \`
          <div class="field">
            <label>\${LABELS[key]}</label>
            <input type="number" id="approve_\${key}" step="0.001" inputmode="decimal"
              placeholder="예: 0.000" value="\${val}">
            <div class="prev-price" id="prev_approve_\${key}"></div>
          </div>\`;
      });

      container.innerHTML = \`
        <div class="date-row">
          \${pending.date}
          <span class="status-badge badge-pending">임시</span>
        </div>
        \${fieldsHtml}
        <button class="btn btn-approve" id="approveBtn" onclick="approvePricesForm('\${pending.date}')">승인하기</button>
        <div id="approveMsg"></div>
      \`;

      loadPrevPrices(pending.date);
    }).getPendingData();

    loadPrevPrices(todayStr); // 수동 입력 탭 전일가

    // 모드 전환
    function switchMode(mode) {
      document.getElementById('sectionApprove').classList.toggle('active', mode === 'approve');
      document.getElementById('sectionManual').classList.toggle('active', mode === 'manual');
      document.getElementById('tabApprove').classList.toggle('active', mode === 'approve');
      document.getElementById('tabManual').classList.toggle('active', mode === 'manual');
    }

    // 승인 제출
    function approvePricesForm(date) {
      const btn = document.getElementById('approveBtn');
      btn.disabled = true;
      btn.textContent = '처리 중...';

      const data = { date: date };
      PRODUCTS_KEY.forEach(function(key) {
        data[key] = document.getElementById('approve_' + key).value;
      });

      google.script.run
        .withSuccessHandler(function() {
          btn.textContent = '✅ 승인 완료!';
          btn.classList.add('btn-success');
          document.getElementById('approveMsg').innerHTML =
            '<div class="msg msg-ok">확정 처리되었습니다.</div>';
        })
        .withFailureHandler(function(err) {
          btn.disabled = false;
          btn.textContent = '승인하기';
          document.getElementById('approveMsg').innerHTML =
            '<div class="msg msg-err">오류: ' + err.message + '</div>';
        })
        .approvePrices(data);
    }

    // 수동 저장
    function savePricesManual() {
      const btn = document.getElementById('saveBtn');
      btn.disabled = true;
      btn.textContent = '저장 중...';

      const data = { date: document.getElementById('manualDate').value };
      PRODUCTS_KEY.forEach(function(key) {
        data[key] = document.getElementById('manual_' + key).value;
      });

      google.script.run
        .withSuccessHandler(function() {
          btn.textContent = '✅ 저장 완료!';
          btn.classList.add('btn-success');
          document.getElementById('saveMsg').innerHTML =
            '<div class="msg msg-ok">저장되었습니다.</div>';
        })
        .withFailureHandler(function(err) {
          btn.disabled = false;
          btn.textContent = '저장하기';
          document.getElementById('saveMsg').innerHTML =
            '<div class="msg msg-err">오류: ' + err.message + '</div>';
        })
        .savePrices(data);
    }
  </script>
</body>
</html>`;
}

// 필드 HTML 생성 헬퍼 (서버 측 템플릿용)
function makeFields(prefix) {
  const labels = {
    ddr5_16gb: 'DDR5 16Gb Spot (USD)',
    ddr4_8gb: 'DDR4 8Gb Spot (USD)',
    ddr3_4gb: 'DDR3 4Gb Spot (USD)',
    nand_tlc_512: 'NAND TLC 512Gb Wafer (USD)',
    nand_mlc_64: 'MLC 64Gb Spot (USD)',
  };
  const placeholders = {
    ddr5_16gb: '39.300', ddr4_8gb: '33.600', ddr3_4gb: '6.400',
    nand_tlc_512: '20.500', nand_mlc_64: '9.300',
  };
  return PRODUCTS.map(key => `
    <div class="field">
      <label>${labels[key]}</label>
      <input type="number" id="${prefix}_${key}" step="0.001" inputmode="decimal" placeholder="예: ${placeholders[key]}">
      <div class="prev-price" id="prev_${prefix}_${key}"></div>
    </div>`).join('');
}


// ============================================
// 5. 서버 함수
// ============================================

// 임시 상태 최신 행 반환
function getPendingData() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (!sheet || sheet.getLastRow() < 2) return null;

  const statusCol = HEADERS.indexOf('status') + 1;
  const lastRow = sheet.getLastRow();

  for (let row = lastRow; row >= 2; row--) {
    const status = sheet.getRange(row, statusCol).getValue().toString().trim();
    if (status === '임시') {
      return rowToObject(sheet, row);
    }
  }
  return null;
}

// 디버그: getPendingData 직접 테스트
function 디버그_getPendingData() {
  const result = getPendingData();
  Logger.log('getPendingData 결과: ' + JSON.stringify(result));
  if (result) {
    Logger.log('date 타입: ' + typeof result.date + ' | 값: ' + result.date);
  }
}

// 임시 행을 확정으로 변경
function approvePrices(data) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (!sheet) throw new Error('시트를 찾을 수 없습니다.');

  const targetRow = findRowByDate(sheet, data.date);
  if (targetRow === -1) throw new Error('해당 날짜 행을 찾을 수 없습니다: ' + data.date);

  // 가격 업데이트
  const values = PRODUCTS.map(key => parseFloat(data[key]) || '');
  sheet.getRange(targetRow, 2, 1, PRODUCTS.length).setValues([values]);

  // status = "확정", 배경색 제거
  const statusCol = HEADERS.indexOf('status') + 1;
  sheet.getRange(targetRow, statusCol).setValue('확정');
  sheet.getRange(targetRow, 1, 1, HEADERS.length).setBackground(null);

  Logger.log('✅ ' + data.date + ' 확정 처리 완료');
}

// 수동 저장 (날짜 기준, 없으면 생성 후 정렬)
function savePrices(data) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (!sheet) throw new Error('시트를 찾을 수 없습니다.');

  let targetRow = findRowByDate(sheet, data.date);

  if (targetRow === -1) {
    targetRow = sheet.getLastRow() + 1;
    sheet.getRange(targetRow, 1).setValue(data.date);
  }

  // 가격 저장
  const values = PRODUCTS.map(key => parseFloat(data[key]) || '');
  sheet.getRange(targetRow, 2, 1, PRODUCTS.length).setValues([values]);

  // status = "확정", 배경색 제거
  const statusCol = HEADERS.indexOf('status') + 1;
  sheet.getRange(targetRow, statusCol).setValue('확정');
  sheet.getRange(targetRow, 1, 1, HEADERS.length).setBackground(null);

  // date 기준 오름차순 정렬 (헤더 제외)
  const lastRow = sheet.getLastRow();
  if (lastRow > 2) {
    sheet.getRange(2, 1, lastRow - 1, HEADERS.length).sort({ column: 1, ascending: true });
  }

  Logger.log('✅ ' + data.date + ' 수동 저장 완료');
}

// 지정 날짜 이전 확정 최신 행 반환
function getPreviousPrices(date) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (!sheet || sheet.getLastRow() < 2) return null;

  const statusCol = HEADERS.indexOf('status') + 1;
  const lastRow = sheet.getLastRow();

  for (let row = lastRow; row >= 2; row--) {
    const v = sheet.getRange(row, 1).getValue();
    const rowDate = (v instanceof Date)
      ? Utilities.formatDate(v, 'Asia/Seoul', 'yyyy-MM-dd')
      : v.toString();
    const status = sheet.getRange(row, statusCol).getValue().toString().trim();
    if (status === '확정' && rowDate < date) {
      return rowToObject(sheet, row);
    }
  }
  return null;
}


// ============================================
// 유틸
// ============================================
function 삭제_기존트리거() {
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === '자동수집_실행') {
      ScriptApp.deleteTrigger(t);
    }
  });
}

function findRowByDate(sheet, date) {
  const lastRow = sheet.getLastRow();
  for (let row = lastRow; row >= 2; row--) {
    const v = sheet.getRange(row, 1).getValue();
    const rowDate = (v instanceof Date)
      ? Utilities.formatDate(v, 'Asia/Seoul', 'yyyy-MM-dd')
      : v.toString();
    if (rowDate === date) return row;
  }
  return -1;
}

function rowToObject(sheet, row) {
  const headers = sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0];
  const values = sheet.getRange(row, 1, 1, HEADERS.length).getValues()[0];
  const result = {};
  headers.forEach((h, i) => {
    // date 열은 항상 yyyy-MM-dd 문자열로 변환
    if (h === 'date') {
      const v = values[i];
      result[h] = (v instanceof Date)
        ? Utilities.formatDate(v, 'Asia/Seoul', 'yyyy-MM-dd')
        : v.toString();
    } else {
      result[h] = values[i];
    }
  });
  return result;
}
