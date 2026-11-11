import type { MetadataRoute } from "next";

/** Web app manifest: lets parents add EVNT to their home screen and open it like an app. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "EVNT — Things to do with kids in Lebanon",
    short_name: "EVNT",
    description: "Discover, book and enjoy kids' activities, birthdays, family restaurants and shopping in Lebanon.",
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    categories: ["lifestyle", "entertainment", "shopping"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "This weekend", url: "/discover?when=weekend", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "My bookings", url: "/account/bookings", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Shop", url: "/shop", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
