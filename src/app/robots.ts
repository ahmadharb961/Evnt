import type { MetadataRoute } from "next";
import { appUrl } from "@/server/urls";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/merchant", "/account", "/checkout", "/cart", "/api", "/pay", "/go", "/r/"] }],
    sitemap: `${appUrl()}/sitemap.xml`,
  };
}
