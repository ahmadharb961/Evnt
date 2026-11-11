// Card data passed from server to client components.

export type Availability = "available" | "limited" | "soldout" | "none";

export type EventCardData = {
  kind: "event";
  id: string;
  slug: string;
  title: string;
  image: string;
  merchantName: string;
  area: string | null;
  areaName: string;
  ageMin: number;
  ageMax: number;
  isFree: boolean;
  fromPriceCents: number;
  rating: number;
  ratingCount: number;
  nextStartsAt: string | null;
  sessionsCount: number;
  availability: Availability;
  farah: boolean;
  sponsored?: boolean;
  isNew: boolean;
  lat: number | null;
  lng: number | null;
  categoryName: string;
};

export type RestaurantCardData = {
  kind: "restaurant";
  id: string;
  slug: string;
  name: string;
  image: string;
  areaName: string;
  cuisines: string[];
  priceLevel: number;
  rating: number;
  ratingCount: number;
  facilities: string[];
  farah: boolean;
  acceptsReservations: boolean;
  sponsored?: boolean;
  lat: number | null;
  lng: number | null;
};

export type ProductCardData = {
  kind: "product";
  id: string;
  slug: string;
  title: string;
  image: string;
  merchantName: string;
  priceCents: number;
  salePriceCents: number | null;
  rating: number;
  ratingCount: number;
  inStock: boolean;
  sponsored?: boolean;
};

export type CardData = EventCardData | RestaurantCardData | ProductCardData;
