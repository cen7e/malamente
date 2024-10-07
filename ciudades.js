// Creación de la instancia Vue
const app = Vue.createApp({
    data() {
        return {
            title: "Explora Ciudades",
            citySearch: '', // Entrada del usuario para la búsqueda de la ciudad
            suggestions: [] // Lista de sugerencias de ciudades
        };
    },
    methods: {
        // Función para normalizar las cadenas y eliminar acentos/tildes
        normalizeString(str) {
            return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
        },
        // Función para buscar sugerencias de ciudades usando la API de Nominatim
        searchCity() {
            if (this.citySearch.length > 2) {
                fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(this.citySearch)}&format=json&addressdetails=1&limit=50&accept-language=es`)
                    .then(response => response.json())
                    .then(data => {
                        const searchNormalized = this.normalizeString(this.citySearch); // Normaliza el texto ingresado
                        const uniqueCities = new Set(); // Para evitar duplicados
                        
                        // Filtrar las ciudades localmente y evitar duplicados
                        this.suggestions = data
                            .filter(suggestion => {
                                const city = suggestion.address.city || suggestion.address.town || suggestion.address.village;
                                if (city) {
                                    const cityNormalized = this.normalizeString(city); // Normaliza la ciudad
                                    // Comprobar si ya está en el Set de ciudades únicas
                                    if (!uniqueCities.has(cityNormalized) && cityNormalized.includes(searchNormalized)) {
                                        uniqueCities.add(cityNormalized); // Añadir ciudad al Set
                                        return true;
                                    }
                                }
                                return false;
                            })
                            .map(suggestion => {
                                const city = suggestion.address.city || suggestion.address.town || suggestion.address.village;
                                const country = suggestion.address.country || 'País desconocido';
                                return {
                                    displayText: `${city}, ${country}`, // Solo muestra la ciudad y el país
                                    lat: suggestion.lat, // Latitud
                                    lon: suggestion.lon // Longitud
                                };
                            });
                    })
                    .catch(error => console.error('Error al obtener sugerencias:', error));
            } else {
                this.suggestions = [];
            }
        },
        // Función para seleccionar una ciudad y redirigir
        selectCity(suggestion) {
            window.location.href = `mapa.html?lat=${suggestion.lat}&lon=${suggestion.lon}`;
        },
        // Función para obtener la ubicación actual del usuario
        getCurrentLocation() {
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition((position) => {
                    const lat = position.coords.latitude;
                    const lon = position.coords.longitude;
                    window.location.href = `mapa.html?lat=${lat}&lon=${lon}`;
                }, () => {
                    alert('No se pudo obtener la ubicación');
                });
            } else {
                alert('La geolocalización no es compatible con este navegador');
            }
        },
        goToCity(city) {
            window.location.href = `mapa.html?city=${city}`;
        }
    },
    watch: {
        citySearch() {
            this.searchCity();
        }
    }
}).mount('#app');
