mapboxgl.accessToken = 'pk.eyJ1IjoiZW5lcmd5LXN1c3RhaW5hYmlsaXR5IiwiYSI6ImNsMW90NXdkbjA3b3MzZG1tN3c5bnByaHMifQ.qLik89SH6k3mWb2smnaKOw';

var map = new mapboxgl.Map({
    container: 'map',
    // style: 'mapbox://styles/mapbox/streets-v11',
    style: 'mapbox://styles/mapbox/satellite-streets-v12',
    center: [140.11, 36.07],
    zoom: 14
});

var draw = new MapboxDraw({
    userProperties: true,
    displayControlsDefault: false,
    controls: {
        point: true,
        polygon: true,
        trash: true
    }
});

let currentGroup = "wind";
function setCurrentGroup(group) {
    currentGroup = group;
}

map.addControl(draw, 'top-right');

map.on('draw.create', addGroupAttribute);
map.on('draw.delete', updateAreas);
map.on('draw.update', updateAreas);

function addGroupAttribute(e) {
    var feature = e.features[0];
    var featureId = e.features[0].id;
    draw.setFeatureProperty(featureId, 'group', currentGroup);

    // Wind circle
    if (feature.geometry.type === 'Point' && currentGroup === "wind") {
        var buffered = turf.buffer(feature, 0.25, { units: 'kilometers' });
        draw.add(buffered);
    }

    updateAreas();
}

function updateAreas() {
    var data = draw.getAll();
    var area_wind = 0;
    var area_solar = 0;
    var capacity_wind = 0;
    var capacity_solar = 0;

    // Parameters
    let area_wind_turbine = 0.2 // km2/MW
    let cap_wind_turbine = 4 // MW
    let cap_wind = 20 // MW/km2
    let cap_solar = 30
    let cf_wind = 0.3
    let cf_solar = 0.17
    let cost_wind = 347 // M-JPY/MW
    let cost_solar = 208
    let eco_loss_wind = 0.01
    let eco_loss_solar = 0

    if (data.features.length > 0) {
        data.features.forEach(function(feature) {
            if (feature.properties.group === "wind" && feature.geometry.type === 'Point') {
                capacity_wind += cap_wind_turbine
                area_wind += area_wind_turbine;
            } else if (feature.properties.group === "wind" && feature.geometry.type === 'Polygon') {
                capacity_wind += turf.area(feature)/1000000*cap_wind - turf.area(feature)/1000000*cap_wind % cap_wind_turbine;
                area_wind += turf.area(feature) / 1000000;
            } else if (feature.properties.group === "solar") {
                capacity_solar += turf.area(feature)/1000000*cap_solar            
                area_solar += turf.area(feature) / 1000000;
            }
        });
    }

    document.getElementById('area_wind').innerText = area_wind.toFixed(2);
    document.getElementById('area_solar').innerText = area_solar.toFixed(2);
    document.getElementById('capacity_wind').innerText = capacity_wind.toFixed(2);
    document.getElementById('capacity_solar').innerText = capacity_solar.toFixed(2);
    document.getElementById('generation_wind').innerText = (capacity_wind/1000*8760*cf_wind).toFixed(2);
    document.getElementById('generation_solar').innerText = (capacity_solar/1000*8760*cf_solar).toFixed(2);
    document.getElementById('invest_wind').innerText = (capacity_wind*cost_wind).toFixed(0);
    document.getElementById('invest_solar').innerText = (capacity_solar*cost_solar).toFixed(0);
    document.getElementById('eco_wind').innerText = (capacity_wind*eco_loss_wind).toFixed(0);
    document.getElementById('eco_solar').innerText = (capacity_solar*eco_loss_solar).toFixed(0)
}

// Add Geojson layers
// const layers = {
//     'solar_REPOS': '../json/solar_REPOS.json',
//     'wind_2013': '../json/wind_point_2013.geojson'
// };

// map.on('load', () => {
//     for (const layer in layers) {
//         map.addSource(layer, {
//             type: 'geojson',
//             data: layers[layer]
//         });

//         map.addLayer({
//             id: layer,
//             type: 'fill',
//             source: layer,
//             layout: { 'visibility': 'none' },
//             paint: {
//                 'fill-color': '#888888',
//                 'fill-opacity': 0.5
//             }
//         });
//     }

//     document.getElementById('layer-select').addEventListener('change', (event) => {
//         const selectedLayer = event.target.value;

//         for (const layer in layers) {
//             if (layer === selectedLayer) {
//                 map.setLayoutProperty(layer, 'visibility', 'visible');
//             } else {
//                 map.setLayoutProperty(layer, 'visibility', 'none');
//             }
//         }
//     });
// });

map.on('load', () => {
    const layers = map.getStyle().layers;
    // Find the index of the first symbol layer in the map style
    let firstSymbolId;
    for (const layer of layers) {
    if (layer === 'symbol') {
    firstSymbolId = layer.id;
    break;
    }
    }
     
    map.addSource('urban-areas', {
    'type': 'geojson',
    'data': '../json/wind_point_2013.geojson'
    });
    map.addLayer(
    {
    'id': 'urban-areas-fill',
    'type': 'fill',
    'source': 'urban-areas',
    'layout': {},
    'paint': {
    'fill-color': '#f08',
    'fill-opacity': 0.4
    }
    // This is the important part of this example: the addLayer
    // method takes 2 arguments: the layer as an object, and a string
    // representing another layer's name. if the other layer
    // exists in the stylesheet already, the new layer will be positioned
    // right before that layer in the stack, making it possible to put
    // 'overlays' anywhere in the layer stack.
    // Insert the layer beneath the first symbol layer.
    },
    firstSymbolId
    );
});

// Utility
document.getElementById('reset').onclick = function() {
    draw.deleteAll();
    updateAreas();
};

document.getElementById('export').onclick = function() {
    const data = draw.getAll();
    if (data.features.length > 0) {
        const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'MILUS_landuse.geojson';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } else {
        alert('No features to export');
    }
};

function changeColor(clickedButton) {
    // 全てのボタンを取得
    const buttons = document.querySelectorAll('.group-selector');
    // 各ボタンのクラスをリセット
    buttons.forEach(button => {
        button.classList.remove('active');
    });
    // クリックされたボタンにクラスを追加
    clickedButton.classList.add('active');
}

function toggleSection(sectionId) {
    const section = document.getElementById(sectionId);
    const button = section.previousElementSibling.querySelector('button');

    if (section.classList.contains('hidden')) {
        section.classList.remove('hidden');
        section.style.maxHeight = section.scrollHeight + "px";
        button.textContent = '−';
    } else {
        section.style.maxHeight = 0;
        section.classList.add('hidden');
        button.textContent = '＋';
    }
}


// styles: [
//     {
//         "id": "gl-draw-polygon-fill-inactive",
//         "type": "fill",
//         "filter": ['all', ['==', 'active', 'false'],
//                 ['==', '$type', 'Polygon'],
//                 ['!=', 'mode', 'static']],
//         "paint": {
//             "fill-color": ["case",
//                 ['==', ['get', "group"], 1], "#00FF00", // Group 1: green
//                 ['==', ['get', "group"], 2], "#0000FF", // Group 2: blue
//                 "#FF0000" // Default: red
//             ],
//             "fill-outline-color": "#000000",
//             "fill-opacity": 0.5
//         }
//     },
//     {
//         "id": "gl-draw-polygon-fill-active",
//         "type": "fill",
//         "filter": ['all', ['==', 'active', 'true'],
//                 ['==', '$type', 'Polygon'],
//                 ['!=', 'mode', 'static']],
//         "paint": {
//             "fill-color": ["case",
//                 ["==", ["get", "group"], 1], "#00FF00", // Group 1: green
//                 ["==", ["get", "group"], 2], "#0000FF", // Group 2: blue
//                 "#FF0000" // Default: red
//             ],
//             "fill-outline-color": "#000000",
//             "fill-opacity": 0.2
//         }
//     },    
//     {
//         'id': 'gl-draw-polygon-midpoint',
//         'type': 'circle',
//         'filter': ['all', ['==', '$type', 'Point'],
//             ['==', 'meta', 'midpoint']
//         ],
//         'paint': {
//             'circle-radius': 3,
//             'circle-color': '#fbb03b'
//         }
//     },
//     {
//         'id': 'gl-draw-polygon-stroke-inactive',
//         'type': 'line',
//         'filter': ['all', ['==', 'active', 'false'],
//             ['==', '$type', 'Polygon'],
//             ['!=', 'mode', 'static']
//         ],
//         'layout': {
//             'line-cap': 'round',
//             'line-join': 'round'
//         },
//         'paint': {
//             'line-color': '#000',
//             'line-width': 1
//         }
//     },
//     {
//         'id': 'gl-draw-polygon-stroke-active',
//         'type': 'line',
//         'filter': ['all', ['==', 'active', 'true'],
//             ['==', '$type', 'Polygon']
//         ],
//         'layout': {
//             'line-cap': 'round',
//             'line-join': 'round'
//         },
//         'paint': {
//             'line-color': '#fbb03b',
//             'line-dasharray': [0.2, 2],
//             'line-width': 2
//         }
//     },
//     {
//         'id': 'gl-draw-line-inactive',
//         'type': 'line',
//         'filter': ['all', ['==', 'active', 'false'],
//             ['==', '$type', 'LineString'],
//             ['!=', 'mode', 'static']
//         ],
//         'layout': {
//             'line-cap': 'round',
//             'line-join': 'round'
//         },
//         'paint': {
//             'line-color': '#3bb2d0',
//             'line-width': 2
//         }
//     },
//     {
//         'id': 'gl-draw-line-active',
//         'type': 'line',
//         'filter': ['all', ['==', '$type', 'LineString'],
//             ['==', 'active', 'true']
//         ],
//         'layout': {
//             'line-cap': 'round',
//             'line-join': 'round'
//         },
//         'paint': {
//             'line-color': '#fbb03b',
//             'line-dasharray': [0.2, 2],
//             'line-width': 2
//         }
//     },
//     {
//         'id': 'gl-draw-polygon-and-line-vertex-stroke-inactive',
//         'type': 'circle',
//         'filter': ['all', ['==', 'meta', 'vertex'],
//             ['==', '$type', 'Point'],
//             ['!=', 'mode', 'static']
//         ],
//         'paint': {
//             'circle-radius': 5,
//             'circle-color': '#fff'
//         }
//     },
//     {
//         'id': 'gl-draw-polygon-and-line-vertex-inactive',
//         'type': 'circle',
//         'filter': ['all', ['==', 'meta', 'vertex'],
//             ['==', '$type', 'Point'],
//             ['!=', 'mode', 'static']
//         ],
//         'paint': {
//             'circle-radius': 3,
//             'circle-color': '#fbb03b'
//         }
//     },
//     {
//         'id': 'gl-draw-point-point-stroke-inactive',
//         'type': 'circle',
//         'filter': ['all', ['==', 'active', 'false'],
//             ['==', '$type', 'Point'],
//             ['==', 'meta', 'feature'],
//             ['!=', 'mode', 'static']
//         ],
//         'paint': {
//             'circle-radius': 5,
//             'circle-opacity': 1,
//             'circle-color': '#fff'
//         }
//     },
//     {
//         'id': 'gl-draw-point-inactive',
//         'type': 'circle',
//         'filter': ['all', ['==', 'active', 'false'],
//             ['==', '$type', 'Point'],
//             ['==', 'meta', 'feature'],
//             ['!=', 'mode', 'static']
//         ],
//         'paint': {
//             'circle-radius': 3,
//             'circle-color': '#3bb2d0'
//         }
//     },
//     {
//         'id': 'gl-draw-point-stroke-active',
//         'type': 'circle',
//         'filter': ['all', ['==', '$type', 'Point'],
//             ['==', 'active', 'true'],
//             ['!=', 'meta', 'midpoint']
//         ],
//         'paint': {
//             'circle-radius': 7,
//             'circle-color': '#fff'
//         }
//     },
//     {
//         'id': 'gl-draw-point-active',
//         'type': 'circle',
//         'filter': ['all', ['==', '$type', 'Point'],
//             ['!=', 'meta', 'midpoint'],
//             ['==', 'active', 'true']
//         ],
//         'paint': {
//             'circle-radius': 5,
//             'circle-color': '#fbb03b'
//         }
//     },
//     {
//         'id': 'gl-draw-polygon-fill-static',
//         'type': 'fill',
//         'filter': ['all', ['==', 'mode', 'static'],
//             ['==', '$type', 'Polygon']
//         ],
//         'paint': {
//             'fill-color': '#404040',
//             'fill-outline-color': '#404040',
//             'fill-opacity': 0.1
//         }
//     },
//     {
//         'id': 'gl-draw-polygon-stroke-static',
//         'type': 'line',
//         'filter': ['all', ['==', 'mode', 'static'],
//             ['==', '$type', 'Polygon']
//         ],
//         'layout': {
//             'line-cap': 'round',
//             'line-join': 'round'
//         },
//         'paint': {
//             'line-color': '#404040',
//             'line-width': 2
//         }
//     },
//     {
//         'id': 'gl-draw-line-static',
//         'type': 'line',
//         'filter': ['all', ['==', 'mode', 'static'],
//             ['==', '$type', 'LineString']
//         ],
//         'layout': {
//             'line-cap': 'round',
//             'line-join': 'round'
//         },
//         'paint': {
//             'line-color': '#404040',
//             'line-width': 2
//         }
//     },
//     {
//         'id': 'gl-draw-point-static',
//         'type': 'circle',
//         'filter': ['all', ['==', 'mode', 'static'],
//             ['==', '$type', 'Point']
//         ],
//         'paint': {
//             'circle-radius': 5,
//             'circle-color': '#404040'
//         }
//     }
// ]