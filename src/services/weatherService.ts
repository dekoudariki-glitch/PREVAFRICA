export interface WeatherData {
  temp: number;
  humidity: number;
  wind: number;
  rain: number;
  description: string;
  source: 'simulation' | 'api' | 'cache';
}

const inMemoryWeatherCache: Record<string, string> = {};

const safeLocalStorage = {
  getItem: (key: string): string | null => {
    try {
      if (typeof window !== 'undefined') {
        const val = window.localStorage ? window.localStorage.getItem(key) : null;
        if (val) return val;
      }
    } catch (e) {
      console.warn("localStorage is not accessible in WeatherService", e);
    }
    return inMemoryWeatherCache[key] || null;
  },
  setItem: (key: string, value: string): void => {
    try {
      inMemoryWeatherCache[key] = value;
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
      }
    } catch (e) {
      console.warn("localStorage setItem failed in WeatherService", e);
    }
  }
};

export class WeatherService {
  private static CACHE_KEY_PREFIX = 'prevafrica_weather_';
  private static CACHE_EXPIRY_MS = 30 * 60 * 1000; // 30 minutes

  public static getSimulatedWeather(country: string): WeatherData {
    try {
      const safeP = typeof country === 'string' && country ? country : 'Sénégal';
      let hours = 12;
      try {
        hours = new Date().getHours();
      } catch (e) {}

      const today = new Date().toDateString();
      const seedString = safeP + today;
      const seed = seedString.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      
      let baseTemp = 28;
      let baseHum = 70;
      let baseVent = 12;
      let basePluie = 0;
      let desc = 'Ensoleillé, idéal pour les récoltes';
      
      // Sahel / Desert climates (very hot, dry)
      if (['Burkina Faso', 'Niger', 'Mali', 'Tchad'].includes(safeP)) {
        baseTemp = 34 + (seed % 4); // 34-37°C
        baseHum = 35 + (seed % 15);  // 35-50%
        baseVent = 15 + (seed % 10); // 15-25 km/h
        desc = 'Chaud et Sec, surveillez l\'évaporation des cultures';
      }
      // Equatorial / Humid climates (warm, high humidity, frequent rain)
      else if (['Congo', 'Cameroun', 'Gabon', 'Centrafrique'].includes(safeP)) {
        baseTemp = 25 + (seed % 3);  // 25-27°C
        baseHum = 80 + (seed % 10);  // 80-90%
        baseVent = 8 + (seed % 6);   // 8-14 km/h
        basePluie = seed % 2 === 0 ? 3 + (seed % 5) : 0; // occasional rain
        desc = basePluie > 0 ? 'Averses tropicales de saison' : 'Humide et Nuageux, conditions favorables';
      }
      // Coastal West Africa (balanced, tropical)
      else {
        baseTemp = 28 + (seed % 3);  // 28-30°C
        baseHum = 65 + (seed % 15);  // 65-80%
        baseVent = 12 + (seed % 8);  // 12-20 km/h
        desc = 'Ensoleillé avec brise marine, idéal pour le tallage';
      }
      
      // Temperature variation based on hour of the day
      let hourDiff = 0;
      if (hours >= 20 || hours < 6) {
        hourDiff = -5; // cooler at night
      } else if (hours >= 11 && hours <= 15) {
        hourDiff = 3;  // hotter in afternoon
      }
      
      const finalTemp = Math.round(baseTemp + hourDiff);
      
      return {
        temp: finalTemp,
        description: desc,
        humidity: baseHum,
        wind: baseVent,
        rain: basePluie,
        source: 'simulation'
      };
    } catch (err) {
      console.warn("getSimulatedWeather fallback triggered:", err);
      return {
        temp: 29,
        humidity: 75,
        wind: 12,
        rain: 0,
        description: 'Ensoleillé, idéal pour les récoltes',
        source: 'simulation'
      };
    }
  }

  public static async getWeather(country: string): Promise<WeatherData> {
    try {
      const safeCountry = typeof country === 'string' && country ? country : 'Sénégal';
      
      // 1. Try local storage cache first
      try {
        const cached = safeLocalStorage.getItem(`${this.CACHE_KEY_PREFIX}${safeCountry}`);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed && typeof parsed === 'object' && parsed.data) {
            const { data, timestamp } = parsed;
            if (typeof timestamp === 'number' && Date.now() - timestamp < this.CACHE_EXPIRY_MS) {
              return {
                temp: typeof data.temp === 'number' ? data.temp : 29,
                humidity: typeof data.humidity === 'number' ? data.humidity : 75,
                wind: typeof data.wind === 'number' ? data.wind : 12,
                rain: typeof data.rain === 'number' ? data.rain : 0,
                description: typeof data.description === 'string' ? data.description : 'Ensoleillé',
                source: 'cache'
              };
            }
          }
        }
      } catch (e) {
        console.warn("WeatherService cache read failed:", e);
      }

      // 2. Generate simulated weather model
      const weather = this.getSimulatedWeather(safeCountry);

      // 3. Save to cache
      try {
        safeLocalStorage.setItem(`${this.CACHE_KEY_PREFIX}${safeCountry}`, JSON.stringify({
          data: weather,
          timestamp: Date.now()
        }));
      } catch (e) {
        console.warn("WeatherService cache write failed:", e);
      }

      return {
        ...weather,
        source: 'simulation'
      };
    } catch (err) {
      console.warn("getWeather fallback triggered:", err);
      return {
        temp: 29,
        humidity: 75,
        wind: 12,
        rain: 0,
        description: 'Ensoleillé, idéal pour les récoltes',
        source: 'simulation'
      };
    }
  }
}
