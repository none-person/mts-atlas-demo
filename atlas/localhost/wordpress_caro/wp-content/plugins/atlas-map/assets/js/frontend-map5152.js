document.addEventListener("DOMContentLoaded", function () {
    let allMarkers = [];
    let map;

    const mapContainer = document.getElementById("atlas-map-container");
    if (!mapContainer || typeof atlasMapAjax === "undefined" || !Array.isArray(atlasMapAjax.projects)) return;

map = L.map("atlas-map-container").setView([37.4747, 57.3310], 8);
fetch("./kerman.geojson")
    .then(response => response.json())
    .then(data => {
        L.geoJSON(data, {
            style: {
                color: '#007bff',
                weight: 2,
                fillColor: '#007bff',
                fillOpacity: 0.3
            }
        }).addTo(map);
    })
    .catch(error => {
        console.error("خطا در بارگذاری نقشه کرمان:", error);
    });


    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors"
    }).addTo(map);

    // ساخت مدال
    const modalHTML = `
        <div id="atlas-modal" class="atlas-modal-overlay"; style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; 
            background: rgba(0,0,0,0.7); z-index: 10000; justify-content:center; align-items:center;">
            <div style="background:#fff; padding:20px; max-width:600px; width:90%; max-height:80%; overflow:auto; position:relative; border-radius:10px;">
                <button id="atlas-close-modal" style="position:absolute; top:10px; right:10px;">✖</button>
                <div id="atlas-modal-content"></div>
            </div>
        </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    const modal = document.getElementById("atlas-modal");
    const modalContent = document.getElementById("atlas-modal-content");
    const closeModal = document.getElementById("atlas-close-modal");

    closeModal.addEventListener("click", () => {
        modal.style.display = "none";
    });

function showModal(html) {
    modalContent.innerHTML = html;
    modal.style.display = "flex";
        modalContent.querySelectorAll("a[target='_blank']").forEach(link => {
        link.addEventListener("click", function (e) {
            e.preventDefault();
            e.stopPropagation();   // جلوی bubbling رو بگیر
            window.open(this.href, "_blank");
            return false;          // جلوی رفتار پیش‌فرض مرورگر رو بگیر
        });
    });

    // پیدا کردن div نقشه داخلی (id باید با prefix popup-map- شروع شود)
    const mapDiv = modalContent.querySelector("[id^='popup-map-']");
    if (mapDiv) {
        const mapId = mapDiv.id;
        const markerData = allMarkers.find(m => m.projectData.html.includes(mapId));
        if (markerData) {
            // حتماً id منحصر به‌فرد لازم داریم وگرنه leaflet خطا میده
            setTimeout(() => {
                if (L.DomUtil.get(mapId) !== null) {
    L.DomUtil.get(mapId)._leaflet_id = null;
}

                const innerMap = L.map(mapId).setView([markerData.projectData.lat, markerData.projectData.lng], 10);
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '&copy; OpenStreetMap contributors'
                }).addTo(innerMap);

                L.marker([markerData.projectData.lat, markerData.projectData.lng]).addTo(innerMap);
            }, 300); // صبر برای رندر DOM
        }
    }
}


    // ساخت مارکرها
    atlasMapAjax.projects.forEach((project) => {
const marker = L.marker([project.lat, project.lng]).addTo(map);

// اگر ID خاصی داری، شرط بگذار
if (project.id === 107) { // جایگزین کن با ID واقعی
    marker._icon.classList.add("hue-red");
}


        const popupContent = document.createElement("div");
popupContent.innerHTML = `
    <div style="text-align: center;">
        <div style="font-weight: bold; margin-bottom: 6px;">${project.title}</div>
        <button class="atlas-details-btn">جزئیات</button>
    </div>
`;

        popupContent.querySelector(".atlas-details-btn").addEventListener("click", () => {
            showModal(project.html);
        });

        marker.bindPopup(popupContent);
        marker.projectData = { ...project }; // تمام فیلدهای ACF در دسترس!
        allMarkers.push(marker);
    });

// دسترسی به فیلترها
const sectorSelect = document.getElementById("filter-sector");
const subsectorSelect = document.getElementById("filter-subsector");

// بارگذاری داینامیک فیلد بخش
if (atlasMapAjax.sectors && Array.isArray(atlasMapAjax.sectors)) {
    atlasMapAjax.sectors.forEach(sector => {
        const option = document.createElement("option");
        option.value = sector;
        option.textContent = sector;
        sectorSelect.appendChild(option);
    });
}

// هنگام تغییر بخش، زیر‌بخش‌های مرتبط را لود کن
sectorSelect.addEventListener("change", function () {
    const selectedSector = this.value;
    const subsectors = atlasMapAjax.subsectorsBySector[selectedSector] || [];

    subsectorSelect.innerHTML = '<option value="">همه</option>';
    subsectors.forEach(sub => {
        const option = document.createElement("option");
        option.value = sub;
        option.textContent = sub;
        subsectorSelect.appendChild(option);
    });
});






const toggleBtn = document.getElementById("atlas-filters-toggle");
const filtersPanel = document.getElementById("atlas-filters-panel");
const closeBtn = document.getElementById("atlas-filters-close");

if (toggleBtn && filtersPanel && closeBtn) {
    toggleBtn.addEventListener("click", () => {
        filtersPanel.classList.add("open");
        toggleBtn.classList.add("hidden"); // دکمه رو مخفی کن
    });

    closeBtn.addEventListener("click", () => {
        filtersPanel.classList.remove("open");
        toggleBtn.classList.remove("hidden"); // دوباره دکمه رو نشون بده
    });

    // کلیک بیرون از پنل برای بستن
    document.addEventListener("click", function (e) {
        if (
            !filtersPanel.contains(e.target) &&
            !toggleBtn.contains(e.target) &&
            filtersPanel.classList.contains("open")
        ) {
            filtersPanel.classList.remove("open");
            toggleBtn.classList.remove("hidden");
        }
    });
}






    // تابع فیلتر مارکرها
function filterMarkers() {
    const filters = {
        suggester: document.getElementById("filter-suggester").value.toLowerCase(),
        sector: document.getElementById("filter-sector").value,
        subsector: document.getElementById("filter-subsector").value,
    };

    allMarkers.forEach(marker => {
        const data = marker.projectData;
        let visible = true;

        // فیلتر بر اساس پیشنهاددهنده (input text)
        if (filters.suggester && (!data.suggester || !data.suggester.toLowerCase().includes(filters.suggester))) {
            visible = false;
        }

        // فیلتر بر اساس بخش
        if (filters.sector && data.sector !== filters.sector) {
            visible = false;
        }

        // فیلتر بر اساس زیر‌بخش
        if (filters.subsector && (!Array.isArray(data.subsectors) || !data.subsectors.includes(filters.subsector))) {
            visible = false;
        }

        if (visible) {
            marker.addTo(map);
        } else {
            map.removeLayer(marker);
        }
    });
}



    // تابع نمایش همه مارکرها
    function showAllMarkers() {
        allMarkers.forEach(marker => {
            marker.addTo(map);
        });

        // ریست فیلترها
        document.getElementById("filter-suggester").value = "";
        document.getElementById("filter-sector").value = "";
        document.getElementById("filter-subsector").value = "";
    }

    // اتصال دکمه‌ها
    document.getElementById("filter-apply").addEventListener("click", filterMarkers);
    document.getElementById("filter-reset").addEventListener("click", showAllMarkers);
});
