import { Injectable } from '@angular/core';
import { WeatherData, WeatherForecast } from '../models/sanvii.models';

@Injectable({ providedIn: 'root' })
export class WeatherService {

  async getWeather(city: string): Promise<WeatherData | null> {
    try {
      const response = await fetch(
        `https://wttr.in/${encodeURIComponent(city)}?format=j1`
      );

      if (!response.ok) return null;

      const data = await response.json();
      const current = data.current_condition[0];

      const weather: WeatherData = {
        city: data.nearest_area?.[0]?.areaName?.[0]?.value || city,
        temp: parseInt(current.temp_C),
        feelsLike: parseInt(current.FeelsLikeC),
        humidity: parseInt(current.humidity),
        wind: parseInt(current.windspeedKmph),
        description: current.weatherDesc[0].value,
        icon: this.getWeatherEmoji(current.weatherDesc[0].value),
        forecast: data.weather?.slice(0, 3).map((d: any) => ({
          day: new Date(d.date).toLocaleDateString('en-US', { weekday: 'short' }),
          temp: parseInt(d.avgtempC),
          desc: d.hourly?.[4]?.weatherDesc?.[0]?.value || ''
        }))
      };

      return weather;
    } catch (err) {
      console.error('Weather error:', err);
      return null;
    }
  }

  getWeatherEmoji(desc: string): string {
    const d = desc.toLowerCase();
    if (d.includes('sunny') || d.includes('clear')) return '☀️';
    if (d.includes('cloud')) return '☁️';
    if (d.includes('rain') || d.includes('drizzle')) return '🌧️';
    if (d.includes('thunder') || d.includes('storm')) return '⛈️';
    if (d.includes('snow')) return '❄️';
    if (d.includes('fog') || d.includes('mist')) return '🌫️';
    if (d.includes('overcast')) return '🌥️';
    if (d.includes('partly')) return '⛅';
    return '🌤️';
  }

  formatWeatherCard(w: WeatherData): string {
    let text = `Weather in ${w.city}:\n`;
    text += `${w.icon} ${w.description}\n`;
    text += `🌡️ ${w.temp}°C (Feels like ${w.feelsLike}°C)\n`;
    text += `💧 Humidity: ${w.humidity}%\n`;
    text += `💨 Wind: ${w.wind} km/h`;

    if (w.forecast && w.forecast.length > 0) {
      text += '\n\nForecast:';
      w.forecast.forEach((f: WeatherForecast) => {
        text += `\n${f.day}: ${f.temp}°C ${this.getWeatherEmoji(f.desc)}`;
      });
    }

    return text;
  }
}