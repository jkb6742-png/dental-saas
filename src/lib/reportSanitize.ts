import sanitizeHtml from "sanitize-html"

/**
 * 신뢰된 마스터가 업로드하는 보고서 HTML을 정제한다.
 * 원본을 최대한 그대로 렌더링하기 위해 태그/속성/스타일을 폭넓게 허용하되,
 * XSS·네비게이션 벡터가 되는 요소만 차단한다:
 *  - script / iframe / object / embed / form 태그 제거(내용 포함)
 *  - 모든 on* 이벤트 핸들러 속성 제거
 */
export function sanitizeReportHtml(raw: string): string {
  const cleaned = sanitizeHtml(raw, {
    allowedTags: false, // 모든 태그 허용
    allowedAttributes: false, // 모든 속성 허용
    allowVulnerableTags: true, // style 등 유지 (경고 억제)
    allowedSchemes: ["http", "https", "data", "mailto", "tel"],
    transformTags: {
      "*": (tagName, attribs) => {
        const clean: Record<string, string> = {}
        for (const key of Object.keys(attribs)) {
          if (!/^on/i.test(key)) clean[key] = attribs[key]
        }
        return { tagName, attribs: clean }
      },
    },
    exclusiveFilter: (frame) =>
      ["script", "iframe", "object", "embed", "form"].includes(frame.tag),
  })

  // 완전한 문서 형태가 아니면 DOCTYPE/기본 골격 보강
  const hasHtmlRoot = /<html[\s>]/i.test(cleaned)
  if (!hasHtmlRoot) {
    return `<!DOCTYPE html>\n<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body>${cleaned}</body></html>`
  }
  if (!/^\s*<!DOCTYPE/i.test(cleaned)) {
    return `<!DOCTYPE html>\n${cleaned}`
  }
  return cleaned
}
