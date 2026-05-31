'use client';

import type { Poi } from '@/lib/services/indoorRouting';

interface PoiSelectProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Poi[];
  disabled?: boolean;
}

function formatPoiOption(poi: Poi): string {
  if (poi.isOutdoor) return `${poi.label || poi.name} · Outdoor`;

  const mappedRoomName = poi.room_name && poi.room_name !== poi.name ? `${poi.room_name} · ` : '';
  const roomCode = poi.room_code ? ` (${poi.room_code})` : '';
  const roomType = poi.room_type || poi.category;

  return `${mappedRoomName}${poi.name}${roomCode} · Floor ${poi.floor_id} · ${roomType}`;
}

export function PoiSelect({
  id,
  label,
  value,
  onChange,
  options,
  disabled = false,
}: PoiSelectProps) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-medium text-gray-700">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-gray-100"
      >
        <option value="">Selecionar um POI</option>
        {options.map((poi) => (
          <option key={poi.id} value={String(poi.id)}>
            {formatPoiOption(poi)}
          </option>
        ))}
      </select>
    </div>
  );
}
