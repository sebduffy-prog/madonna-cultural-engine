import { useEffect, useRef, useState, useCallback } from "react";

const COLORS = {
  BG: "#0C0C0C",
  CARD: "rgba(21,21,21,0.68)",
  BORDER: "#222",
  Y: "#FFD500",
  WHITE: "#EDEDE8",
  MUTED: "#777",
  DIM: "#999",
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

const CITIES = [
  { key: "uk", label: "All UK", center: [54.5, -3.0], zoom: 6 },
  { key: "london", label: "London", center: [51.5074, -0.1278], zoom: 11 },
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

function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

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
  .leaflet-popup-close-button {
    color: ${COLORS.MUTED} !important;
  }
`;

export default function StreetArtMap() {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const pinLayerRef = useRef(null);

  const [pins, setPins] = useState([]);
  const [isPlacingPin, setIsPlacingPin] = useState(false);
  const [pendingPin, setPendingPin] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    color: PIN_COLORS[0].hex,
  });
  const [activeCity, setActiveCity] = useState("london");

  useEffect(() => {
    fetch("/api/map-pins")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.pins) setPins(d.pins);
      })
      .catch(() => {});
  }, []);

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
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
        subdomains: "abcd",
        maxZoom: 19,
      }
    ).addTo(map);

    pinLayerRef.current = L.layerGroup().addTo(map);

    // Leaflet sometimes fails to load tiles for parts of the map not visible
    // at init (hidden tab, resize). Nudge it to recompute its viewport.
    const invalidate = () => {
      try { map.invalidateSize(false); } catch {}
    };
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(invalidate) : null;
    if (ro) ro.observe(mapRef.current);
    window.addEventListener("resize", invalidate);
    const timers = [
      requestAnimationFrame(invalidate),
      setTimeout(invalidate, 120),
      setTimeout(invalidate, 400),
      setTimeout(invalidate, 1000),
    ];

    return () => {
      if (ro) ro.disconnect();
      window.removeEventListener("resize", invalidate);
      cancelAnimationFrame(timers[0]);
      timers.slice(1).forEach(clearTimeout);
      styleEl.remove();
      map.remove();
      mapInstanceRef.current = null;
      pinLayerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const L = window.L;
    const map = mapInstanceRef.current;
    const group = pinLayerRef.current;
    if (!L || !map || !group) return;

    group.clearLayers();
    pins.forEach((pin) => {
      const marker = L.circleMarker([pin.lat, pin.lng], {
        radius: 8,
        fillColor: pin.color || COLORS.Y,
        color: COLORS.BG,
        weight: 2,
        fillOpacity: 0.9,
      });
      const popupContent = `
        <div>
          <strong style="color:${pin.color || COLORS.Y}">${esc(pin.title || "Custom Pin")}</strong>
          ${pin.description ? `<br/><span style="color:${COLORS.MUTED}">${esc(pin.description)}</span>` : ""}
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
      group.addLayer(marker);
    });
  }, [pins]);

  useEffect(() => {
    window.__deleteCustomPin__ = async (id) => {
      try {
        await fetch("/api/map-pins", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "delete", pinId: id }),
        });
      } catch {}
      setPins((prev) => prev.filter((p) => p.id !== id));
    };
    return () => {
      delete window.__deleteCustomPin__;
    };
  }, []);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    function onMapClick(e) {
      if (!isPlacingPin) return;
      const { lat, lng } = e.latlng;
      setPendingPin({ lat, lng });
      setShowForm(true);
      setIsPlacingPin(false);
      map.getContainer().style.cursor = "";
    }
    map.on("click", onMapClick);
    return () => {
      map.off("click", onMapClick);
    };
  }, [isPlacingPin]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    map.getContainer().style.cursor = isPlacingPin ? "crosshair" : "";
  }, [isPlacingPin]);

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

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    const city = CITIES.find((c) => c.key === activeCity);
    if (!city) return;
    map.flyTo(city.center, city.zoom, { duration: 0.6 });
  }, [activeCity]);

  const handleStartPlacing = useCallback(() => {
    setIsPlacingPin(true);
    setShowForm(false);
    setPendingPin(null);
    setFormData({ title: "", description: "", color: PIN_COLORS[0].hex });
  }, []);

  const handleCancel = useCallback(() => {
    setIsPlacingPin(false);
    setShowForm(false);
    setPendingPin(null);
  }, []);

  const handleSavePin = useCallback(async () => {
    if (!pendingPin) return;
    try {
      const r = await fetch("/api/map-pins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add",
          lat: pendingPin.lat,
          lng: pendingPin.lng,
          title: formData.title,
          description: formData.description,
          color: formData.color,
        }),
      });
      const d = await r.json();
      if (d.ok && d.pin) setPins((prev) => [...prev, d.pin]);
    } catch {}
    setPendingPin(null);
    setShowForm(false);
    setFormData({ title: "", description: "", color: PIN_COLORS[0].hex });
  }, [pendingPin, formData]);

  return (
    <div>
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
          Drop your own pins on the map. Click + Add Pin, then click anywhere to place a pin and fill in the details. Pins are shared across all users.
        </p>

        {!isPlacingPin && !showForm && (
          <button
            onClick={handleStartPlacing}
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
            + Add Pin
          </button>
        )}
        {(isPlacingPin || showForm) && (
          <button
            onClick={handleCancel}
            style={{
              background: "none",
              color: COLORS.WHITE,
              border: `1px solid ${COLORS.WHITE}`,
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

      <div style={{
        background: COLORS.CARD, border: `1px solid ${COLORS.BORDER}`, borderRadius: 10,
        padding: "12px 14px", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
        marginBottom: 12, maxWidth: 260,
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

      <div
        ref={mapRef}
        style={{
          width: "100%",
          height: "70vh",
          borderRadius: isPlacingPin ? "0 0 10px 10px" : 10,
          overflow: "hidden",
        }}
      />

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
            New Pin
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ display: "block", fontSize: 12, color: COLORS.MUTED, marginBottom: 4 }}>Title</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
              style={{ width: "100%", boxSizing: "border-box", background: COLORS.BG, border: `1px solid ${COLORS.BORDER}`, borderRadius: 6, padding: "8px 12px", fontSize: 13, color: COLORS.WHITE, outline: "none" }}
              placeholder="e.g. Camden Market Mural"
            />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ display: "block", fontSize: 12, color: COLORS.MUTED, marginBottom: 4 }}>Description</label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
              style={{ width: "100%", boxSizing: "border-box", background: COLORS.BG, border: `1px solid ${COLORS.BORDER}`, borderRadius: 6, padding: "8px 12px", fontSize: 13, color: COLORS.WHITE, outline: "none" }}
              placeholder="What's here?"
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 12, color: COLORS.MUTED, marginBottom: 6 }}>Pin Color</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {PIN_COLORS.map((c) => (
                <button
                  key={c.hex}
                  onClick={() => setFormData((prev) => ({ ...prev, color: c.hex }))}
                  title={c.name}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    background: c.hex,
                    border: formData.color === c.hex ? `3px solid ${COLORS.WHITE}` : `3px solid ${COLORS.BG}`,
                    cursor: "pointer",
                    outline: "none",
                    transition: "border-color 0.15s",
                  }}
                />
              ))}
            </div>
          </div>

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
              onClick={handleCancel}
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

      <div
        style={{
          background: COLORS.CARD,
          border: `1px solid ${COLORS.BORDER}`,
          borderLeft: `3px solid ${COLORS.Y}`,
          borderRadius: 8,
          padding: "12px 16px",
          marginTop: 20,
          maxWidth: 200,
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
        }}
      >
        <div style={{ fontSize: 10, color: COLORS.MUTED, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4, fontFamily: "'Inter Tight', system-ui, sans-serif" }}>
          Pins
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, color: COLORS.Y, fontVariantNumeric: "tabular-nums", fontFamily: "'Inter Tight', system-ui, sans-serif" }}>
          {pins.length.toLocaleString()}
        </div>
      </div>
    </div>
  );
}
