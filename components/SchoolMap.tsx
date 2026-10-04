import { Settings } from "@/lib/models";

export default function SchoolMap({ s }: { s: Settings }) {
  let source = "";
  try {
    const url = new URL(s.mapsEmbed || s.maps || "");
    if (url.protocol === "https:" && url.hostname === "www.google.com" && url.pathname.startsWith("/maps/embed")) source = url.href;
    else if (url.hostname === "www.google.com" || url.hostname === "maps.google.com") {
      const query = url.searchParams.get("q") || url.searchParams.get("query");
      if (query) source = `https://www.google.com/maps?q=${encodeURIComponent(query)}&output=embed`;
    }
  } catch {}
  if (!source && s.address) source = `https://www.google.com/maps?q=${encodeURIComponent([s.schoolName, s.address].filter(Boolean).join(", "))}&output=embed`;
  if (!source) return null;
  return <div className="school-map">
    <iframe src={source} title="Vị trí nhà trường trên Google Maps" loading="lazy" referrerPolicy="no-referrer-when-downgrade" allowFullScreen />
  </div>;
}
