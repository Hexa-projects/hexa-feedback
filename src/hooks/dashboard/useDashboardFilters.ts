import { useCallback, useEffect, useState } from "react";
import { getRangeForPreset, type DateRange } from "@/lib/kpi-utils";

export type PresetKey = "today" | "7d" | "30d" | "mtd" | "qtd" | "ytd";

export interface DashboardFilters {
  preset: PresetKey;
  range: DateRange;
  setor: string; // "Todos" or setor name
  responsavelId: string; // "Todos" or user id
  cliente: string; // free text
}

const STORAGE_KEY = "hexaos:dashboardFilters";

function loadFilters(): DashboardFilters {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw) as Partial<DashboardFilters>;
      const preset: PresetKey = (saved.preset as PresetKey) || "30d";
      return {
        preset,
        range: getRangeForPreset(preset),
        setor: saved.setor || "Todos",
        responsavelId: saved.responsavelId || "Todos",
        cliente: saved.cliente || "",
      };
    }
  } catch { /* ignore */ }
  return {
    preset: "30d",
    range: getRangeForPreset("30d"),
    setor: "Todos",
    responsavelId: "Todos",
    cliente: "",
  };
}

export function useDashboardFilters() {
  const [filters, setFiltersState] = useState<DashboardFilters>(loadFilters);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      preset: filters.preset,
      setor: filters.setor,
      responsavelId: filters.responsavelId,
      cliente: filters.cliente,
    }));
  }, [filters]);

  const setPreset = useCallback((preset: PresetKey) => {
    setFiltersState(f => ({ ...f, preset, range: getRangeForPreset(preset) }));
  }, []);

  const setSetor = useCallback((setor: string) => {
    setFiltersState(f => ({ ...f, setor }));
  }, []);

  const setResponsavel = useCallback((id: string) => {
    setFiltersState(f => ({ ...f, responsavelId: id }));
  }, []);

  const setCliente = useCallback((c: string) => {
    setFiltersState(f => ({ ...f, cliente: c }));
  }, []);

  const reset = useCallback(() => {
    setFiltersState({
      preset: "30d",
      range: getRangeForPreset("30d"),
      setor: "Todos",
      responsavelId: "Todos",
      cliente: "",
    });
  }, []);

  return { filters, setPreset, setSetor, setResponsavel, setCliente, reset };
}
