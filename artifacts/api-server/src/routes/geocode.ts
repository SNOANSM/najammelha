import { Router, type IRouter } from "express";

const router: IRouter = Router();

interface NominatimAddress {
  road?: string;
  pedestrian?: string;
  footway?: string;
  highway?: string;
  amenity?: string;
  building?: string;
  neighbourhood?: string;
  suburb?: string;
  city_district?: string;
  quarter?: string;
  town?: string;
  city?: string;
  state?: string;
}

// Turns the browser's GPS coordinates into a readable place name ("شارع X، منطقة Y")
// so the report carries the exact spot instead of a generic "my location".
router.get("/geocode/reverse", async (req, res) => {
  if (!req.authUser) {
    res.status(401).json({ error: "يرجى تسجيل الدخول أولًا." });
    return;
  }
  const latitude = Number(req.query.lat);
  const longitude = Number(req.query.lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < 28 || latitude > 31 || longitude < 46 || longitude > 49) {
    res.status(400).json({ error: "الإحداثيات خارج الكويت." });
    return;
  }
  try {
    const url = new URL("https://nominatim.openstreetmap.org/reverse");
    url.search = new URLSearchParams({ format: "jsonv2", lat: String(latitude), lon: String(longitude), zoom: "18", addressdetails: "1", "accept-language": "ar" }).toString();
    const response = await fetch(url, { headers: { "User-Agent": "Najammelha/1.0 (community reporting)" }, signal: AbortSignal.timeout(6000) });
    if (!response.ok) throw new Error(`geocoder status ${response.status}`);
    const data = (await response.json()) as { address?: NominatimAddress; display_name?: string };
    const a = data.address ?? {};
    const street = a.road || a.pedestrian || a.footway || a.highway || a.amenity || a.building;
    const area = a.neighbourhood || a.suburb || a.quarter || a.city_district || a.town || a.city || a.state;
    const name = [street, area].filter((part, i, all) => part && all.indexOf(part) === i).join("، ") || data.display_name?.split(",").slice(0, 2).join("،").trim() || null;
    res.json({ name });
  } catch (error) {
    req.log.warn({ err: error }, "Reverse geocoding failed");
    res.json({ name: null });
  }
});

export default router;
