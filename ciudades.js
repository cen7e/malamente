document.addEventListener("DOMContentLoaded", function() {
    const searchInput = document.getElementById('city-search');
    const suggestionsContainer = document.getElementById('suggestions');

    // Función para obtener sugerencias de Nominatim
    searchInput.addEventListener('input', function() {
        const query = searchInput.value;
        if (query.length > 2) {
            fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=5&accept-language=es`)
                .then(response => response.json())
                .then(data => {
                    displaySuggestions(data);
                })
                .catch(error => console.error('Error al obtener sugerencias:', error));
        } else {
            suggestionsContainer.innerHTML = '';
        }
    });

    // Función para mostrar las sugerencias
    function displaySuggestions(suggestions) {
        suggestionsContainer.innerHTML = '';
        const ul = document.createElement('ul');

        suggestions.forEach(suggestion => {
            // Verificar si tiene información de ciudad o país
            const address = suggestion.address;
            const cityName = address.city || address.town || address.village || address.hamlet || address.county || address.state_district || address.state;
            const countryName = address.country;

            // Si tenemos al menos el país, mostramos la sugerencia
            if (countryName) {
                const li = document.createElement('li');
                let displayText = '';

                if (cityName) {
                    displayText = `${cityName}, ${countryName}`;
                } else {
                    // Si no hay nombre de ciudad, usamos el display_name limitado
                    displayText = suggestion.display_name.split(', ').slice(0, 2).join(', ');
                }

                li.textContent = displayText;
                li.addEventListener('click', function() {
                    const coords = [suggestion.lat, suggestion.lon];
                    window.location.href = `mapa.html?lat=${coords[0]}&lon=${coords[1]}`;
                });
                ul.appendChild(li);
            }
        });

        if (ul.children.length > 0) {
            suggestionsContainer.appendChild(ul);
        } else {
            suggestionsContainer.innerHTML = '<p>No se encontraron resultados.</p>';
        }
    }

    // Función para buscar una ciudad manualmente
    document.getElementById('search-button').addEventListener('click', function() {
        const cityName = searchInput.value;
        fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(cityName)}&format=json&addressdetails=1&limit=1&accept-language=es`)
            .then(response => response.json())
            .then(data => {
                if (data.length > 0) {
                    const suggestion = data[0];
                    const coords = [suggestion.lat, suggestion.lon];
                    window.location.href = `mapa.html?lat=${coords[0]}&lon=${coords[1]}`;
                } else {
                    alert('Ciudad no encontrada');
                }
            })
            .catch(error => console.error('Error al buscar la ciudad:', error));
    });

    // Función para obtener la ubicación actual del usuario
    document.getElementById('current-location').addEventListener('click', function() {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(function(position) {
                const lat = position.coords.latitude;
                const lon = position.coords.longitude;
                window.location.href = `mapa.html?lat=${lat}&lon=${lon}`;
            }, function() {
                alert('No se pudo obtener la ubicación');
            });
        } else {
            alert('La geolocalización no es compatible con este navegador');
        }
    });

    // Ocultar sugerencias cuando se hace clic fuera
    document.addEventListener('click', function(event) {
        if (!suggestionsContainer.contains(event.target) && event.target !== searchInput) {
            suggestionsContainer.innerHTML = '';
        }
    });
});
