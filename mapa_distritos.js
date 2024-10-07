document.addEventListener("DOMContentLoaded", function() {
    const urlParams = new URLSearchParams(window.location.search);
    const city = urlParams.get('city') || 'cordoba'; // Ciudad por defecto: Córdoba
    const zone = urlParams.get('zone') || 'distrito-centro'; // Distrito por defecto: Distrito Centro

    var map;
    var satelliteLayer;
    var streetsLayer;
    var districtBounds;
    var streetNames = {};
    var highlightedLayers = [];
    var activePopup = null;
    var previousSelections = {};
    var streetsVisible = false;

    fetch('distritos.json')
        .then(response => response.json())
        .then(data => {
            const district = data[city][zone];
            if (district) {
                map = L.map('map');

                // Capa satélite de Esri
                satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
                    maxZoom: 19,
                    attribution: '© Esri, Maxar, Earthstar Geographics, and the GIS User Community'
                }).addTo(map);

                // Capa de nombres de calles
                streetsLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    maxZoom: 19
                });

                districtBounds = L.latLngBounds(district.coordenadas);
                
                map.setView(districtBounds.getCenter(), 14); // Inicializar con el centro del distrito

                const polygonCoordinates = 'poly:"' + district.coordenadas.map(coord => coord.join(' ')).join(' ') + '"';

                // Filtrado de tipos de vías
                fetch('https://overpass-api.de/api/interpreter?data=[out:json];way["highway"~"motorway|motorway_link|trunk|trunk_link|primary|primary_link|secondary|secondary_link|tertiary|residential|living_street|pedestrian|footway"](' + polygonCoordinates + ');out geom;')
                    .then(response => response.json())
                    .then(data => {
                        var geojsonLayer = L.geoJSON(overpassToGeoJSON(data), {
                            style: function(feature) {
                                return { color: 'turquoise', weight: 7 };
                            },
                            onEachFeature: function(feature, layer) {
                                if (feature.properties && feature.properties.name) {
                                    if (!streetNames[feature.properties.name]) {
                                        streetNames[feature.properties.name] = [];
                                    }
                                    streetNames[feature.properties.name].push(layer);

                                    // Resaltar todos los tramos de la calle en azul al pasar el ratón
                                    layer.on('mouseover', function() {
                                        if (!activePopup) {
                                            streetNames[feature.properties.name].forEach(function(streetLayer) {
                                                if (!previousSelections[streetLayer._leaflet_id]) {
                                                    streetLayer.setStyle({ color: 'blue', weight: 7 });
                                                }
                                            });
                                        }
                                    });

                                    // Restaurar el color original al quitar el ratón
                                    layer.on('mouseout', function() {
                                        if (!activePopup) {
                                            streetNames[feature.properties.name].forEach(function(streetLayer) {
                                                if (!previousSelections[streetLayer._leaflet_id]) {
                                                    streetLayer.setStyle({ color: 'transparent', weight: 5 });
                                                }
                                            });
                                        }
                                    });

                                    // Seleccionar la calle al hacer clic
                                    layer.on('click', function() {
                                        selectStreet(feature.properties.name, streetNames[feature.properties.name]);
                                    });
                                }
                            }
                        }).addTo(map);

                        // Mostrar mensaje con el número de calles cargadas
                        const streetCount = Object.keys(streetNames).length;
                        const messagePopup = L.popup()
                            .setLatLng(map.getCenter())
                            .setContent(`Número de calles cargadas: ${streetCount}`)
                            .openOn(map);

                        setTimeout(function() {
                            geojsonLayer.eachLayer(function(layer) {
                                layer.setStyle({ color: 'transparent' });
                            });
                            map.closePopup(messagePopup);
                            map.setZoom(map.getZoom() + 2);

                            const worldPolygon = [
                                [[-90, -180], [90, -180], [90, 180], [-90, 180]],
                                district.coordenadas
                            ];

                            L.polygon(worldPolygon, {
                                color: 'white',
                                weight: 3,
                                fillColor: 'rgba(30, 30, 30, 0.85)',
                                fillRule: 'evenodd'
                            }).addTo(map);
                        }, 3000);
                    })
                    .catch(error => {
                        console.error('Error al cargar los datos de Overpass:', error);
                    });
            } else {
                console.error("Distrito no encontrado en los datos JSON.");
            }
        })
        .catch(error => {
            console.error('Error al cargar el archivo JSON:', error);
        });

    // Función para seleccionar una calle aleatoria
    function selectRandomStreet() {
        var streetNamesArray = Object.keys(streetNames);
        if (streetNamesArray.length === 0) return;

        // Elegir una calle aleatoria
        var randomStreetName = streetNamesArray[Math.floor(Math.random() * streetNamesArray.length)];
        selectStreet(randomStreetName, streetNames[randomStreetName]);
    }

    // Evento para el botón de calle aleatoria
    document.getElementById('random-street-btn').addEventListener('click', function() {
        try {
            selectRandomStreet();
        } catch (error) {
            console.error('Error al seleccionar calle aleatoria:', error);
        }
    });

    // Función para alternar la visibilidad de las calles
    document.getElementById('toggle-street-names').addEventListener('change', function() {
        if (streetsVisible) {
            map.removeLayer(streetsLayer);
        } else {
            map.addLayer(streetsLayer);
        }
        streetsVisible = !streetsVisible;
    });

    // Definición de funciones

    function selectStreet(streetName, layers) {
        highlightedLayers.forEach(function(layer) {
            layer.setStyle({ color: previousSelections[layer._leaflet_id] || 'grey', weight: 5 });
        });
        highlightedLayers = [];

        var bounds = L.latLngBounds();
        layers.forEach(function(layer) {
            bounds.extend(layer.getBounds());
            layer.setStyle({ color: 'blue', weight: 7 });
            highlightedLayers.push(layer);
        });
        map.fitBounds(bounds);

        var options = generateOptions(streetName, Object.keys(streetNames));
        showPopup(options, layers);
    }

    function handleAnswer(selectedOption, layers) {
        var correctName = layers[0].feature.properties.name;
        var message = "";

        var correctSound = new Audio('sounds/correct.mp3');
        var incorrectSound = new Audio('sounds/incorrect.mp3');

        layers.forEach(function(layer) {
            if (selectedOption === correctName) {
                if (previousSelections[layer._leaflet_id] === 'red') {
                    layer.setStyle({ color: 'yellow', weight: 7 });
                    previousSelections[layer._leaflet_id] = 'yellow';
                    message = `¡Ahora sí! La calle es ${correctName}`;
                    correctSound.play();
                } else {
                    layer.setStyle({ color: 'green', weight: 7 });
                    previousSelections[layer._leaflet_id] = 'green';
                    message = `¡Bien hecho! La calle es ${correctName}`;
                    correctSound.play();
                }
            } else {
                layer.setStyle({ color: 'red', weight: 7 });
                previousSelections[layer._leaflet_id] = 'red';
                message = `¡Lo siento! La calle es ${correctName}`;
                incorrectSound.play();
            }
        });

        displayMessagePopup(message);
    }

    function generateOptions(correctName, streetNamesArray) {
        var options = [correctName];
        while (options.length < 3) {
            var randomOption = streetNamesArray[Math.floor(Math.random() * streetNamesArray.length)];
            if (!options.includes(randomOption)) {
                options.push(randomOption);
            }
        }
        return shuffleArray(options);
    }

    function shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    function showPopup(options, layers) {
        var popupContent = "";
        options.forEach(function(option) {
            popupContent += `<button class="popup-option minimalista">${option}</button><br>`;
        });

        var popup = L.popup()
            .setLatLng(layers[0].getBounds().getCenter())
            .setContent(popupContent)
            .openOn(map);

        activePopup = popup;

        document.querySelectorAll('.popup-option').forEach(function(button) {
            button.addEventListener('click', function() {
                handleAnswer(button.textContent, layers);
                map.closePopup(popup);
                activePopup = null;
            });
        });
    }

    function displayMessagePopup(message) {
        var popupContainer = document.createElement('div');
        popupContainer.className = 'message-popup minimalista';
        popupContainer.innerHTML = `<div class="message-popup-content"><p>${message}</p></div>`;
        document.body.appendChild(popupContainer);

        setTimeout(function() {
            if (popupContainer) {
                popupContainer.remove();
            }
        }, 3000);
    }

    function overpassToGeoJSON(data) {
        var geojson = {
            type: 'FeatureCollection',
            features: []
        };

        data.elements.forEach(function(element) {
            if (element.type === 'way' && element.geometry) {
                var feature = {
                    type: 'Feature',
                    properties: {
                        id: element.id,
                        name: element.tags.name || null
                    },
                    geometry: {
                        type: 'LineString',
                        coordinates: element.geometry.map(function(coord) {
                            return [coord.lon, coord.lat];
                        })
                    }
                };
                geojson.features.push(feature);
            }
        });

        return geojson;
    }

});
