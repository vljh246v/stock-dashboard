const SECTOR_LABELS: Record<string, string> = {
  "Basic Materials": "소재",
  "Communication Services": "커뮤니케이션 서비스",
  "Consumer Cyclical": "경기소비재",
  "Consumer Defensive": "필수소비재",
  Energy: "에너지",
  "Financial Services": "금융서비스",
  Healthcare: "헬스케어",
  Industrials: "산업재",
  "Real Estate": "부동산",
  Technology: "기술",
  Utilities: "유틸리티",
};

const INDUSTRY_LABELS: Record<string, string> = {
  "Consumer Electronics": "소비자 전자제품",
  "Software - Application": "응용 소프트웨어",
  "Software - Infrastructure": "인프라 소프트웨어",
  Semiconductors: "반도체",
  "Internet Content & Information": "인터넷 콘텐츠 및 정보",
  "Auto Manufacturers": "자동차 제조",
  "Banks - Diversified": "종합 은행",
};

const COUNTRY_LABELS: Record<string, string> = {
  "United States": "미국",
  USA: "미국",
  China: "중국",
  Japan: "일본",
  "South Korea": "대한민국",
  Germany: "독일",
  Taiwan: "대만",
};

function translateKnownLabel(value: string | undefined, labels: Record<string, string>) {
  if (!value) return "N/A";
  return labels[value] || value;
}

export function translateSector(value: string | undefined) {
  return translateKnownLabel(value, SECTOR_LABELS);
}

export function translateIndustry(value: string | undefined) {
  return translateKnownLabel(value, INDUSTRY_LABELS);
}

export function translateCountry(value: string | undefined) {
  return translateKnownLabel(value, COUNTRY_LABELS);
}

export function buildKoreanCompanySummary(profile: any, companyName: string) {
  if (!profile) return "";

  const name = companyName || "이 기업";
  const industry = translateIndustry(profile.industry);
  const sector = translateSector(profile.sector);
  const country = translateCountry(profile.country);
  const location = [profile.city, country].filter(value => value && value !== "N/A").join(", ");
  const employees = profile.fullTimeEmployees?.toLocaleString();

  const sentences = [
    `${name}의 공개 기업 프로필을 요약했습니다.`,
  ];

  if (sector !== "N/A" || industry !== "N/A") {
    sentences.push(
      [sector !== "N/A" ? `섹터는 ${sector}` : null, industry !== "N/A" ? `업종은 ${industry}` : null]
        .filter(Boolean)
        .join(", ") + "입니다.",
    );
  }

  if (location) {
    sentences.push(`본사는 ${location}에 있습니다.`);
  }

  if (employees) {
    sentences.push(`직원 수는 약 ${employees}명입니다.`);
  }

  sentences.push("이 요약은 공개된 기업 프로필을 바탕으로 정리했습니다.");

  return sentences.join(" ");
}
