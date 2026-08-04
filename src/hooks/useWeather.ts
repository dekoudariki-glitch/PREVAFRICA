import { useState, useEffect, useCallback } from 'react';
import { WeatherService, WeatherData } from '../services/weatherService';

export function useWeather(country: string, active: boolean) {
  const [weather, setWeather] = useState<WeatherData>(() => {
    try {
      return WeatherService.getSimulatedWeather(country);
    } catch (e) {
      return { temp: 29, description: 'Ensoleillé, idéal pour les récoltes', humidity: 75, wind: 12, rain: 0, source: 'simulation' };
    }
  });
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);

  useEffect(() => {
    let isMounted = true;
    if (!active) return;

    try {
      setLoading(true);
      setError('');

      Promise.resolve()
        .then(() => WeatherService.getWeather(country))
        .then(data => {
          if (isMounted && data) {
            setWeather(data);
            setLoading(false);
          }
        })
        .catch(err => {
          if (isMounted) {
            console.error("useWeather hook failed safely:", err);
            setError("Données météo synchronisées en mode local.");
            setWeather(WeatherService.getSimulatedWeather(country));
            setLoading(false);
          }
        });
    } catch (err) {
      if (isMounted) {
        console.error("useWeather effect error caught safely:", err);
        setWeather(WeatherService.getSimulatedWeather(country));
        setLoading(false);
      }
    }

    return () => {
      isMounted = false;
    };
  }, [country, active, refreshTrigger]);

  const refresh = useCallback(() => {
    try {
      setRefreshTrigger(prev => prev + 1);
    } catch (e) {}
  }, []);

  return {
    weather,
    loading,
    error,
    refresh
  };
}
