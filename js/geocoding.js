let gkey = '';
const urlApiG = 'https://maps.googleapis.com/maps/api/geocode/json';

const geojsons = []; // List of geojson files
let map = L.map('map').setView([4.6097, -74.0817], 13);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

let dirs = []; // List of addresses
let markers = [];
let values = [];
let count = 0;
let success = 0;

// State management
let state = {
    apiKey: '',
    addresses: [],
    results: [],
    currentIndex: 0,
    isProcessing: false,
    geojsons: [] // List of geojson files
};

// DOM Elements
const form = document.getElementById('geocodingForm');
const apiKeyInput = document.getElementById('gapik');
const singleAddressInput = document.getElementById('direccion');
const csvFileInput = document.getElementById('direcciones');
const loadingElement = document.getElementById('loading');
const successCounter = document.getElementById('success');
const totalCounter = document.getElementById('count');
const progressBar = document.querySelector('.progress-bar');
const progressContainer = document.querySelector('.progress');

// Event Listeners
form.addEventListener('submit', handleSubmit);
singleAddressInput.addEventListener('input', () => {
    csvFileInput.value = '';
    csvFileInput.dispatchEvent(new Event('change'));
});
csvFileInput.addEventListener('change', handleFileSelect);

// Load GeoJSON files
async function loadGeojsonFiles() {
    try {
        const result = await window.api.getGeojsonFiles();
        for (const file of result.files) {
            try {
                const response = await fetch(`geojson/${file}`);
                const geojson = await response.json();
                state.geojsons.push(geojson);
            } catch (e) {
                console.error(`Error loading GeoJSON file ${file}:`, e);
            }
        }
    } catch (error) {
        console.error('Error loading GeoJSON files:', error);
    }
}

function intersect(geojson, lat, lng) {
    const point = {
        "type": "Feature",
        "properties": {},
        "geometry": {
            "type": "Point",
            "coordinates": [lng, lat]
        }
    };
    return intersectFeature(geojson, point);
}

function intersectFeature(geojson, geojson2) {
    for (let obj of geojson.features) {
        try {
            if (turf.intersect(obj, geojson2) != null) {
                return obj;
            }
        } catch (e) {
            console.error('Error in intersectFeature:', e);
        }
    }
    return null;
}

function getCoords(btaAddress) {
    const adr = encodeURI(btaAddress.toUpperCase().replace(/\"|\#|\-/gi, ' ').replace(/(\s)([A-Z])(\s)/gi, '$2$3').trim());
    const url = urlApiG + '?address=' + adr + ',bogotá&components=locality:bogota|country:CO&key=' + gkey;
    return promise = new Promise(function(resolve, reject) {
        const xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange = function() {
            if (this.readyState == 4 && this.status == 200) {
                let data = JSON.parse(this.responseText);
                coord = {
                    lat: 0,
                    lng: 0
                };
                address = '';
                neighborhood = '';
                sublocality = '';
                postalcode = '';
                let exdata = {};
                if (data.status == 'OK' && data.results.length > 0) {
                    console.log(data.results);
                    coord = data.results[0].geometry.location;
                    address = data.results[0].formatted_address;
                    for (let d of data.results[0].address_components) {
                        if (d.types.includes('neighborhood')) {
                            neighborhood = d.long_name;
                        }
                        if (d.types.includes('sublocality')) {
                            sublocality = d.long_name;
                        }
                        if (d.types.includes('postal_code')) {
                            postalcode = d.long_name;
                        }
                    }
                    for (let geojson of state.geojsons) {
                        exdata = intersect(geojson, coord.lat, coord.lng);
                        console.log('Primer intento:', exdata);

                        if (exdata == null) {
                            let buffered = turf.buffer(turf.point([coord.lng, coord.lat]), 0.05, { units: 'kilometers' });
                            exdata = intersectFeature(geojson, buffered);
                            console.log('Segundo intento:', exdata);
                            if (exdata !== null) {
                                drawGeoJSON(buffered);
                            }
                        }
                        if (exdata != null) {
                            drawGeoJSON(exdata);
                        }
                    }
                    let marker = L.marker({ lon: coord.lng, lat: coord.lat }).bindPopup(address).addTo(map);
                    map.setView([coord.lat, coord.lng], 16);
                    markers.push(marker);
                }

                success++;
                updateLoading();
                resolve({
                    st: true,
                    btaAddress,
                    coord,
                    address,
                    neighborhood,
                    sublocality,
                    postalcode,
                    data: exdata !== null && exdata.properties ? exdata.properties : null
                });
            }
        };
        xhttp.open("GET", url, true);
        xhttp.send();
    });
}

function drawGeoJSON(json) {
    let feature = L.geoJSON(json, {
        style: function(feature) {
            return { color: '#3b3b3b' };
        }
    }).addTo(map);
    markers.push(feature);
}

function setResponse(titulo, lat, long, barrio, localidad, codigopostal, mas) {
    document.getElementById('titulo').innerHTML = titulo;
    document.getElementById('lat').innerHTML = lat;
    document.getElementById('long').innerHTML = long;
    document.getElementById('barrio').innerHTML = barrio;
    document.getElementById('localidad').innerHTML = localidad;
    document.getElementById('codigopostal').innerHTML = codigopostal;
    let html = '';
    for (let k in mas) {
        html += '<div style="padding-left:20px;"><b>' + k + ':<b>' + mas[k] + '</div>';
    }
    document.getElementById('mas').innerHTML = html;
}

function run() {
    const dir = document.getElementById('direccion').value;
    if (dirs.length > 0 || dir.length > 0) {
        loading(true);
        gkey = document.getElementById('gapik').value;
        setResponse('', '', '', '', '', '', '');
        for (let m of markers) {
            map.removeLayer(m);
        }
        values = [];
        if (dirs.length > 0) {
            showInfo(false);
            let promises = [];
            count = dirs.length;
            success = 0;
            updateLoading();
            for (let address of dirs) {
                promises.push(getCoords(address));
            }
            Promise.all(promises).then(result => {
                dirs = [];
                values = result;
                let group = new L.featureGroup(markers);
                map.fitBounds(group.getBounds());
                document.getElementById('direcciones').value = '';
                loading(false);
            });
        } else {
            showInfo(true);
            getCoords(dir).then(function(response) {
                setResponse(
                    response.address,
                    response.coord.lat,
                    response.coord.lng,
                    response.neighborhood,
                    response.sublocality,
                    response.postalcode,
                    response.data
                );
                loading(false);
            }, function(error) {
                console.error("Failed!", error);
            });
        }
    } else {
        alert('Ingrese una dirección o un archivo CSV.');
    }
}

function loading(show) {
    if (show) {
        document.getElementById('loading').style.display = 'block';
    } else {
        document.getElementById('loading').style.display = 'none';
    }
}

function updateLoading() {
    document.getElementById('count').innerHTML = count;
    document.getElementById('success').innerHTML = success;
}

function showInfo(show) {
    if (show) {
        document.getElementById('download').style.display = 'none';
        document.getElementById('info').style.display = 'block';
    } else {
        document.getElementById('download').style.display = 'block';
        document.getElementById('info').style.display = 'none';
    }
}

function onChangeInput(e) {
    document.getElementById('direccion').value = '';
    const files = e.target.files;
    if (files.length > 0) {
        this.fileToUpload = files.item(0);
        const reader = new FileReader();
        reader.onload = function() {
            dirs = processData(reader.result);
        };
        reader.readAsText(this.fileToUpload);
    }
}

function processData(allText) {
    let record_num = 1; // or however many elements there are in each row
    let allTextLines = allText.split(/\r\n|\n/);
    let lines = [];
    for (let r of allTextLines) {
        let d = r;
        if (d.length) {
            lines.push(d);
        }
    }
    return lines;
}

function download_csv(csv, filename) {
    let csvFile;
    let downloadLink;

    // CSV FILE
    csvFile = new Blob([csv], {
        type: 'text/csv'
    });

    // Download link
    downloadLink = document.createElement('a');

    // File name
    downloadLink.download = filename;

    // We have to create a link to the file
    downloadLink.href = window.URL.createObjectURL(csvFile);

    // Make sure that the link is not displayed
    downloadLink.style.display = 'none';

    // Add the link to your DOM
    document.body.appendChild(downloadLink);

    // Lanzamos
    downloadLink.click();
}

function export_to_csv(filename) {
    const csv = [
        ['Address', 'Normalized address', 'Latitude', 'Longitude', 'Neighborhood', 'postalcode', 'sublocality']
    ];

    for (let v of values) {
        const row = [];
        row.push(v.btaAddress.replace(/\,/gi, ' -'));
        row.push(v.address.replace(/\,/gi, ' -'));
        row.push(v.coord.lat);
        row.push(v.coord.lng);
        row.push(v.neighborhood);
        row.push(v.postalcode);
        row.push(v.sublocality);
        for (let d in v.data) {
            if (v.data.hasOwnProperty(d)) {
                row.push(d + ':' + v.data[d]);
            }
        }
        csv.push(row.join(','));
    }

    // Download CSV
    download_csv(csv.join('\n'), filename);
}

function download() {
    export_to_csv('result.csv');
}

// Form validation
function validateForm() {
    let isValid = true;
    const apiKey = apiKeyInput.value.trim();
    const singleAddress = singleAddressInput.value.trim();
    const csvFile = csvFileInput.files[0];

    if (!apiKey) {
        showError('gapikError', 'API key is required');
        isValid = false;
    } else {
        hideError('gapikError');
    }

    if (!singleAddress && !csvFile) {
        showError('direccionError', 'Either single address or CSV file is required');
        showError('direccionesError', 'Either single address or CSV file is required');
        isValid = false;
    } else {
        hideError('direccionError');
        hideError('direccionesError');
    }

    return isValid;
}

function showError(elementId, message) {
    const errorElement = document.getElementById(elementId);
    errorElement.textContent = message;
    errorElement.style.display = 'block';
}

function hideError(elementId) {
    const errorElement = document.getElementById(elementId);
    errorElement.style.display = 'none';
}

// File handling
async function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file) {
        try {
            const text = await file.text();
            state.addresses = text.split('\n')
                .map(line => line.trim())
                .filter(line => line.length > 0);
            singleAddressInput.value = '';
            hideError('direccionesError');
        } catch (error) {
            showError('direccionesError', 'Error reading CSV file');
            console.error('Error reading file:', error);
        }
    }
}

// Form submission
async function handleSubmit(event) {
    event.preventDefault();
    
    if (!validateForm()) {
        return;
    }

    state.apiKey = apiKeyInput.value.trim();
    state.results = [];
    state.currentIndex = 0;
    state.isProcessing = true;

    if (singleAddressInput.value.trim()) {
        state.addresses = [singleAddressInput.value.trim()];
    }

    showLoading();
    try {
        await processAddresses();
    } catch (error) {
        console.error('Error processing addresses:', error);
        alert(`Error: ${error.message}`);
    } finally {
        hideLoading();
    }
}

// Geocoding process
async function processAddresses() {
    const total = state.addresses.length;
    totalCounter.textContent = total;
    progressContainer.style.display = 'block';

    for (let i = 0; i < total; i++) {
        if (!state.isProcessing) break;

        state.currentIndex = i;
        const address = state.addresses[i];
        
        try {
            const result = await geocodeAddress(address);
            state.results.push(result);
            updateProgress(i + 1, total);
            updateMap(result);
            updateInfo(result);
        } catch (error) {
            console.error(`Error geocoding address "${address}":`, error);
            state.results.push({ 
                address, 
                error: error.message,
                status: 'error'
            });
        }
    }

    showDownloadButton();
}

// Geocoding function
async function geocodeAddress(address) {
    try {
        const encodedAddress = encodeURIComponent(address + ', Bogotá, Colombia');
        const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${state.apiKey}`;
        
        console.log('Geocoding URL:', url);
        
        const response = await fetch(url);
        const data = await response.json();

        console.log('Geocoding response:', data);

        if (data.status === 'ZERO_RESULTS') {
            throw new Error('No results found for this address');
        }
        
        if (data.status === 'OVER_QUERY_LIMIT') {
            throw new Error('Google API quota exceeded. Please try again later.');
        }
        
        if (data.status === 'REQUEST_DENIED') {
            throw new Error('Invalid API key or API key not authorized');
        }
        
        if (data.status === 'INVALID_REQUEST') {
            throw new Error('Invalid address format');
        }
        
        if (data.status !== 'OK') {
            throw new Error(`Geocoding failed: ${data.status} - ${data.error_message || 'Unknown error'}`);
        }

        const result = data.results[0];
        const location = result.geometry.location;

        // Check intersections with GeoJSON files
        let intersectionData = null;
        for (const geojson of state.geojsons) {
            const intersection = intersect(geojson, location.lat, location.lng);
            if (intersection) {
                intersectionData = intersection.properties;
                break;
            }
        }

        // Extract address components
        const components = {};
        for (const component of result.address_components) {
            for (const type of component.types) {
                components[type] = component.long_name;
            }
        }

        return {
            address,
            location: result.geometry.location,
            formatted_address: result.formatted_address,
            components,
            place_id: result.place_id,
            intersection_data: intersectionData,
            raw_response: data // Include raw response for debugging
        };
    } catch (error) {
        console.error('Geocoding error details:', error);
        throw error;
    }
}

// UI updates
function showLoading() {
    loadingElement.style.display = 'block';
    state.isProcessing = true;
}

function hideLoading() {
    loadingElement.style.display = 'none';
    state.isProcessing = false;
}

function updateProgress(current, total) {
    const percentage = (current / total) * 100;
    progressBar.style.width = `${percentage}%`;
    successCounter.textContent = current;
}

function updateMap(result) {
    const { lat, lng } = result.location;
    L.marker([lat, lng])
        .bindPopup(result.formatted_address)
        .addTo(map);
    map.setView([lat, lng], 13);
}

function showDownloadButton() {
    document.getElementById('download').style.display = 'block';
}

// Update info panel with geocoding results
function updateInfo(result) {
    if (result.error) {
        document.getElementById('titulo').textContent = 'Error';
        document.getElementById('lat').textContent = 'N/A';
        document.getElementById('long').textContent = 'N/A';
        document.getElementById('barrio').textContent = 'N/A';
        document.getElementById('localidad').textContent = 'N/A';
        document.getElementById('codigopostal').textContent = 'N/A';
        document.getElementById('mas').textContent = result.error;
        return;
    }

    document.getElementById('titulo').textContent = result.formatted_address;
    document.getElementById('lat').textContent = result.location.lat;
    document.getElementById('long').textContent = result.location.lng;
    document.getElementById('barrio').textContent = result.components.neighborhood || 'N/A';
    document.getElementById('localidad').textContent = result.components.sublocality || 'N/A';
    document.getElementById('codigopostal').textContent = result.components.postal_code || 'N/A';
    
    let additionalInfo = '';
    if (result.intersection_data) {
        additionalInfo += '<h6>Intersection Data:</h6>';
        for (const [key, value] of Object.entries(result.intersection_data)) {
            additionalInfo += `<div><strong>${key}:</strong> ${value}</div>`;
        }
    }
    document.getElementById('mas').innerHTML = additionalInfo || 'No additional data';
}

// Initialize the application
window.onload = async function() {
    // Clear any existing map layers
    map.eachLayer((layer) => {
        map.removeLayer(layer);
    });
    
    // Reinitialize the map
    map.setView([4.6097, -74.0817], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    // Load GeoJSON files
    await loadGeojsonFiles();
};