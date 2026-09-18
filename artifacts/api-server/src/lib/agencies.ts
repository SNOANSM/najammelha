// Kuwaiti government agencies a community report can be referred to, plus a
// deterministic Arabic keyword classifier that picks one. Pure functions only:
// nothing in this file (or in prepareReferral) performs any network call, so
// routing a report can never contact a real agency.

export interface Agency {
  id: string;
  name: string;
  scope: string;
}

export const AGENCIES: Agency[] = [
  { id: "public-works", name: "وزارة الأشغال العامة", scope: "الطرق والحفر والأرصفة والجسور والأنفاق، إنارة الشوارع، الصرف الصحي والمجاري، تصريف مياه الأمطار" },
  { id: "municipality", name: "بلدية الكويت", scope: "النظافة والنفايات والحاويات، السيارات المهملة، الحدائق والألعاب والأشجار، التشوه البصري واللوحات المخالفة، الحشرات والقوارض، مخلفات البناء، الحيوانات النافقة" },
  { id: "electricity", name: "وزارة الكهرباء والماء والطاقة المتجددة", scope: "انقطاع الكهرباء، الأسلاك والكيبلات والمحولات، تسرب المياه وكسر أنابيب المياه" },
  { id: "traffic", name: "وزارة الداخلية – الإدارة العامة للمرور", scope: "الإشارات المرورية، الوقوف الخاطئ، القيادة المتهورة، الحوادث، السيارات المعطلة التي تعيق الطريق" },
  { id: "interior", name: "وزارة الداخلية", scope: "الأمن والسلامة العامة، المشاجرات، السرقة، التحرش، الحالات الطارئة" },
  { id: "environment", name: "الهيئة العامة للبيئة", scope: "التلوث والدخان والحرق، التسرب النفطي والمواد الكيميائية، تلوث الشواطئ والبحر، الروائح الصناعية" },
  { id: "agriculture", name: "الهيئة العامة لشؤون الزراعة والثروة السمكية", scope: "الكلاب والقطط والحيوانات الضالة، المخالفات الزراعية والصيد" },
  { id: "part", name: "الهيئة العامة للطرق والنقل البري", scope: "مواقف ومظلات الباصات، النقل العام" },
  { id: "education", name: "وزارة التربية", scope: "المدارس ومرافقها" },
  { id: "health", name: "وزارة الصحة", scope: "المستشفيات والمراكز الصحية والمستوصفات" },
];

export function getAgency(id: string | null | undefined): Agency | undefined {
  return AGENCIES.find((agency) => agency.id === id);
}

export interface RoutingInput {
  title: string;
  description: string;
  category?: string;
  locationName?: string;
}

export interface AgencyMatch {
  agencyId: string | null;
  confidence: number;
  reason: string;
  source: "rules" | "ai";
}

const arabicMarks = /[ً-ْـ]/g;

export function normalizeArabic(text: string) {
  return text
    .replace(arabicMarks, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ئ/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[چ]/g, "ك")
    .replace(/[گ]/g, "ك")
    .toLowerCase();
}

type Rule = readonly [keyword: string, weight: number];

// Keywords are written the way people actually type (Gulf dialect included)
// and normalised at load time. Weight 3 = unambiguous phrase, 2 = strong,
// 1 = weak hint. A keyword matches as a substring of the normalised text.
const RULES: Record<string, Rule[]> = {
  "public-works": [
    ["حفره", 3], ["حفر", 2], ["حفريات", 2], ["اسفلت", 3], ["تشققات", 3], ["شرخ في الشارع", 3], ["مطب", 2], ["سفلته", 3], ["تشقق", 2],
    ["رصيف", 3], ["ارصفه", 3], ["انترلوك", 3], ["بلاط الرصيف", 3],
    ["انارة الشارع", 4], ["انارة الشوارع", 4], ["عمود انارة", 4], ["اعمدة الانارة", 4], ["عمود الانارة", 4], ["لمبة الشارع", 4], ["الشارع مظلم", 4], ["شارع مظلم", 4], ["لمبات", 2], ["لمبه", 1], ["مطفي", 1], ["انارة", 2], ["مظلم", 1], ["ظلام", 1], ["فانوس", 1],
    ["مجاري", 4], ["صرف صحي", 4], ["الصرف الصحي", 4], ["مياه المجاري", 4], ["طافح", 3], ["مناهل", 3], ["منهول", 3], ["بيارة", 3], ["غطاء المنهول", 4], ["بالوعه", 3], ["بلاعه", 3],
    ["غرقان", 3], ["مويا", 2], ["بعد المطر", 2], ["مياه الامطار", 4], ["تجمع مياه", 3], ["غرق الشارع", 3], ["تصريف الامطار", 4], ["سيول", 2], ["مستنقع", 2],
    ["جسر", 3], ["نفق", 3], ["حاجز اسمنتي", 3], ["حاجز خرساني", 3], ["دوار", 1], ["الطريق السريع", 2], ["طريق سريع", 2], ["الشارع مكسور", 3], ["الشارع خربان", 3], ["شارع مكسور", 3], ["شارع خربان", 3], ["الطريق مكسور", 3],
    ["لوحه ارشاديه", 3], ["لوحات ارشاديه", 3], ["علامات الطريق", 3], ["خطوط الشارع", 3], ["دهان الشارع", 3],
  ],
  municipality: [
    ["زباله", 4], ["زبايل", 4], ["قمامه", 4], ["نفايات", 3], ["حاويه", 4], ["حاويات", 4], ["مكب", 3], ["قذاره", 3], ["وسخ", 3], ["اوساخ", 3], ["نظافه", 2], ["متراكمه", 1], ["مخلفات", 2], ["مخلفات بناء", 4], ["مخلفات البناء", 4], ["بقايا بناء", 4], ["ردم", 2],
    ["سياره مهمله", 5], ["سيارات مهمله", 5], ["سياره مهجوره", 5], ["سياره متروكه", 5], ["سيارات متروكه", 5], ["مركبه مهمله", 5], ["مهمله", 2], ["مهجوره", 2], ["متروكه", 2], ["خرده", 2], ["سكراب", 2],
    ["حديقه", 4], ["حدايق", 4], ["منتزه", 4], ["ملعب اطفال", 4], ["العاب اطفال", 4], ["لعبه اطفال", 4], ["لعبه الاطفال", 4], ["العاب الاطفال", 4], ["مقاعد الحديقه", 4], ["ممشى", 3], ["مسار مشي", 3],
    ["شجره", 2], ["اشجار", 2], ["شجر", 1], ["عشب", 2], ["تشجير", 2],
    ["تشوه بصري", 4], ["لوحه اعلانيه", 4], ["اعلانات مخالفه", 4], ["اعلانات عشوائيه", 4], ["ملصقات", 3], ["كتابات على الجدران", 4], ["رسومات على الجدار", 4], ["خربشات", 3], ["جرافيتي", 4],
    ["حشرات", 4], ["صراصير", 4], ["فئران", 4], ["جرذان", 4], ["فار ", 3], ["بعوض", 3], ["ذباب", 3], ["حشره", 3], ["قوارض", 4],
    ["حيوان ميت", 5], ["حيوان نافق", 5], ["قطه ميته", 5], ["كلب ميت", 5], ["نافقه", 4], ["جيفه", 5], ["ميته", 2],
    ["مخالفه بناء", 4], ["مخالفات بناء", 4], ["تعدي على املاك الدوله", 4], ["اشغال طريق", 2], ["بسطه", 2], ["بسطات", 2], ["كشك", 2], ["مطعم", 1], ["مخالفه صحيه", 3],
  ],
  electricity: [
    ["انقطاع الكهرباء", 5], ["انقطاع كهرباء", 5], ["الكهرباء مقطوعه", 5], ["الكهرباء قاطعه", 5], ["كهرباء مقطوعه", 5], ["مافي كهرباء", 5], ["ما في كهرباء", 5], ["قاطع الكهرباء", 4], ["انقطاع التيار", 5], ["التيار الكهربايي", 4], ["تيار كهربايي", 4],
    ["سلك كهرباء", 5], ["اسلاك كهرباء", 5], ["اسلاك مكشوفه", 5], ["سلك مكشوف", 5], ["اسلاك", 4], ["متدليه", 3], ["كيبل", 4], ["كابل", 3], ["محول", 4], ["مولد كهرباء", 3], ["محطه كهرباء", 4], ["عمود كهرباء", 5], ["اعمدة كهرباء", 5], ["صندوق كهرباء", 5], ["ضغط عالي", 3], ["كهرباء", 2], ["ماس كهربايي", 5], ["شرارات", 3], ["صعقه", 4], ["مكشوف", 1],
    ["تسرب مياه", 5], ["تسريب مياه", 5], ["ماسوره مكسوره", 5], ["ماسورة مكسورة", 5], ["ماسوره", 2], ["انفجار خط مياه", 5], ["خط مياه", 4], ["كسر خط", 4], ["كسر ماسوره", 5], ["مياه تنزل", 3], ["مياه تطلع", 3], ["مياه الشرب", 3], ["الماء مقطوع", 5], ["انقطاع الماء", 5], ["انقطاع المياه", 5], ["مياه نظيفه", 2], ["عداد مياه", 4],
  ],
  traffic: [
    ["اشاره مروريه", 5], ["اشارات مروريه", 5], ["اشاره المرور", 5], ["اشارة المرور", 5], ["اشارات المرور", 5], ["الاشاره خربانه", 5], ["الاشاره ما تشتغل", 5], ["اشاره ضوئيه", 5], ["اشاره", 2], ["سيغنال", 4], ["فانوس المرور", 5],
    ["وقوف خاطي", 5], ["وقوف خطا", 5], ["وقوف ممنوع", 5], ["واقفه قدام", 4], ["واقف قدام", 4], ["وقف قدام", 4], ["مواقف المعاقين", 5], ["مواقف ذوي الاعاقه", 5], ["يسد الطريق", 4], ["تسد الطريق", 4], ["يقفل الطريق", 4], ["مخرج", 1], ["مدخل", 1], ["وقوف", 2], ["موقف سيارات", 1],
    ["حادث", 3], ["حوادث", 3], ["تصادم", 3], ["سرعه زايده", 4], ["سرعه عاليه", 4], ["تهور", 4], ["متهور", 4], ["سباق سيارات", 5], ["تفحيط", 5], ["دراجات ناريه", 4], ["دراجه ناريه", 4], ["سياره معطله", 4], ["سياره عطلانه", 4], ["ازدحام", 3], ["زحمه", 2], ["مخالفه مروريه", 5], ["مخالفات مروريه", 5], ["كاميرا مروريه", 4], ["ساهر", 4], ["مرور", 3],
  ],
  interior: [
    ["سرقه", 5], ["سارق", 5], ["حرامي", 5], ["سطو", 5], ["مشاجره", 5], ["عراك", 5], ["ضرب", 3], ["تحرش", 5], ["مخدرات", 5], ["مشبوه", 4], ["اشخاص مشبوهين", 5], ["تهديد", 4], ["سلاح", 4], ["خطر امني", 5], ["شغب", 4], ["اطلاق نار", 5], ["نجده", 4], ["طوارئ", 4], ["مسكر", 3], ["شرطه", 3], ["امن", 1],
  ],
  environment: [
    ["دخان", 3], ["دخان اسود", 4], ["حرق نفايات", 5], ["حرق زباله", 5], ["حرق اطارات", 5], ["حرق", 2], ["احتراق", 2], ["تلوث", 5], ["تلوث الهواء", 5], ["تلوث بيئي", 5], ["تلوث الشاطي", 5], ["تلوث البحر", 5],
    ["تسرب نفط", 5], ["تسرب نفطي", 5], ["بقعه نفط", 5], ["نفط", 3], ["زيوت", 2], ["مواد كيماويه", 5], ["كيماوي", 4], ["مواد سامه", 5], ["غبار", 2], ["روايح كريهه", 3], ["رايحه كريهه", 3], ["رايحه مصنع", 5], ["روايح مصنع", 5], ["روايح من مصنع", 5], ["رايحه من مصنع", 5], ["مصنع", 2], ["اسماك نافقه", 5], ["سمك ميت", 5], ["نفوق اسماك", 5], ["الشاطي", 2], ["شاطي", 2], ["البحر", 2], ["صيد جاير", 3], ["حياه فطريه", 4], ["طيور مهاجره", 3], ["بيئه", 3],
  ],
  agriculture: [
    ["كلاب ضاله", 6], ["كلب ضال", 6], ["كلاب سايبه", 6], ["قطط ضاله", 6], ["قطط سايبه", 6], ["حيوانات ضاله", 6], ["حيوانات سايبه", 6], ["كلاب", 4], ["كلب", 3], ["قطط", 3], ["ثعبان", 3], ["حمير", 3], ["اغنام", 3], ["ابل سايبه", 4], ["حظيره", 3], ["مزرعه", 3], ["صيد", 1], ["ثروه سمكيه", 5], ["مزارع", 3],
  ],
  part: [
    ["موقف باص", 6], ["موقف الباص", 6], ["موقف حافله", 6], ["مواقف الباصات", 6], ["مظله", 4], ["مظلات", 4], ["محطه باص", 6], ["محطه حافلات", 6], ["محطه الباصات", 6], ["باص", 2], ["باصات", 3], ["حافله", 2], ["حافلات", 3], ["نقل عام", 5], ["مواصلات عامه", 5], ["خط باص", 5],
  ],
  education: [
    ["مدرسه", 3], ["مدارس", 3], ["ابتدايي", 3], ["متوسطه", 2], ["ثانويه", 3], ["روضه", 3], ["جامعه", 3], ["طلاب", 2], ["طلبه", 2], ["فصول دراسيه", 4], ["سور المدرسه", 6], ["حوش المدرسه", 6],
  ],
  health: [
    ["مستشفى", 3], ["مستشفيات", 3], ["مركز صحي", 4], ["مستوصف", 4], ["عياده", 4], ["صيدليه", 3], ["اسعاف", 4], ["طوارى المستشفى", 6], ["وزاره الصحه", 6], ["مرضى", 3],
  ],
};

// A weak prior from the category the reporter picked. It only breaks ties: any
// real keyword evidence in the text outweighs it.
const CATEGORY_PRIOR: Record<string, { agencyId: string; weight: number }> = {
  roads: { agencyId: "public-works", weight: 1.5 },
  sidewalks: { agencyId: "public-works", weight: 1.5 },
  lighting: { agencyId: "public-works", weight: 1.5 },
  cleanliness: { agencyId: "municipality", weight: 1.5 },
  parks: { agencyId: "municipality", weight: 1.5 },
  visual: { agencyId: "municipality", weight: 1.5 },
};

const compiled = Object.entries(RULES).map(([agencyId, rules]) => ({
  agencyId,
  rules: rules.map(([keyword, weight]) => [normalizeArabic(keyword), weight] as const),
}));

/** Below this score we would rather say "unsure" than guess an agency. */
export const MIN_RULE_SCORE = 2;

export function classifyByRules(input: RoutingInput): AgencyMatch {
  const text = ` ${normalizeArabic(`${input.title} ${input.description}`)} `;
  const scores = new Map<string, number>();
  const hits = new Map<string, string[]>();

  for (const { agencyId, rules } of compiled) {
    let score = 0;
    const matched: string[] = [];
    for (const [keyword, weight] of rules) {
      if (text.includes(keyword)) {
        score += weight;
        matched.push(keyword.trim());
      }
    }
    if (score > 0) {
      scores.set(agencyId, score);
      hits.set(agencyId, matched);
    }
  }

  const prior = input.category ? CATEGORY_PRIOR[input.category] : undefined;
  if (prior) scores.set(prior.agencyId, (scores.get(prior.agencyId) ?? 0) + prior.weight);

  const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1]);
  const top = ranked[0];
  if (!top || top[1] < MIN_RULE_SCORE) {
    return { agencyId: null, confidence: 0, reason: "الوصف ما يكفي لتحديد الجهة بثقة، يحتاج مراجعة الإدارة.", source: "rules" };
  }

  const second = ranked[1]?.[1] ?? 0;
  const confidence = Math.round((top[1] / (top[1] + second)) * (top[1] >= 4 ? 1 : 0.75) * 100) / 100;
  const matched = hits.get(top[0]) ?? [];
  const reason = matched.length
    ? `كلمات مطابقة لاختصاص الجهة: ${matched.slice(0, 4).join("، ")}.`
    : "مقترحة من تصنيف البلاغ.";
  return { agencyId: top[0], confidence, reason, source: "rules" };
}

export interface ReferralDraft {
  mode: "simulated";
  sent: false;
  agencyId: string;
  agencyName: string;
  subject: string;
  body: string;
}

/**
 * Builds the message that WOULD be sent to the agency. Deliberately has no
 * transport: there is no email/HTTP code path here, so this is a preview only.
 */
export function prepareReferral(
  report: { id: number; title: string; description: string; locationName: string; latitude: number; longitude: number; locationExact: boolean },
  agencyId: string,
): ReferralDraft | null {
  const agency = getAgency(agencyId);
  if (!agency) return null;
  const where = report.locationExact
    ? `${report.locationName} (https://www.google.com/maps?q=${report.latitude},${report.longitude})`
    : report.locationName;
  return {
    mode: "simulated",
    sent: false,
    agencyId: agency.id,
    agencyName: agency.name,
    subject: `بلاغ مجتمعي #${report.id}: ${report.title}`,
    body: `السادة ${agency.name}،\n\nوردنا عبر منصة نجمّلها البلاغ التالي:\n${report.description}\n\nالموقع: ${where}`,
  };
}
