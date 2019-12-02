const { ipcRenderer } = require('electron');

let gkey = '';
const urlApiG = 'https://maps.googleapis.com/maps/api/geocode/json';

const geojsons = []; // List of geojson files
let map = null;
let dirs = []; // List of addresses
let markers = [];
let values = [];
let count = 0;
let success = 0;

function intersect(geojson, lat, lng) {
    const point = {
        "type": "Feature",
        "properties": {},
        "geometry": {
            "type": "Point",
            "coordinates": [lng, lat]
        }
    };
    for (let obj of geojson.features) {
        try {
            if (turf.intersect(obj, point) != null) {
                return obj;
            }
        } catch (e) {}
    }
    return null;
}

function checkGeojsons() {
    updateLoading();
    loading(true);
    ipcRenderer.send('getGeojsonFiles');
    ipcRenderer.on('getGeojsonFiles-response', (event, result) => {
        for (let f of result.files) {
            try {
                let gjson = require('./geojson/' + f);
                geojsons.push(gjson);
            } catch (e) {}
        }
        map = L.map('map').setView([4.809156, -74.187403], 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap contributors</a>'
        }).addTo(map);
        /*
        // Draw GeoJsons
        for (let geojson of geojsons) {
            L.geoJSON(geojson, {
                style: function(feature) {
                    return { color: '#3b3b3b' };
                }
            }).bindPopup(function(layer) {
                return layer.feature.properties.ESTRATO;
            }).addTo(map);
        }
        */
        loading(false);
    });
}

function getCoords(btaAddress) {
    const adr = encodeURI(btaAddress.replace(/\"|\#/gi, '').trim());
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
                if (data.status == 'OK' && data.results.length > 0) {
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
                }

                let exdata = {};
                for (let geojson of geojsons) {
                    exdata = intersect(geojson, coord.lat, coord.lng);
                }
                let marker = L.marker({ lon: coord.lng, lat: coord.lat }).bindPopup(address).addTo(map);
                map.setView([coord.lat, coord.lng], 16);
                markers.push(marker);
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

window.onload = checkGeojsons;