document.addEventListener("DOMContentLoaded", function() {
    var previousSelections = {};
    var map; // Definir la variable del mapa en el ámbito global
    var highlightedLayers = [];
    var streetNames = {};
    var activePopup = null;

    function getCoordinatesFromUrl() {
        const params = new URLSearchParams(window.location.search);
        const lat = params.get('lat');
        const lon = params.get('lon');
        const city = params.get('city');

        const cityCoordinates = {
            "cordoba": [37.8882, -4.7794],
            "malaga": [36.7213, -4.4216],
            "sevilla": [37.3891, -5.9845],
            "madrid": [40.4168, -3.7038],
            "nueva_york": [40.7128, -74.0060],
            "paris": [48.8566, 2.3522],
            "tokio": [35.6895, 139.6917]
        };

        if (lat && lon) {
            return [parseFloat(lat), parseFloat(lon)];
        } else if (city && cityCoordinates[city.toLowerCase()]) {
            return cityCoordinates[city.toLowerCase()];
        }
        return [37.8882, -4.7794];
    }

    function initializeMap(coords) {
        // Verificar si el mapa ya está inicializado
        if (map) {
            map.off(); // Eliminar eventos del mapa
            map.remove(); // Destruir el mapa
        }

        // Inicializar el mapa
        map = L.map('map').setView(coords, 13);

        // Capa satélite de Esri
        var satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            maxZoom: 19,
            attribution: '© Esri, Maxar, Earthstar Geographics, and the GIS User Community'
        }).addTo(map);

        // Capa de nombres de calles
        var streetsLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
        });

        var streetsVisible = false;

        // Verificar que el interruptor para mostrar/ocultar calles existe
        var toggleStreetNames = document.getElementById('toggle-street-names');
        if (toggleStreetNames) {
            toggleStreetNames.addEventListener('change', function() {
                if (streetsVisible) {
                    map.removeLayer(streetsLayer);
                } else {
                    map.addLayer(streetsLayer);
                }
                streetsVisible = !streetsVisible;
            });
        }

        // Cargar las calles desde Overpass
        fetch('https://overpass-api.de/api/interpreter?data=[out:json];way["highway"~"motorway|motorway_link|trunk|trunk_link|primary|primary_link|secondary|secondary_link|tertiary|residential|living_street|pedestrian|footway"](' + getBoundsFromCoords(coords) + ');out geom;')
            .then(response => response.json())
            .then(data => {
                var geojsonLayer = L.geoJSON(overpassToGeoJSON(data), {
                    style: function(feature) {
                        return { 
                            color: 'turquoise', 
                            weight: 7
                        };
                    },
                    onEachFeature: function(feature, layer) {
                        if (feature.properties.name) {
                            if (!streetNames[feature.properties.name]) {
                                streetNames[feature.properties.name] = [];
                            }
                            streetNames[feature.properties.name].push(layer);

                            // Eventos para resaltar calles al pasar el cursor
                            layer.on('mouseover', function() {
                                if (!activePopup) {
                                    streetNames[feature.properties.name].forEach(function(streetLayer) {
                                        if (!previousSelections[streetLayer._leaflet_id]) {
                                            streetLayer.setStyle({ color: 'blue', weight: 7 });
                                        }
                                    });
                                }
                            });

                            layer.on('mouseout', function() {
                                if (!activePopup) {
                                    streetNames[feature.properties.name].forEach(function(streetLayer) {
                                        if (!previousSelections[streetLayer._leaflet_id]) {
                                            streetLayer.setStyle({ color: 'transparent', weight: 5 });
                                        }
                                    });
                                }
                            });

                            layer.on('click', function(e) {
                                selectStreet(feature.properties.name, streetNames[feature.properties.name]);
                            });
                        } else {
                            map.removeLayer(layer);
                        }
                    }
                }).addTo(map);

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
                }, 3000);
            })
            .catch(error => console.error('Error al cargar los datos:', error));
    }

    // Obtener las coordenadas de la URL
    var initialCoords = getCoordinatesFromUrl();
    initializeMap(initialCoords);

    // Verificar que el botón de calle aleatoria existe
    var randomStreetButton = document.getElementById('random-street-btn');
    if (randomStreetButton) {
        randomStreetButton.addEventListener('click', function() {
            selectRandomStreet();
        });
    }

    function selectRandomStreet() {
        var streetNamesArray = Object.keys(streetNames);
        if (streetNamesArray.length === 0) return;

        var randomStreetName = streetNamesArray[Math.floor(Math.random() * streetNamesArray.length)];
        selectStreet(randomStreetName, streetNames[randomStreetName]);
    }

    function selectStreet(streetName, layers) {
        highlightedLayers.forEach(function(layer) {
            if (layer.options.color === 'blue') {
                layer.setStyle({ color: 'transparent', weight: 5 });
            }
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

    function getBoundsFromCoords(coords) {
        var lat = coords[0];
        var lon = coords[1];
        var latOffset = 0.05;
        var lonOffset = 0.05;
        return (lat - latOffset) + ',' + (lon - lonOffset) + ',' + (lat + latOffset) + ',' + (lon + lonOffset);
    }
});
