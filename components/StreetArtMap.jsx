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
  CARD: "#151515",
  BORDER: "#222",
  Y: "#FFD500",
  WHITE: "#EDEDE8",
  MUTED: "#777",
  PINK: "#F472B6",
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

export default function StreetArtMap({ murals, venues }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const customMarkersRef = useRef([]);

  // Custom pin state
  const [customPins, setCustomPins] = useState(() => {
    if (typeof window === "undefined") return [];
    try {
      const stored = localStorage.getItem(LOCALSTORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [isPlacingPin, setIsPlacingPin] = useState(false);
  const [pendingPin, setPendingPin] = useState(null); // { lat, lng }
  const [formData, setFormData] = useState({
    address: "",
    description: "",
    color: PIN_COLORS[0].hex,
  });
  const [showForm, setShowForm] = useState(false);

  // Persist custom pins to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(LOCALSTORAGE_KEY, JSON.stringify(customPins));
    } catch {
      // ignore storage errors
    }
  }, [customPins]);

  const venueLinks = useMemo(() => {
    if (!venues || !murals || murals.length === 0) return [];
    return venues.map((v) => {
      const { mural, distance } = findNearestMural(v, murals);
      return { venue: v, mural, distance };
    });
  }, [venues, murals]);

  const avgDistance = useMemo(() => {
    if (venueLinks.length === 0) return 0;
    const total = venueLinks.reduce((sum, l) => sum + l.distance, 0);
    return total / venueLinks.length;
  }, [venueLinks]);

  useEffect(() => {
    const L = window.L;
    if (!L || !mapRef.current || mapInstanceRef.current) return;

    // Inject popup styles
    const styleEl = document.createElement("style");
    styleEl.textContent = popupStyle;
    document.head.appendChild(styleEl);

    const map = L.map(mapRef.current, {
      center: [51.515, -0.09],
      zoom: 12,
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

    // Mural markers
    if (murals) {
      murals.forEach((m) => {
        L.circleMarker([m.lat, m.lng], {
          radius: 8,
          fillColor: COLORS.Y,
          color: COLORS.BG,
          weight: 2,
          fillOpacity: 0.9,
        })
          .addTo(map)
          .bindPopup(
            `<div>
              <strong>${m.name}</strong><br/>
              <span style="color:${COLORS.MUTED}">${m.address}</span><br/>
              <span style="color:${COLORS.MUTED}">${m.city}, ${m.postcode}</span>
            </div>`
          );
      });
    }

    // Venue markers
    if (venues) {
      venues.forEach((v) => {
        L.circleMarker([v.lat, v.lng], {
          radius: 8,
          fillColor: COLORS.PINK,
          color: COLORS.BG,
          weight: 2,
          fillOpacity: 0.9,
        })
          .addTo(map)
          .bindPopup(
            `<div>
              <strong>${v.name}</strong><br/>
              <span style="color:${COLORS.MUTED}">${v.address}</span>
            </div>`
          );
      });
    }

    // Connection lines between each venue and its nearest mural
    venueLinks.forEach(({ venue, mural, distance }) => {
      if (!mural) return;
      const line = L.polyline(
        [
          [venue.lat, venue.lng],
          [mural.lat, mural.lng],
        ],
        {
          color: "#FFD50066",
          weight: 1.5,
          dashArray: "6 6",
        }
      ).addTo(map);
      line.bindPopup(
        `<div>
          <strong style="color:${COLORS.PINK}">${venue.name}</strong>
          <span style="color:${COLORS.MUTED}"> → </span>
          <strong style="color:${COLORS.Y}">${mural.name}</strong><br/>
          <span style="color:${COLORS.MUTED}">${distance.toFixed(2)} km</span>
        </div>`
      );
    });

    // Legend
    const legend = L.control({ position: "bottomright" });
    legend.onAdd = function () {
      const div = L.DomUtil.create("div");
      div.style.cssText = `
        background: ${COLORS.CARD};
        border: 1px solid ${COLORS.BORDER};
        border-radius: 8px;
        padding: 10px 14px;
        font-size: 12px;
        color: ${COLORS.WHITE};
        line-height: 1.8;
      `;
      div.innerHTML = `
        <div style="font-weight:700; margin-bottom:4px; text-transform:uppercase; letter-spacing:0.04em; font-size:11px; color:${COLORS.MUTED}">Legend</div>
        <div style="display:flex; align-items:center; gap:8px;">
          <span style="display:inline-block; width:12px; height:12px; border-radius:50%; background:${COLORS.Y}; border:2px solid ${COLORS.BG};"></span>
          Murals
        </div>
        <div style="display:flex; align-items:center; gap:8px;">
          <span style="display:inline-block; width:12px; height:12px; border-radius:50%; background:${COLORS.PINK}; border:2px solid ${COLORS.BG};"></span>
          Gay Venues
        </div>
        <div style="display:flex; align-items:center; gap:8px;">
          <span style="display:inline-block; width:20px; height:0; border-top:1.5px dashed #FFD50066;"></span>
          <span style="font-size:11px;">Nearest Mural Link</span>
        </div>
      `;
      return div;
    };
    legend.addTo(map);

    return () => {
      styleEl.remove();
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [murals, venues, venueLinks]);

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

  // Render custom pin markers
  useEffect(() => {
    const L = window.L;
    const map = mapInstanceRef.current;
    if (!L || !map) return;

    // Clear old custom markers
    customMarkersRef.current.forEach((m) => map.removeLayer(m));
    customMarkersRef.current = [];

    customPins.forEach((pin) => {
      const marker = L.circleMarker([pin.lat, pin.lng], {
        radius: 8,
        fillColor: pin.color,
        color: COLORS.BG,
        weight: 2,
        fillOpacity: 0.9,
      }).addTo(map);

      const popupContent = `
        <div>
          <strong style="color:${pin.color}">${pin.address || "Custom Pin"}</strong><br/>
          <span style="color:${COLORS.MUTED}">${pin.description || ""}</span>
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
  }, [customPins]);

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
    window.__deleteCustomPin__ = (id) => {
      setCustomPins((prev) => prev.filter((p) => p.id !== id));
    };
    return () => {
      delete window.__deleteCustomPin__;
    };
  }, []);

  const handleStartPlacing = useCallback(() => {
    setIsPlacingPin(true);
    setShowForm(false);
    setPendingPin(null);
    setFormData({ address: "", description: "", color: PIN_COLORS[0].hex });
  }, []);

  const handleCancelPlacing = useCallback(() => {
    setIsPlacingPin(false);
    setShowForm(false);
    setPendingPin(null);
  }, []);

  const handleSavePin = useCallback(() => {
    if (!pendingPin) return;
    const newPin = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      lat: pendingPin.lat,
      lng: pendingPin.lng,
      address: formData.address,
      description: formData.description,
      color: formData.color,
    };
    setCustomPins((prev) => [...prev, newPin]);
    setPendingPin(null);
    setShowForm(false);
    setFormData({ address: "", description: "", color: PIN_COLORS[0].hex });
  }, [pendingPin, formData]);

  const muralCount = murals ? murals.length : 0;
  const venueCount = venues ? venues.length : 0;

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
            London Cultural Map
          </h2>
        </div>
        <p
          style={{
            fontSize: 14,
            color: COLORS.MUTED,
            lineHeight: 1.75,
            margin: "0 0 12px",
          }}
        >
          Murals and LGBTQ+ venues across London. Dotted lines connect each
          venue to its nearest mural location.
        </p>
      </div>

      {/* Map container */}
      <div
        ref={mapRef}
        style={{
          width: "100%",
          height: "70vh",
          borderRadius: 10,
          overflow: "hidden",
        }}
      />

      {/* Stats row */}
      <div
        style={{
          display: "flex",
          gap: 24,
          marginTop: 20,
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            background: COLORS.CARD,
            border: `1px solid ${COLORS.BORDER}`,
            borderRadius: 8,
            padding: "14px 20px",
            flex: 1,
            minWidth: 140,
          }}
        >
          <div
            style={{
              fontSize: 11,
              color: COLORS.MUTED,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              marginBottom: 4,
            }}
          >
            Murals
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: COLORS.Y }}>
            {muralCount}
          </div>
        </div>
        <div
          style={{
            background: COLORS.CARD,
            border: `1px solid ${COLORS.BORDER}`,
            borderRadius: 8,
            padding: "14px 20px",
            flex: 1,
            minWidth: 140,
          }}
        >
          <div
            style={{
              fontSize: 11,
              color: COLORS.MUTED,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              marginBottom: 4,
            }}
          >
            Venues
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: COLORS.PINK }}>
            {venueCount}
          </div>
        </div>
        <div
          style={{
            background: COLORS.CARD,
            border: `1px solid ${COLORS.BORDER}`,
            borderRadius: 8,
            padding: "14px 20px",
            flex: 1,
            minWidth: 140,
          }}
        >
          <div
            style={{
              fontSize: 11,
              color: COLORS.MUTED,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              marginBottom: 4,
            }}
          >
            Avg Distance
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: COLORS.WHITE }}>
            {avgDistance.toFixed(2)} km
          </div>
        </div>
      </div>
    </div>
  );
}
