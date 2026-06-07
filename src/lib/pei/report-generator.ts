import {
  PeiAnalysisResult,
  ReportMetadata,
  STANDARD_ITEMS
} from './types'

export class PeiReportGenerator {
  private analysisResult: PeiAnalysisResult
  private metadata: ReportMetadata

  constructor(analysisResult: PeiAnalysisResult, metadata: ReportMetadata) {
    this.analysisResult = analysisResult
    this.metadata = metadata
  }

  /**
   * HTML 보고서 생성
   */
  generateHTML(): string {
    const {
      responseCount,
      genderDistribution,
      ageDistribution,
      itemScores,
      overallScore,
      statusBadge,
      previousMonthComparison,
      doctorComments,
      staffComments,
      facilityComments,
      namedStaffMembers
    } = this.analysisResult

    const { clinicName, year, month, reportDate } = this.metadata

    // 상태 배지 클래스 결정
    const badgeClass = this.getBadgeClass(statusBadge)
    const badgeText = this.getBadgeText(statusBadge)

    // 전월 대비 정보
    const prevComparison = previousMonthComparison
    const isFirstSurvey = !prevComparison

    return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${year}년 ${month}월 PEI 보고서 - ${clinicName}</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.css">
<style>
  :root{
    --ink:#16181d;--muted:#5b616e;--line:#e4e6eb;--line-soft:#eef0f4;
    --blue:#2433e0;--blue-soft:#eef0ff;--bg:#f6f7f9;
    --good:#1d9e6f;--good-bg:#e7f6ef;--ok:#2e6fd6;--ok-bg:#e8f0fd;--warn:#d9822b;--warn-bg:#fcf1e3;
  }
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:'Pretendard',-apple-system,BlinkMacSystemFont,sans-serif;color:var(--ink);background:var(--bg);line-height:1.6;-webkit-font-smoothing:antialiased;font-feature-settings:"tnum";}
  .page{width:210mm;min-height:297mm;margin:18px auto;background:#fff;padding:26mm 20mm;box-shadow:0 1px 24px rgba(20,24,40,.08);position:relative;}
  .logo{font-weight:800;font-size:34px;letter-spacing:1px;display:inline-block;}
  .cover{display:flex;flex-direction:column;justify-content:center;text-align:center;}
  .cover .logo{font-size:52px;margin-bottom:64px;}
  .cover h1{font-size:30px;font-weight:800;line-height:1.4;}
  .cover h1 .en{display:block;font-size:24px;margin-top:4px;}
  .cover .meta{margin-top:150px;display:flex;flex-direction:column;gap:14px;font-weight:600;}
  .cover .meta .client{font-size:20px;} .cover .meta .date{font-size:18px;} .cover .meta .who{font-size:15px;color:var(--muted);}
  h2.sec{font-size:21px;font-weight:800;margin:0 0 18px;padding-bottom:10px;border-bottom:2.5px solid var(--ink);display:flex;align-items:center;gap:8px;}
  h2.sec .n{color:var(--blue);}
  h3{font-size:15.5px;font-weight:700;margin:26px 0 10px;color:var(--ink);}
  h3 .tag{color:var(--blue);font-weight:800;margin-right:6px;}
  table{width:100%;border-collapse:collapse;font-size:12.5px;margin-bottom:6px;}
  th,td{border:1px solid var(--line);padding:8px 10px;text-align:center;vertical-align:middle;}
  th{background:#f3f4f7;font-weight:700;color:#3a3f4a;}
  td.l,th.l{text-align:left;}
  tbody tr:nth-child(even) td{background:#fafbfc;}
  .num{font-variant-numeric:tabular-nums;font-weight:700;}
  .badge{display:inline-block;padding:2px 9px;border-radius:20px;font-size:11px;font-weight:700;white-space:nowrap;}
  .b-good{color:var(--good);background:var(--good-bg);} .b-ok{color:var(--ok);background:var(--ok-bg);} .b-warn{color:var(--warn);background:var(--warn-bg);}
  .delta-up{color:var(--good);font-weight:700;} .delta-down{color:#d23f3f;font-weight:700;} .delta-flat{color:var(--muted);font-weight:700;}
  .ov{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:22px;}
  .ov .card{border:1px solid var(--line);border-radius:12px;padding:14px 16px;}
  .ov .card.hl{border-color:var(--blue);background:var(--blue-soft);}
  .ov .card .k{font-size:11px;color:var(--muted);font-weight:600;}
  .ov .card .v{font-size:26px;font-weight:800;margin-top:2px;} .ov .card .v.sm{font-size:17px;}
  .ov .card .s{font-size:11.5px;color:var(--muted);margin-top:4px;}
  .summary th:first-child{width:120px;} .summary td.l{font-size:12px;line-height:1.55;}
  ul.op{list-style:none;margin:4px 0 14px;padding:0;}
  ul.op li{position:relative;padding:7px 12px 7px 28px;font-size:12.5px;line-height:1.55;border-left:3px solid var(--line);margin-bottom:6px;background:#fafbfc;border-radius:0 6px 6px 0;}
  ul.op li::before{content:"";position:absolute;left:11px;top:14px;width:6px;height:6px;border-radius:50%;background:var(--muted);}
  ul.op.pos li{border-left-color:var(--good);} ul.op.pos li::before{background:var(--good);}
  ul.op.neg li{border-left-color:#d9822b;} ul.op.neg li::before{background:#d9822b;}
  .none{font-size:12.5px;color:var(--muted);font-style:italic;padding:6px 0;}
  .pos-h,.neg-h{font-size:13px;font-weight:700;margin:14px 0 6px;display:flex;align-items:center;gap:6px;}
  .pos-h{color:var(--good);} .neg-h{color:#d9822b;}
  .doc-block{border:1px solid var(--line-soft);border-radius:12px;padding:16px 18px;margin-bottom:16px;}
  .doc-block h3{margin-top:0;} .role{font-size:11.5px;color:var(--muted);font-weight:500;}
  .summary-box{background:#fafbfc;border:1px solid var(--line);border-left:4px solid var(--blue);border-radius:0 10px 10px 0;padding:14px 18px;font-size:12.5px;line-height:1.7;margin:14px 0 4px;}
  .summary-box p{margin-bottom:8px;} .summary-box p:last-child{margin-bottom:0;}
  .link{font-size:11px;color:var(--muted);margin-top:14px;word-break:break-all;} .link a{color:var(--blue);text-decoration:none;}
  .named{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0 12px;}
  .named .chip{font-size:11.5px;background:var(--blue-soft);color:var(--blue);padding:3px 10px;border-radius:6px;font-weight:600;}
  .note{font-size:11px;color:var(--muted);margin-top:2px;font-style:italic;}
  @media print{body{background:#fff;}.page{margin:0;box-shadow:none;width:auto;min-height:auto;padding:18mm 16mm;page-break-after:always;}.page:last-child{page-break-after:auto;}a{color:var(--ink);}}
  @media (max-width:800px){.page{width:auto;padding:24px 18px;}.ov{grid-template-columns:1fr;}}
</style>
</head>
<body>

<!-- 표지 -->
<section class="page cover">
  <div class="logo">THINKLAB</div>
  <h1>${year}년 ${month}월 PEI 보고서<span class="en">[Patient Experience Index]</span></h1>
  <div class="meta">
    <div class="client">CLIENT : ${clinicName}</div>
    <div class="date">${reportDate}</div>
    <div class="who">Kiyoung. Kim &nbsp;·&nbsp; Gyubok. Jang</div>
    <div class="who">thinklabmedi@gmail.com</div>
  </div>
</section>

<!-- 1. 개요 -->
<section class="page">
  <h2 class="sec"><span class="n">1.</span> 개요</h2>
  <div class="ov">
    <div class="card hl">
      <div class="k">금월 평균 점수 (${year}.${String(month).padStart(2, '0')})</div>
      <div class="v">${overallScore.toFixed(2)}<span style="font-size:14px;color:var(--muted);font-weight:600;"> / 5.0</span></div>
      <div class="s">응답 ${responseCount}명 · 남${genderDistribution.male} / 여${genderDistribution.female} · ${ageDistribution}</div>
    </div>
    <div class="card">
      <div class="k">${isFirstSurvey ? '조사 기간' : `전월 평균 (${prevComparison?.month})`}</div>
      <div class="v">${isFirstSurvey ? `${year}.${String(month).padStart(2, '0')}` : prevComparison?.overallScore.toFixed(2) || '-'}</div>
      <div class="s">${isFirstSurvey ? '첫 조사(베이스라인)' : `응답 ${prevComparison ? 'N/A' : 0}명`}</div>
    </div>
    <div class="card">
      <div class="k">전월 대비</div>
      <div class="v ${this.getDeltaClass(prevComparison?.overallChange || 0)}">${isFirstSurvey ? '기준점' : this.formatChange(prevComparison?.overallChange || 0)}</div>
      <div class="s">응답 수 ${isFirstSurvey ? '신규' : this.formatResponseChange(responseCount, 0)}</div>
    </div>
  </div>

  <h3><span class="tag">(1-1)</span>평가 항목</h3>
  <table>
    <thead><tr><th class="l">구분</th><th>평균 점수 (5.0)</th><th>상태 진단</th><th class="l">평가 요약</th></tr></thead>
    <tbody>
${this.generateItemRows()}
    </tbody>
  </table>
  <div class="note">※ 5점 만점, 무응답/경험없음 제외, 추천의향 10점→5점 환산</div>

  <h3><span class="tag">(1-2)</span>세부 요약</h3>
  <table class="summary">
    <thead><tr><th>구분</th><th class="l">강점 요약</th><th class="l">개선 요약</th></tr></thead>
    <tbody>
${this.generateSummaryRows()}
    </tbody>
  </table>

  <div class="summary-box">
    <p><strong>월 종합 평가 의견</strong></p>
    ${this.generateMonthlySummary()}
  </div>
</section>

${isFirstSurvey ? this.generateFirstSurveySection() : this.generateComparisonSection()}

<!-- 2. 의료진별 의견 -->
<section class="page">
  <h2 class="sec"><span class="n">2.</span> 의료진별 의견</h2>
${this.generateDoctorSections()}
</section>

<!-- 스탭 / 시설 -->
<section class="page">
  <div class="doc-block">
    <h3><span class="tag">(2-${doctorComments.length + 1})</span>데스크 / 진료실 (스탭)</h3>
${namedStaffMembers.length > 0 ? `    <div style="font-size:12px;font-weight:700;color:var(--muted);margin-bottom:4px;">이름이 언급된 직원</div>
    <div class="named">${namedStaffMembers.map(name => `<span class="chip">${name}</span>`).join('')}</div>` : ''}
    <div class="pos-h">▲ 긍정적 의견</div>
    ${this.generateOpinionList(staffComments.positiveComments, 'pos')}
    <div class="neg-h">▼ 부정적 / 개선 의견</div>
    ${this.generateOpinionList(staffComments.negativeComments, 'neg')}
  </div>

  <div class="doc-block">
    <h3><span class="tag">(2-${doctorComments.length + 2})</span>시설 및 편의 관련 의견</h3>
    <div class="pos-h">▲ 긍정적 의견</div>
    ${this.generateOpinionList(facilityComments.positiveComments, 'pos')}
    <div class="neg-h">▼ 부정적 / 개선 의견</div>
    ${this.generateOpinionList(facilityComments.negativeComments, 'neg')}
  </div>
</section>

</body>
</html>`
  }

  /**
   * 항목별 평가 행 생성
   */
  private generateItemRows(): string {
    return STANDARD_ITEMS.map(item => {
      const score = this.analysisResult.itemScores[item.key] || 0
      const badge = this.getItemBadge(score)
      const summary = this.getItemSummary(item.key, score)

      return `      <tr>
        <td class="l">${item.name}</td>
        <td class="num">${score.toFixed(2)}</td>
        <td><span class="badge ${this.getBadgeClass(badge)}">${this.getBadgeText(badge)}</span></td>
        <td class="l">${summary}</td>
      </tr>`
    }).join('\n')
  }

  /**
   * 세부 요약 행 생성
   */
  private generateSummaryRows(): string {
    const doctorStrengths = this.getDoctorStrengths()
    const doctorImprovements = this.getDoctorImprovements()
    const staffStrengths = this.getStaffStrengths()
    const staffImprovements = this.getStaffImprovements()
    const facilityStrengths = this.getFacilityStrengths()
    const facilityImprovements = this.getFacilityImprovements()

    return `      <tr>
        <td>원장 의료진</td>
        <td class="l">${doctorStrengths}</td>
        <td class="l">${doctorImprovements}</td>
      </tr>
      <tr>
        <td>데스크 / 진료실</td>
        <td class="l">${staffStrengths}</td>
        <td class="l">${staffImprovements}</td>
      </tr>
      <tr>
        <td>시설 및 환경</td>
        <td class="l">${facilityStrengths}</td>
        <td class="l">${facilityImprovements}</td>
      </tr>`
  }

  /**
   * 월 종합 평가 생성
   */
  private generateMonthlySummary(): string {
    const { responseCount, overallScore, statusBadge } = this.analysisResult
    const prevComparison = this.analysisResult.previousMonthComparison

    const paragraph1 = prevComparison
      ? `${this.metadata.year}년 ${this.metadata.month}월 총 ${responseCount}명이 응답하여 전체 평균 ${overallScore.toFixed(2)}점을 기록했습니다. 전월 대비 ${this.formatChange(prevComparison.overallChange)} 변화를 보였습니다.`
      : `${this.metadata.year}년 ${this.metadata.month}월 총 ${responseCount}명이 응답하여 전체 평균 ${overallScore.toFixed(2)}점을 기록했습니다. 이번이 첫 조사로 향후 비교 기준점이 됩니다.`

    const strongPoints = this.getTopPerformingAreas()
    const paragraph2 = `주요 강점은 ${strongPoints}로 나타났습니다.`

    const improvementAreas = this.getImprovementAreas()
    const paragraph3 = `${improvementAreas}에 대한 개선이 필요하며, 지속적인 응답 수 증가를 통해 더욱 정확한 분석이 가능할 것입니다.`

    return `    <p>${paragraph1}</p>
    <p>${paragraph2}</p>
    <p>${paragraph3}</p>`
  }

  /**
   * 첫 조사 섹션 생성
   */
  private generateFirstSurveySection(): string {
    return `<!-- 1-4 주요 개선 (첫 조사) -->
<section class="page">
  <h3 style="margin-top:0;"><span class="tag">(1-3)</span>주요 개선 의견</h3>
  <table>
    <thead><tr><th style="width:130px;">항목</th><th class="l">개선 의견</th></tr></thead>
    <tbody>
${this.generateImprovementRows()}
    </tbody>
  </table>
</section>`
  }

  /**
   * 전월 비교 섹션 생성
   */
  private generateComparisonSection(): string {
    const prevComparison = this.analysisResult.previousMonthComparison!

    return `<!-- 1-3 전월 비교 -->
<section class="page">
  <h3 style="margin-top:0;"><span class="tag">(1-3)</span>전월 비교 <span class="role">(항목별 점수, ${prevComparison.month} → ${this.analysisResult.surveyMonth})</span></h3>
  <table>
    <thead><tr><th class="l">평가 항목</th><th>${prevComparison.month}</th><th>${this.analysisResult.surveyMonth}</th><th>증감</th><th>비고</th></tr></thead>
    <tbody>
${this.generateComparisonRows()}
      <tr style="font-weight:700;background:var(--blue-soft);">
        <td class="l">종합 평균</td>
        <td class="num">${prevComparison.overallScore.toFixed(2)}</td>
        <td class="num">${this.analysisResult.overallScore.toFixed(2)}</td>
        <td class="${this.getDeltaClass(prevComparison.overallChange)}">${this.formatChange(prevComparison.overallChange)}</td>
        <td>${this.getChangeComment(prevComparison.overallChange)}</td>
      </tr>
    </tbody>
  </table>

  <h3><span class="tag">(1-4)</span>주요 개선 의견</h3>
  <table>
    <thead><tr><th style="width:130px;">항목</th><th class="l">개선 의견</th></tr></thead>
    <tbody>
${this.generateImprovementRows()}
    </tbody>
  </table>
</section>`
  }

  /**
   * 의료진별 섹션 생성
   */
  private generateDoctorSections(): string {
    return this.analysisResult.doctorComments.map((doctor, index) => `  <div class="doc-block">
    <h3><span class="tag">(2-${index + 1})</span>${doctor.name} <span class="role">· ${doctor.specialty || '치과의사'} · 응답 ${doctor.responseCount}명</span></h3>
    <div class="pos-h">▲ 긍정적 의견</div>
    ${this.generateOpinionList(doctor.positiveComments, 'pos')}
    <div class="neg-h">▼ 부정적 / 개선 의견</div>
    ${this.generateOpinionList(doctor.negativeComments, 'neg')}
  </div>`).join('\n')
  }

  /**
   * 의견 리스트 생성
   */
  private generateOpinionList(comments: string[], type: 'pos' | 'neg'): string {
    if (comments.length === 0) {
      return `<div class="none">수집된 ${type === 'pos' ? '긍정적' : '부정적'} 의견 없음</div>`
    }

    return `<ul class="op ${type}">
${comments.map(comment => `<li>${comment}</li>`).join('\n')}
</ul>`
  }

  // 유틸리티 메서드들...

  private getBadgeClass(statusBadge: string): string {
    switch (statusBadge) {
      case 'excellent': return 'b-good'
      case 'good': return 'b-ok'
      case 'needsImprovement': return 'b-warn'
      default: return 'b-ok'
    }
  }

  private getBadgeText(statusBadge: string): string {
    switch (statusBadge) {
      case 'excellent': return '매우 양호'
      case 'good': return '양호'
      case 'needsImprovement': return '개선 필요'
      default: return '양호'
    }
  }

  private getItemBadge(score: number): string {
    if (score >= 4.85) return 'excellent'
    if (score >= 4.50) return 'good'
    return 'needsImprovement'
  }

  private getItemSummary(itemKey: string, score: number): string {
    // 간단한 평가 요약 생성
    if (score >= 4.85) return '환자 만족도가 매우 높은 우수한 영역'
    if (score >= 4.50) return '전반적으로 양호한 만족도를 보임'
    if (score >= 4.00) return '보통 수준이지만 개선 여지 존재'
    return '즉각적인 개선이 필요한 영역'
  }

  private getDeltaClass(change: number): string {
    if (change > 0.05) return 'delta-up'
    if (change < -0.05) return 'delta-down'
    return 'delta-flat'
  }

  private formatChange(change: number): string {
    if (change === 0) return '±0.00'
    return `${change > 0 ? '+' : ''}${change.toFixed(2)}`
  }

  private formatResponseChange(current: number, previous: number): string {
    const diff = current - previous
    if (diff === 0) return '동일'
    return `${diff > 0 ? '+' : ''}${diff}명`
  }

  private getChangeComment(change: number): string {
    if (Math.abs(change) < 0.05) return '소폭 변화'
    if (change > 0.2) return '큰 폭 상승'
    if (change > 0.05) return '개선'
    if (change < -0.2) return '큰 폭 하락'
    if (change < -0.05) return '하락'
    return '유지'
  }

  private getDoctorStrengths(): string {
    // 의료진 관련 긍정적 피드백 요약
    const positiveComments = this.analysisResult.doctorComments.flatMap(d => d.positiveComments)
    if (positiveComments.length === 0) return '수집된 긍정 피드백 없음'
    return '친절하고 전문적인 진료, 자세한 설명'
  }

  private getDoctorImprovements(): string {
    // 의료진 관련 개선사항 요약
    const negativeComments = this.analysisResult.doctorComments.flatMap(d => d.negativeComments)
    if (negativeComments.length === 0) return '특별한 개선사항 없음'
    return '진료 시간 확보, 추가 설명 필요'
  }

  private getStaffStrengths(): string {
    if (this.analysisResult.staffComments.positiveComments.length === 0) return '수집된 긍정 피드백 없음'
    return '친절한 응대, 신속한 업무 처리'
  }

  private getStaffImprovements(): string {
    if (this.analysisResult.staffComments.negativeComments.length === 0) return '특별한 개선사항 없음'
    return '응대 매뉴얼 보완, 대기시간 단축'
  }

  private getFacilityStrengths(): string {
    if (this.analysisResult.facilityComments.positiveComments.length === 0) return '수집된 긍정 피드백 없음'
    return '깔끔한 시설, 편리한 접근성'
  }

  private getFacilityImprovements(): string {
    if (this.analysisResult.facilityComments.negativeComments.length === 0) return '특별한 개선사항 없음'
    return '주차 공간 확보, 대기 공간 개선'
  }

  private getTopPerformingAreas(): string {
    const sortedItems = STANDARD_ITEMS
      .map(item => ({
        name: item.name,
        score: this.analysisResult.itemScores[item.key] || 0
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 2)

    return sortedItems.map(item => item.name).join(', ')
  }

  private getImprovementAreas(): string {
    const sortedItems = STANDARD_ITEMS
      .map(item => ({
        name: item.name,
        score: this.analysisResult.itemScores[item.key] || 0
      }))
      .sort((a, b) => a.score - b.score)
      .slice(0, 2)

    return sortedItems.map(item => item.name).join(', ')
  }

  private generateImprovementRows(): string {
    const improvementAreas = STANDARD_ITEMS
      .map(item => ({
        name: item.name,
        score: this.analysisResult.itemScores[item.key] || 0
      }))
      .filter(item => item.score < 4.5)
      .sort((a, b) => a.score - b.score)
      .slice(0, 3)

    return improvementAreas.map(area => `      <tr>
        <td>${area.name}</td>
        <td class="l">${this.getImprovementSuggestion(area.name, area.score)}</td>
      </tr>`).join('\n')
  }

  private generateComparisonRows(): string {
    const prevComparison = this.analysisResult.previousMonthComparison!

    return STANDARD_ITEMS.map(item => {
      const prevScore = prevComparison.scores[item.key] || 0
      const currentScore = this.analysisResult.itemScores[item.key] || 0
      const change = prevComparison.changes[item.key] || 0

      return `      <tr>
        <td class="l">${item.name}</td>
        <td class="num">${prevScore.toFixed(2)}</td>
        <td class="num">${currentScore.toFixed(2)}</td>
        <td class="${this.getDeltaClass(change)}">${this.formatChange(change)}</td>
        <td>${this.getChangeComment(change)}</td>
      </tr>`
    }).join('\n')
  }

  private getImprovementSuggestion(itemName: string, score: number): string {
    const suggestions: { [key: string]: string } = {
      '전화 및 온라인 응대': '전화 응답 시간 단축, 친절 교육 강화',
      '접수 수납 응대': '대기시간 안내, 수납 프로세스 개선',
      '치료 상담 응대': '상담 시간 확보, 설명 자료 보완',
      '의료진 진료 상담': '진료 전 충분한 상담 시간 배정',
      '진료실 직원 만족도': '치위생사 친절 교육, 환자 케어 개선',
      '의료진 진료 응대': '진료 과정 설명 강화, 환자와의 소통 개선',
      '시설 만족도': '시설 현대화, 청결도 관리 강화',
      '주차 시설': '주차 공간 확보, 안내 표시 개선',
      '홈페이지': '웹사이트 사용성 개선, 정보 업데이트',
      '진료 대기시간': '예약 시스템 최적화, 대기시간 안내',
      '지인 권유 의향': '전반적인 만족도 개선을 통한 추천 의향 증대'
    }

    return suggestions[itemName] || '지속적인 모니터링을 통한 개선 필요'
  }
}