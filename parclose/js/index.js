// ==================== INITIALISATION ====================
document.addEventListener("DOMContentLoaded", async () => {

  // ==================== APERÇU IMAGE ====================
  const imageFileInput = document.getElementById("imageFile");
  const artworkPreview = document.getElementById("artworkPreview");

  imageFileInput?.addEventListener("change", (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      artworkPreview.src = e.target.result;
      artworkPreview.style.display = "block";
    };
    reader.readAsDataURL(file);
  });

  // ==================== MOTS SÉLECTIONNÉS ====================
  function updateGlobalSelectedWords() {
    const allWords = [];
    Object.keys(PAGES || {}).forEach(page => {
      const words = JSON.parse(localStorage.getItem(`selectedWords_${page}`)) || [];
      allWords.push(...words);
    });

    const container = document.getElementById('globalSelectedWords');
    const list = document.getElementById('globalWordsList');
    if (!container || !list) return;

    if (allWords.length === 0) {
      container.style.display = 'none';
      return;
    }

    container.style.display = 'block';
    list.innerHTML = allWords.map(word => `<span class="badge bg-primary text-white me-1">${word}</span>`).join('');
  }

  updateGlobalSelectedWords();
  window.addEventListener('storage', (e) => {
    if (e.key?.startsWith('selectedWords_') || e.key === 'forceGlobalUpdate') {
      updateGlobalSelectedWords();
    }
  });

  // ==================== COMMENTAIRE ÉCRIT ====================
  const editor = document.getElementById('commentEditor');
  if (editor) {
    const saved = localStorage.getItem('commentDraft');
    if (saved && saved.trim() !== '' && saved !== '<br>') editor.innerHTML = saved;

    let timeout;
    editor.addEventListener('input', () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        const content = editor.innerHTML.trim();
        if (content && content !== '<br>') localStorage.setItem('commentDraft', editor.innerHTML);
        else localStorage.removeItem('commentDraft');
      }, 500);
    });

    // ==================== GÉNÉRATION TEXTE ====================
    const generateTextButton = document.getElementById('generateTextButton');
    generateTextButton?.addEventListener('click', () => {
      const textContent = editor.innerText.trim();
      if (!textContent) return alert("Le commentaire est vide !");
      const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = "commentaire.txt";
      link.click();
    });

    // ==================== EXPORT WORD ====================
    const exportWordButton = document.getElementById('exportWordButton');
    exportWordButton?.addEventListener('click', () => {
      const content = editor.innerHTML.trim();
      if (!content) return alert("Le commentaire est vide !");
      const htmlContent = `
        <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
        <head><meta charset="utf-8"><title>Document Word</title></head>
        <body>${content}</body></html>`;
      const blob = new Blob(['\ufeff', htmlContent], { type: 'application/msword' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = "commentaire.doc";
      link.click();
    });
  }

  // ==================== CARTE LEAFLET ====================
  let map = null;
  let geojsonLayer = null;
  const carteMondeModal = document.getElementById('carteMondeModal');
  const countryData = {};
  const isoCorrections = {}; // si besoin de corrections ISO
  const fallbackCountryData = {};
  const capitalFallbacks = {};

  async function loadCountryData() {
    try {
      const res = await fetch('data/countries.json');
      const data = await res.json();
      data.forEach(c => {
        countryData[c.cca2] = {
          flag: c.flags.png,
          languages: Object.values(c.languages).join(', ')
        };
      });
    } catch {
      Object.assign(countryData, fallbackCountryData);
    }
  }

  carteMondeModal?.addEventListener('shown.bs.modal', async () => {
    if (!map) {
      map = L.map('map').setView([20, 0], 2);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18 }).addTo(map);

      await loadCountryData();

      const resGeo = await fetch('data/ne_110m_admin_0_countries.geojson');
      const geoData = await resGeo.json();

      geojsonLayer = L.geoJSON(geoData, {
        style: { color: '#3388ff', weight: 2, fillOpacity: 0.2 },
        onEachFeature: (feature, layer) => {
          const iso = isoCorrections[feature.properties.ISO_A2] || feature.properties.ISO_A2;
          const info = countryData[iso] || fallbackCountryData[iso] || {};
          const languages = info.languages || 'N/A';
          const flag = info.flag || '';
          const capital = capitalFallbacks[iso] || feature.properties.CAPITAL || 'N/A';
          const population = feature.properties.POP_EST ? feature.properties.POP_EST.toLocaleString('fr-FR') : 'N/A';
          const countryName = feature.properties.NAME_FR || feature.properties.ADMIN || 'N/A';

          let popup = `<b>Pays :</b> ${countryName}<br>
                       <b>Capitale :</b> ${capital}<br>
                       <b>Population :</b> ${population}<br>
                       <b>Langue(s) :</b> ${languages}<br>`;
          if (flag) popup += `<img src="${flag}" alt="Drapeau de ${countryName}" style="width:50px;">`;

          layer.bindPopup(popup);
          layer.on({
            click: e => map.fitBounds(e.target.getBounds()),
            mouseover: e => e.target.setStyle({ fillOpacity: 0.5, weight: 3 }),
            mouseout: e => geojsonLayer.resetStyle(e.target)
          });
        }
      }).addTo(map);
    } else map.invalidateSize();
  });

  carteMondeModal?.addEventListener('hidden.bs.modal', () => {
    if (map) {
      map.remove();
      map = null;
      geojsonLayer = null;
    }
  });

  // ==================== AUDIO ====================
  const recordButton = document.getElementById('recordButton');
  const recordingIndicator = document.getElementById('recordingIndicator');
  const recordingConfirmation = document.getElementById('recordingConfirmation');
  const audioPlayback = document.getElementById('audioPlayback');
  const downloadButton = document.getElementById('downloadButton');

  let mediaRecorder, audioChunks = [];

  recordButton?.addEventListener('click', async () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
      return;
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    audioChunks = [];

    mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
    mediaRecorder.onstart = () => {
      recordingIndicator.style.display = 'inline';
      recordingConfirmation.style.display = 'none';
      recordButton.textContent = 'Arrêter l’enregistrement';
    };
    mediaRecorder.onstop = () => {
      recordingIndicator.style.display = 'none';
      recordingConfirmation.style.display = 'inline';
      recordButton.textContent = 'Enregistrer votre commentaire';
      const blob = new Blob(audioChunks, { type: 'audio/wav' });
      audioPlayback.src = URL.createObjectURL(blob);
      window.audioBlob = blob;
    };

    mediaRecorder.start();
  });

  downloadButton?.addEventListener('click', () => {
    if (!window.audioBlob) return alert('Aucun enregistrement disponible');
    const fileName = document.getElementById('fileName').value || 'enregistrement';
    const link = document.createElement('a');
    link.href = URL.createObjectURL(window.audioBlob);
    link.download = `${fileName}.wav`;
    link.click();
  });

});
