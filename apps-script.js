// ============================================
// Google Apps Script - 반도체 시세 입력 자동화
// ============================================
// 사용법:
// 1. Google Sheets에서 [확장 프로그램] > [Apps Script] 클릭
// 2. 이 코드 전체를 붙여넣기
// 3. 저장 후 "초기설정" 함수 실행 (최초 1회)
// 4. 권한 허용
// ============================================

// === 설정 ===
const SHEET_NAME = '시세';
const PRODUCTS = ['ddr5_16gb', 'ddr4_8gb', 'ddr3_4gb', 'nand_tlc_512', 'nand_mlc_64', 'dxi'];
const HEADERS = ['date', ...PRODUCTS];

// === 1. 초기 설정 (최초 1회 실행) ===
function 초기설정() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }
  
  // 헤더 설정
  const headerRow = HEADERS;
  sheet.getRange(1, 1, 1, headerRow.length).setValues([headerRow]);
  sheet.getRange(1, 1, 1, headerRow.length).setFontWeight('bold');
  
  // 날짜 열 서식
  sheet.setColumnWidth(1, 120);
  for (let i = 2; i <= headerRow.length; i++) {
    sheet.setColumnWidth(i, 100);
  }
  
  // 매일 오전 9시 자동 행 생성 트리거 설정
  삭제_기존트리거();
  ScriptApp.newTrigger('오늘행_자동생성')
    .timeBased()
    .atHour(9)
    .everyDays(1)
    .create();
  
  Logger.log('✅ 초기 설정 완료! 매일 오전 9시에 새 행이 자동 생성됩니다.');
}

// === 2. 매일 자동 실행: 오늘 날짜 행 생성 ===
function 오늘행_자동생성() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (!sheet) return;
  
  const today = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd');
  const day = new Date().getDay();
  
  // 주말 건너뛰기 (토=6, 일=0)
  if (day === 0 || day === 6) return;
  
  // 이미 오늘 행이 있는지 확인
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    const lastDate = sheet.getRange(lastRow, 1).getValue();
    if (lastDate === today) return; // 중복 방지
  }
  
  // 새 행 추가 (날짜만 채움, 가격은 비워둠)
  const newRow = lastRow + 1;
  sheet.getRange(newRow, 1).setValue(today);
  
  // 가격 셀에 노란 배경 (입력 필요 표시)
  sheet.getRange(newRow, 2, 1, PRODUCTS.length)
    .setBackground('#fff3cd')
    .setNumberFormat('0.000');
  
  Logger.log('✅ ' + today + ' 행 생성 완료');
}

// === 3. 모바일 입력 폼 (웹앱) ===
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
    .date { color: #888; font-size: 14px; margin-bottom: 24px; }
    .field { margin-bottom: 16px; }
    label {
      display: block;
      font-size: 13px;
      font-weight: 700;
      color: #555;
      margin-bottom: 6px;
    }
    input[type="number"] {
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
    .btn:disabled { background: #ccc; }
    .btn-success { background: #52c41a; }
    .msg {
      text-align: center;
      margin-top: 12px;
      font-size: 14px;
      padding: 10px;
      border-radius: 8px;
    }
    .msg-ok { background: #d4edda; color: #155724; }
    .msg-err { background: #f8d7da; color: #721c24; }
    .prev-price {
      font-size: 12px;
      color: #999;
      margin-top: 4px;
    }
  </style>
</head>
<body>
  <h1>시세 입력</h1>
  <div class="date" id="dateLabel"></div>
  
  <div id="form">
    <div class="field">
      <label>DDR5 16Gb Spot (USD)</label>
      <input type="number" id="ddr5_16gb" step="0.001" inputmode="decimal" placeholder="예: 39.300">
      <div class="prev-price" id="prev_ddr5_16gb"></div>
    </div>
    <div class="field">
      <label>DDR4 8Gb Spot (USD)</label>
      <input type="number" id="ddr4_8gb" step="0.001" inputmode="decimal" placeholder="예: 33.600">
      <div class="prev-price" id="prev_ddr4_8gb"></div>
    </div>
    <div class="field">
      <label>DDR3 4Gb Spot (USD)</label>
      <input type="number" id="ddr3_4gb" step="0.001" inputmode="decimal" placeholder="예: 6.400">
      <div class="prev-price" id="prev_ddr3_4gb"></div>
    </div>
    <div class="field">
      <label>NAND TLC 512Gb Wafer (USD)</label>
      <input type="number" id="nand_tlc_512" step="0.001" inputmode="decimal" placeholder="예: 20.500">
      <div class="prev-price" id="prev_nand_tlc_512"></div>
    </div>
    <div class="field">
      <label>MLC 64Gb Spot (USD)</label>
      <input type="number" id="nand_mlc_64" step="0.001" inputmode="decimal" placeholder="예: 9.300">
      <div class="prev-price" id="prev_nand_mlc_64"></div>
    </div>
    <div class="field">
      <label>DXI 지수</label>
      <input type="number" id="dxi" step="0.01" inputmode="decimal" placeholder="예: 38250.12">
      <div class="prev-price" id="prev_dxi"></div>
    </div>
    <button class="btn" id="submitBtn" onclick="submitPrices()">저장하기</button>
  </div>
  <div id="msg"></div>

  <script>
    // 오늘 날짜 표시
    const today = new Date();
    document.getElementById('dateLabel').textContent = 
      today.getFullYear() + '년 ' + (today.getMonth()+1) + '월 ' + today.getDate() + '일';

    // 전일 가격 불러오기
    google.script.run.withSuccessHandler(function(prev) {
      if (prev) {
        ['ddr5_16gb', 'ddr4_8gb', 'ddr3_4gb', 'nand_tlc_512', 'nand_mlc_64'].forEach(function(key) {
          const el = document.getElementById('prev_' + key);
          if (el && prev[key]) {
            el.textContent = '전일: $' + Number(prev[key]).toFixed(3);
          }
        });
        const dxiEl = document.getElementById('prev_dxi');
        if (dxiEl && prev['dxi']) {
          dxiEl.textContent = '전일: ' + Number(prev['dxi']).toFixed(2);
        }
      }
    }).getPreviousPrices();

    function submitPrices() {
      const btn = document.getElementById('submitBtn');
      btn.disabled = true;
      btn.textContent = '저장 중...';

      const data = {
        ddr5_16gb: document.getElementById('ddr5_16gb').value,
        ddr4_8gb: document.getElementById('ddr4_8gb').value,
        ddr3_4gb: document.getElementById('ddr3_4gb').value,
        nand_tlc_512: document.getElementById('nand_tlc_512').value,
        nand_mlc_64: document.getElementById('nand_mlc_64').value,
        dxi: document.getElementById('dxi').value,
      };

      google.script.run
        .withSuccessHandler(function() {
          btn.textContent = '✅ 저장 완료!';
          btn.classList.add('btn-success');
          document.getElementById('msg').innerHTML = 
            '<div class="msg msg-ok">시세가 정상적으로 저장되었습니다.</div>';
        })
        .withFailureHandler(function(err) {
          btn.disabled = false;
          btn.textContent = '저장하기';
          document.getElementById('msg').innerHTML = 
            '<div class="msg msg-err">오류: ' + err.message + '</div>';
        })
        .savePrices(data);
    }
  </script>
</body>
</html>`;
}

// === 4. 폼에서 호출하는 함수들 ===

// 전일 가격 조회
function getPreviousPrices() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (!sheet || sheet.getLastRow() < 2) return null;
  
  // 마지막으로 가격이 입력된 행 찾기
  const lastRow = sheet.getLastRow();
  for (let row = lastRow; row >= 2; row--) {
    const val = sheet.getRange(row, 2).getValue();
    if (val && val !== '') {
      const headers = sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0];
      const values = sheet.getRange(row, 1, 1, HEADERS.length).getValues()[0];
      const result = {};
      headers.forEach((h, i) => { result[h] = values[i]; });
      return result;
    }
  }
  return null;
}

// 가격 저장
function savePrices(data) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (!sheet) throw new Error('시트를 찾을 수 없습니다.');
  
  const today = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd');
  const lastRow = sheet.getLastRow();
  
  // 오늘 행 찾기
  let targetRow = -1;
  for (let row = lastRow; row >= 2; row--) {
    if (sheet.getRange(row, 1).getValue() === today) {
      targetRow = row;
      break;
    }
  }
  
  // 오늘 행이 없으면 새로 만들기
  if (targetRow === -1) {
    targetRow = lastRow + 1;
    sheet.getRange(targetRow, 1).setValue(today);
  }
  
  // 가격 입력
  const values = PRODUCTS.map(key => parseFloat(data[key]) || '');
  sheet.getRange(targetRow, 2, 1, values.length).setValues([values]);
  
  // 배경색 원래대로
  sheet.getRange(targetRow, 2, 1, values.length).setBackground(null);
  
  Logger.log('✅ ' + today + ' 시세 저장 완료');
}

// === 유틸 ===
function 삭제_기존트리거() {
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === '오늘행_자동생성') {
      ScriptApp.deleteTrigger(t);
    }
  });
}
