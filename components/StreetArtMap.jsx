import { useEffect, useRef, useMemo } from "react";

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
