// Runs on every deploy (npm run build). Idempotent: creates what's missing, never overwrites
// anything an admin has edited (prices, rates, sections, categories).
import { PrismaClient, type CommissionCategory, type ListingKind, type PlanCode } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
type L = { en: string; ar: string; fr: string };

const CATEGORIES: { slug: string; kind: ListingKind; commission?: CommissionCategory; name: L; children?: { slug: string; name: L; commission?: CommissionCategory }[] }[] = [
  {
    slug: "activities-workshops",
    kind: "EVENT",
    commission: "WORKSHOPS",
    name: { en: "Activities & Workshops", ar: "نشاطات وورش عمل", fr: "Activités & ateliers" },
    children: [
      { slug: "arts-crafts", name: { en: "Arts & crafts", ar: "فنون وأشغال يدوية", fr: "Arts & bricolage" } },
      { slug: "cooking", name: { en: "Cooking & baking", ar: "طبخ وخبز", fr: "Cuisine & pâtisserie" } },
      { slug: "science-stem", name: { en: "Science & STEM", ar: "علوم وتكنولوجيا", fr: "Sciences & STEM" } },
      { slug: "music-dance", name: { en: "Music & dance", ar: "موسيقى ورقص", fr: "Musique & danse" } },
      { slug: "sports", name: { en: "Sports", ar: "رياضة", fr: "Sport" } },
      { slug: "classes", name: { en: "Weekly classes", ar: "صفوف أسبوعية", fr: "Cours hebdomadaires" } },
    ],
  },
  {
    slug: "camps-after-school",
    kind: "EVENT",
    commission: "CAMPS",
    name: { en: "Camps & After School", ar: "مخيمات وما بعد المدرسة", fr: "Camps & périscolaire" },
    children: [
      { slug: "summer-camps", name: { en: "Summer camps", ar: "مخيمات صيفية", fr: "Camps d'été" } },
      { slug: "winter-camps", name: { en: "Winter & holiday camps", ar: "مخيمات الشتاء والعطل", fr: "Camps d'hiver & vacances" } },
      { slug: "after-school", name: { en: "After-school programs", ar: "برامج ما بعد المدرسة", fr: "Activités périscolaires" } },
    ],
  },
  {
    slug: "birthdays-parties",
    kind: "EVENT",
    commission: "BIRTHDAYS",
    name: { en: "Birthdays & Parties", ar: "أعياد ميلاد وحفلات", fr: "Anniversaires & fêtes" },
    children: [
      { slug: "birthday-venues", name: { en: "Venues", ar: "قاعات وأماكن", fr: "Lieux" } },
      { slug: "entertainers", name: { en: "Entertainers", ar: "منشطون وفنانون", fr: "Animateurs" } },
      { slug: "decorations", name: { en: "Decorations", ar: "زينة", fr: "Décorations" } },
      { slug: "cakes", name: { en: "Cakes", ar: "قوالب حلوى", fr: "Gâteaux" } },
      { slug: "photographers", name: { en: "Photographers", ar: "مصورون", fr: "Photographes" } },
      { slug: "party-packages", name: { en: "Party packages", ar: "باقات حفلات", fr: "Formules fête" } },
    ],
  },
  {
    slug: "family-experiences",
    kind: "EVENT",
    commission: "FAMILY_EXPERIENCES",
    name: { en: "Family Experiences", ar: "تجارب عائلية", fr: "Expériences en famille" },
    children: [
      { slug: "outdoor-nature", name: { en: "Outdoor & nature", ar: "طبيعة وهواء طلق", fr: "Plein air & nature" } },
      { slug: "farms-animals", name: { en: "Farms & animals", ar: "مزارع وحيوانات", fr: "Fermes & animaux" } },
      { slug: "play-areas", name: { en: "Play areas", ar: "مساحات لعب", fr: "Aires de jeux" } },
      { slug: "museums", name: { en: "Museums & culture", ar: "متاحف وثقافة", fr: "Musées & culture" } },
    ],
  },
  {
    slug: "shows-entertainment",
    kind: "EVENT",
    commission: "SHOWS",
    name: { en: "Shows & Entertainment", ar: "عروض وترفيه", fr: "Spectacles & divertissement" },
    children: [
      { slug: "theater", name: { en: "Theater", ar: "مسرح", fr: "Théâtre" } },
      { slug: "cinema", name: { en: "Cinema", ar: "سينما", fr: "Cinéma" } },
      { slug: "concerts", name: { en: "Concerts", ar: "حفلات موسيقية", fr: "Concerts" } },
      { slug: "festivals", name: { en: "Festivals & fairs", ar: "مهرجانات ومعارض", fr: "Festivals & foires" } },
    ],
  },
  {
    slug: "restaurants-cafes",
    kind: "RESTAURANT",
    name: { en: "Restaurants & Cafés", ar: "مطاعم ومقاهٍ", fr: "Restaurants & cafés" },
  },
  {
    slug: "shop",
    kind: "PRODUCT",
    commission: "RETAIL",
    name: { en: "Shop for Kids", ar: "تسوّق للأطفال", fr: "Boutique enfants" },
    children: [
      { slug: "toys-games", name: { en: "Toys & Games", ar: "ألعاب", fr: "Jouets & jeux" } },
      { slug: "baby-essentials", name: { en: "Baby Essentials", ar: "مستلزمات الأطفال الرضّع", fr: "Essentiels bébé" } },
      { slug: "kids-fashion", name: { en: "Kids' Fashion", ar: "أزياء الأطفال", fr: "Mode enfant" } },
      { slug: "learning-creativity", name: { en: "Learning & Creativity", ar: "تعلّم وإبداع", fr: "Éveil & créativité" } },
      { slug: "gifts-party", name: { en: "Gifts & Party Supplies", ar: "هدايا ومستلزمات حفلات", fr: "Cadeaux & fête" } },
    ],
  },
];

const PLANS: {
  code: PlanCode;
  name: string;
  monthlyCents: number;
  yearlyCents: number;
  flash: number;
  guestFee: number;
  flags: [boolean, boolean, boolean, boolean, boolean, boolean];
  features: L[];
}[] = [
  {
    code: "BASIC",
    name: "Basic",
    monthlyCents: 0,
    yearlyCents: 0,
    flash: 0,
    guestFee: 200,
    flags: [false, false, false, false, false, false],
    features: [
      { en: "Business listing", ar: "صفحة لنشاطك", fr: "Fiche établissement" },
      { en: "WhatsApp contact button", ar: "زر تواصل عبر واتساب", fr: "Bouton de contact WhatsApp" },
      { en: "Basic analytics", ar: "إحصاءات أساسية", fr: "Statistiques de base" },
      { en: "Standard marketplace access", ar: "وصول عادي إلى المنصة", fr: "Accès standard à la plateforme" },
      { en: "Standard commissions", ar: "عمولات عادية", fr: "Commissions standard" },
    ],
  },
  {
    code: "PRO",
    name: "Pro",
    monthlyCents: 7900,
    yearlyCents: 79000,
    flash: 3,
    guestFee: 150,
    flags: [true, true, false, false, false, false],
    features: [
      { en: "Everything in Basic", ar: "كل ما في الأساسية", fr: "Tout le forfait Basic" },
      { en: "Booking management", ar: "إدارة الحجوزات", fr: "Gestion des réservations" },
      { en: "Reduced commissions", ar: "عمولات مخفّضة", fr: "Commissions réduites" },
      { en: "3 flash promotions a month", ar: "3 عروض سريعة شهرياً", fr: "3 promotions flash par mois" },
      { en: "Advanced analytics & sales reports", ar: "إحصاءات متقدمة وتقارير مبيعات", fr: "Statistiques avancées & rapports de ventes" },
      { en: "Improved listing tools", ar: "أدوات عرض محسّنة", fr: "Outils de fiche améliorés" },
    ],
  },
  {
    code: "FEATURED",
    name: "Featured",
    monthlyCents: 19900,
    yearlyCents: 199000,
    flash: 10,
    guestFee: 100,
    flags: [true, true, true, true, true, true],
    features: [
      { en: "Everything in Pro", ar: "كل ما في برو", fr: "Tout le forfait Pro" },
      { en: "10 flash promotions a month", ar: "10 عروض سريعة شهرياً", fr: "10 promotions flash par mois" },
      { en: "Birthday Radar access", ar: "الوصول إلى رادار أعياد الميلاد", fr: "Accès au Radar anniversaires" },
      { en: "Demand intelligence", ar: "بيانات الطلب", fr: "Intelligence de la demande" },
      { en: "Priority placement eligibility (labelled)", ar: "أهلية الظهور المميز (مع إشارة)", fr: "Éligibilité au placement prioritaire (signalé)" },
      { en: "Sponsored roundup eligibility", ar: "أهلية الظهور في القوائم المموّلة", fr: "Éligibilité aux sélections sponsorisées" },
      { en: "Customer acquisition insights", ar: "تحليلات اكتساب العملاء", fr: "Analyses d'acquisition clients" },
    ],
  },
];

// Category × plan, in percent.
const RATES: Record<CommissionCategory, [number, number, number]> = {
  WORKSHOPS: [15, 12, 10],
  CAMPS: [12, 10, 8],
  SHOWS: [15, 12, 10],
  BIRTHDAYS: [10, 8, 6],
  FAMILY_EXPERIENCES: [15, 12, 10],
  RETAIL: [12, 10, 8],
};

const PLACEMENTS: { code: string; name: L; priceCents: number; unit: string; exclusive: boolean; slots: number; requiresPlan?: PlanCode; description: L }[] = [
  { code: "HOMEPAGE_FEATURED", name: { en: "Featured homepage placement", ar: "ظهور مميز على الصفحة الرئيسية", fr: "Mise en avant sur l'accueil" }, priceCents: 15000, unit: "WEEK", exclusive: false, slots: 4, description: { en: "Your listing in the sponsored row of the homepage for a week.", ar: "نشاطك في صف الإعلانات على الصفحة الرئيسية لمدة أسبوع.", fr: "Votre fiche dans la rangée sponsorisée de l'accueil pendant une semaine." } },
  { code: "CATEGORY_SPONSOR", name: { en: "Category sponsorship", ar: "رعاية فئة", fr: "Sponsoring de catégorie" }, priceCents: 25000, unit: "MONTH", exclusive: true, slots: 1, description: { en: "Be the one sponsor shown at the top of a category for a month.", ar: "كن الراعي الوحيد في أعلى الفئة لمدة شهر.", fr: "Soyez l'unique sponsor en tête d'une catégorie pendant un mois." } },
  { code: "WHATSAPP_CAMPAIGN", name: { en: "WhatsApp promotional campaign", ar: "حملة ترويجية عبر واتساب", fr: "Campagne promotionnelle WhatsApp" }, priceCents: 10000, unit: "CAMPAIGN", exclusive: false, slots: 2, description: { en: "Sent only to parents who opted in to WhatsApp offers.", ar: "تُرسل فقط للأهل الذين وافقوا على تلقي العروض عبر واتساب.", fr: "Envoyée uniquement aux parents ayant accepté les offres WhatsApp." } },
  { code: "NEWSLETTER", name: { en: "Sponsored newsletter placement", ar: "ظهور مموّل في النشرة البريدية", fr: "Placement sponsorisé dans la newsletter" }, priceCents: 12500, unit: "ITEM", exclusive: false, slots: 2, description: { en: "A labelled spot in the weekly family newsletter.", ar: "مساحة مميزة في النشرة الأسبوعية للعائلات.", fr: "Un emplacement signalé dans la newsletter hebdomadaire." } },
  { code: "WEEKEND_ROUNDUP", name: { en: "Sponsored weekend roundup", ar: "ظهور مموّل في قائمة نهاية الأسبوع", fr: "Sélection week-end sponsorisée" }, priceCents: 15000, unit: "ITEM", exclusive: false, slots: 3, requiresPlan: "FEATURED", description: { en: "Included as a sponsored pick in the weekend roundup.", ar: "ضمن اختيارات نهاية الأسبوع كمحتوى مموّل.", fr: "Inclus comme choix sponsorisé dans la sélection du week-end." } },
  { code: "FARAH_REEL", name: { en: "Sponsored Farah Approved reel", ar: "فيديو مموّل Farah Approved", fr: "Reel sponsorisé Farah Approved" }, priceCents: 40000, unit: "ITEM", exclusive: false, slots: 2, description: { en: "A labelled video feature ($400–$700 depending on scope). Never affects certification.", ar: "فيديو مموّل (400–700$ حسب الحجم). لا يؤثر أبداً على الشهادة.", fr: "Vidéo sponsorisée (400–700 $ selon l'ampleur). N'influence jamais la certification." } },
  { code: "SPONSORED_EXPERIENCE", name: { en: "Sponsored family experience", ar: "تجربة عائلية مموّلة", fr: "Expérience famille sponsorisée" }, priceCents: 75000, unit: "ITEM", exclusive: false, slots: 1, description: { en: "A co-hosted EVNT family experience, from $750.", ar: "تجربة عائلية بالشراكة مع EVNT، ابتداءً من 750$.", fr: "Une expérience famille co-organisée avec EVNT, dès 750 $." } },
  { code: "DEMAND_LAB", name: { en: "Demand Lab activation", ar: "تفعيل مختبر الطلب", fr: "Activation Demand Lab" }, priceCents: 1500, unit: "PERCENT_SALES", exclusive: false, slots: 5, requiresPlan: "FEATURED", description: { en: "We design and run a demand campaign; 15% of the sales it generates.", ar: "نصمّم وننفّذ حملة طلب؛ 15% من المبيعات الناتجة.", fr: "Nous concevons une campagne ; 15 % des ventes générées." } },
  { code: "MARKET_REPORT", name: { en: "Custom market intelligence report", ar: "تقرير مخصّص عن السوق", fr: "Rapport d'études de marché sur mesure" }, priceCents: 29900, unit: "ITEM", exclusive: false, slots: 10, description: { en: "A tailored report on family demand in your category and area.", ar: "تقرير مخصّص عن طلب العائلات في فئتك ومنطقتك.", fr: "Un rapport sur la demande des familles dans votre catégorie et zone." } },
];

const SECTIONS: { title: L; subtitle?: L; source: string; filters?: object; layout?: string; mode?: string; limit?: number; sponsored?: boolean; ctaHref?: string }[] = [
  { title: { en: "This Weekend with Kids", ar: "نهاية هذا الأسبوع مع الأطفال", fr: "Ce week-end avec les enfants" }, source: "EVENTS", filters: { weekend: true, sort: "soonest" }, ctaHref: "/discover?when=weekend" },
  { title: { en: "Trending This Week", ar: "الأكثر رواجاً هذا الأسبوع", fr: "Tendances de la semaine" }, source: "EVENTS", filters: { sort: "popular" } },
  { title: { en: "Handpicked experiences", ar: "تجارب مختارة بعناية", fr: "Expériences triées sur le volet" }, subtitle: { en: "The places and moments our team would pick for their own kids.", ar: "الأماكن واللحظات التي يختارها فريقنا لأطفاله.", fr: "Les lieux et moments que notre équipe choisirait pour ses propres enfants." }, source: "HANDPICKED", layout: "SPOTLIGHT", mode: "MANUAL", limit: 8 },
  { title: { en: "Free Things to Do", ar: "نشاطات مجانية", fr: "Sorties gratuites" }, source: "EVENTS", filters: { free: true }, ctaHref: "/discover?price=free" },
  { title: { en: "Perfect for Toddlers", ar: "مثالية للأطفال الصغار", fr: "Parfait pour les tout-petits" }, source: "EVENTS", filters: { ageMax: 3 }, ctaHref: "/discover?age=0-2" },
  { title: { en: "Under $20", ar: "بأقل من 20$", fr: "Moins de 20 $" }, source: "EVENTS", filters: { maxPriceCents: 2000 }, ctaHref: "/discover?maxPrice=20" },
  { title: { en: "Kids-Friendly Restaurants", ar: "مطاعم صديقة للأطفال", fr: "Restaurants adaptés aux enfants" }, source: "RESTAURANTS", ctaHref: "/restaurants" },
  { title: { en: "Farah Approved", ar: "Farah Approved", fr: "Farah Approved" }, subtitle: { en: "Independently assessed family-friendly venues", ar: "أماكن صديقة للعائلات بتقييم مستقل", fr: "Lieux familiaux évalués de façon indépendante" }, source: "FARAH", ctaHref: "/farah-approved" },
  { title: { en: "New on EVNT", ar: "جديد على EVNT", fr: "Nouveau sur EVNT" }, source: "EVENTS", filters: { sort: "newest" } },
  { title: { en: "Shop Our Favorites", ar: "تسوّقوا مختاراتنا", fr: "Nos coups de cœur boutique" }, source: "PRODUCTS", ctaHref: "/shop" },
];

async function main() {
  // Categories
  let sort = 0;
  for (const c of CATEGORIES) {
    const parent = await prisma.category.upsert({
      where: { slug: c.slug },
      create: { slug: c.slug, kind: c.kind, commission: c.commission, name: c.name, sort: sort++ },
      update: {},
    });
    let s = 0;
    for (const ch of c.children ?? []) {
      await prisma.category.upsert({
        where: { slug: ch.slug },
        create: { slug: ch.slug, kind: c.kind, commission: ch.commission ?? c.commission, name: ch.name, parentId: parent.id, sort: s++ },
        update: {},
      });
    }
  }

  // Plans & commission matrix
  for (const p of PLANS) {
    const [bm, aa, br, di, pp, sr] = p.flags;
    await prisma.subscriptionPlan.upsert({
      where: { code: p.code },
      create: {
        code: p.code,
        name: p.name,
        monthlyCents: p.monthlyCents,
        yearlyCents: p.yearlyCents,
        flashPromosPerMonth: p.flash,
        restaurantGuestFeeCents: p.guestFee,
        bookingManagement: bm,
        advancedAnalytics: aa,
        birthdayRadar: br,
        demandIntelligence: di,
        priorityPlacement: pp,
        sponsoredRoundups: sr,
        features: p.features,
      },
      update: {},
    });
  }
  const plans: PlanCode[] = ["BASIC", "PRO", "FEATURED"];
  for (const [cat, pcts] of Object.entries(RATES) as [CommissionCategory, number[]][]) {
    for (let i = 0; i < 3; i++) {
      await prisma.commissionRate.upsert({
        where: { category_plan: { category: cat, plan: plans[i] } },
        create: { category: cat, plan: plans[i], rateBps: pcts[i] * 100 },
        update: {},
      });
    }
  }

  // Advertising inventory
  let ps = 0;
  for (const p of PLACEMENTS) {
    await prisma.adPlacement.upsert({
      where: { code: p.code },
      create: { code: p.code, name: p.name, description: p.description, priceCents: p.priceCents, unit: p.unit, exclusive: p.exclusive, slots: p.slots, requiresPlan: p.requiresPlan, sort: ps++ },
      update: {},
    });
  }

  // Homepage sections (only on first deploy)
  if ((await prisma.homeSection.count()) === 0) {
    let i = 0;
    for (const s of SECTIONS) {
      await prisma.homeSection.create({
        data: { title: s.title, subtitle: s.subtitle, source: s.source, filters: s.filters ?? {}, layout: s.layout ?? "CAROUSEL", mode: s.mode ?? "AUTO", limit: s.limit ?? 12, sponsored: !!s.sponsored, ctaHref: s.ctaHref, sort: i++ },
      });
    }
  }
  // Upgrade: the old "EVNT Featured" paid row becomes the editorial "Handpicked experiences" showcase
  // (paid homepage placements still appear inside it, labelled sponsored).
  for (const old of await prisma.homeSection.findMany({ where: { source: "SPONSORED" } })) {
    if ((old.title as { en?: string })?.en !== "EVNT Featured") continue;
    const h = SECTIONS.find((x) => x.source === "HANDPICKED")!;
    await prisma.homeSection.update({ where: { id: old.id }, data: { title: h.title, subtitle: h.subtitle, source: "HANDPICKED", layout: "SPOTLIGHT", mode: "MANUAL", limit: 8, sponsored: false } });
  }

  // First super admin
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (email && password) {
    const existing = await prisma.user.findUnique({ where: { email } });
    const user =
      existing ??
      (await prisma.user.create({ data: { email, name: "EVNT Admin", passwordHash: await bcrypt.hash(password, 11), emailVerifiedAt: new Date() } }));
    await prisma.userRole.upsert({ where: { userId_role: { userId: user.id, role: "SUPER_ADMIN" } }, create: { userId: user.id, role: "SUPER_ADMIN" }, update: {} });
  }

  if (process.env.SEED_DEMO === "true") {
    const { seedDemo } = await import("./demo");
    await seedDemo(prisma);
  }
  console.log("[seed] done");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
