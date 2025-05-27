// Koordinat pusat Kota Tomohon
const centerCoordinates = [1.3231, 124.8400];
const initialZoom = 12;

// Inisialisasi map
const theMap = L.map('map', {
  zoomControl: false // Akan dipindahkan nanti
}).setView(centerCoordinates, initialZoom);

// Tambahkan beberapa basemap options
const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap contributors'
}).addTo(theMap);

const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
  attribution: '© Esri'
});

const topoLayer = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenTopoMap'
});

// Layer WMS GeoServer: Kerawanan Longsor Kota Tomohon
const overlayTomohon = L.tileLayer.wms('http://localhost:8080/geoserver/ows', {
  layers: 'ne:overlay_kotaTomohon',
  format: 'image/png',
  transparent: true,
  version: '1.3.0',
  attribution: '© GeoServer'
}).addTo(theMap);

// Koleksi layer untuk GetFeatureInfo
const queryableLayers = {
  'ne:overlay_kotaTomohon': overlayTomohon
};

// Menginisialisasi sidebar
const sidebar = L.control.sidebar({
  autopan: true,
  closeButton: true,
  container: 'sidebar',
  position: 'left'
}).addTo(theMap);

// Memindahkan zoom control ke kanan
L.control.zoom({
  position: 'topright'
}).addTo(theMap);

// Menambahkan skala
L.control.scale({
  imperial: false,
  position: 'bottomright'
}).addTo(theMap);

// Menambahkan tombol lokasi pengguna
L.control.locate({
  position: 'topright',
  strings: {
    title: 'Lokasi Saya'
  },
  locateOptions: {
    enableHighAccuracy: true
  }
}).addTo(theMap);

// Fungsi untuk menampilkan koordinat
theMap.on('mousemove', function(e) {
  const coordElement = document.createElement('div');
  coordElement.id = 'coordinateDisplay';
  coordElement.style.cssText = 'position:absolute;bottom:0;left:0;background:rgba(255,255,255,0.8);padding:5px;font-size:12px;z-index:1000;';
  
  document.querySelector('#coordinateDisplay')?.remove();
  coordElement.innerHTML = `Lat: ${e.latlng.lat.toFixed(5)}, Lng: ${e.latlng.lng.toFixed(5)}`;
  document.querySelector('#map').appendChild(coordElement);
});

// Membuat control layer dengan mengelompokkan basemap & overlay
const baseLayers = {
  'OpenStreetMap': osmLayer,
  'Satellite': satelliteLayer,
  'Topographic': topoLayer
};

const overlays = {
  'Kerawanan Longsor Tomohon': overlayTomohon
};

// Fungsi untuk menampilkan basemap di tab settings
function createBasemapControl() {
  const basemapContainer = document.getElementById('basemapControl');
  basemapContainer.innerHTML = '';
  
  // Buat radio button untuk setiap basemap
  let activeBasemap = null;
  
  // Cari basemap yang aktif
  for (const [name, layer] of Object.entries(baseLayers)) {
    if (theMap.hasLayer(layer)) {
      activeBasemap = name;
      break;
    }
  }
  
  // Buat opsi-opsi basemap
  for (const [name, layer] of Object.entries(baseLayers)) {
    const optionDiv = document.createElement('div');
    optionDiv.className = 'basemap-option';
    
    const input = document.createElement('input');
    input.type = 'radio';
    input.name = 'basemap';
    input.id = `basemap-${name}`;
    input.checked = (name === activeBasemap);
    
    input.addEventListener('change', function() {
      // Hapus semua basemap
      for (const baseLayer of Object.values(baseLayers)) {
        theMap.removeLayer(baseLayer);
      }
      // Tambahkan basemap yang dipilih
      theMap.addLayer(layer);
    });
    
    const label = document.createElement('label');
    label.htmlFor = `basemap-${name}`;
    label.textContent = name;
    
    optionDiv.appendChild(input);
    optionDiv.appendChild(label);
    basemapContainer.appendChild(optionDiv);
  }
}

// Menambahkan layer control ke dalam sidebar daripada floating di map
const layerControlContainer = L.DomUtil.get('layersControl');
const layerControlOptions = { collapsed: false };
const layerControl = L.control.layers(null, overlays, layerControlOptions);

// Kontrol layer (via DOM manipulation bukan floating control)
layerControl.addTo(theMap);
const layerControlElement = layerControl.getContainer();
layerControlContainer.appendChild(layerControlElement);

// Inisialisasi basemap control
createBasemapControl();

// Listener untuk tab settings agar memperbarui basemap control saat tab dibuka
sidebar.on('content', function(e) {
  if (e.id === 'settings') {
    createBasemapControl();
  }
});

// Popup request Info (GetFeatureInfo) dengan format yang lebih baik
theMap.on('click', function(e) {
  // Loading indicator
  const popup = L.popup()
    .setLatLng(e.latlng)
    .setContent('<div class="popup-loading">Memuat informasi...</div>')
    .openOn(theMap);
  
  // Temukan semua layer yang aktif dan bisa diquery
  const activeLayers = [];
  Object.keys(queryableLayers).forEach(layerName => {
    if (theMap.hasLayer(queryableLayers[layerName])) {
      activeLayers.push(layerName);
    }
  });
  
  if (activeLayers.length === 0) {
    popup.setContent('<div class="popup-content"><p>Tidak ada layer aktif yang bisa diquery.</p></div>');
    return;
  }
  
  const url = getFeatureInfoUrl(e.latlng, activeLayers);
  
  fetch(url)
    .then(res => res.text())
    .then(html => {
      // Format HTML yang lebih baik
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      
      // Ekstrak informasi dan format ulang
      let formattedContent = '<div class="popup-content">';
      
      // Tambahkan judul
      formattedContent += '<h4>Informasi Lokasi</h4>';
      
      // Extract table content if any
      const tables = doc.querySelectorAll('table');
      if (tables.length) {
        tables.forEach(table => {
          const rows = table.querySelectorAll('tr');
          rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length >= 2) {
              formattedContent += `<div class="popup-attribute">
                <span class="popup-label">${cells[0].textContent}</span>
                <span>${cells[1].textContent}</span>
              </div>`;
            }
          });
        });
      } else {
        // Fallback ke konten asli jika tidak ada tabel
        formattedContent += html;
      }
      
      formattedContent += '</div>';
      popup.setContent(formattedContent);
    })
    .catch(error => {
      popup.setContent(`<div class="popup-content error">Gagal memuat info: ${error.message}</div>`);
    });
});

// Fungsi untuk membangun URL GetFeatureInfo (mendukung multi layer)
function getFeatureInfoUrl(latlng, layers) {
  const point = theMap.latLngToContainerPoint(latlng, theMap.getZoom());
  const size = theMap.getSize();

  const params = {
    request: 'GetFeatureInfo',
    service: 'WMS',
    srs: 'EPSG:32651',
    styles: '',
    transparent: true,
    version: '1.3.0',
    format: 'image/png',
    bbox: theMap.getBounds().toBBoxString(),
    height: size.y,
    width: size.x,
    layers: layers.join(','),
    query_layers: layers.join(','),
    info_format: 'text/html'
  };

  params.i = Math.floor(point.x);
  params.j = Math.floor(point.y);

  return 'http://localhost:8080/geoserver/ows?' + new URLSearchParams(params).toString();
}

// Legend dinamis berdasarkan layer yang aktif
function updateLegend() {
  const legend = document.getElementById('legend');
  legend.innerHTML = ''; // Clear existing legend
  
  // Define legend items for each layer
  const legendItems = {
    'Kerawanan Longsor Tomohon': [
      { label: 'Aman', color: '#38A800' },
      { label: 'Rawan', color: '#FFFF00' },
      { label: 'Tinggi', color: '#FF0000' }
    ]
  };

  // Buat container untuk legend group
  const legendGroup = document.createElement('div');
  legendGroup.className = 'legend-group';
  
  // Menampilkan legend khusus Tomohon jika overlay Tomohon aktif
  if (theMap.hasLayer(overlayTomohon)) {
    const layerHeading = document.createElement('div');
    layerHeading.textContent = 'Kerawanan Longsor Tomohon';
    layerHeading.style.fontWeight = 'bold';
    layerHeading.style.marginTop = '8px';
    legendGroup.appendChild(layerHeading);

    legendItems['Kerawanan Longsor Tomohon'].forEach(item => {
      const itemDiv = document.createElement('div');
      itemDiv.className = 'legend-item';
      
      const colorBox = document.createElement('div');
      colorBox.className = 'legend-color';
      colorBox.style.background = item.color;
      
      const label = document.createElement('span');
      label.textContent = item.label;
      
      itemDiv.appendChild(colorBox);
      itemDiv.appendChild(label);
      legend.appendChild(itemDiv);
    });
  } else {
    const noLayerMsg = document.createElement('div');
    noLayerMsg.textContent = 'Tidak ada layer aktif';
    noLayerMsg.style.fontStyle = 'italic';
    noLayerMsg.style.color = '#777';
    legend.appendChild(noLayerMsg);
  }
}

// Update legend when layers change
theMap.on('overlayadd overlayremove', updateLegend);
updateLegend(); // Initial update

// Opacity slider functionality
document.getElementById('opacitySlider').addEventListener('input', function(e) {
  const opacity = parseFloat(e.target.value);
  Object.values(overlays).forEach(layer => {
    if (layer && theMap.hasLayer(layer)) {
      layer.setOpacity(opacity);
    }
  });
});

// Add fullscreen functionality
const fullscreenButton = L.control({position: 'topright'});
fullscreenButton.onAdd = function() {
  const div = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
  div.innerHTML = '<a href="#" id="fullscreenBtn" title="Tampilan penuh" style="font-size:18px;">⛶</a>';
  return div;
};
fullscreenButton.addTo(theMap);

document.getElementById('fullscreenBtn')?.addEventListener('click', function(e) {
  e.preventDefault();
  
  const mapElem = document.getElementById('map');
  
  if (!document.fullscreenElement) {
    if (mapElem.requestFullscreen) {
      mapElem.requestFullscreen();
    } else if (mapElem.webkitRequestFullscreen) {
      mapElem.webkitRequestFullscreen();
    } else if (mapElem.msRequestFullscreen) {
      mapElem.msRequestFullscreen();
    }
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    } else if (document.msExitFullscreen) {
      document.msExitFullscreen();
    }
  }
});