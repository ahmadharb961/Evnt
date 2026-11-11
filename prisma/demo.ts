// Demo data for local development and sales demos ONLY (SEED_DEMO=true). Never enable in production:
// these are fictional businesses. All demo accounts use @demo.evnt.local emails so admin can find and remove them.
import type { MerchantType, PlanCode, PrismaClient, VenueSetting } from "@prisma/client";
import bcrypt from "bcryptjs";

type L = { en: string; ar: string; fr: string };
const cover = (i: number) => `/demo/cover-${(i % 18) + 1}.svg`;

const MERCHANTS: { slug: string; name: string; type: MerchantType; plan: PlanCode; area: string; lat: number; lng: number; farah?: boolean }[] = [
  { slug: "little-makers-studio", name: "Little Makers Studio", type: "ACTIVITY_PROVIDER", plan: "PRO", area: "achrafieh", lat: 33.888, lng: 35.521, farah: true },
  { slug: "cedar-kids-theater", name: "Cedar Kids Theater", type: "EVENT_ORGANIZER", plan: "FEATURED", area: "hamra", lat: 33.896, lng: 35.482 },
  { slug: "green-valley-farm", name: "Green Valley Farm", type: "VENUE", plan: "BASIC", area: "broummana", lat: 33.881, lng: 35.626, farah: true },
  { slug: "tiny-chefs-academy", name: "Tiny Chefs Academy", type: "ACTIVITY_PROVIDER", plan: "BASIC", area: "jounieh", lat: 33.98, lng: 35.618 },
  { slug: "sunny-camp-lebanon", name: "Sunny Camp Lebanon", type: "ACTIVITY_PROVIDER", plan: "PRO", area: "faraya", lat: 34.013, lng: 35.825 },
  { slug: "party-lane", name: "Party Lane", type: "BIRTHDAY_SERVICE", plan: "FEATURED", area: "dbayeh", lat: 33.937, lng: 35.589 },
  { slug: "cafe-bloom", name: "Café Bloom", type: "RESTAURANT", plan: "PRO", area: "badaro", lat: 33.874, lng: 35.515, farah: true },
  { slug: "the-garden-table", name: "The Garden Table", type: "RESTAURANT", plan: "BASIC", area: "jal-el-dib", lat: 33.909, lng: 35.579 },
  { slug: "seaside-family-grill", name: "Seaside Family Grill", type: "RESTAURANT", plan: "FEATURED", area: "batroun", lat: 34.255, lng: 35.658 },
  { slug: "toybox-beirut", name: "Toybox Beirut", type: "RETAILER", plan: "PRO", area: "verdun", lat: 33.887, lng: 35.485 },
  { slug: "mini-mode", name: "Mini Mode", type: "RETAILER", plan: "BASIC", area: "hazmieh", lat: 33.855, lng: 35.54 },
];

const T = (en: string, ar: string, fr: string): L => ({ en, ar, fr });

const EVENTS: {
  m: string;
  cat: string;
  title: L;
  summary: L;
  age: [number, number];
  setting: VenueSetting;
  prices: { name: L; cents: number; zone?: string }[];
  capacity: number;
  times: [number, number][]; // [dayOffset, hour]
  seating?: boolean;
  free?: boolean;
}[] = [
  { m: "little-makers-studio", cat: "arts-crafts", title: T("Clay & Colour Pottery Workshop", "ورشة فخار وألوان", "Atelier poterie & couleurs"), summary: T("Little hands shape, paint and take home their own clay creations.", "يصنع الصغار أعمالهم من الطين ويلوّنونها ويأخذونها معهم.", "Les petites mains modèlent, peignent et repartent avec leurs créations."), age: [4, 10], setting: "INDOOR", prices: [{ name: T("Child ticket", "تذكرة طفل", "Billet enfant"), cents: 2500 }], capacity: 12, times: [[1, 10], [3, 16], [5, 10], [6, 11], [12, 10]] },
  { m: "little-makers-studio", cat: "science-stem", title: T("Junior Robotics Lab", "مختبر الروبوتات للصغار", "Labo robotique junior"), summary: T("Build and code a tiny robot in a playful two-hour lab.", "بناء وبرمجة روبوت صغير خلال ساعتين من المرح.", "Construire et coder un petit robot en deux heures ludiques."), age: [7, 12], setting: "INDOOR", prices: [{ name: T("Child ticket", "تذكرة طفل", "Billet enfant"), cents: 3500 }], capacity: 10, times: [[2, 15], [6, 14], [9, 15]] },
  { m: "cedar-kids-theater", cat: "theater", title: T("The Lantern Fox — Family Musical", "الثعلب والفانوس — مسرحية موسيقية", "Le Renard à la lanterne — comédie musicale"), summary: T("A warm, funny musical about friendship. Choose your seats.", "مسرحية موسيقية مضحكة ودافئة عن الصداقة. اختاروا مقاعدكم.", "Une comédie musicale tendre et drôle sur l'amitié. Choisissez vos places."), age: [3, 12], setting: "INDOOR", prices: [{ name: T("Premium", "مميّز", "Premium"), cents: 3000, zone: "premium" }, { name: T("Standard", "عادي", "Standard"), cents: 2000, zone: "standard" }], capacity: 0, times: [[4, 17], [5, 11], [5, 16], [11, 17]], seating: true },
  { m: "green-valley-farm", cat: "farms-animals", title: T("Morning at the Farm", "صباح في المزرعة", "Matinée à la ferme"), summary: T("Feed the animals, pick vegetables and enjoy a picnic in the hills.", "إطعام الحيوانات وقطف الخضار ونزهة في الجبل.", "Nourrir les animaux, cueillir des légumes et pique-niquer."), age: [2, 12], setting: "OUTDOOR", prices: [{ name: T("Child", "طفل", "Enfant"), cents: 1500 }, { name: T("Adult", "بالغ", "Adulte"), cents: 1000 }], capacity: 40, times: [[5, 9], [6, 9], [12, 9], [13, 9]] },
  { m: "green-valley-farm", cat: "outdoor-nature", title: T("Free Nature Story Walk", "نزهة الحكايات في الطبيعة", "Balade-contes nature"), summary: T("A gentle guided walk with stories along the trail. Free, book a spot.", "نزهة هادئة مع حكايات على الطريق. مجانية، احجزوا مكانكم.", "Une balade guidée avec des histoires. Gratuit, réservez votre place."), age: [3, 9], setting: "OUTDOOR", prices: [{ name: T("Free spot", "مكان مجاني", "Place gratuite"), cents: 0 }], capacity: 25, times: [[6, 16], [13, 16]], free: true },
  { m: "tiny-chefs-academy", cat: "cooking", title: T("Mini Bakers: Manakish & Cookies", "الخبازون الصغار: مناقيش وكوكيز", "Mini-boulangers : manakich & cookies"), summary: T("Knead, top and bake Lebanese manakish, then decorate cookies.", "عجن وتحضير المناقيش اللبنانية ثم تزيين الكوكيز.", "Pétrir et cuire des manakich, puis décorer des cookies."), age: [5, 11], setting: "INDOOR", prices: [{ name: T("Child ticket", "تذكرة طفل", "Billet enfant"), cents: 1800 }], capacity: 14, times: [[1, 16], [5, 12], [8, 16]] },
  { m: "tiny-chefs-academy", cat: "classes", title: T("Toddler Sensory Play", "لعب حسّي للأطفال الصغار", "Jeu sensoriel tout-petits"), summary: T("Textures, colours and music for little explorers with a parent.", "ملمس وألوان وموسيقى للمستكشفين الصغار مع أحد الأهل.", "Textures, couleurs et musique pour les petits explorateurs avec un parent."), age: [1, 3], setting: "INDOOR", prices: [{ name: T("Child + parent", "طفل مع أحد الأهل", "Enfant + parent"), cents: 1500 }], capacity: 8, times: [[2, 10], [4, 10], [9, 10]] },
  { m: "sunny-camp-lebanon", cat: "winter-camps", title: T("Snow Week Winter Camp", "مخيم أسبوع الثلج الشتوي", "Camp d'hiver semaine neige"), summary: T("Five days of snow play, crafts and hot chocolate in Faraya.", "خمسة أيام من اللعب بالثلج والأشغال والشوكولا الساخنة في فاريا.", "Cinq jours de neige, d'activités et de chocolat chaud à Faraya."), age: [6, 12], setting: "BOTH", prices: [{ name: T("Full week", "أسبوع كامل", "Semaine complète"), cents: 22000 }], capacity: 30, times: [[20, 9], [27, 9]] },
  { m: "sunny-camp-lebanon", cat: "after-school", title: T("After-School Football Club", "نادي كرة القدم بعد المدرسة", "Club de foot après l'école"), summary: T("Fun football sessions with certified coaches.", "حصص كرة قدم ممتعة مع مدربين معتمدين.", "Des séances de foot ludiques avec des coachs certifiés."), age: [6, 12], setting: "OUTDOOR", prices: [{ name: T("Session", "حصة", "Séance"), cents: 1200 }], capacity: 20, times: [[1, 15], [3, 15], [8, 15], [10, 15]] },
  { m: "party-lane", cat: "party-packages", title: T("Superhero Party Package", "باقة حفلة الأبطال الخارقين", "Formule fête super-héros"), summary: T("Venue, host, games, decoration and cake for up to 20 kids.", "المكان ومنشّط وألعاب وزينة وقالب حلوى لحتى 20 طفلاً.", "Salle, animateur, jeux, déco et gâteau jusqu'à 20 enfants."), age: [3, 10], setting: "INDOOR", prices: [{ name: T("Party for 20", "حفلة لـ20 طفلاً", "Fête pour 20"), cents: 45000 }], capacity: 1, times: [[6, 14], [7, 14], [13, 14], [14, 14]] },
  { m: "sunny-camp-lebanon", cat: "outdoor-nature", title: T("Splash Day at the Water Park", "يوم المرح في المسبح المائي", "Journée glisse au parc aquatique"), summary: T("Slides, splash pools and lifeguard-supervised games for a sunny family day.", "زحاليق ومسابح وألعاب بإشراف منقذين ليوم عائلي مشمس.", "Toboggans, pataugeoires et jeux surveillés pour une journée ensoleillée en famille."), age: [4, 12], setting: "OUTDOOR", prices: [{ name: T("Child", "طفل", "Enfant"), cents: 1800 }, { name: T("Adult", "بالغ", "Adulte"), cents: 1200 }], capacity: 60, times: [[6, 10], [7, 10], [13, 10], [14, 10]] },
  { m: "green-valley-farm", cat: "outdoor-nature", title: T("Junior Quad Ride in the Hills", "جولة دراجات رباعية للصغار في الجبل", "Balade en quad junior dans les collines"), summary: T("Kid-size quads on a safe dirt track with helmets and a trained guide.", "دراجات رباعية بحجم الأطفال على مسار آمن مع خوذات ومرشد مدرَّب.", "Des quads adaptés aux enfants sur une piste sécurisée, avec casques et guide formé."), age: [7, 12], setting: "OUTDOOR", prices: [{ name: T("30-minute ride", "جولة 30 دقيقة", "Balade de 30 minutes"), cents: 2500 }], capacity: 8, times: [[5, 15], [6, 11], [12, 15]] },
  { m: "cedar-kids-theater", cat: "cinema", title: T("Family Movie Night Under the Stars", "سهرة سينما عائلية تحت النجوم", "Soirée cinéma en famille sous les étoiles"), summary: T("An animated classic on the big outdoor screen, with bean bags and popcorn.", "فيلم رسوم متحركة على شاشة كبيرة في الهواء الطلق مع وسائد وفشار.", "Un grand classique animé sur écran géant en plein air, poufs et pop-corn compris."), age: [3, 12], setting: "OUTDOOR", prices: [{ name: T("Bean bag spot", "مكان على وسادة", "Place sur pouf"), cents: 1000 }], capacity: 80, times: [[5, 19], [12, 19]] },
  { m: "party-lane", cat: "entertainers", title: T("Magic Show with Captain Bubbles", "عرض سحري مع الكابتن فقاعات", "Spectacle de magie avec Capitaine Bulles"), summary: T("A giant-bubble magic show at our studio every Saturday.", "عرض سحري بالفقاعات العملاقة في الاستوديو كل سبت.", "Un spectacle de bulles géantes chaque samedi."), age: [2, 9], setting: "INDOOR", prices: [{ name: T("Ticket", "تذكرة", "Billet"), cents: 1200 }], capacity: 50, times: [[5, 11], [12, 11]] },
];

const RESTAURANTS: { m: string; name: string; cuisines: string[]; price: number; f: string[]; about: L }[] = [
  { m: "cafe-bloom", name: "Café Bloom", cuisines: ["Café", "Brunch"], price: 2, f: ["kidsMenu", "highChairs", "playArea", "strollerAccess", "changingFacilities"], about: T("A bright brunch café with a supervised play corner.", "مقهى فطور مشمس مع زاوية لعب بإشراف.", "Un café brunch lumineux avec un coin jeux surveillé.") },
  { m: "the-garden-table", name: "The Garden Table", cuisines: ["Lebanese", "Grill"], price: 2, f: ["kidsMenu", "highChairs", "outdoorSeating", "parking", "birthdaySuitable"], about: T("Lebanese mezze in a big garden where kids can run.", "مازة لبنانية في حديقة كبيرة يركض فيها الأطفال.", "Mezzé libanais dans un grand jardin où les enfants courent.") },
  { m: "seaside-family-grill", name: "Seaside Family Grill", cuisines: ["Seafood", "Lebanese"], price: 3, f: ["kidsMenu", "highChairs", "outdoorSeating", "parking", "playArea", "birthdaySuitable"], about: T("Fresh fish by the sea with a sandy play area.", "سمك طازج على البحر مع منطقة لعب رملية.", "Poisson frais au bord de la mer avec aire de jeux.") },
];

const PRODUCTS: { m: string; cat: string; title: L; cents: number; sale?: number; variants: [string, number][]; age?: [number, number] }[] = [
  { m: "toybox-beirut", cat: "toys-games", title: T("Wooden Rainbow Stacker", "لعبة قوس قزح الخشبية", "Arc-en-ciel en bois à empiler"), cents: 2800, variants: [["Default", 12]], age: [1, 5] },
  { m: "toybox-beirut", cat: "learning-creativity", title: T("Arabic Alphabet Puzzle", "أحجية الحروف العربية", "Puzzle alphabet arabe"), cents: 1900, sale: 1500, variants: [["Default", 20]], age: [3, 7] },
  { m: "toybox-beirut", cat: "toys-games", title: T("Family Board Game Night Set", "مجموعة ألعاب طاولة عائلية", "Coffret jeux de société en famille"), cents: 3500, variants: [["Default", 6]], age: [6, 12] },
  { m: "toybox-beirut", cat: "gifts-party", title: T("Birthday Party Box (10 kids)", "علبة حفلة عيد ميلاد (10 أطفال)", "Box fête d'anniversaire (10 enfants)"), cents: 4500, variants: [["Pastel", 8], ["Superhero", 5]] },
  { m: "mini-mode", cat: "kids-fashion", title: T("Organic Cotton Pyjamas", "بيجاما قطن عضوي", "Pyjama en coton bio"), cents: 2400, variants: [["2-3Y", 6], ["4-5Y", 8], ["6-7Y", 0]], age: [2, 7] },
  { m: "mini-mode", cat: "kids-fashion", title: T("Rain Jacket", "سترة للمطر", "Veste de pluie"), cents: 3900, sale: 2900, variants: [["4Y", 4], ["6Y", 3], ["8Y", 2]], age: [4, 9] },
  { m: "mini-mode", cat: "baby-essentials", title: T("Muslin Swaddle Set", "مجموعة لفّات موسلين", "Lot de langes en mousseline"), cents: 2200, variants: [["Default", 15]], age: [0, 1] },
];

// Demo photos (public/demo/photos). First = cover, the rest = gallery.
const P = (n: string) => `/demo/photos/${n}.webp`;
const EVENT_PHOTOS: Record<string, string[]> = {
  "Clay & Colour Pottery Workshop": ["painting", "cupcake-baking", "face-painting"],
  "Junior Robotics Lab": ["science-lab", "painting"],
  "The Lantern Fox — Family Musical": ["stage-show", "outdoor-cinema"],
  "Morning at the Farm": ["farm-goats", "rope-course", "family-dinner"],
  "Free Nature Story Walk": ["rope-course", "farm-goats"],
  "Mini Bakers: Manakish & Cookies": ["cupcake-baking", "birthday-cake"],
  "Toddler Sensory Play": ["indoor-playground", "bouncy-castle"],
  "Snow Week Winter Camp": ["climbing-wall", "rope-course", "trampoline"],
  "After-School Football Club": ["trampoline", "climbing-wall"],
  "Superhero Party Package": ["birthday-cake", "bouncy-castle", "face-painting"],
  "Magic Show with Captain Bubbles": ["face-painting", "stage-show", "bouncy-castle"],
  "Splash Day at the Water Park": ["water-slide", "family-burger"],
  "Junior Quad Ride in the Hills": ["quad-bikes", "rope-course"],
  "Family Movie Night Under the Stars": ["outdoor-cinema", "stage-show"],
};
const RESTAURANT_PHOTOS: Record<string, string[]> = {
  "cafe-bloom": ["rainbow-cafe", "family-burger", "indoor-playground"],
  "the-garden-table": ["stone-courtyard-restaurant", "family-dinner", "terrace-restaurant"],
  "seaside-family-grill": ["terrace-restaurant", "family-dinner", "family-burger"],
};
const CATEGORY_PHOTOS: Record<string, string> = {
  "activities-workshops": "painting",
  "camps-after-school": "climbing-wall",
  "birthdays-parties": "birthday-cake",
  "family-experiences": "farm-goats",
  "shows-entertainment": "stage-show",
  "restaurants-cafes": "rainbow-cafe",
};
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");


type Ids = Map<string, { merchantId: string; locationId: string }>;
async function createDemoEvent(prisma: PrismaClient, ev: (typeof EVENTS)[number], e: number, ids: Ids, cats: Map<string, { id: string }>, mapId: string | null) {
  const now = new Date();
  const m = ids.get(ev.m)!;
  const cat = cats.get(ev.cat)!;
  const created = await prisma.event.create({
    data: {
      merchantId: m.merchantId,
      locationId: m.locationId,
      categoryId: cat.id,
      slug: slug(ev.title.en),
      title: ev.title,
      summary: ev.summary,
      description: T(
        `${ev.summary.en}\n\nSessions are small and led by friendly, experienced staff. Parents are welcome to stay.`,
        `${ev.summary.ar}\n\nالمجموعات صغيرة ويشرف عليها فريق ودود وذو خبرة. يمكن للأهل البقاء.`,
        `${ev.summary.fr}\n\nPetits groupes encadrés par une équipe chaleureuse et expérimentée. Les parents peuvent rester.`,
      ),
      included: T("All materials\nSnack and water", "جميع المواد\nوجبة خفيفة ومياه", "Tout le matériel\nGoûter et eau"),
      importantInfo: T("Please arrive 10 minutes early.", "يرجى الحضور قبل 10 دقائق.", "Merci d'arriver 10 minutes en avance."),
      cancellationPolicy: T(
        "Free cancellation up to 48 hours before the session. No refunds after that.",
        "إلغاء مجاني حتى 48 ساعة قبل الموعد. لا استرداد بعد ذلك.",
        "Annulation gratuite jusqu'à 48 h avant la séance. Aucun remboursement ensuite.",
      ),
      coverUrl: cover(e),
      ageMin: ev.age[0],
      ageMax: ev.age[1],
      setting: ev.setting,
      isFree: !!ev.free,
      fromPriceCents: Math.min(...ev.prices.map((p) => p.cents)),
      seatingMode: ev.seating ? "ASSIGNED" : "GENERAL",
      seatingMapId: ev.seating ? mapId : null,
      accessible: e % 3 === 0,
      payAtVenue: e % 2 === 0, // demo: authorized pay-at-venue on some listings
      status: "PUBLISHED",
      publishedAt: new Date(now.getTime() - e * 2 * 86400_000),
      popularity: 40 - e * 3,
      ticketTypes: { create: ev.prices.map((p, k) => ({ name: p.name, priceCents: p.cents, zone: p.zone, maxQty: ev.capacity === 1 ? 1 : 10, sort: k })) },
    },
  });
  for (const [d, h] of ev.times) {
    const startsAt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + d, h - 2));
    await prisma.eventSession.create({ data: { eventId: created.id, startsAt, endsAt: new Date(startsAt.getTime() + 2 * 3600_000), capacity: ev.seating ? 0 : ev.capacity } });
  }
}

/**
 * Adds demo activities that don't exist yet and applies the demo photos to listings, merchants,
 * categories and the homepage hero. Safe to run on every seed.
 */
async function applyDemoPhotos(prisma: PrismaClient) {
  const merchants = await prisma.merchant.findMany({ where: { slug: { in: MERCHANTS.map((m) => m.slug) } }, include: { locations: true } });
  const ids: Ids = new Map(merchants.map((m) => [m.slug, { merchantId: m.id, locationId: m.locations[0]?.id }]));
  const cats = new Map((await prisma.category.findMany()).map((c) => [c.slug, c]));
  const map = await prisma.seatingMap.findFirst({ where: { merchantId: ids.get("cedar-kids-theater")?.merchantId } });
  let added = 0;
  for (const [e, ev] of EVENTS.entries()) {
    if (!ids.get(ev.m) || (await prisma.event.findUnique({ where: { slug: slug(ev.title.en) } }))) continue;
    await createDemoEvent(prisma, ev, e, ids, cats, map?.id ?? null);
    added++;
  }
  for (const [title, photos] of Object.entries(EVENT_PHOTOS)) {
    const ev = await prisma.event.findUnique({ where: { slug: slug(title) } });
    if (!ev || ev.coverId) continue; // never overwrite a real upload
    await prisma.event.update({ where: { id: ev.id }, data: { coverUrl: P(photos[0]) } });
    await prisma.eventMedia.deleteMany({ where: { eventId: ev.id, mediaId: null } });
    await prisma.eventMedia.createMany({ data: photos.slice(1).map((n, k) => ({ eventId: ev.id, url: P(n), sort: k })) });
  }
  for (const [s, photos] of Object.entries(RESTAURANT_PHOTOS)) {
    await prisma.restaurant.updateMany({ where: { slug: s, coverId: null }, data: { coverUrl: P(photos[0]), gallery: photos.slice(1).map(P) } });
  }
  for (const [s, n] of Object.entries(CATEGORY_PHOTOS)) await prisma.category.updateMany({ where: { slug: s, imageId: null }, data: { imageUrl: P(n) } });
  const hero = await prisma.setting.findUnique({ where: { key: "hero" } });
  if (!hero) await prisma.setting.create({ data: { key: "hero", value: { posterUrl: "/demo/photos/hero-mosaic.jpg" } } });
  if (added) {
    const { reindexAll } = await import("../src/server/reindex");
    await reindexAll(prisma);
  }
  console.log(`[seed] demo photos applied${added ? ` (+${added} activities)` : ""}`);
}

export async function seedDemo(prisma: PrismaClient) {
  if (await prisma.merchant.findUnique({ where: { slug: MERCHANTS[0].slug } })) return applyDemoPhotos(prisma);
  const pw = await bcrypt.hash("demo12345", 10);
  const cats = new Map((await prisma.category.findMany()).map((c) => [c.slug, c]));
  const now = new Date();
  const ids = new Map<string, { merchantId: string; locationId: string }>();
  let i = 0;
  for (const m of MERCHANTS) {
    const user = await prisma.user.create({ data: { email: `${m.slug}@demo.evnt.local`, name: `${m.name} owner`, passwordHash: pw, phone: "96170000000" } });
    const merchant = await prisma.merchant.create({
      data: {
        slug: m.slug,
        name: m.name,
        type: m.type,
        status: "APPROVED",
        onboardingStep: 10,
        plan: m.plan,
        attributionCode: m.slug.slice(0, 6).toUpperCase() + i,
        whatsapp: "96170000000",
        phone: "96170000000",
        email: `${m.slug}@demo.evnt.local`,
        about: T(`${m.name} — a demo business on EVNT.`, `${m.name} — نشاط تجريبي على EVNT.`, `${m.name} — une entreprise de démonstration sur EVNT.`),
        verifiedAt: now,
        farahUntil: m.farah ? new Date(now.getTime() + 300 * 86400_000) : null,
        staff: { create: { userId: user.id, role: "OWNER" } },
        locations: { create: { name: "Main", area: m.area, address: `Main street, ${m.area}`, lat: m.lat, lng: m.lng } },
        subscriptions: {
          create: {
            plan: m.plan,
            status: "ACTIVE",
            priceCents: m.plan === "PRO" ? 7900 : m.plan === "FEATURED" ? 19900 : 0,
            currentPeriodStart: now,
            currentPeriodEnd: new Date(now.getTime() + 30 * 86400_000),
            adminOverride: true,
            note: "Demo",
          },
        },
      },
      include: { locations: true },
    });
    ids.set(m.slug, { merchantId: merchant.id, locationId: merchant.locations[0].id });
    i++;
  }

  // Seating map for the theater: 9 rows, aisle in the middle, premium front rows.
  const theater = ids.get("cedar-kids-theater")!;
  const map = await prisma.seatingMap.create({
    data: {
      merchantId: theater.merchantId,
      name: "Main hall",
      width: 16,
      height: 11,
      zones: [
        { key: "premium", name: "Premium", color: "#FDCDAC" },
        { key: "standard", name: "Standard", color: "#CBD5E8" },
      ],
      labels: [{ text: "STAGE", x: 1, y: 0, w: 14 }],
    },
  });
  const rows = "ABCDEFGHI";
  const seatData = [];
  for (let r = 0; r < rows.length; r++) {
    for (let c = 0; c < 15; c++) {
      if (c === 7) continue; // aisle
      const n = c < 7 ? c + 1 : c;
      seatData.push({ mapId: map.id, label: `${rows[r]}${n}`, row: rows[r], x: c + 1, y: r + 2, zone: r < 3 ? "premium" : "standard", accessible: r === rows.length - 1 && (c === 0 || c === 14) });
    }
  }
  await prisma.seat.createMany({ data: seatData });

  for (const [e, ev] of EVENTS.entries()) await createDemoEvent(prisma, ev, e, ids, cats, map.id);

  let r = 0;
  for (const rs of RESTAURANTS) {
    const m = ids.get(rs.m)!;
    await prisma.restaurant.create({
      data: {
        merchantId: m.merchantId,
        locationId: m.locationId,
        slug: rs.m,
        name: rs.name,
        about: rs.about,
        coverUrl: cover(r + 9),
        gallery: [cover(r + 10), cover(r + 11)],
        cuisines: rs.cuisines,
        priceLevel: rs.price,
        hours: { mon: [["09:00", "23:00"]], tue: [["09:00", "23:00"]], wed: [["09:00", "23:00"]], thu: [["09:00", "23:00"]], fri: [["09:00", "23:59"]], sat: [["09:00", "23:59"]], sun: [["09:00", "22:00"]] },
        ...Object.fromEntries(rs.f.map((k) => [k, true])),
        status: "PUBLISHED",
        popularity: 20 - r,
      },
    });
    r++;
  }

  let p = 0;
  for (const pr of PRODUCTS) {
    const m = ids.get(pr.m)!;
    await prisma.product.create({
      data: {
        merchantId: m.merchantId,
        categoryId: cats.get(pr.cat)!.id,
        slug: slug(pr.title.en),
        title: pr.title,
        description: T("Carefully chosen for little ones. Safe materials, lovely packaging.", "مختار بعناية للصغار. مواد آمنة وتغليف جميل.", "Choisi avec soin pour les petits. Matériaux sûrs, joli emballage."),
        deliveryInfo: T("Delivery across Lebanon in 1–3 working days.", "توصيل إلى كل لبنان خلال 1–3 أيام عمل.", "Livraison partout au Liban en 1 à 3 jours ouvrés."),
        images: [cover(p + 4), cover(p + 5)],
        priceCents: pr.cents,
        salePriceCents: pr.sale ?? null,
        ageMin: pr.age?.[0],
        ageMax: pr.age?.[1],
        status: "PUBLISHED",
        popularity: 10 - p,
        variants: { create: pr.variants.map(([name, stock]) => ({ name, stock })) },
      },
    });
    p++;
  }

  const { reindexAll } = await import("../src/server/reindex");
  await reindexAll(prisma);
  await prisma.user.create({ data: { email: "parent@demo.evnt.local", name: "Maya Demo", passwordHash: pw, phone: "96171000000" } });
  await applyDemoPhotos(prisma);
  console.log("[seed] demo data loaded (no fake reviews or ratings: those come only from real bookings)");
}
