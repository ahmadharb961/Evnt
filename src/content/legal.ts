// Legal pages in English, Arabic and French. A starting point written for EVNT's actual flows —
// have them reviewed by a Lebanese lawyer before launch.
type L = { en: string; ar: string; fr: string };
export type LegalPage = { title: L; updated: string; sections: { id?: string; h: L; p: L[] }[] };

const T = (en: string, ar: string, fr: string): L => ({ en, ar, fr });

export const TERMS: LegalPage = {
  title: T("Terms & conditions", "الشروط والأحكام", "Conditions générales"),
  updated: "2026-11-11",
  sections: [
    {
      h: T("1. About EVNT", "1. عن EVNT", "1. À propos d'EVNT"),
      p: [
        T(
          "EVNT (evnt.co) is a marketplace that helps families in Lebanon discover, book and buy kids' activities, restaurant reservations, birthday services and products offered by independent businesses (\"merchants\"). EVNT is not the organizer of activities nor the seller of products unless clearly stated.",
          "EVNT (evnt.co) منصة تساعد العائلات في لبنان على اكتشاف وحجز وشراء نشاطات الأطفال وحجوزات المطاعم وخدمات أعياد الميلاد والمنتجات التي تقدّمها مؤسسات مستقلة (\"التجّار\"). EVNT ليست منظِّمة النشاطات ولا بائعة المنتجات إلا إذا ذُكر ذلك بوضوح.",
          "EVNT (evnt.co) est une place de marché qui aide les familles au Liban à découvrir, réserver et acheter des activités pour enfants, des réservations de restaurants, des services d'anniversaire et des produits proposés par des entreprises indépendantes (« marchands »). EVNT n'est ni l'organisateur des activités ni le vendeur des produits, sauf mention claire.",
        ),
      ],
    },
    {
      h: T("2. Your account", "2. حسابك", "2. Votre compte"),
      p: [
        T(
          "You must be 18 or older to create an account and make bookings or purchases. You are responsible for keeping your login details safe and for the accuracy of the information you provide.",
          "يجب أن يكون عمرك 18 سنة أو أكثر لإنشاء حساب وإجراء الحجوزات أو المشتريات. أنت مسؤول عن حماية بيانات الدخول وعن دقة المعلومات التي تقدّمها.",
          "Vous devez avoir 18 ans ou plus pour créer un compte et effectuer des réservations ou des achats. Vous êtes responsable de la sécurité de vos identifiants et de l'exactitude des informations fournies.",
        ),
      ],
    },
    {
      h: T("3. Bookings and tickets", "3. الحجوزات والتذاكر", "3. Réservations et billets"),
      p: [
        T(
          "Prices, fees and any EVNT booking fee are shown before you confirm. Spots and seats are held for a limited time during checkout. A booking is confirmed only when the payment is confirmed by the payment provider, or when it is a free booking or an authorized pay-at-venue reservation. Tickets are personal QR codes; each can be scanned once.",
          "تُعرض الأسعار والرسوم وأي رسوم حجز من EVNT قبل التأكيد. تُحجز الأماكن والمقاعد لفترة محدودة أثناء الدفع. لا يُؤكَّد الحجز إلا بعد تأكيد الدفع من مزوّد الدفع، أو إذا كان الحجز مجانياً أو حجزاً مسموحاً بالدفع في المكان. التذاكر رموز QR شخصية ويمكن مسح كل منها مرة واحدة.",
          "Les prix, frais et éventuels frais de réservation EVNT sont affichés avant confirmation. Les places et sièges sont bloqués pour une durée limitée pendant le paiement. Une réservation n'est confirmée que lorsque le paiement est confirmé par le prestataire de paiement, ou s'il s'agit d'une réservation gratuite ou d'une réservation autorisée avec paiement sur place. Les billets sont des QR codes personnels, valables pour un seul scan.",
        ),
      ],
    },
    {
      h: T("4. Shop orders", "4. طلبات المتجر", "4. Commandes boutique"),
      p: [
        T(
          "Orders containing products from several shops are split into separate orders, each delivered by its shop. Cash on delivery orders are paid to the shop's delivery person. Online payments are confirmed only by the payment provider.",
          "تُقسَّم الطلبات التي تحتوي على منتجات من عدة متاجر إلى طلبات منفصلة، ويقوم كل متجر بتوصيل طلبه. تُدفع طلبات الدفع عند الاستلام لمندوب التوصيل التابع للمتجر. لا تُؤكَّد المدفوعات الإلكترونية إلا من قبل مزوّد الدفع.",
          "Les commandes contenant des produits de plusieurs boutiques sont divisées en commandes séparées, livrées chacune par sa boutique. Les commandes en paiement à la livraison sont réglées au livreur de la boutique. Les paiements en ligne ne sont confirmés que par le prestataire de paiement.",
        ),
      ],
    },
    {
      h: T("5. EVNT+ membership", "5. عضوية EVNT+", "5. Abonnement EVNT+"),
      p: [
        T(
          "EVNT+ is a paid membership that renews until cancelled. Benefits apply automatically where eligible and never override a merchant's stated cancellation policy. You can cancel renewal at any time and keep the benefits until the end of the paid period.",
          "EVNT+ عضوية مدفوعة تتجدد حتى الإلغاء. تُطبَّق المزايا تلقائياً حيث يمكن، ولا تتجاوز أبداً سياسة الإلغاء المعلنة للتاجر. يمكنك إلغاء التجديد في أي وقت مع الاحتفاظ بالمزايا حتى نهاية الفترة المدفوعة.",
          "EVNT+ est un abonnement payant renouvelé jusqu'à résiliation. Les avantages s'appliquent automatiquement lorsqu'ils sont éligibles et ne remplacent jamais la politique d'annulation du marchand. Vous pouvez arrêter le renouvellement à tout moment et garder les avantages jusqu'à la fin de la période payée.",
        ),
      ],
    },
    {
      h: T("6. Reviews and content", "6. التقييمات والمحتوى", "6. Avis et contenus"),
      p: [
        T(
          "Reviews must be honest and about your own experience. See our review policy. We may remove content that is abusive, misleading or unlawful.",
          "يجب أن تكون التقييمات صادقة وعن تجربتك الشخصية. راجع سياسة التقييمات. يحق لنا إزالة أي محتوى مسيء أو مضلِّل أو مخالف للقانون.",
          "Les avis doivent être sincères et porter sur votre propre expérience. Consultez notre politique d'avis. Nous pouvons retirer tout contenu abusif, trompeur ou illicite.",
        ),
      ],
    },
    {
      id: "merchants",
      h: T("7. Terms for merchants", "7. شروط التجّار", "7. Conditions pour les marchands"),
      p: [
        T(
          "Merchants are verified before going live and are responsible for their activities, products, prices, safety, permits and customer service. Merchants agree to the subscription prices, commissions and fees published on the pricing page at the time of the transaction, which EVNT may update with notice. Commissions apply to bookings generated by EVNT; 50% of the applicable rate applies to verified EVNT-generated bookings completed directly within 72 hours of a contact; customers brought through the merchant's own EVNT link are commission-free (payment costs may apply).",
          "يتم التحقق من التجّار قبل ظهورهم، وهم مسؤولون عن نشاطاتهم ومنتجاتهم وأسعارهم والسلامة والتراخيص وخدمة العملاء. يوافق التجّار على أسعار الاشتراكات والعمولات والرسوم المنشورة في صفحة الأسعار وقت المعاملة، ويحق لـEVNT تحديثها مع إشعار مسبق. تُطبَّق العمولات على الحجوزات التي تولّدها EVNT؛ ويُطبَّق 50% من النسبة على الحجوزات المولّدة من EVNT والمُتحقَّق منها والتي تتم مباشرة خلال 72 ساعة من التواصل؛ والعملاء القادمون عبر رابط التاجر الخاص على EVNT معفيون من العمولة (قد تُطبَّق تكاليف الدفع).",
          "Les marchands sont vérifiés avant leur mise en ligne et sont responsables de leurs activités, produits, prix, sécurité, autorisations et service client. Ils acceptent les prix d'abonnement, commissions et frais publiés sur la page tarifs au moment de la transaction, qu'EVNT peut modifier avec préavis. Les commissions s'appliquent aux réservations générées par EVNT ; 50 % du taux s'applique aux réservations générées par EVNT, vérifiées et conclues directement dans les 72 heures suivant un contact ; les clients amenés par le lien EVNT du marchand sont sans commission (des frais de paiement peuvent s'appliquer).",
        ),
        T(
          "Sponsored placements are labelled as sponsored, require EVNT's approval and never influence organic rankings, reviews or Farah Approved assessments. Unpaid invoices may lead to service restrictions.",
          "تُعلَّم المساحات المموّلة بوضوح، وتحتاج إلى موافقة EVNT، ولا تؤثر أبداً على الترتيب الطبيعي أو التقييمات أو تقييمات Farah Approved. قد تؤدي الفواتير غير المدفوعة إلى تقييد الخدمات.",
          "Les placements sponsorisés sont signalés comme tels, nécessitent l'approbation d'EVNT et n'influencent jamais les classements naturels, les avis ni les évaluations Farah Approved. Des factures impayées peuvent entraîner des restrictions de service.",
        ),
      ],
    },
    {
      h: T("8. Liability and law", "8. المسؤولية والقانون", "8. Responsabilité et droit applicable"),
      p: [
        T(
          "EVNT provides the platform with care but cannot guarantee uninterrupted availability. To the extent permitted by law, EVNT is not liable for the acts of merchants. These terms are governed by Lebanese law.",
          "تقدّم EVNT المنصة بعناية لكنها لا تضمن توفرها دون انقطاع. وفي حدود ما يسمح به القانون، لا تتحمّل EVNT المسؤولية عن تصرفات التجّار. تخضع هذه الشروط للقانون اللبناني.",
          "EVNT fournit la plateforme avec soin mais ne peut garantir une disponibilité ininterrompue. Dans la mesure permise par la loi, EVNT n'est pas responsable des actes des marchands. Ces conditions sont régies par le droit libanais.",
        ),
      ],
    },
  ],
};

export const PRIVACY: LegalPage = {
  title: T("Privacy policy", "سياسة الخصوصية", "Politique de confidentialité"),
  updated: "2026-11-11",
  sections: [
    {
      h: T("What we collect", "ما الذي نجمعه", "Ce que nous collectons"),
      p: [
        T(
          "Your name, email, mobile number, bookings, orders, reviews and preferences you choose to share. For delivery: your address. We never store card numbers — payments are handled by the payment provider.",
          "اسمك وبريدك الإلكتروني ورقم هاتفك وحجوزاتك وطلباتك وتقييماتك والتفضيلات التي تختار مشاركتها. للتوصيل: عنوانك. لا نخزّن أرقام البطاقات أبداً — يتولى مزوّد الدفع معالجة المدفوعات.",
          "Vos nom, e-mail, numéro de mobile, réservations, commandes, avis et préférences que vous choisissez de partager. Pour la livraison : votre adresse. Nous ne stockons jamais de numéros de carte — les paiements sont gérés par le prestataire de paiement.",
        ),
      ],
    },
    {
      h: T("Children's information", "معلومات الأطفال", "Informations sur les enfants"),
      p: [
        T(
          "Family preferences are optional and limited to age ranges, interests and areas, saved only with a parent's consent. We don't ask for children's names or birth dates for recommendations. Attendee first names on tickets are optional and shared only with that organizer.",
          "تفضيلات العائلة اختيارية وتقتصر على الفئات العمرية والاهتمامات والمناطق، ولا تُحفظ إلا بموافقة أحد الوالدين. لا نطلب أسماء الأطفال أو تواريخ ميلادهم لتقديم الاقتراحات. الأسماء الأولى للحضور على التذاكر اختيارية ولا تُشارك إلا مع المنظِّم المعني.",
          "Les préférences familiales sont facultatives et limitées aux tranches d'âge, centres d'intérêt et zones, enregistrées uniquement avec le consentement d'un parent. Nous ne demandons ni le nom ni la date de naissance des enfants pour les recommandations. Les prénoms des participants sur les billets sont facultatifs et partagés uniquement avec l'organisateur concerné.",
        ),
      ],
    },
    {
      h: T("How we use and share it", "كيف نستخدمها ونشاركها", "Utilisation et partage"),
      p: [
        T(
          "To run your bookings and orders, send confirmations, prevent fraud and improve EVNT. Merchants receive what they need to serve you (name, phone, booking details, delivery address). Birthday request details are shared only with businesses you choose and, if you agree, up to 3 verified partners. Marketing by email or WhatsApp only with your opt-in; you can opt out any time in Settings.",
          "لإدارة حجوزاتك وطلباتك وإرسال التأكيدات ومنع الاحتيال وتحسين EVNT. يحصل التجّار على ما يحتاجونه لخدمتك (الاسم والهاتف وتفاصيل الحجز وعنوان التوصيل). تُشارك تفاصيل طلبات أعياد الميلاد فقط مع المؤسسات التي تختارها، ومع 3 شركاء موثَّقين كحد أقصى إذا وافقت. لا نرسل رسائل تسويقية عبر البريد أو واتساب إلا بموافقتك، ويمكنك إلغاء الاشتراك في أي وقت من الإعدادات.",
          "Pour gérer vos réservations et commandes, envoyer les confirmations, prévenir la fraude et améliorer EVNT. Les marchands reçoivent ce dont ils ont besoin pour vous servir (nom, téléphone, détails de réservation, adresse de livraison). Les demandes d'anniversaire ne sont partagées qu'avec les entreprises que vous choisissez et, si vous l'acceptez, jusqu'à 3 partenaires vérifiés. Le marketing par e-mail ou WhatsApp uniquement avec votre accord ; désinscription possible à tout moment dans Paramètres.",
        ),
      ],
    },
    {
      h: T("Your rights", "حقوقك", "Vos droits"),
      p: [
        T(
          "You can access and correct your information in your account, delete your family preferences, and delete your account from Settings. Booking and payment records are kept in anonymised form as required for accounting. Contact us for any privacy request.",
          "يمكنك الاطلاع على معلوماتك وتصحيحها من حسابك، وحذف تفضيلات العائلة، وحذف حسابك من الإعدادات. تُحفظ سجلات الحجوزات والمدفوعات بشكل مجهول الهوية كما تقتضي المحاسبة. تواصل معنا لأي طلب يتعلق بالخصوصية.",
          "Vous pouvez consulter et corriger vos informations depuis votre compte, supprimer vos préférences familiales et supprimer votre compte depuis Paramètres. Les enregistrements de réservations et de paiements sont conservés sous forme anonymisée pour la comptabilité. Contactez-nous pour toute demande liée à la vie privée.",
        ),
      ],
    },
  ],
};

export const REFUNDS: LegalPage = {
  title: T("Refunds & cancellations", "الاسترداد والإلغاء", "Remboursements & annulations"),
  updated: "2026-11-11",
  sections: [
    {
      h: T("Activity bookings", "حجوزات النشاطات", "Réservations d'activités"),
      p: [
        T(
          "Unless the listing states otherwise, you can cancel for free up to 48 hours before the session (24 hours for EVNT+ members) from My bookings. After that, contact the organizer. If an organizer cancels a session, your booking is cancelled and any online payment is refunded in full.",
          "ما لم يُذكر غير ذلك في الإعلان، يمكنك الإلغاء مجاناً حتى 48 ساعة قبل الموعد (24 ساعة لأعضاء EVNT+) من صفحة حجوزاتي. بعد ذلك، تواصل مع المنظِّم. إذا ألغى المنظِّم الموعد، يُلغى حجزك وتُسترد أي دفعة إلكترونية بالكامل.",
          "Sauf mention contraire sur l'annonce, vous pouvez annuler gratuitement jusqu'à 48 heures avant la séance (24 heures pour les membres EVNT+) depuis Mes réservations. Ensuite, contactez l'organisateur. Si l'organisateur annule une séance, votre réservation est annulée et tout paiement en ligne est intégralement remboursé.",
        ),
      ],
    },
    {
      h: T("Shop orders", "طلبات المتجر", "Commandes boutique"),
      p: [
        T(
          "You can cancel an order until the shop starts preparing it. Paid orders cancelled by the shop are refunded in full. For damaged or wrong items, contact the shop within 48 hours of delivery; EVNT can help resolve disputes.",
          "يمكنك إلغاء الطلب حتى يبدأ المتجر بتحضيره. تُسترد قيمة الطلبات المدفوعة التي يلغيها المتجر بالكامل. في حال وصول منتجات تالفة أو خاطئة، تواصل مع المتجر خلال 48 ساعة من التسليم، ويمكن لـEVNT المساعدة في حل النزاعات.",
          "Vous pouvez annuler une commande tant que la boutique n'a pas commencé à la préparer. Les commandes payées annulées par la boutique sont intégralement remboursées. Pour un article endommagé ou erroné, contactez la boutique dans les 48 heures suivant la livraison ; EVNT peut aider à résoudre les litiges.",
        ),
      ],
    },
    {
      h: T("How refunds are paid", "كيف تُدفع المبالغ المستردة", "Mode de remboursement"),
      p: [
        T(
          "Refunds go back to the original payment method (Whish) and are recorded in your account. The EVNT booking fee is refunded when the organizer cancels. Cash payments are refunded by the merchant.",
          "تُعاد المبالغ المستردة إلى وسيلة الدفع الأصلية (Whish) وتُسجَّل في حسابك. تُسترد رسوم حجز EVNT عندما يلغي المنظِّم. أما المدفوعات النقدية فيستردها التاجر.",
          "Les remboursements sont versés sur le moyen de paiement d'origine (Whish) et enregistrés dans votre compte. Les frais de réservation EVNT sont remboursés lorsque l'organisateur annule. Les paiements en espèces sont remboursés par le marchand.",
        ),
      ],
    },
  ],
};

export const REVIEW_POLICY: LegalPage = {
  title: T("Review policy", "سياسة التقييمات", "Politique des avis"),
  updated: "2026-11-11",
  sections: [
    {
      h: T("Verified reviews", "التقييمات الموثّقة", "Avis vérifiés"),
      p: [
        T(
          "A review shows \"Verified booking\" only when it's linked to a completed booking, delivered order or completed reservation on EVNT. This is set automatically and can't be edited by anyone.",
          "يظهر وسم \"حجز موثّق\" على التقييم فقط إذا كان مرتبطاً بحجز مكتمل أو طلب مُسلَّم أو حجز مطعم مكتمل على EVNT. يُضبط ذلك تلقائياً ولا يمكن لأحد تعديله.",
          "Un avis affiche « Réservation vérifiée » uniquement s'il est lié à une réservation terminée, une commande livrée ou une réservation de restaurant honorée sur EVNT. Cela est défini automatiquement et ne peut être modifié par personne.",
        ),
      ],
    },
    {
      h: T("Fairness", "النزاهة", "Équité"),
      p: [
        T(
          "Businesses can't review themselves, buy ratings or remove honest negative reviews. Paid placements never change ratings. We remove reviews that are fake, abusive, discriminatory, share personal data or are unrelated to the experience. Anyone can report a review.",
          "لا يمكن للمؤسسات تقييم نفسها أو شراء التقييمات أو حذف التقييمات السلبية الصادقة. لا تغيّر المساحات المدفوعة التقييمات أبداً. نزيل التقييمات المزيفة أو المسيئة أو التمييزية أو التي تكشف بيانات شخصية أو لا علاقة لها بالتجربة. يمكن لأي شخص الإبلاغ عن تقييم.",
          "Les entreprises ne peuvent ni s'évaluer elles-mêmes, ni acheter des notes, ni supprimer des avis négatifs sincères. Les placements payants ne modifient jamais les notes. Nous retirons les avis faux, abusifs, discriminatoires, contenant des données personnelles ou sans rapport avec l'expérience. Tout le monde peut signaler un avis.",
        ),
      ],
    },
  ],
};
