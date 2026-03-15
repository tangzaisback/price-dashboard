# 반도체 시세 서비스 - 세팅 가이드

## 전체 구조

```
[담당자]                    [Google Sheets]              [조합원]
모바일 입력 폼  ─────→   시세 데이터 저장   ─────→   대시보드 웹페이지
(Apps Script 웹앱)        (CSV로 공개 게시)           (price-dashboard.html)
```

---

## Step 1. Google Sheets 만들기

1. [Google Sheets](https://sheets.google.com)에서 새 스프레드시트 생성
2. 시트 이름을 `시세`로 변경
3. 첫 행(헤더)에 입력:

| A | B | C | D | E |
|---|---|---|---|---|
| date | ddr4_spot | ddr5_spot | nand_spot | ddr5_contract |

---

## Step 2. Apps Script 설치 (입력 자동화)

1. Sheets에서 **[확장 프로그램] > [Apps Script]** 클릭
2. 기본 코드를 모두 지우고 `apps-script.js` 내용 전체를 붙여넣기
3. 💾 저장
4. 상단 함수 선택 드롭다운에서 `초기설정` 선택 후 ▶ 실행
5. Google 권한 허용 (최초 1회)

### 이것으로 자동화되는 것:
- ✅ 매일 오전 9시, 오늘 날짜 행이 자동 생성됨 (주말 제외)
- ✅ 미입력 셀은 노란 배경으로 표시됨
- ✅ 모바일 입력 폼이 생성됨

---

## Step 3. 모바일 입력 폼 배포

1. Apps Script 에디터에서 **[배포] > [새 배포]**
2. 유형: **웹 앱**
3. 설정:
   - 실행 사용자: **나**
   - 액세스 권한: **Google 계정이 있는 모든 사용자** (또는 조직 내)
4. **배포** 클릭 → URL 복사
5. 이 URL을 담당자 스마트폰 홈 화면에 바로가기로 추가

### 담당자 매일 루틴:
1. DRAMeXchange 메인페이지에서 현물가 확인
2. 입력 폼 열기 (전일 가격이 참고용으로 표시됨)
3. 숫자 입력 → 저장 (약 2분)

---

## Step 4. Sheets를 웹에 공개 (CSV)

1. Sheets에서 **[파일] > [공유] > [웹에 게시]**
2. 시트: `시세` 선택
3. 형식: **쉼표로 구분된 값(.csv)** 선택
4. **게시** 클릭
5. 생성된 URL 복사

---

## Step 5. 대시보드 웹페이지 연결

`price-dashboard.html` 파일에서 이 부분을 찾아서:

```javascript
const SHEET_CSV_URL = '';  // TODO: 실제 URL로 교체
```

Step 4에서 복사한 URL을 붙여넣기:

```javascript
const SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/xxxxx/pub?gid=0&single=true&output=csv';
```

---

## Step 6. 웹페이지 배포

### 옵션 A: GitHub Pages (무료, 추천)
1. GitHub repo에 `price-dashboard.html`을 `index.html`로 업로드
2. Settings > Pages > 배포
3. `https://[username].github.io/[repo명]` 으로 접속 가능

### 옵션 B: 기존 Jekyll 블로그에 추가
- 블로그 루트에 `price.html`로 추가
- layout 없이 독립 페이지로 동작

### 옵션 C: Netlify Drop (가장 쉬움)
1. [netlify.com/drop](https://app.netlify.com/drop)에 파일 드래그
2. 즉시 URL 생성됨

---

## Step 7. 조합원 접속

조합원에게 공유할 것:
- 대시보드 URL (북마크 또는 홈 화면 추가 안내)
- QR코드로 만들어서 공유하면 편함

---

## 품목 추가/변경 시

`price-dashboard.html`의 PRODUCTS 배열과 `apps-script.js`의 PRODUCTS/HEADERS를 동일하게 수정하면 됨.

---

## 비용: 0원

모든 구성요소가 무료:
- Google Sheets: 무료
- Apps Script: 무료
- GitHub Pages / Netlify: 무료
- 데이터 소스(DRAMeXchange 무료 현물가): 무료
