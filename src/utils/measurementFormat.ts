import type {
  HeightUnit,
  TemperatureUnit,
  VolumeUnit,
  WeightUnit,
} from "../types/appSettings";
import { getAppSettings } from "./appSettingsStore";

function cleanNumber(value: number, digits = 1): string {
  return Number(value.toFixed(digits)).toString();
}

export function volumeFromMl(value: string | number, unit: VolumeUnit): string {
  const numeric = typeof value === "number" ? value : Number.parseFloat(value);
  if (!Number.isFinite(numeric)) return String(value);
  return unit === "oz" ? cleanNumber(numeric / 29.5735) : cleanNumber(numeric, 0);
}

export function volumeToMl(value: string | number, unit: VolumeUnit): string {
  const numeric = typeof value === "number" ? value : Number.parseFloat(value);
  if (!Number.isFinite(numeric)) return String(value);
  return unit === "oz" ? cleanNumber(numeric * 29.5735, 0) : cleanNumber(numeric, 0);
}

export function formatVolume(value: string | number, unit = getAppSettings().units.volume): string {
  return `${volumeFromMl(value, unit)}${unit}`;
}

export function temperatureFromCelsius(value: string | number, unit: TemperatureUnit): string {
  const numeric = typeof value === "number" ? value : Number.parseFloat(value);
  if (!Number.isFinite(numeric)) return String(value);
  return unit === "f" ? cleanNumber((numeric * 9) / 5 + 32) : cleanNumber(numeric);
}

export function temperatureToCelsius(value: string | number, unit: TemperatureUnit): string {
  const numeric = typeof value === "number" ? value : Number.parseFloat(value);
  if (!Number.isFinite(numeric)) return String(value);
  return unit === "f" ? cleanNumber(((numeric - 32) * 5) / 9) : cleanNumber(numeric);
}

export function formatTemperature(
  value: string | number,
  unit = getAppSettings().units.temperature,
): string {
  return `${temperatureFromCelsius(value, unit)}°${unit === "c" ? "C" : "F"}`;
}

export function formatWeight(
  value: string | number,
  unit: WeightUnit = getAppSettings().units.weight,
): string {
  const numeric = typeof value === "number" ? value : Number.parseFloat(value);
  if (!Number.isFinite(numeric)) return `${value}${unit}`;
  return unit === "lb" ? `${cleanNumber(numeric * 2.20462)}lb` : `${cleanNumber(numeric)}kg`;
}

export function formatHeight(
  value: string | number,
  unit: HeightUnit = getAppSettings().units.height,
): string {
  const numeric = typeof value === "number" ? value : Number.parseFloat(value);
  if (!Number.isFinite(numeric)) return `${value}${unit}`;
  return unit === "inch"
    ? `${cleanNumber(numeric / 2.54)}inch`
    : `${cleanNumber(numeric)}cm`;
}

export function weightToKg(value: string | number, unit: WeightUnit): number | undefined {
  const numeric = typeof value === "number" ? value : Number.parseFloat(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return undefined;
  return Number((unit === "lb" ? numeric / 2.20462 : numeric).toFixed(3));
}

export function weightFromKg(value: number, unit: WeightUnit): string {
  return cleanNumber(unit === "lb" ? value * 2.20462 : value, 1);
}

export function lengthToCm(value: string | number, unit: "cm" | "in" | "inch"): number | undefined {
  const numeric = typeof value === "number" ? value : Number.parseFloat(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return undefined;
  return Number((unit === "cm" ? numeric : numeric * 2.54).toFixed(2));
}

export function lengthFromCm(value: number, unit: "cm" | "in" | "inch"): string {
  return cleanNumber(unit === "cm" ? value : value / 2.54, 1);
}
