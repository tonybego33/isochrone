// Clé API OpenRouteService
const orsAPIKey = "5b3ce3597851110001cf6248bb82b003b23646f9b489a2ef88cef1eb";

let currentIsoLayerFoot = null;
let currentIsoLayerBike = null;
let selectedArret = null;
let isLoading = false;

let allEntreprisesAeroparc = [], allEntreprisesGDBERSOL = [];
let fuseEntreprises, fuseGDBERSOL;

const map = L.map('map').setView([44.83, -0.715], 13);

// Fonds de carte
const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap | Code: Tony Bego'
}).addTo(map);

const satellite = L.tileLayer('https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
  subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
  attribution: 'Google Satellite | Code: Tony Bego'
});

const cartoLight = L.tileLayer('https://cartodb-basemaps-{s}.global.ssl.fastly.net/light_all/{z}/{x}/{y}.png', {
  attribution: '&copy; CartoDB | Code: Tony Bego'
});

L.control.layers({
  "OpenStreetMap": osm,
  "Satellite": satellite,
  "Carto Light": cartoLight
}, null, { position: "bottomleft" }).addTo(map);

// Icônes
const iconTramA = L.icon({ iconUrl: "https://ws-maas.infotbm.com/uploads/network/line/images/65f81cc3efe57_A.svg", iconSize: [24, 24] });
const iconTramB = L.icon({ iconUrl: "https://ws-maas.infotbm.com/uploads/network/line/images/65f81c992e300_B.svg", iconSize: [24, 24] });
const iconTramC = L.icon({ iconUrl: "https://ws-maas.infotbm.com/uploads/network/line/images/65f81c805f048_C.svg", iconSize: [24, 24] });
const iconTramD = L.icon({ iconUrl: "https://ws-maas.infotbm.com/uploads/network/line/images/65f81c4d6e776_D.svg", iconSize: [24, 24] });

const busIcon = L.icon({
  iconUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/fb/Map_pin_icon_green.svg/752px-Map_pin_icon_green.svg.png",
  iconSize: [20, 30],
  iconAnchor: [10, 30],
  popupAnchor: [0, -30]
});

const entrepriseAEROPARCIcon = L.divIcon({ className: "entreprise-AEROPARC-marker", iconSize: [8, 8] });
const entrepriseGDBERSOLIcon = L.divIcon({ className: "entreprise-GDBERSOL-marker", iconSize: [6, 6] });

// Groupes de couches
let layerBus = L.layerGroup();
let layerTramA = L.layerGroup();
let layerTramB = L.layerGroup();
let layerTramC = L.layerGroup();
let layerTramD = L.layerGroup();
let layerEntreprisesAEROPARC;
let layerEntreprisesGDBERSOL;
let layerPistes;
let layerZoneBersol;
let layerZoneAeroparc;

// 💬 Message de zoom
function showZoomMessage() {
  const msg = document.getElementById("zoom-message");
  msg.style.display = "block";
  clearTimeout(msg._timeout);
  msg._timeout = setTimeout(() => {
    msg.style.display = "none";
  }, 2500);
}


// Chargement des arrêts
fetch("arrets_tram_bus.geojson")
  .then(res => res.json())
  .then(data => {
    data.features.forEach(feature => {
      const coords = feature.geometry.coordinates;
      const nom = feature.properties.libelle || "Arrêt";
      const mode = feature.properties.vehicule;
      const ligne = feature.properties.ligne_tram;
      let marker = null;

      if (mode === "BUS") {
        marker = L.marker([coords[1], coords[0]], { icon: busIcon }).bindPopup(nom);
        marker.on("click", () => {
          selectedArret = { lat: coords[1], lon: coords[0] };
          drawIsochrones(coords[1], coords[0]);
        });
        layerBus.addLayer(marker);
      }

      if (mode === "TRAM") {
        let icon = ligne === "A" ? iconTramA : ligne === "B" ? iconTramB : ligne === "C" ? iconTramC : iconTramD;
        marker = L.marker([coords[1], coords[0]], { icon }).bindPopup(`🚋 Tram ${ligne} – ${nom}`);
        marker.on("click", () => {
          selectedArret = { lat: coords[1], lon: coords[0] };
          drawIsochrones(coords[1], coords[0]);
        });
        if (ligne === "A") layerTramA.addLayer(marker);
        if (ligne === "B") layerTramB.addLayer(marker);
        if (ligne === "C") layerTramC.addLayer(marker);
        if (ligne === "D") layerTramD.addLayer(marker);
      }
    });
    updateBusLayerVisibility();
    ["chk-tramA", "chk-tramB", "chk-tramC", "chk-tramD"].forEach((id, i) => {
      const layers = [layerTramA, layerTramB, layerTramC, layerTramD];
      if (document.getElementById(id).checked) map.addLayer(layers[i]);
    });
  });

// ⬇️ Couches conditionnelles par zoom
function updateBusLayerVisibility() {
  const zoom = map.getZoom();
  const checkbox = document.getElementById("chk-bus");
  if (!checkbox.checked) return map.removeLayer(layerBus);
  if (zoom >= 14) {
    map.addLayer(layerBus);
  } else {
    map.removeLayer(layerBus);
    showZoomMessage();
  }
}

function updateEntreprisesLayerVisibility() {
  const zoom = map.getZoom();

  if (layerEntreprisesAEROPARC) {
    if (document.getElementById("chk-aeroparc").checked && zoom >= 14) {
      map.addLayer(layerEntreprisesAEROPARC);
    } else {
      map.removeLayer(layerEntreprisesAEROPARC);
      if (document.getElementById("chk-aeroparc").checked && zoom < 14) showZoomMessage();
    }
  }

  if (layerEntreprisesGDBERSOL) {
    if (document.getElementById("chk-gdbersol").checked && zoom >= 14) {
      map.addLayer(layerEntreprisesGDBERSOL);
    } else {
      map.removeLayer(layerEntreprisesGDBERSOL);
      if (document.getElementById("chk-gdbersol").checked && zoom < 14) showZoomMessage();
    }
  }
}

map.on("zoomend", () => {
  updateBusLayerVisibility();
  updateEntreprisesLayerVisibility();
  updateBikeLayerVisibility();
});


// Pistes cyclables
function updateBikeLayerVisibility() {
  const zoom = map.getZoom();
  const checkbox = document.getElementById("chk-bike");
  if (!checkbox.checked) return map.removeLayer(layerPistes);
  if (layerPistes && zoom >= 13) {
    map.addLayer(layerPistes);
  } else {
    map.removeLayer(layerPistes);
    if (checkbox.checked && zoom < 13) showZoomMessage();
  }
}

fetch("piste_cyclable.geojson")
  .then(res => res.json())
  .then(data => {
    layerPistes = L.geoJSON(data, { style: { color: "#2ca25f", weight: 3 } });
    updateBikeLayerVisibility();
  });

// Chargement entreprises
function renderLayerFromFeatures(features, icon, layerRef, checkboxId) {
  if (layerRef) map.removeLayer(layerRef);
  layerRef = L.geoJSON(features, {
    pointToLayer: (f, latlng) => L.marker(latlng, { icon }),
    onEachFeature: (f, l) => {
      const p = f.properties;
      let popup = `<strong>${p.raison_sociale || "Entreprise"}</strong><br>${p.adresse || ""}`;
      if (p.telephone) popup += `<br>📞 <a href="tel:${p.telephone}">${p.telephone}</a>`;
      if (p.email) popup += `<br>✉️ <a href="mailto:${p.email}">${p.email}</a>`;
      l.bindPopup(popup);
    }
  });
  return layerRef;
}

fetch("entreprisesaeroparc.geojson")
  .then(res => res.json())
  .then(data => {
    allEntreprisesAeroparc = data.features;
    fuseEntreprises = new Fuse(allEntreprisesAeroparc, {
      keys: ["properties.raison_sociale"],
      threshold: 0.3
    });
    layerEntreprisesAEROPARC = renderLayerFromFeatures(allEntreprisesAeroparc, entrepriseAEROPARCIcon, null, "chk-aeroparc");
    updateEntreprisesLayerVisibility();
  });

fetch("entreprisesbersol.geojson")
  .then(res => res.json())
  .then(data => {
    allEntreprisesGDBERSOL = data.features;
    fuseGDBERSOL = new Fuse(allEntreprisesGDBERSOL, {
      keys: ["properties.raison_sociale"],
      threshold: 0.3
    });
    layerEntreprisesGDBERSOL = renderLayerFromFeatures(allEntreprisesGDBERSOL, entrepriseGDBERSOLIcon, null, "chk-gdbersol");
    updateEntreprisesLayerVisibility();
  });

// Recherche entreprise
document.getElementById("search-input").addEventListener("input", e => {
  const query = e.target.value.trim().toLowerCase();

  if (layerEntreprisesAEROPARC) map.removeLayer(layerEntreprisesAEROPARC);
  if (layerEntreprisesGDBERSOL) map.removeLayer(layerEntreprisesGDBERSOL);

  if (!query) {
    layerEntreprisesAEROPARC = renderLayerFromFeatures(allEntreprisesAeroparc, entrepriseAEROPARCIcon, null, "chk-aeroparc");
    layerEntreprisesGDBERSOL = renderLayerFromFeatures(allEntreprisesGDBERSOL, entrepriseGDBERSOLIcon, null, "chk-gdbersol");
    updateEntreprisesLayerVisibility();
    return;
  }

  const resultsAero = fuseEntreprises.search(query).map(r => r.item);
  const resultsBersol = fuseGDBERSOL.search(query).map(r => r.item);
  const allResults = resultsAero.concat(resultsBersol);

  layerEntreprisesAEROPARC = renderLayerFromFeatures(resultsAero, entrepriseAEROPARCIcon, null, "chk-aeroparc");
  layerEntreprisesGDBERSOL = renderLayerFromFeatures(resultsBersol, entrepriseGDBERSOLIcon, null, "chk-gdbersol");

  if (allResults.length > 0) {
    const bounds = L.geoJSON(allResults).getBounds();
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
  }
});


// Zones
fetch("zonebersol.geojson")
  .then(res => res.json())
  .then(data => {
    layerZoneBersol = L.geoJSON(data, {
      style: {
        color: "#34495e",
        weight: 2,
        dashArray: "6,4",
        fillColor: "#95a5a6",
        fillOpacity: 0.1
      }
    });
    if (document.getElementById("chk-bersol-zone").checked) {
      map.addLayer(layerZoneBersol);
    }
  });

fetch("zoneaeroparc.geojson")
  .then(res => res.json())
  .then(data => {
    layerZoneAeroparc = L.geoJSON(data, {
      style: {
        color: "#c0392b",
        weight: 2,
        dashArray: "6,4",
        fillColor: "#e74c3c",
        fillOpacity: 0.1
      }
    });
    if (document.getElementById("chk-aeroparc-zone").checked) {
      map.addLayer(layerZoneAeroparc);
    }
  });

// Filtres de couches
document.getElementById("chk-bus").onchange = updateBusLayerVisibility;
document.getElementById("chk-aeroparc").onchange = updateEntreprisesLayerVisibility;
document.getElementById("chk-gdbersol").onchange = updateEntreprisesLayerVisibility;
document.getElementById("chk-bike").onchange = updateBikeLayerVisibility;

document.getElementById("chk-bersol-zone").onchange = e => toggle(layerZoneBersol, e.target.checked);
document.getElementById("chk-aeroparc-zone").onchange = e => toggle(layerZoneAeroparc, e.target.checked);

// Tramways individuels
["chk-tramA", "chk-tramB", "chk-tramC", "chk-tramD"].forEach((id, idx) => {
  const layer = [layerTramA, layerTramB, layerTramC, layerTramD][idx];
  document.getElementById(id).onchange = e => toggle(layer, e.target.checked);
});

// Tous les trams
document.getElementById("chk-tram").onchange = e => {
  const val = e.target.checked;
  [layerTramA, layerTramB, layerTramC, layerTramD].forEach(l => toggle(l, val));
  ["chk-tramA", "chk-tramB", "chk-tramC", "chk-tramD"].forEach(id => {
    document.getElementById(id).checked = val;
  });
};

// Fonction toggle générique
function toggle(layer, visible) {
  if (!layer) return;
  visible ? map.addLayer(layer) : map.removeLayer(layer);
}
