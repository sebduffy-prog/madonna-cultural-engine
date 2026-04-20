import { useEffect, useRef, useMemo, useState, useCallback } from "react";

function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const toRad = (v) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function findNearestMural(venue, murals) {
  let nearest = null;
  let minDist = Infinity;
  for (const mural of murals) {
    const d = haversineDistance(venue.lat, venue.lng, mural.lat, mural.lng);
    if (d < minDist) {
      minDist = d;
      nearest = mural;
    }
  }
  return { mural: nearest, distance: minDist };
}

const COLORS = {
  BG: "#0C0C0C",
  CARD: "rgba(21,21,21,0.68)",
  BORDER: "#222",
  Y: "#FFD500",
  WHITE: "#EDEDE8",
  MUTED: "#777",
  DIM: "#999",
  PINK: "#F472B6",
  TEAL: "#2DD4BF",
  PURPLE: "#A78BFA",
  CORAL: "#FB923C",
  GREEN: "#34D399",
  RED: "#EF4444",
  BLUE: "#60A5FA",
};

const PIN_COLORS = [
  { name: "Yellow", hex: "#FFD500" },
  { name: "Teal", hex: "#2DD4BF" },
  { name: "Purple", hex: "#A78BFA" },
  { name: "Pink", hex: "#F472B6" },
  { name: "Coral", hex: "#FB923C" },
  { name: "Green", hex: "#34D399" },
  { name: "Red", hex: "#EF4444" },
  { name: "Blue", hex: "#60A5FA" },
];

// Cities for the "Focus on" selector. Each entry is [lat, lng, zoom].
const CITIES = [
  { key: "uk", label: "All UK", center: [54.5, -3.0], zoom: 6 },
  { key: "london", label: "London", center: [51.5074, -0.1278], zoom: 11 },
  { key: "heathrow", label: "Heathrow & M4/A4 corridor", center: [51.4800, -0.3500], zoom: 11 },
  { key: "manchester", label: "Manchester", center: [53.4808, -2.2426], zoom: 12 },
  { key: "birmingham", label: "Birmingham", center: [52.4862, -1.8904], zoom: 12 },
  { key: "bristol", label: "Bristol", center: [51.4545, -2.5879], zoom: 12 },
  { key: "cardiff", label: "Cardiff", center: [51.4816, -3.1791], zoom: 12 },
  { key: "glasgow", label: "Glasgow", center: [55.8642, -4.2518], zoom: 12 },
  { key: "edinburgh", label: "Edinburgh", center: [55.9533, -3.1883], zoom: 12 },
  { key: "liverpool", label: "Liverpool", center: [53.4084, -2.9916], zoom: 12 },
  { key: "leeds", label: "Leeds", center: [53.8008, -1.5491], zoom: 12 },
  { key: "sheffield", label: "Sheffield", center: [53.3811, -1.4701], zoom: 12 },
  { key: "brighton", label: "Brighton", center: [50.8225, -0.1372], zoom: 13 },
  { key: "newcastle", label: "Newcastle", center: [54.9783, -1.6178], zoom: 12 },
];

// Heathrow airport centroid + approximate arterial route polylines connecting
// central London to the airport (M4 and A4 corridors plus M25 junction).
const HEATHROW_AIRPORT = { lat: 51.4700, lng: -0.4543, name: "London Heathrow Airport" };
// Heathrow arterial routes are now loaded from warner-sites.json (fetched from
// OSRM at build prep time — actual road-following polylines, ~1000+ points each).
// Fallback waypoints used only if the JSON is missing the routes field.
const HEATHROW_ROUTES_FALLBACK = [
  { name: "M4 corridor", coords: [[51.5150, -0.1750], [51.4920, -0.2282], [51.4935, -0.2785], [51.4940, -0.3720], [51.4905, -0.4296], [51.4843, -0.4520], [51.4700, -0.4543]] },
  { name: "A4 corridor", coords: [[51.5019, -0.1870], [51.4920, -0.2282], [51.4870, -0.3100], [51.4820, -0.3700], [51.4760, -0.4200], [51.4700, -0.4543]] },
  { name: "M25 / airport spur", coords: [[51.4230, -0.5120], [51.4500, -0.4820], [51.4700, -0.4543]] },
];

function esc(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const LOCALSTORAGE_KEY = "madonna-cultural-engine-custom-pins";

const popupStyle = `
  .leaflet-popup-content-wrapper {
    background: ${COLORS.CARD} !important;
    color: ${COLORS.WHITE} !important;
    border: 1px solid ${COLORS.BORDER} !important;
    border-radius: 8px !important;
    box-shadow: 0 4px 24px rgba(0,0,0,0.5) !important;
  }
  .leaflet-popup-tip {
    background: ${COLORS.CARD} !important;
    border: 1px solid ${COLORS.BORDER} !important;
  }
  .leaflet-popup-content {
    margin: 10px 14px !important;
    font-size: 13px !important;
    line-height: 1.6 !important;
  }
  .leaflet-popup-content strong {
    color: ${COLORS.Y};
  }
  .leaflet-popup-close-button {
    color: ${COLORS.MUTED} !important;
  }
`;

export default function StreetArtMap({ murals, venues, sites = {} }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const customMarkersRef = useRef([]);
  const layerGroupsRef = useRef({});   // { murals: LayerGroup, venues: LayerGroup, flyposting: ..., ... }
  const connectionsGroupRef = useRef(null);

  // Custom pin state — loaded from server API (shared across all users)
  const [customPins, setCustomPins] = useState([]);
  const [isPlacingPin, setIsPlacingPin] = useState(false);
  const [pendingPin, setPendingPin] = useState(null); // { lat, lng }
  const [formData, setFormData] = useState({
    title: "",
    address: "",
    description: "",
    color: PIN_COLORS[0].hex,
  });
  const [showForm, setShowForm] = useState(false);
  const [addressSuggestions, setAddressSuggestions] = useState([]);
  const [addressSearching, setAddressSearching] = useState(false);
  const addressTimeout = useRef(null);
  const [activeCity, setActiveCity] = useState("london");

  // Pin layer definitions — each layer renders as its own toggleable LayerGroup.
  // Murals and venues are merged across cities: colour stays consistent per
  // TYPE of location, not per city, and each popup shows the city inline.
  const allMurals = useMemo(() => [
    ...(murals || []).map(m => ({ ...m, _city: m.city || "London" })),
    ...((sites.manchesterMurals || []).map(m => ({ ...m, _city: m._city || m.region || "Manchester" }))),
  ], [murals, sites.manchesterMurals]);
  const allVenues = useMemo(() => [
    ...(venues || []).map(v => ({ ...v, _city: v._city || "London" })),
    ...((sites.manchesterVenues || []).map(v => ({ ...v, _city: v._city || "Manchester" }))),
  ], [venues, sites.manchesterVenues]);

  const LAYERS = useMemo(() => [
    { key: "murals", label: "Murals", color: COLORS.Y, radius: 7, data: allMurals,
      popup: (m) => `<div><strong style="color:${COLORS.Y}">${esc(m.name)}</strong>${m.address ? `<br/><span style="color:${COLORS.MUTED}">${esc(m.address)}</span>` : ""}${m._city || m.postcode ? `<br/><span style="color:${COLORS.MUTED}">${esc(m._city || "")}${m._city && m.postcode ? ", " : ""}${esc(m.postcode || "")}</span>` : ""}${m.description ? `<br/><span style="color:${COLORS.MUTED}">${esc(m.description)}</span>` : ""}</div>` },
    { key: "venues", label: "LGBTQ+ Venues", color: COLORS.PINK, radius: 7, data: allVenues,
      popup: (v) => `<div><strong style="color:${COLORS.PINK}">${esc(v.name)}</strong>${v.address ? `<br/><span style="color:${COLORS.MUTED}">${esc(v.address)}</span>` : ""}${v._city ? `<br/><span style="color:${COLORS.MUTED}">${esc(v._city)}</span>` : ""}</div>` },
    { key: "flyposting", label: "Flyposting Sites", color: COLORS.TEAL, radius: 4, data: sites.flyposting || [],
      popup: (f) => `<div><strong style="color:${COLORS.TEAL}">${esc(f.site)}</strong><br/><span style="color:${COLORS.MUTED}">${esc(f.address || f.region)}</span>${f.postcode ? `<br/><span style="color:${COLORS.MUTED}">${esc(f.postcode)}</span>` : ""}${f.structure ? `<br/><span style="color:${COLORS.MUTED};font-size:10px">${esc(f.structure)}${f.posterSize ? ` · ${esc(f.posterSize)}` : ""}</span>` : ""}</div>` },
    { key: "tube", label: "Tube Station Sites", color: COLORS.BLUE, radius: 8, data: sites.londonUnderground || [],
      popup: (t) => `<div><strong style="color:${COLORS.BLUE}">${esc(t.station)}</strong><br/><span style="color:${COLORS.MUTED}">London Underground</span></div>` },
    { key: "heathrow", label: "Heathrow Corridor", color: COLORS.PURPLE, radius: 8, data: sites.heathrowSites || [],
      popup: (h) => `<div><strong style="color:${COLORS.PURPLE}">${esc(h.name)}</strong>${h.description ? `<br/><span style="color:${COLORS.MUTED}">${esc(h.description)}</span>` : ""}</div>` },
  ], [allMurals, allVenues, sites]);

  const [visibleLayers, setVisibleLayers] = useState(
    () => new Set(["murals", "venues", "flyposting", "tube", "heathrow", "connections", "custom"])
  );
  function toggleLayer(key) {
    setVisibleLayers(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  // Load custom pins from server on mount
  useEffect(() => {
    fetch("/api/map-pins").then(r => r.ok ? r.json() : null).then(d => {
      if (d?.pins) setCustomPins(d.pins);
    }).catch(() => {});
  }, []);

  const venueLinks = useMemo(() => {
    if (!allVenues.length || !allMurals.length) return [];
    return allVenues.map((v) => {
      const { mural, distance } = findNearestMural(v, allMurals);
      return { venue: v, mural, distance };
    });
  }, [allVenues, allMurals]);

  const avgDistance = useMemo(() => {
    if (venueLinks.length === 0) return 0;
    const total = venueLinks.reduce((sum, l) => sum + l.distance, 0);
    return total / venueLinks.length;
  }, [venueLinks]);

  // Map init — runs once. Tile layer only; all marker layers are added below.
  useEffect(() => {
    const L = window.L;
    if (!L || !mapRef.current || mapInstanceRef.current) return;

    const styleEl = document.createElement("style");
    styleEl.textContent = popupStyle;
    document.head.appendChild(styleEl);

    const map = L.map(mapRef.current, {
      center: [51.5074, -0.1278],
      zoom: 11,
      zoomControl: true,
    });
    mapInstanceRef.current = map;

    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
      {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
        subdomains: "abcd",
        maxZoom: 19,
      }
    ).addTo(map);

    return () => {
      styleEl.remove();
      map.remove();
      mapInstanceRef.current = null;
      layerGroupsRef.current = {};
      connectionsGroupRef.current = null;
    };
  }, []);

  // Build / rebuild data layers whenever the source data changes.
  useEffect(() => {
    const L = window.L;
    const map = mapInstanceRef.current;
    if (!L || !map) return;

    LAYERS.forEach((layer) => {
      // Tear down any previous group for this key
      const existing = layerGroupsRef.current[layer.key];
      if (existing) {
        if (map.hasLayer(existing)) map.removeLayer(existing);
        existing.clearLayers();
      }
      const group = L.layerGroup();
      layerGroupsRef.current[layer.key] = group;

      layer.data.forEach((item) => {
        if (item.lat == null || item.lng == null) return;
        const marker = L.circleMarker([item.lat, item.lng], {
          radius: layer.radius,
          fillColor: layer.color,
          color: COLORS.BG,
          weight: 1.5,
          fillOpacity: 0.9,
        });
        marker.bindPopup(layer.popup(item));
        group.addLayer(marker);
      });

      // Heathrow layer gets the airport centroid + arterial route polylines
      if (layer.key === "heathrow") {
        const routes = (sites.heathrowRoutes && sites.heathrowRoutes.length) ? sites.heathrowRoutes : HEATHROW_ROUTES_FALLBACK;
        routes.forEach((route) => {
          const line = L.polyline(route.coords, {
            color: layer.color,
            weight: 3.5,
            opacity: 0.75,
            lineCap: "round",
            lineJoin: "round",
          });
          line.bindPopup(`<div><strong style="color:${layer.color}">${esc(route.name)}</strong><br/><span style="color:${COLORS.MUTED}">Key arterial route to London Heathrow</span></div>`);
          group.addLayer(line);
        });
        // Airport marker — larger, ringed
        const airportOuter = L.circleMarker([HEATHROW_AIRPORT.lat, HEATHROW_AIRPORT.lng], {
          radius: 14, fillColor: layer.color, color: layer.color, weight: 2, fillOpacity: 0.25,
        });
        const airportInner = L.circleMarker([HEATHROW_AIRPORT.lat, HEATHROW_AIRPORT.lng], {
          radius: 7, fillColor: layer.color, color: COLORS.BG, weight: 2, fillOpacity: 1,
        });
        airportInner.bindPopup(`<div><strong style="color:${layer.color}">&#9992; ${esc(HEATHROW_AIRPORT.name)}</strong><br/><span style="color:${COLORS.MUTED}">Five terminals · ~80m passengers/year</span></div>`);
        group.addLayer(airportOuter);
        group.addLayer(airportInner);
      }

      if (visibleLayers.has(layer.key)) group.addTo(map);
    });

    // Connection lines (venue ↔ nearest mural) — own layer
    if (connectionsGroupRef.current) {
      if (map.hasLayer(connectionsGroupRef.current)) map.removeLayer(connectionsGroupRef.current);
      connectionsGroupRef.current.clearLayers();
    }
    const connGroup = L.layerGroup();
    connectionsGroupRef.current = connGroup;
    venueLinks.forEach(({ venue, mural, distance }) => {
      if (!mural) return;
      const line = L.polyline([[venue.lat, venue.lng], [mural.lat, mural.lng]], {
        color: "#FFD50066", weight: 1.5, dashArray: "6 6",
      });
      line.bindPopup(`<div><strong style="color:${COLORS.PINK}">${esc(venue.name)}</strong><span style="color:${COLORS.MUTED}"> &rarr; </span><strong style="color:${COLORS.Y}">${esc(mural.name)}</strong><br/><span style="color:${COLORS.MUTED}">${distance.toFixed(2)} km</span></div>`);
      connGroup.addLayer(line);
    });
    if (visibleLayers.has("connections")) connGroup.addTo(map);
  }, [LAYERS, venueLinks]); // eslint-disable-line react-hooks/exhaustive-deps

  // Respond to layer-toggle changes without rebuilding markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    Object.entries(layerGroupsRef.current).forEach(([key, group]) => {
      if (!group) return;
      const shouldShow = visibleLayers.has(key);
      if (shouldShow && !map.hasLayer(group)) group.addTo(map);
      else if (!shouldShow && map.hasLayer(group)) map.removeLayer(group);
    });
    const cg = connectionsGroupRef.current;
    if (cg) {
      const shouldShow = visibleLayers.has("connections");
      if (shouldShow && !map.hasLayer(cg)) cg.addTo(map);
      else if (!shouldShow && map.hasLayer(cg)) map.removeLayer(cg);
    }
  }, [visibleLayers]);

  // City selector — pan+zoom to chosen city
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    const city = CITIES.find((c) => c.key === activeCity);
    if (!city) return;
    map.flyTo(city.center, city.zoom, { duration: 0.6 });
  }, [activeCity]);

  // Handle map click when placing a pin
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    function onMapClick(e) {
      if (!isPlacingPin) return;
      const { lat, lng } = e.latlng;
      setPendingPin({ lat, lng });
      setFormData((prev) => ({
        ...prev,
        address: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
      }));
      setShowForm(true);
      setIsPlacingPin(false);
      // Change cursor back
      map.getContainer().style.cursor = "";
    }

    map.on("click", onMapClick);
    return () => {
      map.off("click", onMapClick);
    };
  }, [isPlacingPin]);

  // Update cursor when placing pin
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    map.getContainer().style.cursor = isPlacingPin ? "crosshair" : "";
  }, [isPlacingPin]);

  // Render custom pin markers — inside a dedicated layer group so the "Custom Pins" toggle works
  useEffect(() => {
    const L = window.L;
    const map = mapInstanceRef.current;
    if (!L || !map) return;

    // Tear down existing group
    let group = layerGroupsRef.current.custom;
    if (group) {
      if (map.hasLayer(group)) map.removeLayer(group);
      group.clearLayers();
    }
    group = L.layerGroup();
    layerGroupsRef.current.custom = group;
    customMarkersRef.current = [];

    customPins.forEach((pin) => {
      const marker = L.circleMarker([pin.lat, pin.lng], {
        radius: 8,
        fillColor: pin.color,
        color: COLORS.BG,
        weight: 2,
        fillOpacity: 0.9,
      });
      group.addLayer(marker);

      const popupContent = `
        <div>
          <strong style="color:${pin.color}">${pin.title || "Custom Pin"}</strong><br/>
          ${pin.address ? `<span style="color:${COLORS.MUTED};font-size:10px">${pin.address}</span><br/>` : ""}
          ${pin.description ? `<span style="color:${COLORS.MUTED}">${pin.description}</span>` : ""}
          <div style="margin-top:8px;">
            <button
              onclick="window.__deleteCustomPin__('${pin.id}')"
              style="
                background:none;
                border:1px solid ${COLORS.BORDER};
                color:${COLORS.MUTED};
                cursor:pointer;
                font-size:11px;
                padding:2px 8px;
                border-radius:4px;
              "
              onmouseover="this.style.color='${COLORS.WHITE}';this.style.borderColor='${COLORS.MUTED}'"
              onmouseout="this.style.color='${COLORS.MUTED}';this.style.borderColor='${COLORS.BORDER}'"
            >&#x2715; Delete</button>
          </div>
        </div>`;
      marker.bindPopup(popupContent);
      customMarkersRef.current.push(marker);
    });

    if (visibleLayers.has("custom")) group.addTo(map);
  }, [customPins]); // eslint-disable-line react-hooks/exhaustive-deps

  // Render the pending pin (temporary marker while form is open)
  useEffect(() => {
    const L = window.L;
    const map = mapInstanceRef.current;
    if (!L || !map || !pendingPin) return;

    const tempMarker = L.circleMarker([pendingPin.lat, pendingPin.lng], {
      radius: 10,
      fillColor: formData.color,
      color: COLORS.WHITE,
      weight: 2,
      fillOpacity: 0.7,
      dashArray: "4 4",
    }).addTo(map);

    return () => {
      map.removeLayer(tempMarker);
    };
  }, [pendingPin, formData.color]);

  // Expose delete function globally for popup button clicks
  useEffect(() => {
    window.__deleteCustomPin__ = async (id) => {
      try {
        await fetch("/api/map-pins", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "delete", pinId: id }),
        });
      } catch {}
      setCustomPins((prev) => prev.filter((p) => p.id !== id));
    };
    return () => {
      delete window.__deleteCustomPin__;
    };
  }, []);

  // UK address autosuggest via Nominatim (OpenStreetMap, free, no key)
  function searchAddress(query) {
    if (addressTimeout.current) clearTimeout(addressTimeout.current);
    if (!query || query.length < 3) { setAddressSuggestions([]); return; }
    addressTimeout.current = setTimeout(async () => {
      setAddressSearching(true);
      try {
        const params = new URLSearchParams({ q: query, format: "json", addressdetails: "1", limit: "6", countrycodes: "gb" });
        const r = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
          headers: { "User-Agent": "MadonnaCulturalEngine/1.0" },
        });
        if (r.ok) {
          const results = await r.json();
          setAddressSuggestions(results.map(r => ({
            display: r.display_name,
            lat: parseFloat(r.lat),
            lng: parseFloat(r.lon),
          })));
        }
      } catch {}
      setAddressSearching(false);
    }, 400);
  }

  const handleStartPlacing = useCallback(() => {
    setIsPlacingPin(true);
    setShowForm(false);
    setPendingPin(null);
    setFormData({ title: "", address: "", description: "", color: PIN_COLORS[0].hex });
    setAddressSuggestions([]);
  }, []);

  // Start in address-entry mode (no map click needed)
  const handleStartAddressEntry = useCallback(() => {
    setShowForm(true);
    setIsPlacingPin(false);
    setPendingPin(null);
    setFormData({ title: "", address: "", description: "", color: PIN_COLORS[0].hex });
    setAddressSuggestions([]);
  }, []);

  const handleCancelPlacing = useCallback(() => {
    setIsPlacingPin(false);
    setShowForm(false);
    setPendingPin(null);
    setAddressSuggestions([]);
  }, []);

  const handleSavePin = useCallback(async () => {
    if (!pendingPin && !formData.address) return;
    try {
      const r = await fetch("/api/map-pins", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add",
          lat: pendingPin?.lat || 51.515,
          lng: pendingPin?.lng || -0.09,
          title: formData.title,
          address: formData.address,
          description: formData.description,
          color: formData.color,
        }),
      });
      const d = await r.json();
      if (d.ok && d.pin) setCustomPins((prev) => [...prev, d.pin]);
    } catch {}
    setPendingPin(null);
    setShowForm(false);
    setFormData({ title: "", address: "", description: "", color: PIN_COLORS[0].hex });
    setAddressSuggestions([]);
  }, [pendingPin, formData]);

  return (
    <div>
      {/* Section header */}
      <div style={{ marginBottom: 40 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 16,
          }}
        >
          <div
            style={{
              width: 3,
              height: 18,
              background: COLORS.Y,
              borderRadius: 2,
            }}
          />
          <h2
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: COLORS.WHITE,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              margin: 0,
            }}
          >
            Locations Map
          </h2>
        </div>
        <p
          style={{
            fontSize: 14,
            color: COLORS.WHITE,
            lineHeight: 1.75,
            margin: "0 0 12px",
            opacity: 0.85,
          }}
        >
          Murals, LGBTQ+ venues, Warner flyposting sites, London Underground activations, and the Heathrow corridor. Use the city selector to jump between locations and toggle pin types with the controls below.
        </p>

        {/* Add Location buttons */}
        {!isPlacingPin && !showForm && (
          <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={handleStartAddressEntry}
            style={{
              background: COLORS.Y,
              color: COLORS.BG,
              border: "none",
              borderRadius: 6,
              padding: "8px 18px",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              letterSpacing: "0.02em",
              textTransform: "uppercase",
            }}
          >
            + Add Location
          </button>
          <button
            onClick={handleStartPlacing}
            style={{
              background: "none",
              color: COLORS.WHITE,
              border: `1px solid ${COLORS.BORDER}`,
              borderRadius: 6,
              padding: "8px 18px",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              letterSpacing: "0.02em",
              textTransform: "uppercase",
            }}
          >
            Pin on Map
          </button>
          </div>
        )}
        {(isPlacingPin || showForm) && (
          <button
            onClick={handleCancelPlacing}
            style={{
              background: "none",
              color: COLORS.WHITE,
              border: `1px solid ${COLORS.BORDER}`,
              borderRadius: 6,
              padding: "8px 18px",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              letterSpacing: "0.02em",
              textTransform: "uppercase",
            }}
          >
            Cancel
          </button>
        )}
      </div>

      {/* Map controls — city focus + layer toggles */}
      <div style={{
        display: "grid", gridTemplateColumns: "minmax(220px, 260px) 1fr", gap: 12,
        marginBottom: 12, alignItems: "stretch",
      }}>
        <div style={{
          background: COLORS.CARD, border: `1px solid ${COLORS.BORDER}`, borderRadius: 10,
          padding: "12px 14px", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: COLORS.MUTED, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8, fontFamily: "'Inter Tight', system-ui, sans-serif" }}>
            Focus on
          </div>
          <select
            value={activeCity}
            onChange={(e) => setActiveCity(e.target.value)}
            style={{
              width: "100%", padding: "8px 10px", fontSize: 13,
              color: COLORS.WHITE, background: COLORS.BG,
              border: `1px solid ${COLORS.BORDER}`, borderRadius: 6, outline: "none",
              fontFamily: "'Inter Tight', system-ui, sans-serif",
              cursor: "pointer", colorScheme: "dark", boxSizing: "border-box",
            }}
          >
            {CITIES.map((c) => (
              <option key={c.key} value={c.key}>{c.label}</option>
            ))}
          </select>
        </div>
        <div style={{
          background: COLORS.CARD, border: `1px solid ${COLORS.BORDER}`, borderRadius: 10,
          padding: "12px 14px", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: COLORS.MUTED, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8, fontFamily: "'Inter Tight', system-ui, sans-serif" }}>
            Pin layers
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {[
              ...LAYERS.map((l) => ({ key: l.key, label: l.label, color: l.color, count: l.data.length })),
              { key: "connections", label: "Mural ↔ Venue links", color: COLORS.Y, count: venueLinks.filter(v => v.mural).length, dashed: true },
              { key: "custom", label: "Custom Pins", color: COLORS.WHITE, count: customPins.length },
            ].map((l) => {
              const on = visibleLayers.has(l.key);
              return (
                <button
                  key={l.key}
                  type="button"
                  onClick={() => toggleLayer(l.key)}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 7,
                    padding: "5px 10px", fontSize: 11, fontWeight: 700,
                    color: on ? COLORS.WHITE : COLORS.MUTED,
                    background: on ? `${l.color}22` : "transparent",
                    border: `1px solid ${on ? l.color : COLORS.BORDER}`,
                    borderRadius: 999, cursor: "pointer",
                    fontFamily: "'Inter Tight', system-ui, sans-serif",
                    transition: "all 0.15s ease",
                    opacity: on ? 1 : 0.6,
                  }}
                >
                  <span style={{
                    display: "inline-block",
                    width: l.dashed ? 14 : 9, height: l.dashed ? 0 : 9,
                    borderRadius: l.dashed ? 0 : "50%",
                    background: l.dashed ? "transparent" : l.color,
                    borderTop: l.dashed ? `2px dashed ${l.color}` : "none",
                  }} />
                  {l.label}
                  <span style={{
                    fontSize: 9, fontWeight: 700, color: on ? l.color : COLORS.MUTED,
                    padding: "1px 6px", borderRadius: 999,
                    background: on ? `${l.color}22` : "transparent",
                    fontVariantNumeric: "tabular-nums",
                  }}>{l.count}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Banner: click to place pin */}
      {isPlacingPin && (
        <div
          style={{
            background: COLORS.Y,
            color: COLORS.BG,
            textAlign: "center",
            padding: "10px 16px",
            fontSize: 14,
            fontWeight: 700,
            borderRadius: "10px 10px 0 0",
            letterSpacing: "0.02em",
          }}
        >
          Click on the map to place your pin
        </div>
      )}

      {/* Map container */}
      <div
        ref={mapRef}
        style={{
          width: "100%",
          height: "70vh",
          borderRadius: isPlacingPin ? "0 0 10px 10px" : 10,
          overflow: "hidden",
        }}
      />

      {/* Form panel for new pin */}
      {showForm && (
        <div
          style={{
            background: COLORS.CARD,
            border: `1px solid ${COLORS.BORDER}`,
            borderRadius: 10,
            padding: "20px 24px",
            marginTop: 12,
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: COLORS.MUTED,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              marginBottom: 16,
            }}
          >
            New Custom Pin
          </div>

          {/* Title */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: "block", fontSize: 12, color: COLORS.MUTED, marginBottom: 4 }}>Title</label>
            <input type="text" value={formData.title} onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
              style={{ width: "100%", boxSizing: "border-box", background: COLORS.BG, border: `1px solid ${COLORS.BORDER}`, borderRadius: 6, padding: "8px 12px", fontSize: 13, color: COLORS.WHITE, outline: "none" }}
              placeholder="e.g. Camden Market Mural" />
          </div>

          {/* Address with UK autosuggest */}
          <div style={{ marginBottom: 12, position: "relative" }}>
            <label style={{ display: "block", fontSize: 12, color: COLORS.MUTED, marginBottom: 4 }}>Address {addressSearching && <span style={{ color: COLORS.Y, fontSize: 10 }}>searching...</span>}</label>
            <input type="text" value={formData.address}
              onChange={(e) => { setFormData((prev) => ({ ...prev, address: e.target.value })); searchAddress(e.target.value); }}
              style={{ width: "100%", boxSizing: "border-box", background: COLORS.BG, border: `1px solid ${COLORS.BORDER}`, borderRadius: 6, padding: "8px 12px", fontSize: 13, color: COLORS.WHITE, outline: "none" }}
              placeholder="Start typing a UK address..." />
            {addressSuggestions.length > 0 && (
              <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: COLORS.CARD, border: `1px solid ${COLORS.BORDER}`, borderRadius: "0 0 6px 6px", zIndex: 100, maxHeight: 200, overflowY: "auto" }}>
                {addressSuggestions.map((s, i) => (
                  <div key={i} onClick={() => {
                    setFormData(prev => ({ ...prev, address: s.display }));
                    setPendingPin({ lat: s.lat, lng: s.lng });
                    setAddressSuggestions([]);
                    // Pan map to the selected address
                    if (mapInstanceRef.current) mapInstanceRef.current.setView([s.lat, s.lng], 16);
                  }} style={{
                    padding: "8px 12px", fontSize: 11, color: COLORS.WHITE, cursor: "pointer",
                    borderBottom: `1px solid ${COLORS.BORDER}22`,
                  }} onMouseEnter={e => e.currentTarget.style.background = COLORS.BG}
                     onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    {s.display}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Description */}
          <div style={{ marginBottom: 12 }}>
            <label
              style={{
                display: "block",
                fontSize: 12,
                color: COLORS.MUTED,
                marginBottom: 4,
              }}
            >
              Description
            </label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  description: e.target.value,
                }))
              }
              style={{
                width: "100%",
                boxSizing: "border-box",
                background: COLORS.BG,
                border: `1px solid ${COLORS.BORDER}`,
                borderRadius: 6,
                padding: "8px 12px",
                fontSize: 13,
                color: COLORS.WHITE,
                outline: "none",
              }}
              placeholder="What's here?"
            />
          </div>

          {/* Color picker */}
          <div style={{ marginBottom: 16 }}>
            <label
              style={{
                display: "block",
                fontSize: 12,
                color: COLORS.MUTED,
                marginBottom: 6,
              }}
            >
              Pin Color
            </label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {PIN_COLORS.map((c) => (
                <button
                  key={c.hex}
                  onClick={() =>
                    setFormData((prev) => ({ ...prev, color: c.hex }))
                  }
                  title={c.name}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    background: c.hex,
                    border:
                      formData.color === c.hex
                        ? `3px solid ${COLORS.WHITE}`
                        : `3px solid ${COLORS.BG}`,
                    cursor: "pointer",
                    outline: "none",
                    transition: "border-color 0.15s",
                  }}
                />
              ))}
            </div>
          </div>

          {/* Save / Cancel */}
          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={handleSavePin}
              style={{
                background: COLORS.Y,
                color: COLORS.BG,
                border: "none",
                borderRadius: 6,
                padding: "8px 24px",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                letterSpacing: "0.02em",
                textTransform: "uppercase",
              }}
            >
              Save
            </button>
            <button
              onClick={handleCancelPlacing}
              style={{
                background: "none",
                color: COLORS.MUTED,
                border: `1px solid ${COLORS.BORDER}`,
                borderRadius: 6,
                padding: "8px 24px",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                letterSpacing: "0.02em",
                textTransform: "uppercase",
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Stats row — one tile per layer + avg distance */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
        gap: 12,
        marginTop: 20,
      }}>
        {LAYERS.map((l) => (
          <div key={l.key} style={{
            background: COLORS.CARD, border: `1px solid ${COLORS.BORDER}`,
            borderLeft: `3px solid ${l.color}`,
            borderRadius: 8, padding: "12px 16px",
            backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
          }}>
            <div style={{ fontSize: 10, color: COLORS.MUTED, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4, fontFamily: "'Inter Tight', system-ui, sans-serif" }}>
              {l.label}
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: l.color, fontVariantNumeric: "tabular-nums", fontFamily: "'Inter Tight', system-ui, sans-serif" }}>
              {l.data.length.toLocaleString()}
            </div>
          </div>
        ))}
        <div style={{
          background: COLORS.CARD, border: `1px solid ${COLORS.BORDER}`,
          borderLeft: `3px solid ${COLORS.DIM}`,
          borderRadius: 8, padding: "12px 16px",
          backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
        }}>
          <div style={{ fontSize: 10, color: COLORS.MUTED, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4, fontFamily: "'Inter Tight', system-ui, sans-serif" }}>
            Avg venue&rarr;mural
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: COLORS.WHITE, fontVariantNumeric: "tabular-nums", fontFamily: "'Inter Tight', system-ui, sans-serif" }}>
            {avgDistance.toFixed(2)} km
          </div>
        </div>
      </div>
    </div>
  );
}
