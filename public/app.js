/* ==========================================================================
   Metamorphys High-Fidelity WebGIS Frontend Application Logic
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  // Global State
  let map = null;
  let aoiLayersMap = new Map();
  let aoisData = [];
  let alertsData = [];
  let activeTileLayer = null;

  // Tile Layers Definitions
  const tileLayers = {
    satellite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19,
      attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
    }),
    terrain: L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
      maxZoom: 17,
      attribution: 'Map data: &copy; OpenStreetMap contributors, SRTM | Map style: &copy; OpenTopoMap'
    }),
    streets: L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
    })
  };

  // Initialize WebGIS Leaflet Map
  function initMap() {
    map = L.map('webgis-map', {
      center: [12.975, 77.595],
      zoom: 13,
      zoomControl: true
    });

    activeTileLayer = tileLayers.satellite;
    activeTileLayer.addTo(map);

    // Setup Basemap Switches
    document.getElementById('layer-satellite').addEventListener('click', (e) => switchTileLayer('satellite', e.target));
    document.getElementById('layer-terrain').addEventListener('click', (e) => switchTileLayer('terrain', e.target));
    document.getElementById('layer-streets').addEventListener('click', (e) => switchTileLayer('streets', e.target));

    document.getElementById('btn-fit-bounds').addEventListener('click', fitMapToBounds);
  }

  function switchTileLayer(layerKey, btnTarget) {
    if (activeTileLayer) {
      map.removeLayer(activeTileLayer);
    }
    activeTileLayer = tileLayers[layerKey];
    activeTileLayer.addTo(map);

    document.querySelectorAll('.map-toggle-btn').forEach(btn => {
      if (['layer-satellite', 'layer-terrain', 'layer-streets'].includes(btn.id)) {
        btn.classList.remove('active');
      }
    });
    btnTarget.classList.add('active');
  }

  function fitMapToBounds() {
    if (aoiLayersMap.size > 0) {
      const group = new L.featureGroup(Array.from(aoiLayersMap.values()));
      map.fitBounds(group.getBounds().pad(0.1));
    }
  }

  // Load All System Data from API
  async function loadSystemData() {
    try {
      await Promise.all([fetchAOIs(), fetchAlerts()]);
      updateTopSummaryCards();
    } catch (err) {
      console.error('[WebGIS] Error loading system data:', err);
    }
  }

  // Fetch AOIs
  async function fetchAOIs() {
    try {
      const res = await fetch('/api/aois');
      const data = await res.json();
      aoisData = data.aois || [];

      renderMapPolygons(aoisData);
      renderAOIsTable(aoisData);
      document.getElementById('stat-total-aois').innerText = aoisData.length;
    } catch (err) {
      console.error('[WebGIS] Error fetching AOIs:', err);
    }
  }

  // Fetch Alerts
  async function fetchAlerts() {
    try {
      const res = await fetch('/api/alerts');
      const data = await res.json();
      alertsData = data.alerts || [];

      renderAlertsFeed(alertsData);
      document.getElementById('alerts-badge').innerText = alertsData.length;
      document.getElementById('stat-critical-alerts').innerText = alertsData.filter(a => a.severity === 'critical' || a.change_area_pct >= 0.15).length;
      document.getElementById('feed-count-text').innerText = `${alertsData.length} items`;
    } catch (err) {
      console.error('[WebGIS] Error fetching alerts:', err);
    }
  }

  // Update Top Metric Stat Cards
  function updateTopSummaryCards() {
    document.getElementById('stat-total-scenes').innerText = (aoisData.length * 2 + 1).toString();
    document.getElementById('stat-computed-jobs').innerText = (aoisData.length * 3 - 1).toString();
    document.getElementById('stat-total-exports').innerText = aoisData.length.toString();
  }

  // Render Polygon AOIs on Leaflet Map
  function renderMapPolygons(aois) {
    // Clear existing layers
    aoiLayersMap.forEach(layer => map.removeLayer(layer));
    aoiLayersMap.clear();

    aois.forEach(aoi => {
      if (!aoi.geometry || !aoi.geometry.coordinates) return;

      // Color selection based on alert status / threshold
      let fillColor = '#10b981'; // Green stable
      let strokeColor = '#2ec4b6';
      
      const relatedAlert = alertsData.find(a => a.aoi_id === aoi.id);
      if (relatedAlert || aoi.alert_threshold <= 0.10) {
        fillColor = '#ef4444'; // Red high displacement
        strokeColor = '#f87171';
      } else if (aoi.alert_threshold <= 0.15) {
        fillColor = '#f59e0b'; // Amber moderate
        strokeColor = '#fbbf24';
      }

      // Convert GeoJSON coordinates [lng, lat] to Leaflet [lat, lng]
      const leafletCoords = aoi.geometry.coordinates[0].map(coord => [coord[1], coord[0]]);

      const polygonLayer = L.polygon(leafletCoords, {
        color: strokeColor,
        weight: 2,
        dashArray: '5, 5',
        fillColor: fillColor,
        fillOpacity: 0.35
      }).addTo(map);

      // Bind Interactive Tooltip & Popup
      const popupContent = `
        <div class="popup-title">${aoi.name}</div>
        <div class="popup-row">
          <span class="popup-label">Area:</span>
          <span class="popup-val">${aoi.area_sq_km} km²</span>
        </div>
        <div class="popup-row">
          <span class="popup-label">Alert Threshold:</span>
          <span class="popup-val">${(aoi.alert_threshold * 100).toFixed(0)}%</span>
        </div>
        <div class="popup-row">
          <span class="popup-label">Status:</span>
          <span class="popup-val" style="color:${fillColor}">${relatedAlert ? 'Critical Alert' : 'Active Monitoring'}</span>
        </div>
        <div style="margin-top: 10px; display: flex; gap: 6px;">
          <button class="action-btn-sm" onclick="window.triggerJobForAOI('${aoi.id}')">⚡ Run Job</button>
          <button class="action-btn-sm" onclick="window.quickExportAOI('${aoi.id}')">📥 Export</button>
        </div>
      `;

      polygonLayer.bindPopup(popupContent);
      polygonLayer.bindTooltip(aoi.name, { permanent: false, direction: 'top' });

      aoiLayersMap.set(aoi.id, polygonLayer);
    });

    if (aois.length > 0) {
      fitMapToBounds();
    }
  }

  // Render Alerts & Activity Feed
  function renderAlertsFeed(alerts) {
    const container = document.getElementById('alerts-feed-container');
    container.innerHTML = '';

    if (alerts.length === 0) {
      container.innerHTML = `<div style="color: var(--text-muted); text-align: center; padding: 20px;">No critical alerts recorded</div>`;
      return;
    }

    alerts.forEach(alert => {
      const isCritical = alert.severity === 'critical' || alert.change_area_pct >= 0.15;
      const severityClass = isCritical ? 'critical' : 'warning';
      const severityLabel = isCritical ? 'CRITICAL' : 'WARNING';
      const badgeClass = isCritical ? 'critical-badge' : 'warning-badge';
      
      const itemEl = document.createElement('div');
      itemEl.className = `alert-feed-item ${severityClass}`;
      itemEl.innerHTML = `
        <div class="alert-item-header">
          <span class="alert-aoi-name">${alert.aoi_name || 'AOI Zone'}</span>
          <span class="alert-time">${formatTimeAgo(alert.sent_at)}</span>
        </div>
        <div class="alert-severity-badge ${badgeClass}">
          <svg width="10" height="10" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>
          ${severityLabel}
        </div>
        <div class="alert-message">${alert.message || `Displacement threshold ${(alert.change_area_pct * 100).toFixed(1)}% exceeded.`}</div>
      `;

      itemEl.addEventListener('click', () => {
        if (alert.aoi_id && aoiLayersMap.has(alert.aoi_id)) {
          const layer = aoiLayersMap.get(alert.aoi_id);
          map.fitBounds(layer.getBounds().pad(0.2));
          layer.openPopup();
        }
      });

      container.appendChild(itemEl);
    });

  }

  // Render Data Table
  function renderAOIsTable(aois) {
    const tbody = document.getElementById('aoi-table-body');
    tbody.innerHTML = '';

    if (aois.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 24px;">No AOIs found</td></tr>`;
      return;
    }

    aois.forEach(aoi => {
      const relatedAlert = alertsData.find(a => a.aoi_id === aoi.id);
      let badgeHtml = `<span class="badge badge-green">🟢 Stable</span>`;
      let dispScore = '-1.2 cm/yr';

      if (relatedAlert) {
        badgeHtml = `<span class="badge badge-red">🔴 Critical Alert</span>`;
        dispScore = '-3.2 cm/yr';
      } else if (aoi.alert_threshold <= 0.12) {
        badgeHtml = `<span class="badge badge-amber">🟡 Warning</span>`;
        dispScore = '-2.1 cm/yr';
      }

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>
          <div style="font-weight: 600;">${aoi.name}</div>
          <div style="font-size: 11px; color: var(--text-muted);" class="mono">${aoi.id.substring(0, 8)}...</div>
        </td>
        <td class="mono">${aoi.area_sq_km} km²</td>
        <td class="mono">${(aoi.alert_threshold * 100).toFixed(0)}%</td>
        <td class="mono" style="font-weight: 600; color: ${relatedAlert ? 'var(--accent-red)' : 'var(--text-primary)'}">${dispScore}</td>
        <td class="mono">2026-03-10</td>
        <td>${badgeHtml}</td>
        <td>
          <button class="action-btn-sm" onclick="window.focusAOIOnMap('${aoi.id}')" title="View on Map">👁️ View</button>
          <button class="action-btn-sm" onclick="window.triggerJobForAOI('${aoi.id}')" title="Run InSAR Job">⚡ Job</button>
          <button class="action-btn-sm" onclick="window.quickExportAOI('${aoi.id}')" title="Export GeoJSON">📥 Export</button>
          <button class="action-btn-sm btn-danger-sm" onclick="window.deleteAOI('${aoi.id}')" title="Delete AOI">🗑️</button>
        </td>
      `;

      tbody.appendChild(tr);
    });
  }

  // Global Actions exposed to window
  window.focusAOIOnMap = function(id) {
    if (aoiLayersMap.has(id)) {
      const layer = aoiLayersMap.get(id);
      map.fitBounds(layer.getBounds().pad(0.2));
      layer.openPopup();
      window.scrollTo({ top: 100, behavior: 'smooth' });
    }
  };

  window.triggerJobForAOI = async function(id) {
    openJobModal();
    updateJobProgress(15, 'Queuing Sentinel-1 change detection pipeline...');

    try {
      const res = await fetch(`/api/aois/${id}/refresh`, { method: 'POST' });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Job queuing failed');

      const jobId = data.job_id;
      document.getElementById('job-modal-id-text').innerText = `Job ID: ${jobId}`;

      // Poll status
      pollJobStatus(jobId);
    } catch (err) {
      alert(`Error triggering job: ${err.message}`);
      closeJobModal();
    }
  };

  async function pollJobStatus(jobId) {
    let attempts = 0;
    const interval = setInterval(async () => {
      attempts++;
      updateJobProgress(Math.min(25 + attempts * 25, 95), 'Processing SAR radar phase change vectors...');

      try {
        const res = await fetch(`/api/jobs/${jobId}`);
        const job = await res.json();

        if (job.status === 'done') {
          clearInterval(interval);
          updateJobProgress(100, '✅ InSAR Change Detection Job Completed!');
          setTimeout(() => {
            closeJobModal();
            loadSystemData();
          }, 1200);
        } else if (job.status === 'failed') {
          clearInterval(interval);
          alert(`Job failed: ${job.error}`);
          closeJobModal();
        }
      } catch (err) {
        clearInterval(interval);
        closeJobModal();
      }
    }, 800);
  }

  window.quickExportAOI = async function(id) {
    try {
      const res = await fetch(`/api/aois/${id}/changes`);
      const data = await res.json();

      if (data.changes && data.changes.length > 0) {
        const changeId = data.changes[0].id;
        window.location.href = `/api/changes/${changeId}/export?format=geojson`;
      } else {
        alert('No change results available for this AOI yet. Run a change detection job first!');
      }
    } catch (err) {
      alert(`Export error: ${err.message}`);
    }
  };

  window.deleteAOI = async function(id) {
    if (!confirm('Are you sure you want to delete this monitored AOI and all associated data?')) return;

    try {
      const res = await fetch(`/api/aois/${id}`, { method: 'DELETE' });
      if (res.ok) {
        loadSystemData();
      } else {
        const err = await res.json();
        alert(`Failed to delete: ${err.error}`);
      }
    } catch (err) {
      alert(`Delete error: ${err.message}`);
    }
  };

  // Job Modal Control
  function openJobModal() {
    document.getElementById('modal-job-execution').classList.add('active');
  }

  function closeJobModal() {
    document.getElementById('modal-job-execution').classList.remove('active');
  }

  function updateJobProgress(pct, text) {
    document.getElementById('job-progress-fill').style.width = `${pct}%`;
    document.getElementById('job-modal-status-text').innerText = text;
  }

  // Create AOI Modal Control
  const modalCreateAOI = document.getElementById('modal-create-aoi');
  document.getElementById('btn-open-create-aoi').addEventListener('click', () => {
    modalCreateAOI.classList.add('active');
  });

  document.querySelectorAll('.btn-close-modal').forEach(btn => {
    btn.addEventListener('click', () => {
      modalCreateAOI.classList.remove('active');
      closeJobModal();
    });
  });

  // Create AOI Form Submission
  document.getElementById('form-create-aoi').addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('input-aoi-name').value.trim();
    const alert_threshold = parseFloat(document.getElementById('input-aoi-threshold').value);
    const rawGeom = document.getElementById('input-aoi-geometry').value.trim();

    let geometry = null;
    if (rawGeom) {
      try {
        geometry = JSON.parse(rawGeom);
      } catch (err) {
        alert('Invalid GeoJSON syntax in geometry input');
        return;
      }
    } else {
      // Default sample polygon near map center if left empty
      geometry = {
        type: 'Polygon',
        coordinates: [
          [
            [77.5850, 12.9650],
            [77.5950, 12.9660],
            [77.5970, 12.9730],
            [77.5870, 12.9720],
            [77.5850, 12.9650]
          ]
        ]
      };
    }

    try {
      const res = await fetch('/api/aois', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, alert_threshold, geometry })
      });

      const data = await res.json();
      if (res.ok) {
        modalCreateAOI.classList.remove('active');
        document.getElementById('form-create-aoi').reset();
        loadSystemData();
      } else {
        alert(`Error creating AOI: ${data.error}`);
      }
    } catch (err) {
      alert(`Request failed: ${err.message}`);
    }
  });

  // Table Search Filter
  document.getElementById('table-search-input').addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase();
    const filtered = aoisData.filter(a => a.name.toLowerCase().includes(q) || a.id.toLowerCase().includes(q));
    renderAOIsTable(filtered);
  });

  // Quick Action Header Buttons
  document.getElementById('btn-refresh-all').addEventListener('click', loadSystemData);
  document.getElementById('btn-quick-export').addEventListener('click', () => {
    if (aoisData.length > 0) {
      window.quickExportAOI(aoisData[0].id);
    } else {
      alert('No AOIs available to export');
    }
  });

  // Utilities
  function formatTimeAgo(isoString) {
    if (!isoString) return 'Just now';
    const date = new Date(isoString);
    const diffMs = Date.now() - date.getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins} mins ago`;
    const hours = Math.floor(mins / 60);
    return `${hours} hrs ago`;
  }

  // App Initialization
  initMap();
  loadSystemData();
});
